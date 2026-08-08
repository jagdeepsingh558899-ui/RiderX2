/* ============================================================
RiderX Login System
Customer + Rider + Admin
Firebase v10 Modular SDK
============================================================ */

import {
auth,
db
} from "../firebase/firebase-config.js";

import {
signInWithEmailAndPassword,
signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
doc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ============================================================
ELEMENTS
============================================================ */

const loginForm =
document.getElementById("login-form");

const emailInput =
document.getElementById("email");

const passwordInput =
document.getElementById("password");

const loginButton =
document.getElementById("login-btn");

const statusBox =
document.getElementById("status") ||
document.getElementById("error-message");

/* ============================================================
URL ROLE
============================================================ */

const params =
new URLSearchParams(
window.location.search
);

const requestedRole =
String(
params.get("role") || ""
)
.trim()
.toLowerCase();

/* ============================================================
STATE
============================================================ */

let loginInProgress = false;

/* ============================================================
MESSAGE
============================================================ */

function showMessage(
text,
type = "error"
){

if(!statusBox){
    return;
}

statusBox.textContent =
    text || "";

statusBox.className =
    "status " + type;

}

/* ============================================================
BUTTON STATE
============================================================ */

function setLoading(
loading
){

if(!loginButton){
    return;
}

loginButton.disabled =
    loading;

if(loading){

    loginButton.dataset.oldText =
        loginButton.textContent;

    loginButton.textContent =
        "Signing in...";

}
else{

    loginButton.textContent =
        loginButton.dataset.oldText ||
        "Login";

}

}

/* ============================================================
GET USER PROFILE
============================================================ */

async function getUserProfile(
uid
){

const userRef =
    doc(
        db,
        "users",
        uid
    );

const userSnap =
    await getDoc(
        userRef
    );

if(!userSnap.exists()){

    return null;

}

return userSnap.data();

}

/* ============================================================
NORMALIZE ROLE
============================================================ */

function getRole(
data
){

if(!data){
    return "";
}

const role =
    String(
        data.role ||
        data.userType ||
        data.type ||
        ""
    )
    .trim()
    .toLowerCase();

if(
    role === "administrator"
){

    return "admin";

}

if(
    role === "admin"
){

    return "admin";

}

if(
    role === "rider" ||
    role === "driver"
){

    return "rider";

}

if(
    role === "customer" ||
    role === "user"
){

    return "customer";

}

return role;

}

/* ============================================================
REDIRECT BY ROLE
============================================================ */

function redirectByRole(
role,
data
){

/* ========================================================
   ADMIN
======================================================== */

if(role === "admin"){

    window.location.replace(
        "../admin/dashboard.html"
    );

    return true;

}


/* ========================================================
   RIDER
======================================================== */

if(role === "rider"){

    const approved =
        data.approved === true;

    const status =
        String(
            data.status || ""
        )
        .trim()
        .toLowerCase();


    if(
        approved &&
        status === "active"
    ){

        window.location.replace(
            "../rider/home.html"
        );

    }
    else{

        window.location.replace(
            "../rider/pending.html"
        );

    }

    return true;

}


/* ========================================================
   CUSTOMER
======================================================== */

if(role === "customer"){

    window.location.replace(
        "../customer/home.html"
    );

    return true;

}


return false;

}

/* ============================================================
LOGIN
============================================================ */

async function loginUser(){

if(loginInProgress){
    return;
}


const email =
    emailInput
        ? emailInput.value
            .trim()
            .toLowerCase()
        : "";


const password =
    passwordInput
        ? passwordInput.value
        : "";


/* ========================================================
   VALIDATION
======================================================== */

if(!email){

    showMessage(
        "Please enter your email address.",
        "error"
    );

    if(emailInput){
        emailInput.focus();
    }

    return;

}


if(!email.includes("@")){

    showMessage(
        "Please enter a valid email address.",
        "error"
    );

    if(emailInput){
        emailInput.focus();
    }

    return;

}


if(!password){

    showMessage(
        "Please enter your password.",
        "error"
    );

    if(passwordInput){
        passwordInput.focus();
    }

    return;

}


/* ========================================================
   START LOGIN
======================================================== */

loginInProgress =
    true;

setLoading(true);

showMessage(
    "Signing in...",
    "info"
);


try{

    /* ====================================================
       FIREBASE AUTH
    ==================================================== */

    const result =
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );


    const firebaseUser =
        result.user;


    if(!firebaseUser){

        throw new Error(
            "Firebase authentication failed."
        );

    }


    /* ====================================================
       FIRESTORE PROFILE
    ==================================================== */

    showMessage(
        "Checking account role...",
        "info"
    );


    const data =
        await getUserProfile(
            firebaseUser.uid
        );


    /* ====================================================
       NO PROFILE
    ==================================================== */

    if(!data){

        await signOut(auth);

        throw new Error(
            "User profile not found. Firebase Auth account ke UID ke naam se users collection me profile nahi mili."
        );

    }


    console.log(
        "RiderX Login User:",
        {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            data: data
        }
    );


    /* ====================================================
       ROLE
    ==================================================== */

    const role =
        getRole(data);


    console.log(
        "RiderX Detected Role:",
        role
    );


    /* ====================================================
       ROLE NOT FOUND
    ==================================================== */

    if(!role){

        await signOut(auth);

        throw new Error(
            "Account role not found. users document me role field missing hai."
        );

    }


    /* ====================================================
       REQUESTED ROLE CHECK
    ====================================================

       If user opened:

       login.html?role=rider

       and account is customer, don't silently
       send customer somewhere unexpected.

    */

    if(
        requestedRole === "rider" &&
        role !== "rider"
    ){

        await signOut(auth);

        throw new Error(
            "This account is not registered as a Rider."
        );

    }


    if(
        requestedRole === "customer" &&
        role !== "customer"
    ){

        /*
         * Admin is allowed to use normal login,
         * but not customer-specific login.
         */

        await signOut(auth);

        throw new Error(
            "This account is not registered as a Customer."
        );

    }


    /* ====================================================
       SUCCESS
    ==================================================== */

    showMessage(
        "Login successful. Opening your dashboard...",
        "success"
    );


    setLoading(true);


    /*
     * Small delay so Firebase auth state settles
     * before navigation.
     */

    setTimeout(
        () => {

            const redirected =
                redirectByRole(
                    role,
                    data
                );


            if(!redirected){

                /*
                 * Unknown role protection.
                 */

                signOut(auth);

                setLoading(false);

                loginInProgress =
                    false;

                showMessage(
                    "Access denied. Invalid account role.",
                    "error"
                );

            }

        },
        250
    );


}
catch(error){

    console.error(
        "RiderX Login Error:",
        error
    );


    let message =
        "Login failed. Please try again.";


    switch(
        error.code
    ){

        case "auth/invalid-credential":

            message =
                "Email or password is incorrect.";

            break;


        case "auth/invalid-email":

            message =
                "Invalid email address.";

            break;


        case "auth/user-not-found":

            message =
                "Account not found.";

            break;


        case "auth/wrong-password":

            message =
                "Wrong password.";

            break;


        case "auth/user-disabled":

            message =
                "This account has been disabled.";

            break;


        case "auth/too-many-requests":

            message =
                "Too many login attempts. Please try again later.";

            break;


        case "auth/network-request-failed":

            message =
                "Network error. Please check your internet connection.";

            break;


        default:

            if(
                error.message
            ){

                message =
                    error.message;

            }

            break;

    }


    setLoading(false);

    loginInProgress =
        false;


    showMessage(
        "❌ " + message,
        "error"
    );

}

}

/* ============================================================
FORM SUBMIT
============================================================ */

if(loginForm){

loginForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        loginUser();

    }
);

}

/* ============================================================
ENTER KEY FALLBACK
============================================================ */

if(emailInput){

emailInput.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter"
        ){

            event.preventDefault();

            loginUser();

        }

    }
);

}

if(passwordInput){

passwordInput.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter"
        ){

            event.preventDefault();

            loginUser();

        }

    }
);

}

/* ============================================================
EXISTING SESSION CHECK

IMPORTANT:

Login page should NOT automatically redirect a normal
logged-in customer/rider when opened from a login link.

However, if there is already an authenticated user,
we verify their role before redirecting.

============================================================ */

let initialAuthCheck = true;

onAuthStateChanged(
auth,
async user => {

    /*
     * Don't interfere with the login operation.
     */

    if(loginInProgress){

        initialAuthCheck =
            false;

        return;

    }


    if(!user){

        initialAuthCheck =
            false;

        return;

    }


    try{

        /*
         * Existing authenticated session.
         */

        const data =
            await getUserProfile(
                user.uid
            );


        if(!data){

            await signOut(auth);

            initialAuthCheck =
                false;

            return;

        }


        const role =
            getRole(data);


        console.log(
            "Existing RiderX Session:",
            role
        );


        /*
         * Only redirect known valid roles.
         */

        if(
            role === "admin" ||
            role === "rider" ||
            role === "customer"
        ){

            /*
             * If this is a role-specific login URL,
             * don't redirect to the wrong role.
             */

            if(
                requestedRole === "rider" &&
                role !== "rider"
            ){

                await signOut(auth);

                initialAuthCheck =
                    false;

                return;

            }


            if(
                requestedRole === "customer" &&
                role !== "customer"
            ){

                await signOut(auth);

                initialAuthCheck =
                    false;

                return;

            }


            /*
             * Existing valid session.
             */

            redirectByRole(
                role,
                data
            );

        }

    }
    catch(error){

        console.warn(
            "Existing session check failed:",
            error
        );

    }


    initialAuthCheck =
        false;

}

);

/* ============================================================
EXPORT
============================================================ */

export {
loginUser,
getUserProfile,
getRole,
redirectByRole
};
