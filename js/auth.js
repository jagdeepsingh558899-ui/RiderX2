/* ============================================================
   RIDERX 2.0
   AUTHENTICATION ENGINE
   File: js/auth.js

   CANONICAL AUTHENTICATION ENGINE

   SOURCE OF TRUTH
   ------------------------------------------------------------
   Firebase Authentication
       -> identity / login session

   Firestore /users/{uid}
       -> RiderX profile / role / account status

   localStorage
       -> UI cache ONLY

   SUPPORTS
   ------------------------------------------------------------
   - Customer
   - Rider
   - Admin
   - Superadmin
   - Email registration
   - Email login
   - Phone OTP
   - Firestore profile creation
   - Existing profile recovery
   - Role validation
   - Auth state listener
   - Session cache
   - Logout
   - Password reset
   - Profile update
   - Route guards
   - Rider approval guard
   - Legacy RiderX compatibility APIs

   SECURITY
   ------------------------------------------------------------
   localStorage is NEVER trusted for authentication.

   The Firebase user is the identity source.

   The Firestore /users/{uid} profile is the application
   role/profile source.

   Admin authorization MUST also be enforced by Firebase
   Security Rules / trusted backend logic.

   This file does NOT initialize Firebase.

   Firebase initialization belongs ONLY to:
       firebase/firebase-config.js
============================================================ */

"use strict";


/* ============================================================
   FIREBASE
============================================================ */

import * as FB from "../firebase/firebase-config.js";


/* ============================================================
   CONSTANTS
============================================================ */

const ROLES = Object.freeze({

    CUSTOMER:
        "customer",

    RIDER:
        "rider",

    ADMIN:
        "admin",

    SUPERADMIN:
        "superadmin"

});


const NORMAL_USER_ROLES = Object.freeze([

    ROLES.CUSTOMER,

    ROLES.RIDER

]);


const ADMIN_ROLES = Object.freeze([

    ROLES.ADMIN,

    ROLES.SUPERADMIN

]);


/* ============================================================
   LOCAL STORAGE KEYS
   ------------------------------------------------------------
   These values are cache only.
   They must NEVER be used as authentication authority.
============================================================ */

const STORAGE = Object.freeze({

    user:
        "riderx_user",

    customer:
        "riderx_customer",

    rider:
        "riderx_rider",

    role:
        "riderx_role",

    selectedRole:
        "riderx_selected_role",

    uid:
        "riderx_uid",

    customerId:
        "riderx_customer_id",

    riderId:
        "riderx_rider_id",

    session:
        "riderx_session",

    otpPhone:
        "riderx_otp_phone",

    pendingRole:
        "riderx_pending_role",

    pendingEmail:
        "riderx_pending_email",

    pendingName:
        "riderx_pending_name",

    authReady:
        "riderx_auth_ready"

});


/* ============================================================
   ROUTES
============================================================ */

const ROUTES = Object.freeze({

    role:
        "auth/role.html",

    login:
        "auth/login.html",

    register:
        "auth/register.html",

    customerHome:
        "customer/home.html",

    riderHome:
        "rider/home.html",

    riderPending:
        "rider/pending.html",

    adminDashboard:
        "admin/dashboard.html",

    index:
        "index.html"

});


/* ============================================================
   MEMORY STATE
============================================================ */

let currentUser = null;

let currentProfile = null;

let currentRole = "";

let authInitialized = false;

let authInitPromise = null;

let authListenerStarted = false;

let authListeners = [];

let otpConfirmationResult = null;


/* ============================================================
   SAFE VALUE HELPERS
============================================================ */

function safeString(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();

}


function safeLower(value) {

    return safeString(value)
        .toLowerCase();

}


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


function safeBoolean(
    value,
    fallback = false
) {

    return typeof value === "boolean"
        ? value
        : fallback;

}


/* ============================================================
   LOCAL STORAGE
============================================================ */

function storageGet(key) {

    try {

        return localStorage.getItem(
            key
        );

    } catch (error) {

        console.warn(
            "RiderX storage read failed:",
            error
        );

        return null;

    }

}


function storageSet(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            String(value)
        );

        return true;

    } catch (error) {

        console.warn(
            "RiderX storage write failed:",
            error
        );

        return false;

    }

}


function storageRemove(key) {

    try {

        localStorage.removeItem(
            key
        );

    } catch (error) {

        console.warn(
            "RiderX storage remove failed:",
            error
        );

    }

}


function storageGetJSON(
    key,
    fallback = null
) {

    const value =
        storageGet(key);

    if (!value) {

        return fallback;

    }

    try {

        return JSON.parse(
            value
        );

    } catch (error) {

        storageRemove(key);

        return fallback;

    }

}


function storageSetJSON(
    key,
    value
) {

    try {

        return storageSet(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        return false;

    }

}


/* ============================================================
   ROUTE RESOLUTION
============================================================ */

function resolveRoute(route) {

    const value =
        safeString(route);

    if (!value) {

        return value;

    }

    /*
     * Preserve:
     * - absolute URLs
     * - root URLs
     * - anchors
     * - mailto
     * - tel
     */

    if (
        /^(https?:|mailto:|tel:|#|\/)/i.test(
            value
        )
    ) {

        return value;

    }

    try {

        /*
         * auth.js is located at:
         *
         * /js/auth.js
         *
         * "../customer/home.html"
         * "../rider/home.html"
         * "../auth/login.html"
         *
         * therefore resolve from repository root.
         */

        return new URL(
            "../" + value,
            import.meta.url
        ).href;

    } catch (error) {

        console.warn(
            "RiderX route resolution failed:",
            error
        );

        return value;

    }

}


/* ============================================================
   ROLE NORMALIZATION
============================================================ */

function normalizeRole(value) {

    const role =
        safeLower(value)
            .replace(
                /[\s-]+/g,
                "_"
            );

    if (
        [
            "customer",
            "customers",
            "user",
            "users",
            "passenger",
            "client"
        ].includes(role)
    ) {

        return ROLES.CUSTOMER;

    }

    if (
        [
            "rider",
            "riders",
            "driver",
            "drivers",
            "captain",
            "partner",
            "driver_partner",
            "driverpartner"
        ].includes(role)
    ) {

        return ROLES.RIDER;

    }

    if (
        [
            "admin",
            "administrator"
        ].includes(role)
    ) {

        return ROLES.ADMIN;

    }

    if (
        [
            "superadmin",
            "super_admin",
            "superadministrator"
        ].includes(role)
    ) {

        return ROLES.SUPERADMIN;

    }

    return "";

}


/* ============================================================
   PHONE NORMALIZATION
============================================================ */

function normalizePhone(value) {

    let phone =
        safeString(value);

    if (!phone) {

        return "";

    }

    phone =
        phone.replace(
            /[\s()-]/g,
            ""
        );

    if (
        phone.startsWith("+")
    ) {

        const digits =
            phone
                .slice(1)
                .replace(
                    /\D/g,
                    ""
                );

        if (
            digits.length >= 10 &&
            digits.length <= 15
        ) {

            return "+" + digits;

        }

        return "";

    }

    const digits =
        phone.replace(
            /\D/g,
            ""
        );

    if (
        digits.length === 10
    ) {

        return "+91" + digits;

    }

    if (
        digits.startsWith("91") &&
        digits.length === 12
    ) {

        return "+" + digits;

    }

    return "";

}


/* ============================================================
   EMAIL
============================================================ */

function normalizeEmail(value) {

    return safeString(value)
        .toLowerCase();

}


function validateEmail(email) {

    const value =
        normalizeEmail(email);

    if (!value) {

        return {

            valid:
                false,

            message:
                "Email is required."

        };

    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            value
        )
    ) {

        return {

            valid:
                false,

            message:
                "Please enter a valid email address."

        };

    }

    return {

        valid:
            true,

        message:
            ""

    };

}


function validatePassword(password) {

    const value =
        safeString(password);

    if (
        value.length < 6
    ) {

        return {

            valid:
                false,

            message:
                "Password must be at least 6 characters."

        };

    }

    return {

        valid:
            true,

        message:
            ""

    };

}


/* ============================================================
   FIREBASE ERROR TRANSLATION
============================================================ */

function getErrorMessage(error) {

    if (!error) {

        return "Something went wrong.";

    }

    const code =
        safeString(error.code);

    const messages = {

        "auth/invalid-email":
            "Please enter a valid email address.",

        "auth/user-disabled":
            "This account has been disabled.",

        "auth/user-not-found":
            "No RiderX account was found with these details.",

        "auth/wrong-password":
            "Incorrect email or password.",

        "auth/invalid-credential":
            "Incorrect email or password.",

        "auth/invalid-login-credentials":
            "Incorrect email or password.",

        "auth/email-already-in-use":
            "This email is already registered.",

        "auth/weak-password":
            "Password is too weak.",

        "auth/network-request-failed":
            "Network error. Please check your internet connection.",

        "auth/too-many-requests":
            "Too many attempts. Please try again later.",

        "auth/operation-not-allowed":
            "This authentication method is currently unavailable.",

        "auth/invalid-phone-number":
            "Please enter a valid phone number.",

        "auth/invalid-verification-code":
            "The OTP is incorrect.",

        "auth/code-expired":
            "The OTP has expired. Please request a new OTP.",

        "auth/missing-verification-code":
            "Please enter the OTP.",

        "auth/missing-phone-number":
            "Please enter your phone number.",

        "auth/quota-exceeded":
            "OTP service limit reached. Please try again later.",

        "auth/captcha-check-failed":
            "Captcha verification failed. Please try again.",

        "auth/popup-blocked":
            "The authentication popup was blocked.",

        "auth/popup-closed-by-user":
            "The authentication window was closed.",

        "auth/cancelled-popup-request":
            "The authentication request was cancelled.",

        "auth/requires-recent-login":
            "Please login again before performing this action.",

        "auth/account-exists-with-different-credential":
            "This email is already connected to another sign-in method.",

        "auth/credential-already-in-use":
            "This authentication credential is already in use.",

        "permission-denied":
            "You do not have permission to access this account.",

        "failed-precondition":
            "Firebase service configuration is incomplete.",

        "unavailable":
            "Firebase service is temporarily unavailable.",

        "riderx/role-mismatch":
            "This account belongs to a different RiderX role.",

        "riderx/profile-missing":
            "Your RiderX account profile is incomplete.",

        "riderx/account-blocked":
            "This account has been blocked or suspended."

    };

    return (
        messages[code] ||
        safeString(error.message) ||
        "Authentication failed."
    );

}


/* ============================================================
   FIREBASE AVAILABILITY
============================================================ */

function firebaseReady() {

    return Boolean(

        FB &&
        FB.auth &&
        typeof FB.signInWithEmailAndPassword ===
            "function"

    );

}


function firestoreReady() {

    return Boolean(

        FB &&
        FB.db &&
        typeof FB.doc ===
            "function" &&
        typeof FB.getDoc ===
            "function" &&
        typeof FB.setDoc ===
            "function"

    );

}


/* ============================================================
   CURRENT USER
============================================================ */

function getUser() {

    if (currentUser) {

        return currentUser;

    }

    try {

        return (
            FB.auth?.currentUser ||
            null
        );

    } catch (error) {

        return null;

    }

}


function getProfile() {

    return currentProfile;

}


function getRole() {

    return currentRole;

}


function getUid() {

    return getUser()?.uid || "";

}


/* ============================================================
   PROFILE NORMALIZATION
============================================================ */

function normalizeProfile(
    profile = {},
    user = null
) {

    const source =
        profile &&
        typeof profile === "object"
            ? profile
            : {};

    const role =
        normalizeRole(

            source.role ||
            source.userRole ||
            source.accountType ||
            source.userType ||
            source.type

        );

    const name =
        safeString(

            source.name ||
            source.fullName ||
            source.displayName ||
            user?.displayName

        );

    const phone =
        safeString(

            source.phone ||
            source.phoneNumber ||
            user?.phoneNumber

        );

    return {

        ...source,

        uid:
            user?.uid ||
            source.uid ||
            "",

        email:
            source.email ||
            user?.email ||
            "",

        name,

        fullName:
            source.fullName ||
            name,

        displayName:
            source.displayName ||
            name,

        phone,

        phoneNumber:
            source.phoneNumber ||
            phone,

        role,

        userRole:
            role ||
            source.userRole ||
            "",

        accountType:
            role ||
            source.accountType ||
            "",

        status:
            source.status ||
            "active",

        walletBalance:
            safeNumber(
                source.walletBalance,
                0
            ),

        rating:
            safeNumber(
                source.rating,
                5
            )

    };

}


/* ============================================================
   FIRESTORE USER REFERENCE
============================================================ */

function getUserRef(uid) {

    if (
        !firestoreReady()
    ) {

        throw new Error(
            "Firestore is not available. Check firebase-config.js."
        );

    }

    return FB.doc(
        FB.db,
        "users",
        uid
    );

}


/* ============================================================
   GET USER PROFILE
============================================================ */

async function getUserProfile(user) {

    if (!user?.uid) {

        return null;

    }

    const snapshot =
        await FB.getDoc(
            getUserRef(
                user.uid
            )
        );

    if (
        !snapshot.exists()
    ) {

        return null;

    }

    return normalizeProfile(
        snapshot.data(),
        user
    );

}


/* ============================================================
   SAVE USER PROFILE
============================================================ */

async function saveUserProfile(
    user,
    profile,
    merge = true
) {

    if (!user?.uid) {

        throw new Error(
            "Authenticated user is required."
        );

    }

    const normalized =
        normalizeProfile(
            profile,
            user
        );

    if (
        !normalized.role
    ) {

        throw new Error(
            "User profile role is missing."
        );

    }

    await FB.setDoc(

        getUserRef(
            user.uid
        ),

        {

            ...normalized,

            updatedAt:
                Date.now()

        },

        {
            merge
        }

    );

    currentProfile =
        normalized;

    return normalized;

}


/* ============================================================
   CREATE USER PROFILE
============================================================ */

async function createUserProfile(
    user,
    role,
    extra = {}
) {

    const normalizedRole =
        normalizeRole(role);

    if (
        !NORMAL_USER_ROLES.includes(
            normalizedRole
        )
    ) {

        throw new Error(
            "Please select Customer or Rider."
        );

    }

    const name =
        safeString(

            extra.name ||
            extra.fullName ||
            extra.displayName ||
            user.displayName

        );

    const phone =
        normalizePhone(

            extra.phone ||
            extra.phoneNumber ||
            user.phoneNumber

        );

    const now =
        Date.now();

    const profile = {

        uid:
            user.uid,

        email:
            user.email || "",

        name,

        fullName:
            name,

        displayName:
            name,

        phone,

        phoneNumber:
            phone,

        role:
            normalizedRole,

        userRole:
            normalizedRole,

        accountType:
            normalizedRole,

        status:
            "active",

        online:
            false,

        city:
            safeString(
                extra.city
            ) ||
            "Chandigarh",

        rating:
            safeNumber(
                extra.rating,
                5
            ),

        totalRides:
            safeNumber(
                extra.totalRides,
                0
            ),

        completedRides:
            safeNumber(
                extra.completedRides,
                0
            ),

        cancelledRides:
            safeNumber(
                extra.cancelledRides,
                0
            ),

        walletBalance:
            safeNumber(
                extra.walletBalance,
                0
            ),

        createdAt:
            now,

        updatedAt:
            now

    };


    /*
     * Riders are not automatically approved.
     *
     * Registration creates a pending rider account.
     * Admin approval is handled separately.
     */

    if (
        normalizedRole ===
        ROLES.RIDER
    ) {

        profile.approved =
            safeBoolean(
                extra.approved,
                false
            );

        profile.isApproved =
            safeBoolean(
                extra.isApproved,
                false
            );

        profile.approvalStatus =
            safeString(
                extra.approvalStatus
            ) ||
            "pending";

    }


    return saveUserProfile(
        user,
        profile,
        true
    );

}


/* ============================================================
   ROLE MISMATCH ERROR
============================================================ */

function createRoleMismatchError(
    selectedRole,
    actualRole
) {

    const error =
        new Error(
            `This account is registered as ${actualRole}, not ${selectedRole}.`
        );

    error.code =
        "riderx/role-mismatch";

    error.selectedRole =
        selectedRole;

    error.actualRole =
        actualRole;

    return error;

}


/* ============================================================
   ACCOUNT STATUS
============================================================ */

function isAccountBlocked(
    profile
) {

    if (!profile) {

        return false;

    }

    return (

        profile.disabled === true ||
        profile.blocked === true ||
        profile.suspended === true ||

        [
            "blocked",
            "suspended",
            "disabled"
        ].includes(
            safeLower(
                profile.status
            )
        )

    );

}


/* ============================================================
   RIDER APPROVAL
============================================================ */

function isRiderApproved(
    profile
) {

    if (

        !profile ||

        normalizeRole(
            profile.role
        ) !== ROLES.RIDER

    ) {

        return false;

    }

    if (
        isAccountBlocked(
            profile
        )
    ) {

        return false;

    }

    const status =
        safeLower(

            profile.approvalStatus ||
            profile.riderStatus ||
            ""

        );

    return (

        profile.approved === true ||
        profile.isApproved === true ||
        profile.adminApproved === true ||
        status === "approved"

    );

}


/* ============================================================
   CACHE SESSION
============================================================ */

function cacheAuthenticatedSession(
    user,
    profile,
    role
) {

    const normalizedRole =
        normalizeRole(

            role ||
            profile?.role

        );

    if (!normalizedRole) {

        return false;

    }

    const session = {

        uid:
            user?.uid ||
            profile?.uid ||
            "",

        role:
            normalizedRole,

        email:
            user?.email ||
            profile?.email ||
            "",

        displayName:
            user?.displayName ||
            profile?.displayName ||
            profile?.name ||
            "",

        phone:
            user?.phoneNumber ||
            profile?.phone ||
            profile?.phoneNumber ||
            "",

        updatedAt:
            Date.now()

    };


    storageSetJSON(
        STORAGE.session,
        session
    );

    storageSet(
        STORAGE.uid,
        session.uid
    );

    storageSet(
        STORAGE.role,
        normalizedRole
    );

    storageSet(
        STORAGE.selectedRole,
        normalizedRole
    );


    if (
        normalizedRole ===
        ROLES.CUSTOMER
    ) {

        storageSet(
            STORAGE.customerId,
            session.uid
        );

        storageSetJSON(
            STORAGE.customer,
            {
                ...profile,
                ...session
            }
        );

        storageRemove(
            STORAGE.riderId
        );

        storageRemove(
            STORAGE.rider
        );

    }


    if (
        normalizedRole ===
        ROLES.RIDER
    ) {

        storageSet(
            STORAGE.riderId,
            session.uid
        );

        storageSetJSON(
            STORAGE.rider,
            {
                ...profile,
                ...session
            }
        );

        storageRemove(
            STORAGE.customerId
        );

        storageRemove(
            STORAGE.customer
        );

    }


    if (
        ADMIN_ROLES.includes(
            normalizedRole
        )
    ) {

        storageRemove(
            STORAGE.customerId
        );

        storageRemove(
            STORAGE.riderId
        );

        storageRemove(
            STORAGE.customer
        );

        storageRemove(
            STORAGE.rider
        );

    }


    storageSetJSON(
        STORAGE.user,
        {
            ...profile,
            ...session
        }
    );

    storageSet(
        STORAGE.authReady,
        "true"
    );

    return true;

}


/* ============================================================
   CLEAR SESSION CACHE
============================================================ */

function clearSessionCache() {

    [

        STORAGE.user,
        STORAGE.customer,
        STORAGE.rider,
        STORAGE.role,
        STORAGE.selectedRole,
        STORAGE.uid,
        STORAGE.customerId,
        STORAGE.riderId,
        STORAGE.session,
        STORAGE.authReady

    ].forEach(
        storageRemove
    );

}


/* ============================================================
   CLEAR AUTH MEMORY
============================================================ */

function clearAuthMemory() {

    currentUser =
        null;

    currentProfile =
        null;

    currentRole =
        "";

}


/* ============================================================
   OTP CLEANUP
============================================================ */

function clearOtpState() {

    otpConfirmationResult =
        null;

    storageRemove(
        STORAGE.otpPhone
    );

    storageRemove(
        STORAGE.pendingRole
    );

    storageRemove(
        STORAGE.pendingEmail
    );

    storageRemove(
        STORAGE.pendingName
    );

}


/* ============================================================
   FINALIZE AUTHENTICATED USER
============================================================ */

async function finalizeAuthenticatedUser(
    user,
    options = {}
) {

    if (!user?.uid) {

        throw new Error(
            "Authentication user is missing."
        );

    }

    const requestedRole =
        normalizeRole(
            options.selectedRole
        );

    let profile =
        await getUserProfile(
            user
        );

    let role =
        normalizeRole(
            profile?.role
        );


    /* --------------------------------------------------------
       EXISTING PROFILE
    -------------------------------------------------------- */

    if (
        profile &&
        role
    ) {

        if (

            requestedRole &&

            NORMAL_USER_ROLES.includes(
                requestedRole
            ) &&

            NORMAL_USER_ROLES.includes(
                role
            ) &&

            requestedRole !== role

        ) {

            throw createRoleMismatchError(
                requestedRole,
                role
            );

        }


        if (
            isAccountBlocked(
                profile
            )
        ) {

            const error =
                new Error(
                    "This account has been blocked or suspended."
                );

            error.code =
                "riderx/account-blocked";

            throw error;

        }


        currentUser =
            user;

        currentProfile =
            profile;

        currentRole =
            role;

        cacheAuthenticatedSession(
            user,
            profile,
            role
        );


        return {

            authenticated:
                true,

            configured:
                true,

            user,

            profile,

            role

        };

    }


    /* --------------------------------------------------------
       MISSING PROFILE
       --------------------------------------------------------
       A role may only be used to create a new profile when
       the caller explicitly allows it.

       Login NEVER gets this fallback.
    -------------------------------------------------------- */

    if (

        !profile &&

        options.allowSelectedRoleFallback ===
            true &&

        NORMAL_USER_ROLES.includes(
            requestedRole
        )

    ) {

        profile =
            await createUserProfile(
                user,
                requestedRole,
                options.profile ||
                {}
            );

        role =
            normalizeRole(
                profile.role
            );

        currentUser =
            user;

        currentProfile =
            profile;

        currentRole =
            role;

        cacheAuthenticatedSession(
            user,
            profile,
            role
        );


        return {

            authenticated:
                true,

            configured:
                true,

            user,

            profile,

            role

        };

    }


    /* --------------------------------------------------------
       PROFILE MISSING
       -------------------------------------------------------- */

    currentUser =
        user;

    currentProfile =
        null;

    currentRole =
        "";

    return {

        authenticated:
            true,

        configured:
            false,

        user,

        profile:
            null,

        role:
            ""

    };

}


/* ============================================================
   SAFE FIREBASE SIGN OUT
============================================================ */

async function safeFirebaseSignOut() {

    try {

        if (

            FB.auth &&

            typeof FB.signOut ===
                "function"

        ) {

            await FB.signOut(
                FB.auth
            );

        }

    } catch (error) {

        console.warn(
            "RiderX Firebase sign-out failed:",
            error
        );

    }

}


/* ============================================================
   SAFE DELETE CURRENT FIREBASE USER
   ------------------------------------------------------------
   Used only for rollback when a newly created Firebase
   account cannot get its required Firestore profile.
============================================================ */

async function safeDeleteCurrentFirebaseUser() {

    try {

        const user =
            getUser();

        if (

            user &&

            typeof FB.deleteUser ===
                "function"

        ) {

            await FB.deleteUser(
                user
            );

            return true;

        }

    } catch (error) {

        console.warn(
            "RiderX Firebase account rollback failed:",
            error
        );

    }

    return false;

}


/* ============================================================
   EMAIL REGISTRATION
============================================================ */

async function registerWithEmail(
    options = {}
) {

    const name =
        safeString(

            options.name ||
            options.fullName ||
            options.displayName

        );

    const email =
        normalizeEmail(
            options.email
        );

    const password =
        safeString(
            options.password
        );

    const role =
        normalizeRole(

            options.role ||
            options.selectedRole

        );


    const emailValidation =
        validateEmail(
            email
        );

    if (
        !emailValidation.valid
    ) {

        throw new Error(
            emailValidation.message
        );

    }


    const passwordValidation =
        validatePassword(
            password
        );

    if (
        !passwordValidation.valid
    ) {

        throw new Error(
            passwordValidation.message
        );

    }


    if (
        !NORMAL_USER_ROLES.includes(
            role
        )
    ) {

        throw new Error(
            "Please select Customer or Rider."
        );

    }


    if (

        !FB.auth ||

        typeof FB.createUserWithEmailAndPassword !==
            "function"

    ) {

        throw new Error(
            "Firebase Authentication is not available. Check firebase-config.js."
        );

    }


    storageSet(
        STORAGE.selectedRole,
        role
    );

    storageSet(
        STORAGE.pendingRole,
        role
    );

    storageSet(
        STORAGE.pendingEmail,
        email
    );

    storageSet(
        STORAGE.pendingName,
        name
    );


    let credential;

    try {

        credential =
            await FB.createUserWithEmailAndPassword(
                FB.auth,
                email,
                password
            );

    } catch (error) {

        storageRemove(
            STORAGE.pendingRole
        );

        storageRemove(
            STORAGE.pendingEmail
        );

        storageRemove(
            STORAGE.pendingName
        );

        throw error;

    }


    const user =
        credential.user;


    /*
     * Update Firebase Authentication display name.
     */

    if (

        name &&

        typeof FB.updateProfile ===
            "function"

    ) {

        try {

            await FB.updateProfile(
                user,
                {
                    displayName:
                        name
                }
            );

        } catch (error) {

            console.warn(
                "RiderX display name update failed:",
                error
            );

        }

    }


    let profile;

    try {

        profile =
            await createUserProfile(
                user,
                role,
                {

                    name,

                    fullName:
                        name,

                    displayName:
                        name,

                    phone:
                        options.phone ||
                        options.phoneNumber ||
                        user.phoneNumber ||
                        "",

                    city:
                        options.city ||
                        "Chandigarh"

                }
            );

    } catch (error) {

        /*
         * IMPORTANT:
         * Never leave a Firebase Auth account without its
         * required RiderX profile when registration fails.
         */

        const deleted =
            await safeDeleteCurrentFirebaseUser();

        if (!deleted) {

            await safeFirebaseSignOut();

        }

        clearAuthMemory();

        clearSessionCache();

        storageRemove(
            STORAGE.pendingRole
        );

        storageRemove(
            STORAGE.pendingEmail
        );

        storageRemove(
            STORAGE.pendingName
        );

        throw error;

    }


    currentUser =
        user;

    currentProfile =
        profile;

    currentRole =
        role;


    cacheAuthenticatedSession(
        user,
        profile,
        role
    );


    clearOtpState();


    notifyAuthListeners(
        getState()
    );


    return {

        user,

        profile,

        role

    };

}


/* ============================================================
   EMAIL LOGIN
============================================================ */

async function loginWithEmail(
    options = {}
) {

    const email =
        normalizeEmail(
            options.email
        );

    const password =
        safeString(
            options.password
        );

    const selectedRole =
        normalizeRole(

            options.role ||
            options.selectedRole ||
            storageGet(
                STORAGE.selectedRole
            )

        );


    const validation =
        validateEmail(
            email
        );

    if (
        !validation.valid
    ) {

        throw new Error(
            validation.message
        );

    }


    if (!password) {

        throw new Error(
            "Password is required."
        );

    }


    if (

        !FB.auth ||

        typeof FB.signInWithEmailAndPassword !==
            "function"

    ) {

        throw new Error(
            "Email/password authentication is not available. Check firebase-config.js."
        );

    }


    if (
        NORMAL_USER_ROLES.includes(
            selectedRole
        )
    ) {

        storageSet(
            STORAGE.selectedRole,
            selectedRole
        );

    }


    let credential;

    try {

        credential =
            await FB.signInWithEmailAndPassword(
                FB.auth,
                email,
                password
            );

    } catch (error) {

        throw error;

    }


    const user =
        credential.user;


    let result;

    try {

        result =
            await finalizeAuthenticatedUser(
                user,
                {

                    selectedRole,

                    /*
                     * NEVER create a missing profile during
                     * ordinary login.
                     */

                    allowSelectedRoleFallback:
                        false

                }
            );

    } catch (error) {

        await safeFirebaseSignOut();

        clearAuthMemory();

        clearSessionCache();

        throw error;

    }


    if (
        !result.configured
    ) {

        await safeFirebaseSignOut();

        clearAuthMemory();

        clearSessionCache();


        const error =
            new Error(
                "Your RiderX account profile is incomplete. Please complete registration or contact support."
            );

        error.code =
            "riderx/profile-missing";

        throw error;

    }


    cacheAuthenticatedSession(
        result.user,
        result.profile,
        result.role
    );


    notifyAuthListeners(
        result
    );


    return result;

}


/* ============================================================
   LEGACY EMAIL LOGIN
============================================================ */

async function loginEmail(
    email,
    password,
    role = ""
) {

    return loginWithEmail({

        email,

        password,

        role

    });

}


/* ============================================================
   PASSWORD RESET
============================================================ */

async function sendPasswordReset(
    email
) {

    const normalizedEmail =
        normalizeEmail(
            email
        );

    const validation =
        validateEmail(
            normalizedEmail
        );

    if (
        !validation.valid
    ) {

        throw new Error(
            validation.message
        );

    }


    if (

        !FB.auth ||

        typeof FB.sendPasswordResetEmail !==
            "function"

    ) {

        throw new Error(
            "Password reset service is unavailable."
        );

    }


    await FB.sendPasswordResetEmail(
        FB.auth,
        normalizedEmail
    );


    return true;

}


/* ============================================================
   PHONE OTP
============================================================ */

async function sendPhoneOtp(
    options = {}
) {

    const phone =
        normalizePhone(

            options.phone ||
            options.phoneNumber

        );

    const role =
        normalizeRole(

            options.role ||
            options.selectedRole

        );


    if (!phone) {

        throw new Error(
            "Please enter a valid phone number."
        );

    }


    if (
        !NORMAL_USER_ROLES.includes(
            role
        )
    ) {

        throw new Error(
            "Please select Customer or Rider."
        );

    }


    const verifier =
        options.recaptchaVerifier ||
        options.appVerifier;


    if (!verifier) {

        throw new Error(
            "OTP verification is not ready. Please try again."
        );

    }


    if (

        !FB.auth ||

        typeof FB.signInWithPhoneNumber !==
            "function"

    ) {

        throw new Error(
            "Phone OTP authentication is not available."
        );

    }


    otpConfirmationResult =
        null;


    otpConfirmationResult =
        await FB.signInWithPhoneNumber(

            FB.auth,

            phone,

            verifier

        );


    storageSet(
        STORAGE.otpPhone,
        phone
    );

    storageSet(
        STORAGE.pendingRole,
        role
    );


    return {

        phone,

        role,

        sent:
            true

    };

}


/* ============================================================
   VERIFY PHONE OTP
============================================================ */

async function verifyPhoneOtp(
    options = {}
) {

    const code =
        safeString(

            options.code ||
            options.otp

        );


    const requestedRole =
        normalizeRole(

            options.role ||
            options.selectedRole ||
            storageGet(
                STORAGE.pendingRole
            )

        );


    if (!code) {

        throw new Error(
            "Please enter the OTP."
        );

    }


    if (
        !otpConfirmationResult
    ) {

        throw new Error(
            "OTP session expired. Please request a new OTP."
        );

    }


    if (
        !NORMAL_USER_ROLES.includes(
            requestedRole
        )
    ) {

        throw new Error(
            "Please select Customer or Rider."
        );

    }


    let credential;

    try {

        credential =
            await otpConfirmationResult.confirm(
                code
            );

    } catch (error) {

        throw error;

    }


    /*
     * Firebase confirmation result must not be reused.
     */

    otpConfirmationResult =
        null;


    const firebaseUser =
        credential.user;


    let profile;


    try {

        profile =
            await getUserProfile(
                firebaseUser
            );

    } catch (error) {

        await safeFirebaseSignOut();

        clearAuthMemory();

        clearSessionCache();

        clearOtpState();

        throw error;

    }


    /* --------------------------------------------------------
       NEW PHONE ACCOUNT
    -------------------------------------------------------- */

    if (!profile) {

        try {

            profile =
                await createUserProfile(
                    firebaseUser,
                    requestedRole,
                    {

                        phone:
                            firebaseUser.phoneNumber ||
                            storageGet(
                                STORAGE.otpPhone
                            )

                    }
                );

        } catch (error) {

            const deleted =
                await safeDeleteCurrentFirebaseUser();

            if (!deleted) {

                await safeFirebaseSignOut();

            }

            clearAuthMemory();

            clearSessionCache();

            clearOtpState();

            throw error;

        }

    } else {

        const existingRole =
            normalizeRole(
                profile.role
            );


        if (!existingRole) {

            await safeFirebaseSignOut();

            clearAuthMemory();

            clearSessionCache();

            clearOtpState();


            const error =
                new Error(
                    "Your RiderX account profile does not contain a valid role."
                );

            error.code =
                "riderx/profile-missing";

            throw error;

        }


        if (

            NORMAL_USER_ROLES.includes(
                existingRole
            ) &&

            existingRole !==
                requestedRole

        ) {

            await safeFirebaseSignOut();

            clearAuthMemory();

            clearSessionCache();

            clearOtpState();


            throw createRoleMismatchError(
                requestedRole,
                existingRole
            );

        }


        if (
            isAccountBlocked(
                profile
            )
        ) {

            await safeFirebaseSignOut();

            clearAuthMemory();

            clearSessionCache();

            clearOtpState();


            const error =
                new Error(
                    "This account has been blocked or suspended."
                );

            error.code =
                "riderx/account-blocked";

            throw error;

        }

    }


    const result =
        await finalizeAuthenticatedUser(
            firebaseUser,
            {

                selectedRole:
                    requestedRole,

                allowSelectedRoleFallback:
                    false

            }
        );


    if (
        !result.configured
    ) {

        await safeFirebaseSignOut();

        clearAuthMemory();

        clearSessionCache();

        clearOtpState();


        const error =
            new Error(
                "Your RiderX account profile is incomplete."
            );

        error.code =
            "riderx/profile-missing";

        throw error;

    }


    clearOtpState();


    cacheAuthenticatedSession(
        result.user,
        result.profile,
        result.role
    );


    notifyAuthListeners(
        result
    );


    return result;

}


/* ============================================================
   LOGOUT
============================================================ */

async function logout(
    options = {}
) {

    await safeFirebaseSignOut();

    clearAuthMemory();

    clearSessionCache();

    clearOtpState();


    if (

        options.redirect !== false &&

        typeof window !==
            "undefined"

    ) {

        window.location.replace(

            resolveRoute(

                options.redirectTo ||
                ROUTES.login

            )

        );

    }


    return true;

}


/* ============================================================
   UPDATE PROFILE
============================================================ */

async function updateProfile(
    updates = {}
) {

    const user =
        getUser();


    if (!user) {

        throw new Error(
            "Please login first."
        );

    }


    const profile =
        await getUserProfile(
            user
        );


    if (!profile) {

        throw new Error(
            "User profile was not found."
        );

    }


    const allowed = {};


    const name =
        safeString(

            updates.name ||
            updates.fullName ||
            updates.displayName

        );


    if (name) {

        allowed.name =
            name;

        allowed.fullName =
            name;

        allowed.displayName =
            name;

    }


    if (
        updates.photoURL !==
        undefined
    ) {

        allowed.photoURL =
            safeString(
                updates.photoURL
            );

    }


    if (

        updates.phone !==
            undefined ||

        updates.phoneNumber !==
            undefined

    ) {

        const phone =
            normalizePhone(

                updates.phone ||
                updates.phoneNumber

            );


        if (!phone) {

            throw new Error(
                "Please enter a valid phone number."
            );

        }


        allowed.phone =
            phone;

        allowed.phoneNumber =
            phone;

    }


    allowed.updatedAt =
        Date.now();


    const updated =
        await saveUserProfile(

            user,

            {

                ...profile,

                ...allowed

            },

            true

        );


    if (

        name &&

        typeof FB.updateProfile ===
            "function"

    ) {

        try {

            await FB.updateProfile(

                user,

                {

                    displayName:
                        name

                }

            );

        } catch (error) {

            console.warn(
                "RiderX Auth display name update failed:",
                error
            );

        }

    }


    currentUser =
        user;

    currentProfile =
        updated;

    currentRole =
        normalizeRole(
            updated.role
        );


    cacheAuthenticatedSession(

        user,

        updated,

        currentRole

    );


    notifyAuthListeners(
        getState()
    );


    return updated;

}


/* ============================================================
   AUTH STATE
============================================================ */

function getState() {

    const user =
        getUser();


    return {

        authenticated:
            Boolean(user),

        configured:
            Boolean(
                user &&
                currentRole
            ),

        user,

        profile:
            currentProfile,

        role:
            currentRole

    };

}


function notifyAuthListeners(
    state
) {

    for (
        const listener
        of [...authListeners]
    ) {

        try {

            listener(
                state
            );

        } catch (error) {

            console.error(
                "RiderX auth listener failed:",
                error
            );

        }

    }

}


/* ============================================================
   AUTH INITIALIZATION
============================================================ */

function init() {

    /*
     * Once Firebase has delivered its first auth state,
     * return the CURRENT state rather than an old cached result.
     */

    if (
        authInitialized
    ) {

        return Promise.resolve(
            getState()
        );

    }


    if (

        !FB.auth ||

        typeof FB.onAuthStateChanged !==
            "function"

    ) {

        authInitialized =
            true;


        const state = {

            authenticated:
                false,

            configured:
                false,

            user:
                null,

            profile:
                null,

            role:
                ""

        };


        authInitPromise =
            Promise.resolve(
                state
            );


        return authInitPromise;

    }


    if (
        authInitPromise
    ) {

        return authInitPromise;

    }


    if (
        authListenerStarted
    ) {

        return (

            authInitPromise ||

            Promise.resolve(
                getState()
            )

        );

    }


    authListenerStarted =
        true;


    authInitPromise =
        new Promise(
            resolve => {

                let resolved =
                    false;


                FB.onAuthStateChanged(

                    FB.auth,

                    async user => {

                        try {

                            currentUser =
                                user ||
                                null;


                            /*
                             * USER SIGNED OUT
                             */

                            if (!user) {

                                clearAuthMemory();

                                clearSessionCache();


                                const state = {

                                    authenticated:
                                        false,

                                    configured:
                                        false,

                                    user:
                                        null,

                                    profile:
                                        null,

                                    role:
                                        ""

                                };


                                authInitialized =
                                    true;


                                notifyAuthListeners(
                                    state
                                );


                                if (
                                    !resolved
                                ) {

                                    resolved =
                                        true;

                                    resolve(
                                        state
                                    );

                                }


                                return;

                            }


                            /*
                             * USER SIGNED IN
                             *
                             * Read Firestore profile.
                             */

                            let result;


                            try {

                                result =
                                    await finalizeAuthenticatedUser(

                                        user,

                                        {

                                            /*
                                             * Auth listener
                                             * must NEVER invent
                                             * a role.
                                             */

                                            allowSelectedRoleFallback:
                                                false

                                        }

                                    );

                            } catch (error) {

                                console.error(

                                    "RiderX profile initialization failed:",

                                    error

                                );


                                currentUser =
                                    user;

                                currentProfile =
                                    null;

                                currentRole =
                                    "";

                                clearSessionCache();


                                result = {

                                    authenticated:
                                        true,

                                    configured:
                                        false,

                                    user,

                                    profile:
                                        null,

                                    role:
                                        ""

                                };

                            }


                            authInitialized =
                                true;


                            notifyAuthListeners(
                                result
                            );


                            if (
                                !resolved
                            ) {

                                resolved =
                                    true;

                                resolve(
                                    result
                                );

                            }

                        } catch (error) {

                            console.error(

                                "RiderX auth initialization failed:",

                                error

                            );


                            const state = {

                                authenticated:
                                    Boolean(user),

                                configured:
                                    false,

                                user:
                                    user ||
                                    null,

                                profile:
                                    null,

                                role:
                                    ""

                            };


                            authInitialized =
                                true;


                            currentUser =
                                user ||
                                null;

                            currentProfile =
                                null;

                            currentRole =
                                "";

                            clearSessionCache();


                            notifyAuthListeners(
                                state
                            );


                            if (
                                !resolved
                            ) {

                                resolved =
                                    true;

                                resolve(
                                    state
                                );

                            }

                        }

                    }

                );

            }

        );


    return authInitPromise;

}


/* ============================================================
   AUTH LISTENER
============================================================ */

function onAuthStateChanged(
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return () => {};

    }


    authListeners.push(
        callback
    );


    if (
        authInitialized
    ) {

        try {

            callback(
                getState()
            );

        } catch (error) {

            console.error(
                "RiderX auth callback failed:",
                error
            );

        }

    }


    return () => {

        const index =
            authListeners.indexOf(
                callback
            );


        if (
            index !== -1
        ) {

            authListeners.splice(
                index,
                1
            );

        }

    };

}


/* ============================================================
   REFRESH SESSION
============================================================ */

async function refreshSession() {

    const user =
        getUser();


    if (!user) {

        clearAuthMemory();

        clearSessionCache();


        const state =
            getState();


        notifyAuthListeners(
            state
        );


        return state;

    }


    try {

        const profile =
            await getUserProfile(
                user
            );


        if (!profile) {

            currentProfile =
                null;

            currentRole =
                "";

            clearSessionCache();


            const state =
                getState();


            notifyAuthListeners(
                state
            );


            return state;

        }


        const role =
            normalizeRole(
                profile.role
            );


        if (!role) {

            currentProfile =
                null;

            currentRole =
                "";

            clearSessionCache();


            const state =
                getState();


            notifyAuthListeners(
                state
            );


            return state;

        }


        if (
            isAccountBlocked(
                profile
            )
        ) {

            await safeFirebaseSignOut();

            clearAuthMemory();

            clearSessionCache();


            const state =
                getState();


            notifyAuthListeners(
                state
            );


            return state;

        }


        currentUser =
            user;

        currentProfile =
            profile;

        currentRole =
            role;


        cacheAuthenticatedSession(

            user,

            profile,

            role

        );


        const state =
            getState();


        notifyAuthListeners(
            state
        );


        return state;

    } catch (error) {

        console.error(
            "RiderX session refresh failed:",
            error
        );

        return getState();

    }

}


/* ============================================================
   FORCE TOKEN REFRESH
============================================================ */

async function refreshToken() {

    const user =
        getUser();


    if (

        !user ||

        typeof user.getIdToken !==
            "function"

    ) {

        return null;

    }


    return user.getIdToken(
        true
    );

}


/* ============================================================
   DEFAULT ROUTE
============================================================ */

function getDefaultRouteForRole(
    role
) {

    const normalized =
        normalizeRole(role);


    if (
        normalized ===
        ROLES.CUSTOMER
    ) {

        return ROUTES.customerHome;

    }


    if (
        normalized ===
        ROLES.RIDER
    ) {

        return ROUTES.riderHome;

    }


    if (
        ADMIN_ROLES.includes(
            normalized
        )
    ) {

        return ROUTES.adminDashboard;

    }


    return ROUTES.role;

}


/* ============================================================
   AUTH GUARD
============================================================ */

async function requireAuth(
    options = {}
) {

    const state =
        await init();


    const currentState =
        authInitialized
            ? getState()
            : state;


    if (
        !currentState.authenticated
    ) {

        if (

            options.redirect !==
            false &&

            typeof window !==
                "undefined"

        ) {

            window.location.replace(

                resolveRoute(

                    options.redirectTo ||
                    ROUTES.login

                )

            );

        }


        return false;

    }


    if (

        !currentState.configured ||

        !currentState.role

    ) {

        if (

            options.redirect !==
            false &&

            typeof window !==
                "undefined"

        ) {

            window.location.replace(

                resolveRoute(

                    options.profileMissingRedirect ||
                    ROUTES.role

                )

            );

        }


        return false;

    }


    if (
        options.role
    ) {

        const requiredRole =
            normalizeRole(
                options.role
            );


        if (

            !requiredRole ||

            currentState.role !==
                requiredRole

        ) {

            if (

                options.redirect !==
                false &&

                typeof window !==
                    "undefined"

            ) {

                window.location.replace(

                    resolveRoute(

                        getDefaultRouteForRole(

                            currentState.role

                        )

                    )

                );

            }


            return false;

        }

    }


    if (

        options.checkBlocked !==
            false &&

        isAccountBlocked(
            currentState.profile
        )

    ) {

        await logout({

            redirectTo:
                ROUTES.login

        });


        return false;

    }


    if (

        currentState.role ===
            ROLES.RIDER &&

        options.requireApprovedRider ===
            true &&

        !isRiderApproved(
            currentState.profile
        )

    ) {

        if (

            options.redirect !==
            false &&

            typeof window !==
                "undefined"

        ) {

            window.location.replace(

                resolveRoute(
                    ROUTES.riderPending
                )

            );

        }


        return false;

    }


    return true;

}


/* ============================================================
   ROLE GUARDS
============================================================ */

async function requireRole(
    role,
    options = {}
) {

    return requireAuth({

        ...options,

        role

    });

}


async function requireCustomer(
    options = {}
) {

    return requireRole(

        ROLES.CUSTOMER,

        options

    );

}


async function requireRider(
    options = {}
) {

    return requireRole(

        ROLES.RIDER,

        {

            ...options,

            requireApprovedRider:
                options.requireApprovedRider !==
                false

        }

    );

}


async function requireAdmin(
    options = {}
) {

    const state =
        await init();


    const currentState =
        authInitialized
            ? getState()
            : state;


    if (
        !currentState.authenticated
    ) {

        if (

            options.redirect !==
                false &&

            typeof window !==
                "undefined"

        ) {

            window.location.replace(

                resolveRoute(

                    options.redirectTo ||
                    ROUTES.login

                )

            );

        }


        return false;

    }


    const admin =
        ADMIN_ROLES.includes(
            currentState.role
        );


    if (!admin) {

        if (

            options.redirect !==
                false &&

            typeof window !==
                "undefined"

        ) {

            window.location.replace(

                resolveRoute(

                    getDefaultRouteForRole(
                        currentState.role
                    )

                )

            );

        }


        return false;

    }


    if (

        options.checkBlocked !==
            false &&

        isAccountBlocked(
            currentState.profile
        )

    ) {

        await logout({

            redirectTo:
                ROUTES.login

        });


        return false;

    }


    return true;

}


/* ============================================================
   USER HELPERS
============================================================ */

function getDisplayName(

    user = getUser(),

    profile = currentProfile

) {

    return (

        profile?.displayName ||

        profile?.name ||

        profile?.fullName ||

        user?.displayName ||

        user?.email?.split("@")[0] ||

        "RiderX User"

    );

}


function getPhone() {

    return (

        currentProfile?.phone ||

        currentProfile?.phoneNumber ||

        currentUser?.phoneNumber ||

        ""

    );

}


function getEmail() {

    return (

        currentProfile?.email ||

        currentUser?.email ||

        ""

    );

}


function hasRole(role) {

    const normalized =
        normalizeRole(role);


    return Boolean(

        normalized &&

        currentRole ===
            normalized

    );

}


function getCachedRole() {

    return normalizeRole(

        storageGet(
            STORAGE.role
        )

    );

}


function clearLocalSession() {

    clearSessionCache();

    clearAuthMemory();

}


/* ============================================================
   AUTH PUBLIC API
============================================================ */

const AUTH = {

    ROLES,

    ROUTES,

    normalizeRole,

    isValidRole:
        role =>
            Boolean(
                normalizeRole(role)
            ),

    isNormalUserRole:
        role =>
            NORMAL_USER_ROLES.includes(
                normalizeRole(role)
            ),

    normalizePhone,

    normalizeEmail,

    validateEmail,

    validatePassword,

    getUser,

    getProfile,

    getRole,

    getUid,

    getUserId:
        getUid,

    getDisplayName,

    getPhone,

    getEmail,

    getCachedRole,

    getState,

    getErrorMessage,

    hasRole,

    isRiderApproved,

    isAccountBlocked,

    init,

    onAuthStateChanged,

    listen:
        onAuthStateChanged,

    loginWithEmail,

    loginEmail,

    login:
        loginWithEmail,

    emailLogin:
        loginWithEmail,

    signIn:
        loginWithEmail,

    registerWithEmail,

    register:
        registerWithEmail,

    signup:
        registerWithEmail,

    createAccount:
        registerWithEmail,

    sendPasswordReset,

    resetPassword:
        sendPasswordReset,

    forgotPassword:
        sendPasswordReset,

    resetPasswordEmail:
        sendPasswordReset,

    sendPhoneOtp,

    sendOTP:
        sendPhoneOtp,

    sendOtp:
        sendPhoneOtp,

    verifyPhoneOtp,

    verifyOTP:
        verifyPhoneOtp,

    verifyOtp:
        verifyPhoneOtp,

    clearOtpState,

    updateProfile,

    refreshSession,

    refreshToken,

    logout,

    signOut:
        logout,

    clearLocalSession,

    requireAuth,

    requireRole,

    requireCustomer,

    requireRider,

    requireAdmin,

    resolveRoute

};


/* ============================================================
   GLOBAL RIDERX AUTH COMPATIBILITY
============================================================ */

globalThis.RiderXAuth = {

    ...(globalThis.RiderXAuth || {}),

    auth:
        AUTH,

    AUTH,

    ROLES,

    ROUTES,

    resolveRoute,

    login:
        options =>
            AUTH.loginWithEmail(
                options
            ),

    loginEmail:
        (
            email,
            password,
            role
        ) =>
            AUTH.loginEmail(
                email,
                password,
                role
            ),

    register:
        options =>
            AUTH.registerWithEmail(
                options
            ),

    logout:
        options =>
            AUTH.logout(
                options
            ),

    sendOTP:
        options =>
            AUTH.sendPhoneOtp(
                options
            ),

    verifyOTP:
        options =>
            AUTH.verifyPhoneOtp(
                options
            ),

    getUser:
        () =>
            AUTH.getUser(),

    getProfile:
        () =>
            AUTH.getProfile(),

    getRole:
        () =>
            AUTH.getRole(),

    getUid:
        () =>
            AUTH.getUid(),

    hasRole:
        role =>
            AUTH.hasRole(
                role
            ),

    requireAuth:
        options =>
            AUTH.requireAuth(
                options
            ),

    requireCustomer:
        options =>
            AUTH.requireCustomer(
                options
            ),

    requireRider:
        options =>
            AUTH.requireRider(
                options
            ),

    requireAdmin:
        options =>
            AUTH.requireAdmin(
                options
            ),

    getErrorMessage:
        error =>
            AUTH.getErrorMessage(
                error
            ),

    updateProfile:
        updates =>
            AUTH.updateProfile(
                updates
            ),

    refreshSession:
        () =>
            AUTH.refreshSession(),

    refreshToken:
        () =>
            AUTH.refreshToken()

};


/* ============================================================
   RIDERX GLOBAL
============================================================ */

globalThis.RiderX =
    globalThis.RiderX ||
    {};


globalThis.RiderX.auth =
    AUTH;

globalThis.RiderX.AUTH =
    AUTH;

globalThis.RiderX.ROLES =
    ROLES;

globalThis.RiderX.ROUTES =
    ROUTES;

globalThis.RiderX.resolveRoute =
    resolveRoute;


/* ============================================================
   DIRECT AUTH GLOBAL
============================================================ */

globalThis.AUTH =
    AUTH;


/* ============================================================
   AUTO INITIALIZATION
============================================================ */

try {

    if (

        FB.auth &&

        typeof FB.onAuthStateChanged ===
            "function"

    ) {

        AUTH.init()
            .catch(
                error => {

                    console.error(

                        "RiderX automatic auth initialization failed:",

                        error

                    );

                }
            );

    }

} catch (error) {

    console.error(
        "RiderX auth startup failed:",
        error
    );

}


/* ============================================================
   EXPORTS
============================================================ */

export {

    AUTH,

    ROLES,

    ROUTES,

    resolveRoute

};


/* ============================================================
   END OF RIDERX AUTH ENGINE
============================================================ */
