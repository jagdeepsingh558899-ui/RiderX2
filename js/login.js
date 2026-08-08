// ============================================================
// RiderX Login System
// Customer + Rider + Admin
// Firebase v10 Modular SDK
// ============================================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// ELEMENTS
// ============================================================

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const message = document.getElementById("error-message");
const loginBtn = document.getElementById("login-btn");


// ============================================================
// GET ROLE FROM URL
// ============================================================

const params = new URLSearchParams(window.location.search);

const requestedRole =
    (params.get("role") || "").trim().toLowerCase();


// ============================================================
// MESSAGE
// ============================================================

function showMessage(text, type = "error") {

    if (!message) return;

    message.style.display = "block";
    message.textContent = text;

    if (type === "success") {
        message.style.color = "#22d66b";
    } else {
        message.style.color = "#ff4444";
    }
}


// ============================================================
// BUTTON STATE
// ============================================================

function setLoading(loading) {

    if (!loginBtn) return;

    loginBtn.disabled = loading;

    loginBtn.textContent =
        loading ? "Logging in..." : "Login";
}


// ============================================================
// ROLE REDIRECT
// ============================================================

function redirectUser(data) {

    const role =
        String(
            data?.role ||
            data?.userType ||
            data?.type ||
            ""
        )
        .trim()
        .toLowerCase();


    // ========================================================
    // ADMIN
    // ========================================================

    if (
        role === "admin" ||
        role === "administrator" ||
        data?.isAdmin === true
    ) {

        window.location.replace(
            "../admin/dashboard.html"
        );

        return;
    }


    // ========================================================
    // RIDER
    // ========================================================

    if (role === "rider") {

        const approved =
            data?.approved === true;

        const active =
            String(data?.status || "")
                .trim()
                .toLowerCase() === "active";


        if (approved && active) {

            window.location.replace(
                "../rider/home.html"
            );

        } else {

            window.location.replace(
                "../rider/pending.html"
            );
        }

        return;
    }


    // ========================================================
    // CUSTOMER
    // ========================================================

    window.location.replace(
        "../customer/home.html"
    );
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(event) {

    event.preventDefault();


    if (!emailInput || !passwordInput) {
        return;
    }


    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!email) {

        showMessage(
            "Please enter your email address."
        );

        emailInput.focus();

        return;
    }


    if (!password) {

        showMessage(
            "Please enter your password."
        );

        passwordInput.focus();

        return;
    }


    setLoading(true);

    showMessage("Checking account...", "success");


    try {

        // ====================================================
        // FIREBASE LOGIN
        // ====================================================

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            result.user;


        if (!user) {

            throw new Error(
                "Firebase user was not returned."
            );
        }


        // ====================================================
        // GET USER PROFILE
        // ====================================================

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


        // ====================================================
        // USER PROFILE MISSING
        // ====================================================

        if (!userSnap.exists()) {

            await signOut(auth);

            throw new Error(
                "Your account profile was not found. Please register again."
            );
        }


        const data =
            userSnap.data();


        console.log(
            "RiderX logged-in user:",
            {
                uid: user.uid,
                email: user.email,
                role: data.role,
                status: data.status,
                approved: data.approved
            }
        );


        const role =
            String(
                data.role ||
                data.userType ||
                data.type ||
                ""
            )
            .trim()
            .toLowerCase();


        // ====================================================
        // REQUESTED ROLE CHECK
        // ====================================================

        /*
           If login page was opened with:

           ?role=rider

           then a customer/admin account cannot
           accidentally enter the rider login flow.
        */

        if (
            requestedRole === "rider" &&
            role !== "rider"
        ) {

            await signOut(auth);

            throw new Error(
                "This account is not registered as a Rider."
            );
        }


        if (
            requestedRole === "customer" &&
            role !== "customer" &&
            role !== ""
        ) {

            await signOut(auth);

            throw new Error(
                "This account is not registered as a Customer."
            );
        }


        // ====================================================
        // SUCCESS
        // ====================================================

        showMessage(
            "Login successful. Opening your account...",
            "success"
        );


        setTimeout(
            () => {
                redirectUser(data);
            },
            250
        );


    } catch (error) {

        console.error(
            "RiderX Login Error:",
            error
        );


        let text =
            "Login failed.";


        switch (error.code) {

            case "auth/invalid-credential":

                text =
                    "Email or password is incorrect.";

                break;


            case "auth/user-not-found":

                text =
                    "Account not found.";

                break;


            case "auth/wrong-password":

                text =
                    "Incorrect password.";

                break;


            case "auth/invalid-email":

                text =
                    "Please enter a valid email address.";

                break;


            case "auth/user-disabled":

                text =
                    "This account has been disabled.";

                break;


            case "auth/too-many-requests":

                text =
                    "Too many login attempts. Please try again later.";

                break;


            case "auth/network-request-failed":

                text =
                    "Network error. Please check your internet connection.";

                break;


            case "permission-denied":

                text =
                    "Firestore permission denied.";

                break;


            default:

                if (error.message) {

                    text =
                        error.message;
                }
        }


        setLoading(false);

        showMessage(
            "❌ " + text,
            "error"
        );
    }
}


// ============================================================
// FORM EVENT
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        loginUser
    );
}


// ============================================================
// AUTO FOCUS
// ============================================================

if (emailInput) {

    setTimeout(
        () => {
            emailInput.focus();
        },
        200
    );
}
