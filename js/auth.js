// =====================================
// RiderX Authentication System
// Customer + Rider + Admin
// Firebase v10 Compatible
//
// IMPORTANT:
// Admin pages use their own dedicated
// admin/login.html and admin/dashboard.html
// verification.
//
// This common auth file NEVER redirects
// users while they are inside /admin/.
// =====================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// =====================================
// CURRENT PATH
// =====================================

const currentPath =
    window.location.pathname.toLowerCase();


// =====================================
// CHECK ADMIN AREA
// =====================================

const isAdminArea =
    currentPath.includes("/admin/");


// =====================================
// LOGIN PAGE CHECK
// =====================================

const isLoginPage =
    currentPath.includes("/auth/login.html");


// =====================================
// CUSTOMER AREA
// =====================================

const isCustomerArea =
    currentPath.includes("/customer/");


// =====================================
// RIDER AREA
// =====================================

const isRiderArea =
    currentPath.includes("/rider/");


// =====================================
// ROLE REDIRECT
// =====================================

async function redirectByRole(uid) {

    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    uid
                )
            );


        // ---------------------------------
        // USER DOCUMENT NOT FOUND
        // ---------------------------------

        if (!userSnap.exists()) {

            console.warn(
                "RiderX: User profile not found."
            );

            return;

        }


        const user =
            userSnap.data();


        const role =
            String(
                user.role ||
                user.userType ||
                user.type ||
                ""
            )
            .trim()
            .toLowerCase();


        console.log(
            "RiderX Role:",
            role
        );


        // =================================
        // ADMIN
        // =================================

        if (role === "admin") {

            /*
             * IMPORTANT:
             *
             * If already inside /admin/,
             * do NOTHING.
             *
             * Admin pages have their own
             * authentication system.
             */

            if (isAdminArea) {

                console.log(
                    "RiderX: Admin area detected. Common auth redirect disabled."
                );

                return;

            }


            /*
             * If admin is somewhere outside
             * admin area, send to dashboard.
             */

            window.location.replace(
                "../admin/dashboard.html"
            );

            return;

        }


        // =================================
        // RIDER
        // =================================

        if (role === "rider") {

            /*
             * Never redirect an Admin-area page
             * to Rider pages.
             */

            if (isAdminArea) {

                console.log(
                    "RiderX: Admin area protected from rider redirect."
                );

                return;

            }


            const approved =
                user.approved === true ||
                user.isApproved === true;


            const status =
                String(
                    user.status ||
                    user.accountStatus ||
                    ""
                )
                .trim()
                .toLowerCase();


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

            return;

        }


        // =================================
        // CUSTOMER
        // =================================

        /*
         * IMPORTANT:
         *
         * Customer redirect is NEVER allowed
         * from /admin/.
         */

        if (isAdminArea) {

            console.warn(
                "RiderX: Customer redirect blocked inside Admin area."
            );

            return;

        }


        /*
         * Only redirect recognized customer
         * accounts to customer home.
         */

        if (
            role === "customer" ||
            role === "user" ||
            role === ""
        ) {

            /*
             * Don't redirect if already inside
             * customer area.
             */

            if (isCustomerArea) {

                return;

            }


            window.location.replace(
                "../customer/home.html"
            );

            return;

        }


        // =================================
        // UNKNOWN ROLE
        // =================================

        console.warn(
            "RiderX: Unknown user role:",
            role
        );

    }

    catch (error) {

        console.error(
            "RiderX Role Redirect Error:",
            error
        );

    }

}


// =====================================
// AUTH STATE CHECK
// =====================================

/*
 * VERY IMPORTANT:
 *
 * If this is an Admin URL, this common
 * authentication listener does NOT perform
 * customer/rider redirects.
 *
 * Admin pages handle their own Firebase
 * verification.
 */

if (!isAdminArea) {

    onAuthStateChanged(
        auth,
        async (user) => {

            // -----------------------------
            // USER LOGGED IN
            // -----------------------------

            if (user) {

                await redirectByRole(
                    user.uid
                );

                return;

            }


            // -----------------------------
            // USER NOT LOGGED IN
            // -----------------------------

            /*
             * Only protect Customer and
             * Rider areas here.
             */

            if (
                isCustomerArea ||
                isRiderArea
            ) {

                /*
                 * Calculate correct path to
                 * auth/login.html.
                 *
                 * Customer/Rider pages are one
                 * folder below root.
                 */

                window.location.replace(
                    "../auth/login.html"
                );

                return;

            }

        }
    );

}


// =====================================
// LOGOUT
// =====================================

export async function logoutUser() {

    try {

        await signOut(
            auth
        );


        /*
         * Decide where to return based on
         * current section.
         */

        if (isAdminArea) {

            window.location.replace(
                "../admin/login.html"
            );

            return;

        }


        window.location.replace(
            "../auth/login.html"
        );

    }

    catch (error) {

        console.error(
            "RiderX Logout Error:",
            error
        );

    }

}


// =====================================
// OPTIONAL ROLE HELPER
// =====================================

export async function getCurrentUserRole() {

    try {

        const user =
            auth.currentUser;


        if (!user) {

            return null;

        }


        const snap =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


        if (!snap.exists()) {

            return null;

        }


        const data =
            snap.data();


        return String(
            data.role ||
            data.userType ||
            data.type ||
            ""
        )
        .trim()
        .toLowerCase();

    }

    catch (error) {

        console.error(
            "RiderX Role Read Error:",
            error
        );

        return null;

    }

}


// =====================================
// RIDERX AUTH READY
// =====================================

console.log(
    "RiderX Authentication System Loaded"
);

if (isAdminArea) {

    console.log(
        "RiderX: Admin area detected — common customer/rider redirects disabled."
    );

}
