// ============================================================
// RiderX Login System
// CUSTOMER + RIDER + ADMIN
// Firebase v10 Modular SDK
// FINAL FIXED VERSION
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
// REQUESTED ROLE
// ============================================================

const params =
    new URLSearchParams(window.location.search);

const requestedRole =
    String(params.get("role") || "")
        .trim()
        .toLowerCase();


// ============================================================
// MESSAGE
// ============================================================

function showMessage(text, type = "error") {

    if (!message) return;

    message.style.display = "block";
    message.textContent = text;

    message.style.color =
        type === "success"
            ? "#22d66b"
            : "#ff4444";
}


// ============================================================
// LOADING
// ============================================================

function setLoading(loading) {

    if (!loginBtn) return;

    loginBtn.disabled = loading;

    loginBtn.textContent =
        loading
            ? "Logging in..."
            : "Login";
}


// ============================================================
// ROLE
// ============================================================

function getRole(data) {

    return String(
        data?.role ??
        data?.userType ??
        data?.type ??
        ""
    )
    .trim()
    .toLowerCase();

}


// ============================================================
// NORMALIZE STATUS
// ============================================================

function getStatus(data) {

    return String(
        data?.status ??
        data?.approvalStatus ??
        data?.riderStatus ??
        data?.accountStatus ??
        ""
    )
    .trim()
    .toLowerCase();

}


// ============================================================
// RIDER APPROVAL
// ============================================================

function isRiderApproved(userData, riderData) {

    const all = [
        userData || {},
        riderData || {}
    ];


    // Direct approval flags
    if (
        all.some(
            data =>
                data.approved === true ||
                data.isApproved === true ||
                data.adminApproved === true
        )
    ) {
        return true;
    }


    // Approved / active statuses
    const statuses =
        all
            .map(getStatus)
            .filter(Boolean);


    if (
        statuses.some(
            status =>
                [
                    "approved",
                    "active",
                    "verified"
                ].includes(status)
        )
    ) {
        return true;
    }


    // Account status can be active
    if (
        all.some(
            data =>
                String(
                    data.accountStatus || ""
                )
                .trim()
                .toLowerCase() === "active"
        )
    ) {
        return true;
    }


    return false;
}


// ============================================================
// REDIRECT
// ============================================================

async function redirectUser(
    userData,
    riderData = null
) {

    const role =
        getRole(userData);


    // ========================================================
    // ADMIN
    // ========================================================

    if (
        role === "admin" ||
        role === "administrator" ||
        userData?.isAdmin === true
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
            isRiderApproved(
                userData,
                riderData
            );


        console.log(
            "Rider approval result:",
            approved
        );


        if (approved) {

            // IMPORTANT:
            // File must be exactly:
            // rider/Home.html

            window.location.replace(
                "../rider/Home.html"
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

    if (role === "customer") {

        window.location.replace(
            "../customer/home.html"
        );

        return;
    }


    // ========================================================
    // UNKNOWN
    // ========================================================

    await signOut(auth);

    throw new Error(
        "Your RiderX account role is missing or invalid."
    );
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(event) {

    event.preventDefault();


    if (
        !emailInput ||
        !passwordInput
    ) {
        return;
    }


    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const password =
        passwordInput.value;


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

    showMessage(
        "Checking account...",
        "success"
    );


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
        // USERS PROFILE
        // ====================================================

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


        if (!userSnap.exists()) {

            await signOut(auth);

            throw new Error(
                "RiderX account profile was not found. Please register again."
            );
        }


        const userData =
            userSnap.data();


        const role =
            getRole(userData);


        console.log(
            "RiderX Login:",
            {
                uid: user.uid,
                email: user.email,
                role: role,
                userData: userData
            }
        );


        // ====================================================
        // ROLE SECURITY
        // ====================================================

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
            role !== "customer"
        ) {

            await signOut(auth);

            throw new Error(
                "This account is not registered as a Customer."
            );
        }


        if (
            requestedRole === "admin" &&
            role !== "admin" &&
            role !== "administrator" &&
            userData?.isAdmin !== true
        ) {

            await signOut(auth);

            throw new Error(
                "This account does not have administrator access."
            );
        }


        // ====================================================
        // RIDER PROFILE
        // ====================================================

        let riderData = null;


        if (role === "rider") {

            const riderRef =
                doc(
                    db,
                    "riders",
                    user.uid
                );


            const riderSnap =
                await getDoc(riderRef);


            if (riderSnap.exists()) {

                riderData =
                    riderSnap.data();

            }


            console.log(
                "Rider profile:",
                riderData
            );
        }


        // ====================================================
        // BLOCKED / DISABLED
        // ====================================================

        const userStatus =
            getStatus(userData);

        const riderStatus =
            getStatus(riderData);


        if (
            role === "rider" &&
            [
                userStatus,
                riderStatus
            ].includes("blocked")
        ) {

            await signOut(auth);

            throw new Error(
                "Your Rider account has been blocked."
            );
        }


        if (
            role === "rider" &&
            [
                userStatus,
                riderStatus
            ].includes("disabled")
        ) {

            await signOut(auth);

            throw new Error(
                "Your Rider account has been disabled."
            );
        }


        if (
            role === "customer" &&
            [
                "blocked",
                "disabled"
            ].includes(userStatus)
        ) {

            await signOut(auth);

            throw new Error(
                "Your Customer account has been disabled."
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
            async () => {

                try {

                    await redirectUser(
                        userData,
                        riderData
                    );

                } catch (error) {

                    console.error(
                        "Redirect error:",
                        error
                    );

                    setLoading(false);

                    showMessage(
                        "❌ " +
                        (
                            error.message ||
                            "Unable to open your account."
                        )
                    );

                }

            },
            200
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
                    "This Firebase account has been disabled.";
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
                    text = error.message;
                }

        }


        setLoading(false);

        showMessage(
            "❌ " + text
        );

    }

}


// ============================================================
// FORM
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        loginUser
    );

}
