// ============================================================
// RiderX Login System
// Customer + Rider + Admin
// Firebase v10 Modular SDK
// FINAL - APPROVAL + ROUTING FIXED
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

const loginForm =
    document.getElementById("login-form");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const message =
    document.getElementById("error-message");

const loginBtn =
    document.getElementById("login-btn");


// ============================================================
// REQUESTED ROLE
// ============================================================

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


// ============================================================
// SHOW MESSAGE
// ============================================================

function showMessage(
    text,
    type = "error"
) {

    if (!message) return;

    message.style.display = "block";

    message.textContent = text;

    if (type === "success") {

        message.style.color =
            "#22d66b";

    } else {

        message.style.color =
            "#ff4444";
    }
}


// ============================================================
// BUTTON LOADING
// ============================================================

function setLoading(
    loading
) {

    if (!loginBtn) return;

    loginBtn.disabled =
        loading;

    loginBtn.textContent =
        loading
            ? "Logging in..."
            : "Login";
}


// ============================================================
// NORMALIZE ROLE
// ============================================================

function getUserRole(
    data
) {

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
// NORMALIZE STATUS
// ============================================================

function normalizeStatus(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
}


// ============================================================
// RIDER APPROVAL CHECK
//
// Supports all common RiderX approval formats:
//
// adminApproved: true
// approved: true
// status: "approved"
// status: "active"
// approvalStatus: "approved"
// applicationStatus: "approved"
// ============================================================

function isRiderApproved(
    userData,
    riderData
) {

    const user =
        userData || {};

    const rider =
        riderData || {};


    // --------------------------------------------------------
    // DIRECT BOOLEAN APPROVAL
    // --------------------------------------------------------

    if (
        user.adminApproved === true ||
        rider.adminApproved === true
    ) {

        return true;
    }


    if (
        user.approved === true ||
        rider.approved === true
    ) {

        return true;
    }


    // --------------------------------------------------------
    // APPROVAL STATUS
    // --------------------------------------------------------

    const userApprovalStatus =
        normalizeStatus(
            user.approvalStatus
        );

    const riderApprovalStatus =
        normalizeStatus(
            rider.approvalStatus
        );


    if (
        userApprovalStatus === "approved" ||
        userApprovalStatus === "active" ||
        riderApprovalStatus === "approved" ||
        riderApprovalStatus === "active"
    ) {

        return true;
    }


    // --------------------------------------------------------
    // APPLICATION STATUS
    // --------------------------------------------------------

    const userApplicationStatus =
        normalizeStatus(
            user.applicationStatus
        );

    const riderApplicationStatus =
        normalizeStatus(
            rider.applicationStatus
        );


    if (
        userApplicationStatus === "approved" ||
        userApplicationStatus === "active" ||
        riderApplicationStatus === "approved" ||
        riderApplicationStatus === "active"
    ) {

        return true;
    }


    // --------------------------------------------------------
    // NORMAL STATUS
    // --------------------------------------------------------

    const userStatus =
        normalizeStatus(
            user.status
        );

    const riderStatus =
        normalizeStatus(
            rider.status
        );


    if (
        userStatus === "approved" ||
        userStatus === "active" ||
        riderStatus === "approved" ||
        riderStatus === "active"
    ) {

        return true;
    }


    return false;
}


// ============================================================
// RIDER PENDING CHECK
// ============================================================

function isRiderPending(
    userData,
    riderData
) {

    const user =
        userData || {};

    const rider =
        riderData || {};


    const statuses = [

        user.status,

        rider.status,

        user.approvalStatus,

        rider.approvalStatus,

        user.applicationStatus,

        rider.applicationStatus

    ];


    return statuses.some(
        value => {

            const status =
                normalizeStatus(
                    value
                );

            return (
                status === "pending" ||
                status === "submitted" ||
                status === "underreview" ||
                status === "waiting"
            );
        }
    );
}


// ============================================================
// BLOCKED / DISABLED CHECK
// ============================================================

function isBlocked(
    userData,
    riderData
) {

    const userStatus =
        normalizeStatus(
            userData?.status
        );

    const riderStatus =
        normalizeStatus(
            riderData?.status
        );


    return (

        userStatus === "blocked" ||
        userStatus === "disabled" ||
        userStatus === "suspended" ||

        riderStatus === "blocked" ||
        riderStatus === "disabled" ||
        riderStatus === "suspended"

    );
}


// ============================================================
// SAFE REDIRECT
// ============================================================

function redirectTo(
    path
) {

    console.log(
        "RiderX Redirect:",
        path
    );

    window.location.replace(
        path
    );
}


// ============================================================
// REDIRECT USER
// ============================================================

async function redirectUser(
    userData,
    riderData = null
) {

    const role =
        getUserRole(
            userData
        );


    console.log(
        "RiderX Final Role:",
        role
    );


    // ========================================================
    // ADMIN
    // ========================================================

    if (
        role === "admin" ||
        role === "administrator" ||
        userData?.isAdmin === true
    ) {

        redirectTo(
            "../admin/dashboard.html"
        );

        return;
    }


    // ========================================================
    // RIDER
    // ========================================================

    if (role === "rider") {


        // ----------------------------------------------------
        // BLOCKED RIDER
        // ----------------------------------------------------

        if (
            isBlocked(
                userData,
                riderData
            )
        ) {

            await signOut(
                auth
            );

            throw new Error(
                "Your Rider account has been disabled. Please contact RiderX support."
            );
        }


        // ----------------------------------------------------
        // APPROVED RIDER
        //
        // IMPORTANT:
        // Actual file is:
        //
        // rider/home.html
        //
        // NOT:
        //
        // rider/Home.html
        // ----------------------------------------------------

        const approved =
            isRiderApproved(
                userData,
                riderData
            );


        console.log(
            "RiderX Approval Check:",
            {
                approved: approved,
                userAdminApproved:
                    userData?.adminApproved,
                riderAdminApproved:
                    riderData?.adminApproved,
                userApproved:
                    userData?.approved,
                riderApproved:
                    riderData?.approved,
                userStatus:
                    userData?.status,
                riderStatus:
                    riderData?.status,
                userApprovalStatus:
                    userData?.approvalStatus,
                riderApprovalStatus:
                    riderData?.approvalStatus
            }
        );


        if (approved) {

            console.log(
                "RiderX: Rider approved. Opening home.html"
            );


            redirectTo(
                "../rider/home.html"
            );

            return;
        }


        // ----------------------------------------------------
        // PENDING RIDER
        // ----------------------------------------------------

        if (
            isRiderPending(
                userData,
                riderData
            )
        ) {

            console.log(
                "RiderX: Rider pending."
            );


            /*
             * If pending.html exists,
             * open it.
             *
             * Otherwise open home.html only
             * when account is not explicitly blocked.
             *
             * This prevents a missing pending.html
             * from causing the confusing Vercel 404.
             */

            redirectTo(
                "../rider/pending.html"
            );

            return;
        }


        // ----------------------------------------------------
        // UNKNOWN RIDER STATUS
        // ----------------------------------------------------

        /*
         * Some older RiderX accounts may not have
         * a status field at all.
         *
         * Don't send them to a missing page.
         * Keep them on the rider home page.
         *
         * Admin approval should normally set one of
         * the approval fields above.
         */

        console.warn(
            "RiderX: Rider approval status not found. Opening rider/home.html."
        );


        redirectTo(
            "../rider/home.html"
        );

        return;
    }


    // ========================================================
    // CUSTOMER
    // ========================================================

    if (role === "customer") {


        if (
            isBlocked(
                userData,
                null
            )
        ) {

            await signOut(
                auth
            );

            throw new Error(
                "Your Customer account has been disabled. Please contact RiderX support."
            );
        }


        redirectTo(
            "../customer/home.html"
        );

        return;
    }


    // ========================================================
    // UNKNOWN ROLE
    // ========================================================

    await signOut(
        auth
    );


    throw new Error(
        "Your account role is missing or invalid. Please contact RiderX support."
    );
}


// ============================================================
// LOGIN USER
// ============================================================

async function loginUser(
    event
) {

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


    setLoading(
        true
    );


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


        console.log(
            "RiderX Firebase Login:",
            {
                uid: user.uid,
                email: user.email
            }
        );


        // ====================================================
        // USERS DOCUMENT
        // ====================================================

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

            await signOut(
                auth
            );

            throw new Error(
                "Your RiderX account profile was not found. Please register again."
            );
        }


        const userData =
            userSnap.data();


        const role =
            getUserRole(
                userData
            );


        console.log(
            "RiderX User Profile:",
            userData
        );


        // ====================================================
        // REQUESTED ROLE SECURITY
        // ====================================================

        if (
            requestedRole === "rider" &&
            role !== "rider"
        ) {

            await signOut(
                auth
            );

            throw new Error(
                "This account is not registered as a Rider."
            );
        }


        if (
            requestedRole === "customer" &&
            role !== "customer"
        ) {

            await signOut(
                auth
            );

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

            await signOut(
                auth
            );

            throw new Error(
                "This account does not have administrator access."
            );
        }


        // ====================================================
        // RIDER PROFILE
        // ====================================================

        let riderData =
            null;


        if (
            role === "rider"
        ) {

            const riderRef =
                doc(
                    db,
                    "riders",
                    user.uid
                );


            const riderSnap =
                await getDoc(
                    riderRef
                );


            if (
                riderSnap.exists()
            ) {

                riderData =
                    riderSnap.data();

            } else {

                console.warn(
                    "RiderX: riders/" +
                    user.uid +
                    " does not exist."
                );
            }


            console.log(
                "RiderX Rider Profile:",
                riderData
            );
        }


        // ====================================================
        // ACCOUNT BLOCK CHECK
        // ====================================================

        if (
            isBlocked(
                userData,
                riderData
            )
        ) {

            await signOut(
                auth
            );

            throw new Error(
                "Your RiderX account has been disabled. Please contact RiderX support."
            );
        }


        // ====================================================
        // LOGIN SUCCESS
        // ====================================================

        showMessage(
            "Login successful. Opening your account...",
            "success"
        );


        // ====================================================
        // REDIRECT DIRECTLY
        // ====================================================

        await redirectUser(
            userData,
            riderData
        );


    } catch (error) {


        console.error(
            "RiderX Login Error:",
            error
        );


        let text =
            "Login failed.";


        switch (
            error.code
        ) {


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

                if (
                    error.message
                ) {

                    text =
                        error.message;
                }

        }


        setLoading(
            false
        );


        showMessage(
            "❌ " + text,
            "error"
        );
    }
}


// ============================================================
// FORM EVENT
// ============================================================

if (
    loginForm
) {

    loginForm.addEventListener(
        "submit",
        loginUser
    );
}


// ============================================================
// AUTO FOCUS
// ============================================================

if (
    emailInput
) {

    setTimeout(
        () => {

            if (
                document.activeElement ===
                document.body ||
                document.activeElement ===
                null
            ) {

                emailInput.focus();
            }

        },
        200
    );
                }
