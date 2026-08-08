/* ============================================================
   RIDERX - FIREBASE CONFIGURATION
   File: firebase/firebase-config.js

   Firebase Project:
   riderx-1

   Services used by RiderX:
   - Firebase Authentication
   - Realtime Database
   - Cloud Firestore
   - Cloud Storage
   - Firebase Cloud Messaging
   - Firebase Analytics (optional)

   IMPORTANT:
   Firebase Web API keys are project/app identifiers.
   Database, Firestore and Storage security MUST be handled
   through Firebase Security Rules and App Check.
   ============================================================ */

(function (window) {

    "use strict";


    /* ========================================================
       FIREBASE CONFIG
       ======================================================== */

    const firebaseConfig = {

        apiKey:
            "AIzaSyAjYxSxATNcJyUBKI2I4vn3KDWxxLKGJhs",

        authDomain:
            "riderx-1.firebaseapp.com",

        databaseURL:
            "https://riderx-1-default-rtdb.asia-southeast1.firebasedatabase.app",

        projectId:
            "riderx-1",

        storageBucket:
            "riderx-1.firebasestorage.app",

        messagingSenderId:
            "261640190671",

        appId:
            "1:261640190671:web:701b3ce5dcb6135fd955ba",

        measurementId:
            "G-SM8KLBVPWN"
    };


    /* ========================================================
       RIDERX FIREBASE NAMESPACE
       ======================================================== */

    window.RiderX =
        window.RiderX || {};


    window.RiderX.firebase =
        window.RiderX.firebase || {};


    window.RiderX.firebase.config =
        firebaseConfig;


    /* ========================================================
       FIREBASE AVAILABILITY CHECK
       ======================================================== */

    if (
        typeof firebase ===
        "undefined"
    ) {

        console.error(
            "RiderX Firebase: Firebase SDK is not loaded."
        );

        window.RiderX.firebase.ready =
            false;

        return;
    }


    /* ========================================================
       INITIALIZE FIREBASE
       ======================================================== */

    let app = null;


    try {

        if (
            firebase.apps &&
            firebase.apps.length > 0
        ) {

            app =
                firebase.apps[0];

        } else {

            app =
                firebase.initializeApp(
                    firebaseConfig
                );
        }

    } catch (error) {

        console.error(
            "RiderX Firebase initialization failed:",
            error
        );

        window.RiderX.firebase.ready =
            false;

        window.RiderX.firebase.error =
            error;

        return;
    }


    window.RiderX.firebase.app =
        app;


    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    try {

        if (
            typeof firebase.auth ===
            "function"
        ) {

            window.RiderX.firebase.auth =
                firebase.auth();

        } else {

            window.RiderX.firebase.auth =
                null;
        }

    } catch (error) {

        console.warn(
            "RiderX Firebase Auth unavailable:",
            error
        );

        window.RiderX.firebase.auth =
            null;
    }


    /* ========================================================
       REALTIME DATABASE
       ======================================================== */

    try {

        if (
            typeof firebase.database ===
            "function"
        ) {

            window.RiderX.firebase.database =
                firebase.database();

        } else {

            window.RiderX.firebase.database =
                null;
        }

    } catch (error) {

        console.warn(
            "RiderX Realtime Database unavailable:",
            error
        );

        window.RiderX.firebase.database =
            null;
    }


    /* ========================================================
       CLOUD FIRESTORE
       ======================================================== */

    try {

        if (
            typeof firebase.firestore ===
            "function"
        ) {

            window.RiderX.firebase.firestore =
                firebase.firestore();

        } else {

            window.RiderX.firebase.firestore =
                null;
        }

    } catch (error) {

        console.warn(
            "RiderX Firestore unavailable:",
            error
        );

        window.RiderX.firebase.firestore =
            null;
    }


    /* ========================================================
       CLOUD STORAGE
       ======================================================== */

    try {

        if (
            typeof firebase.storage ===
            "function"
        ) {

            window.RiderX.firebase.storage =
                firebase.storage();

        } else {

            window.RiderX.firebase.storage =
                null;
        }

    } catch (error) {

        console.warn(
            "RiderX Firebase Storage unavailable:",
            error
        );

        window.RiderX.firebase.storage =
            null;
    }


    /* ========================================================
       FIREBASE MESSAGING
       ======================================================== */

    try {

        if (
            typeof firebase.messaging ===
            "function"
        ) {

            window.RiderX.firebase.messaging =
                firebase.messaging();

        } else {

            window.RiderX.firebase.messaging =
                null;
        }

    } catch (error) {

        console.warn(
            "RiderX Firebase Messaging unavailable:",
            error
        );

        window.RiderX.firebase.messaging =
            null;
    }


    /* ========================================================
       ANALYTICS
       ======================================================== */

    try {

        if (
            typeof firebase.analytics ===
            "function"
        ) {

            window.RiderX.firebase.analytics =
                firebase.analytics();

        } else {

            window.RiderX.firebase.analytics =
                null;
        }

    } catch (error) {

        /*
         * Analytics should never prevent
         * RiderX from loading.
         */

        console.warn(
            "RiderX Analytics unavailable:",
            error
        );

        window.RiderX.firebase.analytics =
            null;
    }


    /* ========================================================
       FIREBASE SERVICE STATUS
       ======================================================== */

    window.RiderX.firebase.services = {

        auth:
            Boolean(
                window.RiderX.firebase.auth
            ),

        realtimeDatabase:
            Boolean(
                window.RiderX.firebase.database
            ),

        firestore:
            Boolean(
                window.RiderX.firebase.firestore
            ),

        storage:
            Boolean(
                window.RiderX.firebase.storage
            ),

        messaging:
            Boolean(
                window.RiderX.firebase.messaging
            ),

        analytics:
            Boolean(
                window.RiderX.firebase.analytics
            )
    };


    /* ========================================================
       READY FLAG
       ======================================================== */

    window.RiderX.firebase.ready =
        true;


    /* ========================================================
       HELPER FUNCTIONS
       ======================================================== */

    window.RiderX.firebase.getUser =
        function () {

            try {

                if (
                    window.RiderX.firebase.auth
                ) {

                    return window.RiderX.firebase.auth
                        .currentUser;
                }

            } catch (error) {

                console.warn(
                    "Unable to get Firebase user:",
                    error
                );
            }

            return null;
        };


    window.RiderX.firebase.isLoggedIn =
        function () {

            return Boolean(
                window.RiderX.firebase.getUser()
            );
        };


    window.RiderX.firebase.getUid =
        function () {

            const user =
                window.RiderX.firebase
                    .getUser();


            return user
                ? user.uid
                : null;
        };


    /* ========================================================
       DATABASE HELPERS
       ======================================================== */

    window.RiderX.firebase.ref =
        function (
            path
        ) {

            if (
                !window.RiderX.firebase.database
            ) {

                throw new Error(
                    "Firebase Realtime Database is unavailable."
                );
            }


            return window.RiderX.firebase
                .database
                .ref(
                    path
                );
        };


    window.RiderX.firebase.firestoreCollection =
        function (
            collection
        ) {

            if (
                !window.RiderX.firebase.firestore
            ) {

                throw new Error(
                    "Cloud Firestore is unavailable."
                );
            }


            return window.RiderX.firebase
                .firestore
                .collection(
                    collection
                );
        };


    /* ========================================================
       AUTH STATE LISTENER HELPER
       ======================================================== */

    window.RiderX.firebase.onAuthStateChanged =
        function (
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                return null;
            }


            if (
                !window.RiderX.firebase.auth
            ) {

                return null;
            }


            return window.RiderX.firebase
                .auth
                .onAuthStateChanged(
                    callback
                );
        };


    /* ========================================================
       GLOBAL ALIAS
       ========================================================

       Existing RiderX files may use:
       - firebaseConfig
       - RiderX.firebase
       - firebase.app()
       - firebase.auth()
       - firebase.database()
       - firebase.firestore()

       We preserve Firebase's normal global SDK API while
       also exposing the organized RiderX namespace.
       ======================================================== */

    window.firebaseConfig =
        firebaseConfig;


    /* ========================================================
       LOG
       ======================================================== */

    console.log(
        "RiderX Firebase initialized:",
        {

            projectId:
                firebaseConfig.projectId,

            auth:
                window.RiderX.firebase.services
                    .auth,

            realtimeDatabase:
                window.RiderX.firebase.services
                    .realtimeDatabase,

            firestore:
                window.RiderX.firebase.services
                    .firestore,

            storage:
                window.RiderX.firebase.services
                    .storage,

            messaging:
                window.RiderX.firebase.services
                    .messaging
        }
    );


})(window);
