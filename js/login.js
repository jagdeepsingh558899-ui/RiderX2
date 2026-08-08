// =====================================
// RiderX CUSTOMER / RIDER LOGIN
// Firebase v10 Modular SDK
//
// IMPORTANT:
// Admin login is handled ONLY by:
// /admin/login.html
//
// This file never sends a user to the
// Admin dashboard automatically.
// =====================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const loginForm =
    document.getElementById("login-form");

const message =
    document.getElementById("error-message");

const loginButton =
    document.getElementById("login-btn");


function showMessage(text, type = "") {

    if (!message) {
        return;
    }

    message.style.display = "block";
    message.textContent = text;

    message.style.color =
        type === "success"
            ? "#22d66b"
            : "#ff4444";
}


function setLoading(loading) {

    if (!loginButton) {
        return;
    }

    loginButton.disabled =
        loading;

    loginButton.textContent =
        loading
            ? "Logging in..."
            : "Login";
}


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                document
                    .getElementById("password")
                    .value;


            if (!email || !password) {

                showMessage(
                    "Please enter email and password."
                );

                return;
            }


            setLoading(true);

            showMessage("");


            try {

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
                        "Firebase authentication failed."
                    );

                }


                /*
                 * Get the user's profile.
                 */

                const userRef =
                    doc(
                        db,
                        "users",
                        user.uid
                    );


                const userSnap =
                    await getDoc(
                        userRef
                    );


                if (!userSnap.exists()) {

                    throw new Error(
                        "User profile not found in Firestore."
                    );

                }


                const data =
                    userSnap.data();


                const role =
                    String(
                        data.role ||
                        data.userType ||
                        data.type ||
                        ""
                    )
                    .trim()
                    .toLowerCase();


                console.log(
                    "RiderX Login Role:",
                    role
                );


                /*
                 * ADMIN
                 *
                 * Admin can still use the common
                 * login if necessary, but always
                 * goes ONLY to Admin dashboard.
                 */

                if (role === "admin") {

                    showMessage(
                        "Admin account detected. Opening Admin Panel...",
                        "success"
                    );


                    setTimeout(
                        () => {

                            window.location.replace(
                                "../admin/dashboard.html"
                            );

                        },
                        300
                    );


                    return;
                }


                /*
                 * RIDER
                 */

                if (role === "rider") {

                    const approved =
                        data.approved === true ||
                        data.isApproved === true;


                    const status =
                        String(
                            data.status ||
                            data.accountStatus ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    showMessage(
                        "Rider login successful.",
                        "success"
                    );


                    setTimeout(
                        () => {

                            if (
                                approved &&
                                (
                                    status === "active" ||
                                    status === "approved"
                                )
                            ) {

                                window.location.replace(
                                    "../rider/home.html"
                                );

                            } else {

                                window.location.replace(
                                    "../rider/pending.html"
                                );

                            }

                        },
                        300
                    );


                    return;
                }


                /*
                 * CUSTOMER
                 *
                 * Only explicitly recognized
                 * customer/user accounts are sent
                 * to customer home.
                 */

                if (
                    role === "customer" ||
                    role === "user"
                ) {

                    showMessage(
                        "Login successful.",
                        "success"
                    );


                    setTimeout(
                        () => {

                            window.location.replace(
                                "../customer/home.html"
                            );

                        },
                        300
                    );


                    return;
                }


                /*
                 * UNKNOWN ROLE
                 *
                 * VERY IMPORTANT:
                 * Do NOT send unknown users to
                 * Book Ride/customer page.
                 */

                showMessage(
                    "Access denied. Your account role is not configured."
                );


            }
            catch (error) {

                console.error(
                    "RiderX Login Error:",
                    error
                );


                let errorMessage =
                    "Login failed.";


                switch (error.code) {

                    case "auth/invalid-credential":

                        errorMessage =
                            "Email or password is incorrect.";

                        break;


                    case "auth/user-not-found":

                        errorMessage =
                            "Account not found.";

                        break;


                    case "auth/wrong-password":

                        errorMessage =
                            "Wrong password.";

                        break;


                    case "auth/invalid-email":

                        errorMessage =
                            "Invalid email address.";

                        break;


                    case "auth/user-disabled":

                        errorMessage =
                            "This account has been disabled.";

                        break;


                    case "auth/too-many-requests":

                        errorMessage =
                            "Too many login attempts. Please try again later.";

                        break;


                    case "auth/network-request-failed":

                        errorMessage =
                            "Network error. Check your internet connection.";

                        break;


                    case "permission-denied":

                        errorMessage =
                            "Firestore permission denied.";

                        break;


                    default:

                        if (
                            error.message &&
                            error.message.includes(
                                "Missing or insufficient permissions"
                            )
                        ) {

                            errorMessage =
                                "Firestore permission denied.";

                        }
                        else {

                            errorMessage =
                                error.message ||
                                "Login failed.";

                        }

                }


                showMessage(
                    "❌ " + errorMessage
                );

            }
            finally {

                setLoading(false);

            }

        }
    );

}
