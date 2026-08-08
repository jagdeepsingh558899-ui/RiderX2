/* ============================================================
RiderX Authentication Guard
Customer + Rider + Admin
Firebase v10 Modular SDK

PURPOSE:

- Protect customer pages
- Protect rider pages
- Protect admin pages
- Verify Firebase login
- Verify Firestore users/{uid} role
- Prevent wrong-role access
- Prevent Access Denied -> Book Ride redirect loop
- No automatic redirect for logged-out users to Book Ride
  ============================================================ */

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

/* ============================================================
PATH INFORMATION
============================================================ */

const pathname =
window.location.pathname.toLowerCase();

const currentPage =
window.location.pathname
.split("/")
.pop()
.toLowerCase();

const isAdminPage =
pathname.includes("/admin/");

const isRiderPage =
pathname.includes("/rider/");

const isCustomerPage =
pathname.includes("/customer/");

/* ============================================================
IMPORTANT PUBLIC PAGES

These pages are allowed without Firebase login.

============================================================ */

const publicPages = [

"/auth/login.html",
"/auth/register.html",
"/auth/customer-login.html",
"/auth/rider-login.html",
"/auth/otp-login.html",
"/auth/verify-otp.html",
"/auth/role.html",
"/index.html"

];

function isPublicPage(){

return publicPages.some(
    page =>
        pathname.endsWith(page)
);

}

/* ============================================================
ROLE NORMALIZATION
============================================================ */

function normalizeRole(data){

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
GET USER PROFILE
============================================================ */

async function getUserProfile(uid){

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


if(
    !userSnap.exists()
){

    return null;

}


return userSnap.data();

}

/* ============================================================
LOGIN PAGE REDIRECT
============================================================ */

function redirectToLogin(){

/*
 * NEVER use "../auth/login.html" blindly.
 *
 * All protected folders are one level below
 * RiderX root, so this path is correct.
 */

window.location.replace(
    "../auth/login.html"
);

}

/* ============================================================
ADMIN ACCESS
============================================================ */

function checkAdminAccess(data){

const role =
    normalizeRole(data);


if(
    role !== "admin"
){

    return false;

}


return true;

}

/* ============================================================
RIDER ACCESS
============================================================ */

function checkRiderAccess(data){

const role =
    normalizeRole(data);


if(
    role !== "rider"
){

    return {
        allowed:false,
        reason:"not-rider"
    };

}


const approved =
    data.approved === true;


const status =
    String(
        data.status || ""
    )
    .trim()
    .toLowerCase();


/*
 * Rider is authenticated but not yet approved.
 *
 * We allow pending page itself.
 * Other rider pages go to pending.
 */

if(
    !approved ||
    status !== "active"
){

    return {
        allowed:false,
        reason:"pending"
    };

}


return {
    allowed:true,
    reason:"active"
};

}

/* ============================================================
CUSTOMER ACCESS
============================================================ */

function checkCustomerAccess(data){

const role =
    normalizeRole(data);


if(
    role !== "customer"
){

    return false;

}


return true;

}

/* ============================================================
REDIRECT BASED ON ACTUAL ROLE
============================================================ */

function redirectToCorrectArea(
role,
data
){

/* ========================================================
   ADMIN
======================================================== */

if(
    role === "admin"
){

    /*
     * Admin should never be sent to Book Ride.
     */

    if(!isAdminPage){

        window.location.replace(
            "../admin/dashboard.html"
        );

    }

    return;

}


/* ========================================================
   RIDER
======================================================== */

if(
    role === "rider"
){

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

        if(!isRiderPage){

            window.location.replace(
                "../rider/home.html"
            );

        }

    }
    else{

        /*
         * Pending rider should not enter
         * customer Book Ride pages.
         */

        if(
            !pathname.endsWith(
                "/rider/pending.html"
            )
        ){

            window.location.replace(
                "../rider/pending.html"
            );

        }

    }

    return;

}


/* ========================================================
   CUSTOMER
======================================================== */

if(
    role === "customer"
){

    if(!isCustomerPage){

        window.location.replace(
            "../customer/home.html"
        );

    }

    return;

}


/* ========================================================
   UNKNOWN ROLE
======================================================== */

console.warn(
    "RiderX: Unknown user role."
);

}

/* ============================================================
AUTH STATE GUARD
============================================================ */

let guardRunning = false;

onAuthStateChanged(
auth,
async user => {

    /*
     * Prevent multiple simultaneous checks.
     */

    if(guardRunning){

        return;

    }


    guardRunning = true;


    try{

        /* =================================================
           NO FIREBASE USER
        ================================================= */

        if(!user){

            /*
             * Public page:
             * stay where the user is.
             */

            if(
                isPublicPage()
            ){

                return;

            }


            /*
             * Protected page:
             * send to login.
             *
             * IMPORTANT:
             * We DO NOT send to customer/home.html.
             */

            if(
                isAdminPage ||
                isRiderPage ||
                isCustomerPage
            ){

                redirectToLogin();

                return;

            }


            return;

        }


        /* =================================================
           FIREBASE USER EXISTS
        ================================================= */

        const data =
            await getUserProfile(
                user.uid
            );


        /* =================================================
           PROFILE MISSING
        ================================================= */

        if(!data){

            console.warn(
                "RiderX: Firebase user exists but users profile is missing."
            );


            await signOut(
                auth
            );


            /*
             * If already on a public page,
             * stay there.
             */

            if(
                isPublicPage()
            ){

                return;

            }


            redirectToLogin();

            return;

        }


        /* =================================================
           ROLE
        ================================================= */

        const role =
            normalizeRole(data);


        console.log(
            "RiderX Auth Guard:",
            {
                uid:user.uid,
                email:user.email,
                role:role,
                path:pathname
            }
        );


        /* =================================================
           ADMIN PAGE
        ================================================= */

        if(
            isAdminPage
        ){

            if(
                !checkAdminAccess(
                    data
                )
            ){

                /*
                 * DO NOT redirect to Book Ride.
                 *
                 * Sign out first and return to login.
                 */

                await signOut(
                    auth
                );


                window.location.replace(
                    "../auth/login.html"
                );


                return;

            }


            /*
             * Valid admin.
             * Stay on admin page.
             */

            return;

        }


        /* =================================================
           RIDER PAGE
        ================================================= */

        if(
            isRiderPage
        ){

            const riderAccess =
                checkRiderAccess(
                    data
                );


            if(
                riderAccess.allowed
            ){

                /*
                 * Active rider.
                 * Stay on rider page.
                 */

                return;

            }


            if(
                riderAccess.reason ===
                "pending"
            ){

                /*
                 * Don't create redirect loop
                 * on pending.html itself.
                 */

                if(
                    !pathname.endsWith(
                        "/rider/pending.html"
                    )
                ){

                    window.location.replace(
                        "../rider/pending.html"
                    );

                }

                return;

            }


            /*
             * Account isn't rider.
             */

            await signOut(
                auth
            );


            window.location.replace(
                "../auth/login.html?role=rider"
            );


            return;

        }


        /* =================================================
           CUSTOMER PAGE
        ================================================= */

        if(
            isCustomerPage
        ){

            if(
                checkCustomerAccess(
                    data
                )
            ){

                /*
                 * Valid customer.
                 * Stay on customer page.
                 */

                return;

            }


            /*
             * Customer page opened by another role.
             *
             * DO NOT send to Book Ride.
             */

            if(
                role === "admin"
            ){

                window.location.replace(
                    "../admin/dashboard.html"
                );

                return;

            }


            if(
                role === "rider"
            ){

                const riderAccess =
                    checkRiderAccess(
                        data
                    );


                if(
                    riderAccess.allowed
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

                return;

            }


            /*
             * Unknown role.
             */

            await signOut(
                auth
            );


            window.location.replace(
                "../auth/login.html"
            );


            return;

        }


        /* =================================================
           PUBLIC PAGE + LOGGED-IN USER
        ================================================= */

        if(
            isPublicPage()
        ){

            /*
             * Do NOT interfere with login/register
             * pages here.
             *
             * Login.js and index.html handle their
             * own controlled redirects.
             */

            return;

        }

    }
    catch(error){

        console.error(
            "RiderX Auth Guard Error:",
            error
        );


        /*
         * IMPORTANT:
         *
         * Never send the user to Book Ride when
         * authentication checking fails.
         */

        if(
            isAdminPage ||
            isRiderPage ||
            isCustomerPage
        ){

            window.location.replace(
                "../auth/login.html"
            );

        }

    }
    finally{

        guardRunning =
            false;

    }

}

);

/* ============================================================
LOGOUT
============================================================ */

async function logoutUser(){

try{

    await signOut(
        auth
    );


    /*
     * Logout always goes to public login page.
     */

    window.location.replace(
        "../auth/login.html"
    );

}
catch(error){

    console.error(
        "RiderX Logout Error:",
        error
    );

}

}

/* ============================================================
EXPORT
============================================================ */

export {
getUserProfile,
normalizeRole,
checkAdminAccess,
checkRiderAccess,
checkCustomerAccess,
redirectToCorrectArea,
logoutUser
};
