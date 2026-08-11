/* ============================================================
RIDERX 2.0
AUTHENTICATION ENGINE
File: js/auth.js

FINAL CUSTOMER/RIDER AUTH FLOW

- Firebase Authentication
- Customer / Rider / Admin role resolution
- Email login / registration
- Phone OTP
- Firestore user profiles
- Firebase auth-state listener
- UI-only localStorage cache
- Route guards
- Logout
- Password reset
- Profile update
- User rendering
- Compatibility API

SECURITY:
Firebase Authentication + Firestore Security Rules
are the source of truth.

localStorage is NEVER treated as authentication authority.
============================================================ */

"use strict";


/* ============================================================
   FIREBASE IMPORT
============================================================ */

import * as FB
    from "../firebase/firebase-config.js";


/* ============================================================
   AUTH OBJECT
============================================================ */

const AUTH = {};


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


/* ============================================================
   STORAGE KEYS
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
   ROUTE RESOLVER
============================================================ */

function resolveRoute(
    route
) {

    const value =
        safeString(
            route
        );


    if (
        !value
    ) {

        return value;

    }


    if (
        /^(https?:|mailto:|tel:|#|\/)/i.test(
            value
        )
    ) {

        return value;

    }


    try {

        return new URL(
            "../" + value,
            import.meta.url
        ).href;

    } catch (
        error
    ) {

        console.warn(
            "RiderX: route resolution failed.",
            error
        );

        return value;

    }

}


/* ============================================================
   INTERNAL STATE
============================================================ */

let currentUser =
    null;

let currentProfile =
    null;

let currentRole =
    "";

let authInitialized =
    false;

let authListenerStarted =
    false;

let authInitPromise =
    null;

let authListeners =
    [];

let otpConfirmationResult =
    null;


/* ============================================================
   SAFE HELPERS
============================================================ */

function safeLower(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return "";

    }

    return value
        .trim()
        .toLowerCase();

}


function safeString(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(
        value
    ).trim();

}


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(
            value
        );

    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


function safeBoolean(
    value,
    fallback = false
) {

    if (
        typeof value === "boolean"
    ) {

        return value;

    }

    return fallback;

}


/* ============================================================
   STORAGE HELPERS
============================================================ */

function safeStorageGet(
    key
) {

    try {

        return localStorage.getItem(
            key
        );

    } catch (
        error
    ) {

        console.warn(
            "RiderX storage read failed:",
            error
        );

        return null;

    }

}


function safeStorageSet(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            String(
                value
            )
        );

        return true;

    } catch (
        error
    ) {

        console.warn(
            "RiderX storage write failed:",
            error
        );

        return false;

    }

}


function safeStorageRemove(
    key
) {

    try {

        localStorage.removeItem(
            key
        );

    } catch (
        error
    ) {

        console.warn(
            "RiderX storage remove failed:",
            error
        );

    }

}


/* ============================================================
   JSON STORAGE
============================================================ */

function safeStorageGetJSON(
    key,
    fallback = null
) {

    const value =
        safeStorageGet(
            key
        );


    if (
        !value
    ) {

        return fallback;

    }


    try {

        return JSON.parse(
            value
        );

    } catch (
        error
    ) {

        safeStorageRemove(
            key
        );

        return fallback;

    }

}


function safeStorageSetJSON(
    key,
    value
) {

    try {

        return safeStorageSet(
            key,
            JSON.stringify(
                value
            )
        );

    } catch (
        error
    ) {

        console.warn(
            "RiderX JSON storage failed:",
            error
        );

        return false;

    }

}


/* ============================================================
   ROLE NORMALIZATION
============================================================ */

AUTH.normalizeRole =
    function (
        value
    ) {

        const role =
            safeLower(
                value
            );


        if (
            [
                "customer",
                "user",
                "passenger",
                "client"
            ].includes(
                role
            )
        ) {

            return ROLES.CUSTOMER;

        }


        if (
            [
                "rider",
                "driver",
                "captain",
                "partner"
            ].includes(
                role
            )
        ) {

            return ROLES.RIDER;

        }


        if (
            [
                "admin",
                "administrator"
            ].includes(
                role
            )
        ) {

            return ROLES.ADMIN;

        }


        if (
            [
                "superadmin",
                "super_admin"
            ].includes(
                role
            )
        ) {

            return ROLES.SUPERADMIN;

        }


        return "";

    };


/* ============================================================
   ROLE VALIDATION
============================================================ */

AUTH.isValidRole =
    function (
        role
    ) {

        return Boolean(
            AUTH.normalizeRole(
                role
            )
        );

    };


AUTH.isNormalUserRole =
    function (
        role
    ) {

        return NORMAL_USER_ROLES.includes(
            AUTH.normalizeRole(
                role
            )
        );

    };


/* ============================================================
   PHONE NORMALIZATION
============================================================ */

AUTH.normalizePhone =
    function (
        value
    ) {

        let phone =
            safeString(
                value
            );


        if (
            !phone
        ) {

            return "";

        }


        phone =
            phone.replace(
                /[\s()-]/g,
                ""
            );


        if (
            phone.startsWith(
                "+"
            )
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
            digits.startsWith(
                "91"
            )
            &&
            digits.length === 12
        ) {

            return "+" + digits;

        }


        return "";

    };


/* ============================================================
   EMAIL NORMALIZATION
============================================================ */

AUTH.normalizeEmail =
    function (
        value
    ) {

        return safeString(
            value
        ).toLowerCase();

    };


/* ============================================================
   PASSWORD VALIDATION
============================================================ */

AUTH.validatePassword =
    function (
        password
    ) {

        const value =
            safeString(
                password
            );


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

    };


/* ============================================================
   EMAIL VALIDATION
============================================================ */

AUTH.validateEmail =
    function (
        email
    ) {

        const value =
            AUTH.normalizeEmail(
                email
            );


        if (
            !value
        ) {

            return {

                valid:
                    false,

                message:
                    "Email is required."

            };

        }


        const pattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !pattern.test(
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

    };


/* ============================================================
   FIREBASE USER
============================================================ */

AUTH.getUser =
    function () {

        if (
            currentUser
        ) {

            return currentUser;

        }


        try {

            return FB.auth?.currentUser ||
                null;

        } catch (
            error
        ) {

            return null;

        }

    };


/* ============================================================
   PROFILE
============================================================ */

AUTH.getProfile =
    function () {

        return currentProfile;

    };


/* ============================================================
   ROLE
============================================================ */

AUTH.getRole =
    function () {

        return currentRole;

    };


/* ============================================================
   UID
============================================================ */

AUTH.getUid =
    function () {

        const user =
            AUTH.getUser();


        return user?.uid ||
            "";

    };


/* ============================================================
   USER PROFILE DATA
============================================================ */

function normalizeProfile(
    profile,
    user
) {

    const source =
        profile || {};


    const uid =
        user?.uid ||
        source.uid ||
        "";


    const role =
        AUTH.normalizeRole(
            source.role ||
            source.userRole ||
            source.accountType ||
            source.userType
        );


    return {

        ...source,

        uid,

        email:
            source.email ||
            user?.email ||
            "",

        name:
            source.name ||
            source.fullName ||
            source.displayName ||
            user?.displayName ||
            "",

        fullName:
            source.fullName ||
            source.name ||
            source.displayName ||
            user?.displayName ||
            "",

        displayName:
            source.displayName ||
            source.name ||
            source.fullName ||
            user?.displayName ||
            "",

        phone:
            source.phone ||
            source.phoneNumber ||
            user?.phoneNumber ||
            "",

        phoneNumber:
            source.phoneNumber ||
            source.phone ||
            user?.phoneNumber ||
            "",

        role,

        userRole:
            role,

        accountType:
            role,

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
   FIRESTORE USER PROFILE
============================================================ */

async function getUserProfile(
    user
) {

    if (
        !user?.uid
    ) {

        return null;

    }


    try {

        const userRef =
            FB.doc(
                FB.db,
                "users",
                user.uid
            );


        const snapshot =
            await FB.getDoc(
                userRef
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

    } catch (
        error
    ) {

        console.error(
            "RiderX: failed to read user profile.",
            error
        );

        throw error;

    }

}


/* ============================================================
   SAVE USER PROFILE
============================================================ */

async function saveUserProfile(
    user,
    profile,
    merge = true
) {

    if (
        !user?.uid
    ) {

        throw new Error(
            "Authenticated user is required."
        );

    }


    const normalized =
        normalizeProfile(
            profile,
            user
        );


    const userRef =
        FB.doc(
            FB.db,
            "users",
            user.uid
        );


    await FB.setDoc(
        userRef,
        normalized,
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
        AUTH.normalizeRole(
            role
        );


    if (
        !NORMAL_USER_ROLES.includes(
            normalizedRole
        )
    ) {

        throw new Error(
            "Invalid account role."
        );

    }


    const now =
        Date.now();


    const profile = {

        uid:
            user.uid,

        email:
            user.email || "",

        name:
            extra.name ||
            user.displayName ||
            "",

        fullName:
            extra.fullName ||
            extra.name ||
            user.displayName ||
            "",

        displayName:
            extra.displayName ||
            extra.name ||
            user.displayName ||
            "",

        phone:
            extra.phone ||
            user.phoneNumber ||
            "",

        phoneNumber:
            extra.phoneNumber ||
            extra.phone ||
            user.phoneNumber ||
            "",

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
            extra.city ||
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
            extra.approvalStatus ||
            "pending";

    }


    return saveUserProfile(
        user,
        profile,
        true
    );

}


/* ============================================================
   AUTH ERROR MESSAGE
============================================================ */

AUTH.getErrorMessage =
    function (
        error
    ) {

        if (
            !error
        ) {

            return "Something went wrong.";

        }


        const code =
            error.code ||
            "";


        const messages = {

            "auth/invalid-email":
                "Please enter a valid email address.",

            "auth/user-disabled":
                "This account has been disabled.",

            "auth/user-not-found":
                "No account was found with these details.",

            "auth/wrong-password":
                "Incorrect password.",

            "auth/invalid-credential":
                "Email or password is incorrect.",

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

            "auth/popup-closed-by-user":
                "Authentication window was closed.",

            "auth/popup-blocked":
                "The authentication popup was blocked. Please allow popups and try again.",

            "auth/requires-recent-login":
                "Please login again before performing this action.",

            "permission-denied":
                "You do not have permission to access this account data."

        };


        return (
            messages[code] ||
            error.message ||
            "Authentication failed."
        );

    };


/* ============================================================
   SAFE SIGN OUT
============================================================ */

async function safeFirebaseSignOut(
    firebaseModule = FB
) {

    try {

        if (
            firebaseModule?.auth
            &&
            firebaseModule?.signOut
        ) {

            await firebaseModule.signOut(
                firebaseModule.auth
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "RiderX: Firebase sign-out failed.",
            error
        );

    }

}


/* ============================================================
   SESSION CACHE
============================================================ */

function cacheAuthenticatedSession(
    user,
    profile,
    role
) {

    const normalizedRole =
        AUTH.normalizeRole(
            role ||
            profile?.role
        );


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


    safeStorageSetJSON(
        STORAGE.session,
        session
    );


    safeStorageSet(
        STORAGE.uid,
        session.uid
    );


    safeStorageSet(
        STORAGE.role,
        normalizedRole
    );


    safeStorageSet(
        STORAGE.selectedRole,
        normalizedRole
    );


    if (
        normalizedRole ===
        ROLES.CUSTOMER
    ) {

        safeStorageSet(
            STORAGE.customerId,
            session.uid
        );

        safeStorageSetJSON(
            STORAGE.customer,
            {
                ...profile,
                ...session
            }
        );

    }


    if (
        normalizedRole ===
        ROLES.RIDER
    ) {

        safeStorageSet(
            STORAGE.riderId,
            session.uid
        );

        safeStorageSetJSON(
            STORAGE.rider,
            {
                ...profile,
                ...session
            }
        );

    }


    safeStorageSetJSON(
        STORAGE.user,
        {
            ...profile,
            ...session
        }
    );


    safeStorageSet(
        STORAGE.authReady,
        "true"
    );

}


/* ============================================================
   CLEAR SESSION CACHE
============================================================ */

function clearSessionCache() {

    const keys = [

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

    ];


    for (
        const key
        of keys
    ) {

        safeStorageRemove(
            key
        );

    }

}


/* ============================================================
   GET CACHED ROLE
============================================================ */

AUTH.getCachedRole =
    function () {

        return AUTH.normalizeRole(
            safeStorageGet(
                STORAGE.role
            )
        );

    };


/* ============================================================
   CREATE/UPDATE ROLE PROFILE
============================================================ */

async function ensureRoleProfile(
    user,
    requestedRole,
    extra = {}
) {

    let profile =
        await getUserProfile(
            user
        );


    if (
        profile
    ) {

        const existingRole =
            AUTH.normalizeRole(
                profile.role
            );


        if (
            existingRole
        ) {

            return profile;

        }

    }


    const role =
        AUTH.normalizeRole(
            requestedRole
        );


    if (
        !NORMAL_USER_ROLES.includes(
            role
        )
    ) {

        return null;

    }


    profile =
        await createUserProfile(
            user,
            role,
            extra
        );


    return profile;

}


/* ============================================================
   FINALIZE AUTHENTICATED USER
============================================================ */

async function finalizeAuthenticatedUser(
    user,
    options = {}
) {

    if (
        !user?.uid
    ) {

        throw new Error(
            "Authentication user is missing."
        );

    }


    const requestedRole =
        AUTH.normalizeRole(
            options.selectedRole
        );


    let profile =
        await getUserProfile(
            user
        );


    let role =
        AUTH.normalizeRole(
            profile?.role
        );


    /*
     * Existing Firestore role always wins.
     *
     * Selected-role fallback is allowed only during explicit
     * account setup and only for Customer/Rider.
     */

    if (
        !role
        &&
        options.allowSelectedRoleFallback === true
        &&
        NORMAL_USER_ROLES.includes(
            requestedRole
        )
    ) {

        profile =
            await ensureRoleProfile(
                user,
                requestedRole,
                options.profile || {}
            );


        role =
            AUTH.normalizeRole(
                profile?.role
            );

    }


    if (
        !role
    ) {

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


    if (
        !profile
    ) {

        profile =
            normalizeProfile(
                {},
                user
            );

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


/* ============================================================
   EMAIL REGISTER
============================================================ */

AUTH.registerWithEmail =
    async function (
        options = {}
    ) {

        const name =
            safeString(
                options.name ||
                options.fullName ||
                options.displayName
            );


        const email =
            AUTH.normalizeEmail(
                options.email
            );


        const password =
            safeString(
                options.password
            );


        const role =
            AUTH.normalizeRole(
                options.role ||
                options.selectedRole
            );


        const emailValidation =
            AUTH.validateEmail(
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
            AUTH.validatePassword(
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
            !FB.auth
            ||
            !FB.createUserWithEmailAndPassword
        ) {

            throw new Error(
                "Firebase Authentication is not available."
            );

        }


        let credential;


        try {

            credential =
                await FB.createUserWithEmailAndPassword(
                    FB.auth,
                    email,
                    password
                );

        } catch (
            error
        ) {

            throw error;

        }


        const user =
            credential.user;


        if (
            name
            &&
            FB.updateProfile
        ) {

            try {

                await FB.updateProfile(
                    user,
                    {
                        displayName:
                            name
                    }
                );

            } catch (
                error
            ) {

                console.warn(
                    "RiderX: display name update failed.",
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
                            user.phoneNumber ||
                            ""

                    }
                );

        } catch (
            error
        ) {

            await safeFirebaseSignOut(
                FB
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


        return {

            user,

            profile,

            role

        };

    };


/* ============================================================
   EMAIL LOGIN
============================================================ */

AUTH.loginWithEmail =
    async function (
        options = {}
    ) {

        const email =
            AUTH.normalizeEmail(
                options.email
            );


        const password =
            safeString(
                options.password
            );


        const requestedRole =
            AUTH.normalizeRole(
                options.role ||
                options.selectedRole
            );


        const emailValidation =
            AUTH.validateEmail(
                email
            );


        if (
            !emailValidation.valid
        ) {

            throw new Error(
                emailValidation.message
            );

        }


        if (
            !password
        ) {

            throw new Error(
                "Password is required."
            );

        }


        if (
            !FB.auth
            ||
            !FB.signInWithEmailAndPassword
        ) {

            throw new Error(
                "Firebase Authentication is not available."
            );

        }


        const credential =
            await FB.signInWithEmailAndPassword(
                FB.auth,
                email,
                password
            );


        const user =
            credential.user;


        let result;


        try {

            result =
                await finalizeAuthenticatedUser(
                    user,
                    {

                        selectedRole:
                            requestedRole,

                        allowSelectedRoleFallback:
                            false

                    }
                );

        } catch (
            error
        ) {

            await safeFirebaseSignOut(
                FB
            );

            throw error;

        }


        if (
            !result.configured
        ) {

            await safeFirebaseSignOut(
                FB
            );

            throw new Error(
                "Your account profile is incomplete. Please complete account setup."
            );

        }


        return result;

    };


/* ============================================================
   LEGACY EMAIL LOGIN COMPATIBILITY
   ------------------------------------------------------------
   Older login pages may call:

       auth.loginEmail(email, password)

   while the canonical API uses:

       auth.loginWithEmail({
           email,
           password,
           role
       })

   Both now use the SAME Firebase implementation.
============================================================ */

AUTH.loginEmail =
    function (
        emailOrOptions,
        password,
        role
    ) {

        if (
            emailOrOptions &&
            typeof emailOrOptions === "object"
        ) {

            return AUTH.loginWithEmail(
                emailOrOptions
            );

        }


        return AUTH.loginWithEmail({

            email:
                emailOrOptions,

            password:
                password,

            role:
                role ||
                safeStorageGet(
                    STORAGE.selectedRole
                )

        });

    };


/* ============================================================
   PASSWORD RESET
============================================================ */

AUTH.sendPasswordReset =
    async function (
        email
    ) {

        const normalizedEmail =
            AUTH.normalizeEmail(
                email
            );


        const validation =
            AUTH.validateEmail(
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
            !FB.auth
            ||
            !FB.sendPasswordResetEmail
        ) {

            throw new Error(
                "Firebase Authentication is not available."
            );

        }


        await FB.sendPasswordResetEmail(
            FB.auth,
            normalizedEmail
        );


        return true;

    };


AUTH.resetPassword =
    AUTH.sendPasswordReset;


/* ============================================================
   PHONE OTP
============================================================ */

AUTH.sendPhoneOtp =
    async function (
        options = {}
    ) {

        const phone =
            AUTH.normalizePhone(
                options.phone
            );


        const role =
            AUTH.normalizeRole(
                options.role ||
                options.selectedRole
            );


        if (
            !phone
        ) {

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


        if (
            !verifier
        ) {

            throw new Error(
                "OTP verification is not ready. Please try again."
            );

        }


        if (
            !FB.auth
            ||
            !FB.signInWithPhoneNumber
        ) {

            throw new Error(
                "Phone OTP authentication is not available."
            );

        }


        try {

            otpConfirmationResult =
                await FB.signInWithPhoneNumber(
                    FB.auth,
                    phone,
                    verifier
                );

        } catch (
            error
        ) {

            otpConfirmationResult =
                null;

            throw error;

        }


        safeStorageSet(
            STORAGE.otpPhone,
            phone
        );


        safeStorageSet(
            STORAGE.pendingRole,
            role
        );


        return {

            phone,

            role,

            sent:
                true

        };

    };


/* ============================================================
   PHONE OTP VERIFY
============================================================ */

AUTH.verifyPhoneOtp =
    async function (
        options = {}
    ) {

        const code =
            safeString(
                options.code ||
                options.otp
            );


        const requestedRole =
            AUTH.normalizeRole(
                options.role ||
                options.selectedRole ||
                safeStorageGet(
                    STORAGE.pendingRole
                )
            );


        if (
            !code
        ) {

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

        } catch (
            error
        ) {

            throw error;

        }


        otpConfirmationResult =
            null;


        const firebaseUser =
            credential.user;


        let existingProfile =
            null;


        try {

            existingProfile =
                await getUserProfile(
                    firebaseUser
                );

        } catch (
            error
        ) {

            await safeFirebaseSignOut(
                FB
            );

            throw error;

        }


        const isNewPhoneUser =
            !existingProfile;


        if (
            isNewPhoneUser
        ) {

            const now =
                Date.now();


            const phone =
                safeStorageGet(
                    STORAGE.otpPhone
                ) ||
                firebaseUser.phoneNumber ||
                "";


            const phoneProfile = {

                uid:
                    firebaseUser.uid,

                email:
                    firebaseUser.email || "",

                name:
                    firebaseUser.displayName || "",

                fullName:
                    firebaseUser.displayName || "",

                displayName:
                    firebaseUser.displayName || "",

                phone:
                    firebaseUser.phoneNumber ||
                    phone,

                phoneNumber:
                    firebaseUser.phoneNumber ||
                    phone,

                role:
                    requestedRole,

                userRole:
                    requestedRole,

                accountType:
                    requestedRole,

                status:
                    "active",

                online:
                    false,

                city:
                    "Chandigarh",

                rating:
                    5,

                totalRides:
                    0,

                completedRides:
                    0,

                cancelledRides:
                    0,

                walletBalance:
                    0,

                createdAt:
                    now,

                updatedAt:
                    now

            };


            try {

                await FB.setDoc(
                    FB.doc(
                        FB.db,
                        "users",
                        firebaseUser.uid
                    ),
                    phoneProfile,
                    {
                        merge:
                            true
                    }
                );

            } catch (
                error
            ) {

                await safeFirebaseSignOut(
                    FB
                );

                throw error;

            }

        }


        const authResult =
            await finalizeAuthenticatedUser(
                firebaseUser,
                {

                    allowSelectedRoleFallback:
                        false,

                    selectedRole:
                        requestedRole

                }
            );


        if (
            !authResult.configured
        ) {

            await safeFirebaseSignOut(
                FB
            );

            throw new Error(
                "Your account profile is incomplete."
            );

        }


        safeStorageRemove(
            STORAGE.otpPhone
        );

        safeStorageRemove(
            STORAGE.pendingRole
        );


        return authResult;

    };


/* ============================================================
   CLEAR OTP STATE
============================================================ */

AUTH.clearOtpState =
    function () {

        otpConfirmationResult =
            null;

        safeStorageRemove(
            STORAGE.otpPhone
        );

        safeStorageRemove(
            STORAGE.pendingRole
        );

        safeStorageRemove(
            STORAGE.pendingEmail
        );

        safeStorageRemove(
            STORAGE.pendingName
        );

    };


/* ============================================================
   RIDER APPROVAL
============================================================ */

AUTH.isRiderApproved =
    function (
        user
    ) {

        if (
            !user ||
            AUTH.normalizeRole(
                user.role
            ) !== ROLES.RIDER
        ) {

            return false;

        }


        if (
            user.disabled === true ||
            user.blocked === true ||
            user.suspended === true
        ) {

            return false;

        }


        const status =
            safeLower(
                user.approvalStatus ||
                user.riderStatus ||
                user.status
            );


        return (
            user.approved === true ||
            user.isApproved === true ||
            user.adminApproved === true ||
            status === "approved"
        );

    };


/* ============================================================
   ACCOUNT BLOCK CHECK
============================================================ */

AUTH.isAccountBlocked =
    function (
        user
    ) {

        if (
            !user
        ) {

            return false;

        }


        return (
            user.disabled === true ||
            user.blocked === true ||
            user.suspended === true ||
            safeLower(
                user.status
            ) === "blocked" ||
            safeLower(
                user.status
            ) === "suspended" ||
            safeLower(
                user.status
            ) === "disabled"
        );

    };


/* ============================================================
   UPDATE PROFILE
============================================================ */

AUTH.updateProfile =
    async function (
        updates = {}
    ) {

        const user =
            AUTH.getUser();


        if (
            !user
        ) {

            throw new Error(
                "Please login first."
            );

        }


        const profile =
            await getUserProfile(
                user
            );


        if (
            !profile
        ) {

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


        if (
            name
        ) {

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
            updates.phone ||
            updates.phoneNumber
        ) {

            const phone =
                AUTH.normalizePhone(
                    updates.phone ||
                    updates.phoneNumber
                );


            if (
                !phone
            ) {

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


        const updatedProfile =
            await saveUserProfile(
                user,
                {
                    ...profile,
                    ...allowed
                },
                true
            );


        if (
            name
            &&
            FB.updateProfile
        ) {

            try {

                await FB.updateProfile(
                    user,
                    {
                        displayName:
                            name
                    }
                );

            } catch (
                error
            ) {

                console.warn(
                    "RiderX: Firebase Auth profile update failed.",
                    error
                );

            }

        }


        currentProfile =
            updatedProfile;


        cacheAuthenticatedSession(
            user,
            updatedProfile,
            currentRole
        );


        return updatedProfile;

    };


/* ============================================================
   LOGOUT
============================================================ */

AUTH.logout =
    async function (
        options = {}
    ) {

        try {

            await safeFirebaseSignOut(
                FB
            );

        } finally {

            currentUser =
                null;

            currentProfile =
                null;

            currentRole =
                "";

            clearSessionCache();

            AUTH.clearOtpState();

        }


        if (
            options.redirect !== false
        ) {

            const path =
                options.redirectTo ||
                ROUTES.login;


            window.location.replace(
                resolveRoute(
                    path
                )
            );

        }


        return true;

    };


/* ============================================================
   AUTH STATE CALLBACK
============================================================ */

function notifyAuthListeners(
    state
) {

    for (
        const listener
        of [
            ...authListeners
        ]
    ) {

        try {

            listener(
                state
            );

        } catch (
            error
        ) {

            console.error(
                "RiderX auth listener failed.",
                error
            );

        }

    }

}


/* ============================================================
   AUTH STATE INITIALIZATION
============================================================ */

AUTH.init =
    function (
        options = {}
    ) {

        if (
            authInitPromise
        ) {

            return authInitPromise;

        }


        if (
            !FB.auth ||
            !FB.onAuthStateChanged
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


        authListenerStarted =
            true;


        authInitPromise =
            new Promise(
                function (
                    resolve
                ) {

                    let resolved =
                        false;


                    const unsubscribe =
                        FB.onAuthStateChanged(
                            FB.auth,
                            async function (
                                user
                            ) {

                                try {

                                    currentUser =
                                        user ||
                                        null;


                                    if (
                                        !user
                                    ) {

                                        currentProfile =
                                            null;

                                        currentRole =
                                            "";

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


                                    let result;


                                    try {

                                        result =
                                            await finalizeAuthenticatedUser(
                                                user,
                                                {
                                                    allowSelectedRoleFallback:
                                                        false
                                                }
                                            );

                                    } catch (
                                        error
                                    ) {

                                        console.error(
                                            "RiderX: auth profile initialization failed.",
                                            error
                                        );


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

                                } catch (
                                    error
                                ) {

                                    console.error(
                                        "RiderX: auth initialization failed.",
                                        error
                                    );


                                    const state = {

                                        authenticated:
                                            Boolean(
                                                user
                                            ),

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


                    AUTH._unsubscribe =
                        unsubscribe;

                }
            );


        return authInitPromise;

    };


/* ============================================================
   AUTH STATE SUBSCRIBE
============================================================ */

AUTH.onAuthStateChanged =
    function (
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {

            return function () {};

        }


        authListeners.push(
            callback
        );


        if (
            authInitialized
        ) {

            try {

                callback(
                    AUTH.getState()
                );

            } catch (
                error
            ) {

                console.error(
                    "RiderX auth callback error.",
                    error
                );

            }

        }


        return function unsubscribe() {

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

    };


/* ============================================================
   GET CURRENT AUTH STATE
============================================================ */

AUTH.getState =
    function () {

        const user =
            AUTH.getUser();


        return {

            authenticated:
                Boolean(
                    user
                ),

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

    };


/* ============================================================
   HAS ROLE
============================================================ */

AUTH.hasRole =
    function (
        role
    ) {

        const normalized =
            AUTH.normalizeRole(
                role
            );


        return (
            Boolean(
                normalized
            )
            &&
            currentRole ===
            normalized
        );

    };


/* ============================================================
   REQUIRE AUTH
============================================================ */

AUTH.requireAuth =
    async function (
        options = {}
    ) {

        const state =
            await AUTH.init();


        if (
            !state.authenticated
        ) {

            if (
                options.redirect !== false
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
            options.role
        ) {

            const requiredRole =
                AUTH.normalizeRole(
                    options.role
                );


            if (
                !requiredRole
                ||
                state.role !==
                requiredRole
            ) {

                if (
                    options.redirect !== false
                ) {

                    if (
                        state.role ===
                        ROLES.CUSTOMER
                    ) {

                        window.location.replace(
                            resolveRoute(
                                ROUTES.customerHome
                            )
                        );

                    } else if (
                        state.role ===
                        ROLES.RIDER
                    ) {

                        window.location.replace(
                            resolveRoute(
                                ROUTES.riderHome
                            )
                        );

                    } else if (
                        state.role ===
                        ROLES.ADMIN ||
                        state.role ===
                        ROLES.SUPERADMIN
                    ) {

                        window.location.replace(
                            resolveRoute(
                                ROUTES.adminDashboard
                            )
                        );

                    } else {

                        window.location.replace(
                            resolveRoute(
                                ROUTES.role
                            )
                        );

                    }

                }


                return false;

            }

        }


        if (
            options.checkBlocked !== false
            &&
            AUTH.isAccountBlocked(
                state.profile
            )
        ) {

            await AUTH.logout({

                redirectTo:
                    ROUTES.login

            });


            return false;

        }


        if (
            state.role ===
            ROLES.RIDER
            &&
            options.requireApprovedRider === true
            &&
            !AUTH.isRiderApproved(
                state.profile
            )
        ) {

            if (
                options.redirect !== false
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

    };


/* ============================================================
   REQUIRE ROLE
============================================================ */

AUTH.requireRole =
    async function (
        role,
        options = {}
    ) {

        return AUTH.requireAuth({

            ...options,

            role

        });

    };


/* ============================================================
   REQUIRE CUSTOMER
============================================================ */

AUTH.requireCustomer =
    async function (
        options = {}
    ) {

        return AUTH.requireRole(
            ROLES.CUSTOMER,
            options
        );

    };


/* ============================================================
   REQUIRE RIDER
============================================================ */

AUTH.requireRider =
    async function (
        options = {}
    ) {

        return AUTH.requireRole(
            ROLES.RIDER,
            {

                ...options,

                requireApprovedRider:
                    options.requireApprovedRider !== false

            }
        );

    };


/* ============================================================
   REQUIRE ADMIN
============================================================ */

AUTH.requireAdmin =
    async function (
        options = {}
    ) {

        const state =
            await AUTH.init();


        if (
            !state.authenticated
        ) {

            if (
                options.redirect !== false
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


        const isAdmin =
            state.role ===
                ROLES.ADMIN
            ||
            state.role ===
                ROLES.SUPERADMIN;


        if (
            !isAdmin
        ) {

            if (
                options.redirect !== false
            ) {

                if (
                    state.role ===
                    ROLES.RIDER
                ) {

                    window.location.replace(
                        resolveRoute(
                            ROUTES.riderHome
                        )
                    );

                } else if (
                    state.role ===
                    ROLES.CUSTOMER
                ) {

                    window.location.replace(
                        resolveRoute(
                            ROUTES.customerHome
                        )
                    );

                } else {

                    window.location.replace(
                        resolveRoute(
                            ROUTES.role
                        )
                    );

                }

            }


            return false;

        }


        if (
            options.checkBlocked !== false
            &&
            AUTH.isAccountBlocked(
                state.profile
            )
        ) {

            await AUTH.logout({

                redirectTo:
                    ROUTES.login

            });


            return false;

        }


        return true;

    };


/* ============================================================
   USER DISPLAY HELPERS
============================================================ */

AUTH.getDisplayName =
    function (
        user = AUTH.getUser(),
        profile = currentProfile
    ) {

        return (
            profile?.displayName ||
            profile?.name ||
            profile?.fullName ||
            user?.displayName ||
            user?.email?.split(
                "@"
            )[0] ||
            "RiderX User"
        );

    };


AUTH.getPhone =
    function () {

        return (
            currentProfile?.phone ||
            currentProfile?.phoneNumber ||
            currentUser?.phoneNumber ||
            ""
        );

    };


AUTH.getEmail =
    function () {

        return (
            currentProfile?.email ||
            currentUser?.email ||
            ""
        );

    };


AUTH.getUserId =
    function () {

        return AUTH.getUid();

    };


/* ============================================================
   UPDATE LOCAL SESSION
============================================================ */

AUTH.refreshSession =
    async function () {

        const user =
            AUTH.getUser();


        if (
            !user
        ) {

            currentUser =
                null;

            currentProfile =
                null;

            currentRole =
                "";

            clearSessionCache();

            return AUTH.getState();

        }


        const profile =
            await getUserProfile(
                user
            );


        if (
            !profile
        ) {

            currentProfile =
                null;

            currentRole =
                "";

            clearSessionCache();

            return AUTH.getState();

        }


        currentUser =
            user;

        currentProfile =
            profile;

        currentRole =
            AUTH.normalizeRole(
                profile.role
            );


        if (
            !currentRole
        ) {

            clearSessionCache();

            return AUTH.getState();

        }


        cacheAuthenticatedSession(
            user,
            profile,
            currentRole
        );


        return AUTH.getState();

    };


/* ============================================================
   FORCE TOKEN REFRESH
============================================================ */

AUTH.refreshToken =
    async function () {

        const user =
            AUTH.getUser();


        if (
            !user
        ) {

            return null;

        }


        if (
            typeof user.getIdToken !==
            "function"
        ) {

            return null;

        }


        return user.getIdToken(
            true
        );

    };


/* ============================================================
   UPDATE FIREBASE AUTH PROFILE
============================================================ */

AUTH.updateAuthProfile =
    async function (
        updates = {}
    ) {

        const user =
            AUTH.getUser();


        if (
            !user
        ) {

            throw new Error(
                "Please login first."
            );

        }


        if (
            !FB.updateProfile
        ) {

            return user;

        }


        const allowed = {};


        if (
            updates.displayName !==
            undefined
        ) {

            allowed.displayName =
                safeString(
                    updates.displayName
                );

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
            Object.keys(
                allowed
            ).length
        ) {

            await FB.updateProfile(
                user,
                allowed
            );

        }


        return user;

    };


/* ============================================================
   DELETE SESSION ONLY
============================================================ */

AUTH.clearLocalSession =
    function () {

        clearSessionCache();

        currentUser =
            null;

        currentProfile =
            null;

        currentRole =
            "";

    };


/* ============================================================
   CURRENT USER LISTENER
============================================================ */

AUTH.listen =
    AUTH.onAuthStateChanged;


/* ============================================================
   LEGACY LOGIN ALIASES
============================================================ */

AUTH.login =
    AUTH.loginWithEmail;


AUTH.emailLogin =
    AUTH.loginWithEmail;


AUTH.signIn =
    AUTH.loginWithEmail;


/* ============================================================
   LEGACY REGISTER ALIASES
============================================================ */

AUTH.register =
    AUTH.registerWithEmail;


AUTH.signup =
    AUTH.registerWithEmail;


AUTH.createAccount =
    AUTH.registerWithEmail;


/* ============================================================
   LEGACY OTP ALIASES
============================================================ */

AUTH.sendOTP =
    AUTH.sendPhoneOtp;


AUTH.sendOtp =
    AUTH.sendPhoneOtp;


AUTH.verifyOTP =
    AUTH.verifyPhoneOtp;


AUTH.verifyOtp =
    AUTH.verifyPhoneOtp;


/* ============================================================
   LEGACY LOGOUT ALIAS
============================================================ */

AUTH.signOut =
    AUTH.logout;


/* ============================================================
   LEGACY RESET ALIASES
============================================================ */

AUTH.forgotPassword =
    AUTH.sendPasswordReset;


AUTH.resetPasswordEmail =
    AUTH.sendPasswordReset;


/* ============================================================
   GLOBAL COMPATIBILITY API
   ------------------------------------------------------------
   IMPORTANT:
   Firebase config and older RiderX pages may already use
   window.RiderX.

   Do NOT create a second authentication engine.

   All public APIs below point to the SAME AUTH object.
============================================================ */

const existingRiderX =
    globalThis.RiderX;

const existingRiderXAuth =
    globalThis.RiderXAuth;


const RX =
    existingRiderXAuth ||
    existingRiderX ||
    {};


RX.auth =
    AUTH;


RX.AUTH =
    AUTH;


RX.ROLES =
    ROLES;


RX.ROUTES =
    ROUTES;


RX.resolveRoute =
    resolveRoute;


RX.login =
    function (
        options
    ) {

        return AUTH.loginWithEmail(
            options
        );

    };


RX.loginEmail =
    function (
        email,
        password,
        role
    ) {

        return AUTH.loginEmail(
            email,
            password,
            role
        );

    };


RX.register =
    function (
        options
    ) {

        return AUTH.registerWithEmail(
            options
        );

    };


RX.logout =
    function (
        options
    ) {

        return AUTH.logout(
            options
        );

    };


RX.sendOTP =
    function (
        options
    ) {

        return AUTH.sendPhoneOtp(
            options
        );

    };


RX.verifyOTP =
    function (
        options
    ) {

        return AUTH.verifyPhoneOtp(
            options
        );

    };


RX.getUser =
    function () {

        return AUTH.getUser();

    };


RX.getProfile =
    function () {

        return AUTH.getProfile();

    };


RX.getRole =
    function () {

        return AUTH.getRole();

    };


RX.getUid =
    function () {

        return AUTH.getUid();

    };


RX.hasRole =
    function (
        role
    ) {

        return AUTH.hasRole(
            role
        );

    };


RX.isRiderApproved =
    function (
        user
    ) {

        return AUTH.isRiderApproved(
            user ||
            AUTH.getProfile()
        );

    };


RX.isAccountBlocked =
    function (
        user
    ) {

        return AUTH.isAccountBlocked(
            user ||
            AUTH.getProfile()
        );

    };


RX.requireAuth =
    function (
        options
    ) {

        return AUTH.requireAuth(
            options
        );

    };


RX.requireCustomer =
    function (
        options
    ) {

        return AUTH.requireCustomer(
            options
        );

    };


RX.requireRider =
    function (
        options
    ) {

        return AUTH.requireRider(
            options
        );

    };


RX.requireAdmin =
    function (
        options
    ) {

        return AUTH.requireAdmin(
            options
        );

    };


RX.getErrorMessage =
    function (
        error
    ) {

        return AUTH.getErrorMessage(
            error
        );

    };


RX.updateProfile =
    function (
        updates
    ) {

        return AUTH.updateProfile(
            updates
        );

    };


RX.refreshSession =
    function () {

        return AUTH.refreshSession();

    };


RX.refreshToken =
    function () {

        return AUTH.refreshToken();

    };


/*
 * Compatibility aliases directly on the RiderX namespace.
 */

RX.loginWithEmail =
    AUTH.loginWithEmail;


RX.loginEmail =
    AUTH.loginEmail;


RX.registerWithEmail =
    AUTH.registerWithEmail;


RX.sendPasswordReset =
    AUTH.sendPasswordReset;


RX.resetPassword =
    AUTH.resetPassword;


RX.onAuthStateChanged =
    AUTH.onAuthStateChanged;


/* ============================================================
   GLOBAL REFERENCES
============================================================ */

/*
 * RiderXAuth
 */
globalThis.RiderXAuth =
    RX;


/*
 * RiderX
 *
 * This is intentionally the SAME object.
 */
globalThis.RiderX =
    RX;


/*
 * Direct AUTH compatibility.
 */
globalThis.AUTH =
    AUTH;


/*
 * Explicit auth reference.
 */
globalThis.RiderX.auth =
    AUTH;


/* ============================================================
   AUTO INITIALIZATION
============================================================ */

try {

    if (
        FB.auth
        &&
        FB.onAuthStateChanged
    ) {

        AUTH.init()
            .catch(
                function (
                    error
                ) {

                    console.error(
                        "RiderX: automatic auth initialization failed.",
                        error
                    );

                }
            );

    }

} catch (
    error
) {

    console.error(
        "RiderX: auth startup failed.",
        error
    );

}


/* ============================================================
   EXPORT
============================================================ */

export {

    AUTH,

    ROLES,

    ROUTES,

    resolveRoute

};


/* ============================================================
   END OF FILE
============================================================ */
