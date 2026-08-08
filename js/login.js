// ============================================================
// RiderX Login System
// Customer + Rider + Admin
// Firebase v10 Modular SDK
// FINAL VERSION
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
// GET REQUESTED ROLE
// ============================================================

const params = new URLSearchParams(window.location.search);

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
        loading
            ? "Logging in..."
            : "Login";
}


// ============================================================
// NORMALIZE ROLE
// ============================================================

function getUserRole(data) {

    return String(
        data?.role ||
        data?.userType ||
        data?.type ||
        ""
    )
        .trim()
        .toLowerCase();
}


// ============================================================
// RIDER APPROVAL CHECK
// ============================================================

function isRiderApproved(userData, riderData) {

    /*
     * RiderX may have approval information in either
     * users/{uid} or riders/{uid}.
     *
     * We support both formats so old/new rider records
     * continue working.
     */

    const adminApproved =
        riderData?.adminApproved === true ||
        userData?.adminApproved === true;

    const approved =
        riderData?.approved === true ||
        userData?.approved === true;

    const userStatus =
        String(userData?.status || "")
            .trim()
            .toLowerCase();

    const riderStatus =
        String(riderData?.status || "")
            .trim()
            .toLowerCase();

    const active =
        userStatus === "active" ||
        riderStatus === "active";

    /*
     * Primary approval:
     * adminApproved=true
     *
     * Backward compatibility:
     * approved=true + active status
     */

    if (adminApproved) {
        return true;
    }

    if (approved && active) {
        return true;
    }

    return false;
}


// ============================================================
// REDIRECT USER
// ============================================================

async function redirectUser(userData, riderData = null) {

    const role = getUserRole(userData);


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


        if (approved) {

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
    // UNKNOWN ROLE
    // ========================================================

    await signOut(auth);

    throw new Error(
        "Your account role is missing or invalid. Please contact RiderX support."
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

    showMessage(
        "Checking account...",
        "success"
    );


    try {

        // ====================================================
        // FIREBASE AUTH LOGIN
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
        // FIRESTORE USER PROFILE
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
                "Your RiderX account profile was not found. Please register again."
            );
        }


        const userData =
            userSnap.data();


        const role =
            getUserRole(userData);


        console.log(
            "RiderX Login:",
            {
                uid: user.uid,
                email: user.email,
                role: role,
                status: userData.status,
                approved: userData.approved,
                adminApproved: userData.adminApproved
            }
        );


        // ====================================================
        // REQUESTED ROLE SECURITY CHECK
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

            } else {

                console.warn(
                    "Rider profile not found in riders collection."
                );
            }


            console.log(
                "RiderX Rider Profile:",
                riderData
            );
        }


        // ====================================================
        // ACCOUNT STATUS CHECK
        // ====================================================

        const userStatus =
            String(userData.status || "")
                .trim()
                .toLowerCase();


        const riderStatus =
            String(riderData?.status || "")
                .trim()
                .toLowerCase();


        // ====================================================
        // BLOCKED / DISABLED RIDER
        // ====================================================

        if (
            role === "rider" &&
            (
                userStatus === "blocked" ||
                userStatus === "disabled" ||
                riderStatus === "blocked" ||
                riderStatus === "disabled"
            )
        ) {

            await signOut(auth);

            throw new Error(
                "Your Rider account has been disabled. Please contact RiderX support."
            );
        }


        // ====================================================
        // BLOCKED / DISABLED CUSTOMER
        // ====================================================

        if (
            role === "customer" &&
            (
                userStatus === "blocked" ||
                userStatus === "disabled"
            )
        ) {

            await signOut(auth);

            throw new Error(
                "Your Customer account has been disabled. Please contact RiderX support."
            );
        }


        // ====================================================
        // SUCCESS
        // ====================================================

        showMessage(
            "Login successful. Opening your account...",
            "success"
        );


        /*
         * Short delay lets Firebase finish its auth state
         * propagation before the destination page checks auth.
         */

        setTimeout(
            async () => {

                try {

                    await redirectUser(
                        userData,
                        riderData
                    );

                } catch (redirectError) {

                    console.error(
                        "RiderX Redirect Error:",
                        redirectError
                    );

                    setLoading(false);

                    showMessage(
                        "❌ " +
                        (
                            redirectError.message ||
                            "Unable to open your account."
                        )
                    );
                }

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
                    "Firestore permission denied. Please check Firebase security rules.";

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

            /*
             * Don't steal focus on mobile if the browser
             * already focused another field.
             */

            if (
                document.activeElement === document.body ||
                document.activeElement === null
            ) {

                emailInput.focus();
            }

        },
        200
    );
}
