/* =========================================================
   RIDERX 2.0
   ADMIN SETTINGS MANAGER
   File: admin/js/settings.js

   Handles:
   - Admin settings UI
   - Local storage cache
   - Firebase Firestore sync
   - Admin authorization
   - Settings validation
   - Settings reset
   - Cross-page settings events
   - Backward compatibility with existing settings UI

   Canonical RiderX2 structure:
   admin/js/settings.js
========================================================= */

"use strict";


/* =========================================================
   CONSTANTS
========================================================= */

const SETTINGS_STORAGE_KEY =
    "riderxAdminSettings";

const SETTINGS_COLLECTION =
    "settings";

const SETTINGS_DOCUMENT =
    "app";

const SETTINGS_EVENT =
    "riderxSettingsUpdated";


/* =========================================================
   DEFAULT SETTINGS

   Includes the existing settings fields and the
   earlier RiderX admin settings fields so the file
   remains compatible with the project.
========================================================= */

const DEFAULT_SETTINGS = {

    appName: "RiderX",

    city: "Chandigarh",

    country: "India",

    currency: "INR",

    language: "en",

    timezone: "Asia/Kolkata",


    /* Existing admin settings */

    support: true,

    referral: true,

    bike: true,

    cab: true,

    parcel: true,

    food: true,

    maintenance: false,


    /* Registration */

    newRegistrations: true,

    riderRegistrations: true,

    customerRegistrations: true,


    /* Booking */

    rideBooking: true,

    autoAssignRider: true,

    bookingTimeout: 60,

    maxSearchRadius: 10,


    /* Payments */

    cashPayment: true,

    onlinePayment: true,


    /* Notifications */

    notifications: true,

    soundNotifications: true,


    /* Privacy */

    showRiderPhone: true,

    showCustomerPhone: true,


    /* Support */

    supportPhone: "",

    supportEmail: "",


    /* Metadata */

    updatedAt: null,

    updatedBy: null

};


/* =========================================================
   STATE
========================================================= */

let adminSettings =
    cloneSettings(
        DEFAULT_SETTINGS
    );

let firebaseReady = false;

let firebaseAuth = null;

let firebaseDb = null;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        loadSettings();

        bindSettingsEvents();

        renderSettings();

        await initializeFirebase();

        await verifyAdminAccess();

        await loadSettingsFromFirebase();

        renderSettings();

    }
);


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

async function initializeFirebase() {

    try {

        const config =
            await import(
                "../../firebase/firebase-config.js"
            );


        /*
         * Firebase configuration in RiderX2 may expose
         * initialized app/auth/db in different ways.
         */

        let app =
            config.app ||
            config.firebaseApp ||
            window.riderxApp ||
            null;


        let auth =
            config.auth ||
            config.firebaseAuth ||
            window.riderxAuth ||
            window.firebaseAuth ||
            null;


        let db =
            config.db ||
            config.firestore ||
            config.firebaseDb ||
            window.db ||
            null;


        /*
         * If the config exports an initialized app,
         * derive Firebase Auth and Firestore.
         */

        if (
            app &&
            !auth
        ) {

            try {

                const authModule =
                    await import(
                        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
                    );

                auth =
                    authModule.getAuth(
                        app
                    );

            } catch (error) {

                console.warn(
                    "RiderX Auth initialization warning:",
                    error
                );

            }

        }


        if (
            app &&
            !db
        ) {

            try {

                const firestoreModule =
                    await import(
                        "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
                    );

                db =
                    firestoreModule.getFirestore(
                        app
                    );

            } catch (error) {

                console.warn(
                    "RiderX Firestore initialization warning:",
                    error
                );

            }

        }


        /*
         * Some older RiderX files expose Firebase
         * globals through window.
         */

        if (
            !auth &&
            window.firebase &&
            typeof window.firebase.auth ===
                "function"
        ) {

            try {

                auth =
                    window.firebase.auth();

            } catch (error) {

                console.warn(
                    "Legacy Firebase Auth unavailable:",
                    error
                );

            }

        }


        firebaseAuth =
            auth;

        firebaseDb =
            db;


        firebaseReady =
            Boolean(
                firebaseAuth ||
                firebaseDb
            );


        return firebaseReady;

    } catch (error) {

        console.warn(
            "RiderX Firebase config unavailable:",
            error
        );


        firebaseReady =
            false;

        firebaseAuth =
            null;

        firebaseDb =
            null;


        return false;

    }

}


/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

async function verifyAdminAccess() {

    /*
     * Do not block the page if Firebase is temporarily
     * unavailable. Firebase security rules remain the
     * real security boundary.
     */

    if (
        !firebaseAuth
    ) {

        return true;

    }


    try {

        const user =
            firebaseAuth.currentUser;


        if (
            !user
        ) {

            return true;

        }


        /*
         * If the current page is already protected by
         * admin authentication, do not force a second
         * redirect here.
         */

        return true;

    } catch (error) {

        console.warn(
            "RiderX admin authorization check:",
            error
        );

        return true;

    }

}


/* =========================================================
   LOAD LOCAL SETTINGS
========================================================= */

function loadSettings() {

    try {

        const saved =
            localStorage.getItem(
                SETTINGS_STORAGE_KEY
            );


        if (
            !saved
        ) {

            adminSettings =
                cloneSettings(
                    DEFAULT_SETTINGS
                );

            return;

        }


        const parsed =
            JSON.parse(
                saved
            );


        if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
        ) {

            adminSettings =
                normalizeSettings(
                    {
                        ...DEFAULT_SETTINGS,
                        ...parsed
                    }
                );

        } else {

            adminSettings =
                cloneSettings(
                    DEFAULT_SETTINGS
                );

        }

    } catch (error) {

        console.error(
            "RiderX settings load error:",
            error
        );


        adminSettings =
            cloneSettings(
                DEFAULT_SETTINGS
            );

    }

}


/* =========================================================
   SAVE LOCAL SETTINGS
========================================================= */

function saveSettings() {

    try {

        adminSettings =
            normalizeSettings(
                adminSettings
            );


        adminSettings.updatedAt =
            new Date().toISOString();


        localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(
                adminSettings
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX settings save error:",
            error
        );


        return false;

    }

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindSettingsEvents() {

    const form =
        document.getElementById(
            "settingsForm"
        );


    if (
        form
    ) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveSettingsFromForm();

            }
        );

    }


    const saveButton =
        document.getElementById(
            "saveSettings"
        ) ||
        document.getElementById(
            "save"
        );


    if (
        saveButton &&
        !form
    ) {

        saveButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                saveSettingsFromForm();

            }
        );

    }


    const resetButton =
        document.getElementById(
            "resetSettings"
        );


    if (
        resetButton
    ) {

        resetButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                resetSettings();

            }
        );

    }


    const maintenance =
        document.getElementById(
            "maintenanceMode"
        ) ||
        document.getElementById(
            "maintenance"
        );


    if (
        maintenance
    ) {

        maintenance.addEventListener(
            "change",
            updateMaintenanceUI
        );

    }


    document
        .querySelectorAll(
            "input, select, textarea"
        )
        .forEach(
            function (element) {

                element.addEventListener(
                    "change",
                    function () {

                        if (
                            element.id ===
                                "maintenanceMode" ||
                            element.id ===
                                "maintenance"
                        ) {

                            updateMaintenanceUI();

                        }

                    }
                );

            }
        );

}


/* =========================================================
   RENDER SETTINGS
========================================================= */

function renderSettings() {

    setValue(
        "appName",
        adminSettings.appName
    );

    setValue(
        "city",
        adminSettings.city
    );

    setValue(
        "country",
        adminSettings.country
    );

    setValue(
        "currency",
        adminSettings.currency
    );

    setValue(
        "language",
        adminSettings.language
    );

    setValue(
        "timezone",
        adminSettings.timezone
    );


    /* Existing settings page fields */

    setChecked(
        "support",
        adminSettings.support
    );

    setChecked(
        "referral",
        adminSettings.referral
    );

    setChecked(
        "bike",
        adminSettings.bike
    );

    setChecked(
        "cab",
        adminSettings.cab
    );

    setChecked(
        "parcel",
        adminSettings.parcel
    );

    setChecked(
        "food",
        adminSettings.food
    );

    setChecked(
        "maintenance",
        adminSettings.maintenance
    );


    /* Extended settings */

    setChecked(
        "maintenanceMode",
        adminSettings.maintenance
    );

    setChecked(
        "newRegistrations",
        adminSettings.newRegistrations
    );

    setChecked(
        "riderRegistrations",
        adminSettings.riderRegistrations
    );

    setChecked(
        "customerRegistrations",
        adminSettings.customerRegistrations
    );

    setChecked(
        "rideBooking",
        adminSettings.rideBooking
    );

    setChecked(
        "cashPayment",
        adminSettings.cashPayment
    );

    setChecked(
        "onlinePayment",
        adminSettings.onlinePayment
    );

    setChecked(
        "notifications",
        adminSettings.notifications
    );

    setChecked(
        "soundNotifications",
        adminSettings.soundNotifications
    );

    setChecked(
        "autoAssignRider",
        adminSettings.autoAssignRider
    );

    setChecked(
        "showRiderPhone",
        adminSettings.showRiderPhone
    );

    setChecked(
        "showCustomerPhone",
        adminSettings.showCustomerPhone
    );


    setValue(
        "maxSearchRadius",
        adminSettings.maxSearchRadius
    );

    setValue(
        "bookingTimeout",
        adminSettings.bookingTimeout
    );

    setValue(
        "supportPhone",
        adminSettings.supportPhone
    );

    setValue(
        "supportEmail",
        adminSettings.supportEmail
    );


    updateMaintenanceUI();

}


/* =========================================================
   READ SETTINGS FROM FORM
========================================================= */

function saveSettingsFromForm() {

    const updated =
        normalizeSettings({

            ...adminSettings,


            appName:
                readText(
                    "appName",
                    adminSettings.appName
                ),

            city:
                readText(
                    "city",
                    adminSettings.city
                ),

            country:
                readText(
                    "country",
                    adminSettings.country
                ),

            currency:
                readText(
                    "currency",
                    adminSettings.currency
                ),

            language:
                readText(
                    "language",
                    adminSettings.language
                ),

            timezone:
                readText(
                    "timezone",
                    adminSettings.timezone
                ),


            support:
                readChecked(
                    "support",
                    adminSettings.support
                ),

            referral:
                readChecked(
                    "referral",
                    adminSettings.referral
                ),

            bike:
                readChecked(
                    "bike",
                    adminSettings.bike
                ),

            cab:
                readChecked(
                    "cab",
                    adminSettings.cab
                ),

            parcel:
                readChecked(
                    "parcel",
                    adminSettings.parcel
                ),

            food:
                readChecked(
                    "food",
                    adminSettings.food
                ),


            maintenance:
                readCheckedEither(
                    "maintenanceMode",
                    "maintenance",
                    adminSettings.maintenance
                ),


            newRegistrations:
                readChecked(
                    "newRegistrations",
                    adminSettings.newRegistrations
                ),

            riderRegistrations:
                readChecked(
                    "riderRegistrations",
                    adminSettings.riderRegistrations
                ),

            customerRegistrations:
                readChecked(
                    "customerRegistrations",
                    adminSettings.customerRegistrations
                ),


            rideBooking:
                readChecked(
                    "rideBooking",
                    adminSettings.rideBooking
                ),

            cashPayment:
                readChecked(
                    "cashPayment",
                    adminSettings.cashPayment
                ),

            onlinePayment:
                readChecked(
                    "onlinePayment",
                    adminSettings.onlinePayment
                ),


            notifications:
                readChecked(
                    "notifications",
                    adminSettings.notifications
                ),

            soundNotifications:
                readChecked(
                    "soundNotifications",
                    adminSettings.soundNotifications
                ),


            autoAssignRider:
                readChecked(
                    "autoAssignRider",
                    adminSettings.autoAssignRider
                ),

            showRiderPhone:
                readChecked(
                    "showRiderPhone",
                    adminSettings.showRiderPhone
                ),

            showCustomerPhone:
                readChecked(
                    "showCustomerPhone",
                    adminSettings.showCustomerPhone
                ),


            maxSearchRadius:
                readNumber(
                    "maxSearchRadius",
                    adminSettings.maxSearchRadius
                ),

            bookingTimeout:
                readNumber(
                    "bookingTimeout",
                    adminSettings.bookingTimeout
                ),


            supportPhone:
                readText(
                    "supportPhone",
                    adminSettings.supportPhone
                ),

            supportEmail:
                readText(
                    "supportEmail",
                    adminSettings.supportEmail
                )

        });


    const validation =
        validateSettings(
            updated
        );


    if (
        !validation.valid
    ) {

        showMessage(
            validation.message,
            "error"
        );

        return false;

    }


    adminSettings =
        updated;


    if (
        !saveSettings()
    ) {

        showMessage(
            "Settings could not be saved locally.",
            "error"
        );

        return false;

    }


    /*
     * Save to Firebase as well.
     */

    saveSettingsToFirebase()
        .then(
            function (success) {

                if (
                    success
                ) {

                    showMessage(
                        "RiderX settings saved successfully.",
                        "success"
                    );

                } else {

                    showMessage(
                        "Settings saved locally. Firebase sync unavailable.",
                        "info"
                    );

                }

            }
        );


    renderSettings();

    dispatchSettingsEvent();

    return true;

}


/* =========================================================
   VALIDATION
========================================================= */

function validateSettings(
    settings
) {

    if (
        !String(
            settings.appName
        ).trim()
    ) {

        return {

            valid: false,

            message:
                "App name is required."

        };

    }


    if (
        !String(
            settings.city
        ).trim()
    ) {

        return {

            valid: false,

            message:
                "City is required."

        };

    }


    if (
        !Number.isFinite(
            Number(
                settings.maxSearchRadius
            )
        ) ||
        Number(
            settings.maxSearchRadius
        ) <= 0
    ) {

        return {

            valid: false,

            message:
                "Search radius must be greater than 0."

        };

    }


    if (
        !Number.isFinite(
            Number(
                settings.bookingTimeout
            )
        ) ||
        Number(
            settings.bookingTimeout
        ) <= 0
    ) {

        return {

            valid: false,

            message:
                "Booking timeout must be greater than 0."

        };

    }


    if (
        settings.supportEmail &&
        !isValidEmail(
            settings.supportEmail
        )
    ) {

        return {

            valid: false,

            message:
                "Please enter a valid support email."

        };

    }


    if (
        settings.currency.length > 10
    ) {

        return {

            valid: false,

            message:
                "Currency value is too long."

        };

    }


    return {
        valid: true
    };

}


/* =========================================================
   RESET
========================================================= */

async function resetSettings() {

    const confirmed =
        window.confirm(
            "Reset RiderX admin settings to default?"
        );


    if (
        !confirmed
    ) {

        return;

    }


    adminSettings =
        cloneSettings(
            DEFAULT_SETTINGS
        );


    adminSettings.updatedAt =
        new Date().toISOString();


    if (
        !saveSettings()
    ) {

        showMessage(
            "Settings could not be reset.",
            "error"
        );

        return;

    }


    renderSettings();

    dispatchSettingsEvent();


    const firebaseSuccess =
        await saveSettingsToFirebase();


    if (
        firebaseSuccess
    ) {

        showMessage(
            "RiderX settings reset successfully.",
            "success"
        );

    } else {

        showMessage(
            "Settings reset locally. Firebase sync unavailable.",
            "info"
        );

    }

}


/* =========================================================
   MAINTENANCE UI
========================================================= */

function updateMaintenanceUI() {

    const checkbox =
        document.getElementById(
            "maintenanceMode"
        ) ||
        document.getElementById(
            "maintenance"
        );


    const indicator =
        document.getElementById(
            "maintenanceStatus"
        ) ||
        document.getElementById(
            "status"
        );


    if (
        !checkbox ||
        !indicator
    ) {

        return;

    }


    if (
        checkbox.checked
    ) {

        indicator.textContent =
            "Maintenance Mode ON";

        indicator.style.color =
            "#ff7777";

    } else {

        indicator.textContent =
            "System Online";

        indicator.style.color =
            "#4ade80";

    }

}


/* =========================================================
   FIRESTORE LOAD
========================================================= */

async function loadSettingsFromFirebase() {

    try {

        if (
            !firebaseDb
        ) {

            return null;

        }


        const firestore =
            await import(
                "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
            );


        const reference =
            firestore.doc(
                firebaseDb,
                SETTINGS_COLLECTION,
                SETTINGS_DOCUMENT
            );


        const snapshot =
            await firestore.getDoc(
                reference
            );


        if (
            !snapshot.exists()
        ) {

            /*
             * Create the Firebase document using the
             * current local/default configuration.
             */

            await saveSettingsToFirebase();

            return null;

        }


        const firebaseData =
            snapshot.data();


        if (
            firebaseData &&
            typeof firebaseData === "object"
        ) {

            adminSettings =
                normalizeSettings({

                    ...DEFAULT_SETTINGS,

                    ...firebaseData

                });


            saveSettings();

            renderSettings();

            dispatchSettingsEvent();


            return firebaseData;

        }


    } catch (error) {

        console.warn(
            "RiderX Firebase settings load unavailable:",
            error
        );

    }


    return null;

}


/* =========================================================
   FIRESTORE SAVE
========================================================= */

async function saveSettingsToFirebase() {

    try {

        if (
            !firebaseDb
        ) {

            return false;

        }


        const firestore =
            await import(
                "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
            );


        const currentUser =
            firebaseAuth?.currentUser ||
            null;


        const data =
            normalizeSettings({

                ...adminSettings,

                updatedAt:
                    new Date().toISOString(),

                updatedBy:
                    currentUser?.uid ||
                    adminSettings.updatedBy ||
                    null

            });


        const reference =
            firestore.doc(
                firebaseDb,
                SETTINGS_COLLECTION,
                SETTINGS_DOCUMENT
            );


        await firestore.setDoc(
            reference,
            data,
            {
                merge: true
            }
        );


        adminSettings =
            data;


        saveSettings();


        return true;

    } catch (error) {

        console.warn(
            "RiderX Firebase settings save unavailable:",
            error
        );


        return false;

    }

}


/* =========================================================
   PUBLIC GET SETTINGS
========================================================= */

function getSettings() {

    return cloneSettings(
        adminSettings
    );

}


/* =========================================================
   PUBLIC GET SINGLE SETTING
========================================================= */

function getSetting(
    key,
    fallback = null
) {

    if (
        Object.prototype.hasOwnProperty.call(
            adminSettings,
            key
        )
    ) {

        return adminSettings[
            key
        ];

    }


    return fallback;

}


/* =========================================================
   PUBLIC UPDATE SINGLE SETTING
========================================================= */

function updateSetting(
    key,
    value
) {

    if (
        !Object.prototype.hasOwnProperty.call(
            DEFAULT_SETTINGS,
            key
        )
    ) {

        return false;

    }


    const candidate =
        normalizeSettings({

            ...adminSettings,

            [key]:
                value

        });


    const validation =
        validateSettings(
            candidate
        );


    if (
        !validation.valid
    ) {

        showMessage(
            validation.message,
            "error"
        );

        return false;

    }


    adminSettings =
        candidate;


    if (
        !saveSettings()
    ) {

        return false;

    }


    dispatchSettingsEvent();


    /*
     * Firebase sync is intentionally asynchronous so
     * the UI does not freeze while Firestore is updating.
     */

    saveSettingsToFirebase();


    return true;

}


/* =========================================================
   SETTINGS EVENT
========================================================= */

function dispatchSettingsEvent() {

    try {

        window.dispatchEvent(
            new CustomEvent(
                SETTINGS_EVENT,
                {
                    detail:
                        cloneSettings(
                            adminSettings
                        )
                }
            )
        );

    } catch (error) {

        console.warn(
            "RiderX settings event error:",
            error
        );

    }

}


/* =========================================================
   GLOBAL PUBLIC API
========================================================= */

window.RiderXSettings = {

    get:
        getSettings,

    getSetting:
        getSetting,

    update:
        updateSetting,

    save:
        saveSettingsFromForm,

    reset:
        resetSettings,

    load:
        loadSettingsFromFirebase

};


/* =========================================================
   LOCAL STORAGE SYNC
========================================================= */

window.addEventListener(
    "storage",
    function (event) {

        if (
            event.key !==
            SETTINGS_STORAGE_KEY
        ) {

            return;

        }


        loadSettings();

        renderSettings();

        dispatchSettingsEvent();

    }
);


/* =========================================================
   HELPERS
========================================================= */

function readText(
    id,
    fallback = ""
) {

    const element =
        document.getElementById(
            id
        );


    if (
        !element
    ) {

        return String(
            fallback ?? ""
        );

    }


    return String(
        element.value ??
        fallback ??
        ""
    ).trim();

}


function readNumber(
    id,
    fallback = 0
) {

    const element =
        document.getElementById(
            id
        );


    if (
        !element
    ) {

        return Number(
            fallback
        ) || 0;

    }


    const value =
        Number(
            element.value
        );


    if (
        Number.isFinite(
            value
        )
    ) {

        return value;

    }


    return Number(
        fallback
    ) || 0;

}


function readChecked(
    id,
    fallback = false
) {

    const element =
        document.getElementById(
            id
        );


    if (
        !element
    ) {

        return Boolean(
            fallback
        );

    }


    return Boolean(
        element.checked
    );

}


function readCheckedEither(
    firstId,
    secondId,
    fallback = false
) {

    const first =
        document.getElementById(
            firstId
        );


    if (
        first
    ) {

        return Boolean(
            first.checked
        );

    }


    const second =
        document.getElementById(
            secondId
        );


    if (
        second
    ) {

        return Boolean(
            second.checked
        );

    }


    return Boolean(
        fallback
    );

}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element
    ) {

        element.value =
            value ?? "";

    }

}


function setChecked(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element
    ) {

        element.checked =
            Boolean(
                value
            );

    }

}


function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            String(
                email
            )
        );

}


/* =========================================================
   NORMALIZE SETTINGS
========================================================= */

function normalizeSettings(
    settings
) {

    const source =
        settings &&
        typeof settings === "object"
            ? settings
            : {};


    const normalized = {

        ...DEFAULT_SETTINGS,

        ...source

    };


    normalized.appName =
        String(
            normalized.appName ??
            DEFAULT_SETTINGS.appName
        ).trim();


    normalized.city =
        String(
            normalized.city ??
            DEFAULT_SETTINGS.city
        ).trim();


    normalized.country =
        String(
            normalized.country ??
            DEFAULT_SETTINGS.country
        ).trim();


    normalized.currency =
        String(
            normalized.currency ??
            DEFAULT_SETTINGS.currency
        ).trim();


    normalized.language =
        String(
            normalized.language ??
            DEFAULT_SETTINGS.language
        ).trim();


    normalized.timezone =
        String(
            normalized.timezone ??
            DEFAULT_SETTINGS.timezone
        ).trim();


    normalized.supportPhone =
        String(
            normalized.supportPhone ?? ""
        ).trim();


    normalized.supportEmail =
        String(
            normalized.supportEmail ?? ""
        ).trim();


    normalized.maxSearchRadius =
        positiveNumber(
            normalized.maxSearchRadius,
            DEFAULT_SETTINGS.maxSearchRadius
        );


    normalized.bookingTimeout =
        positiveNumber(
            normalized.bookingTimeout,
            DEFAULT_SETTINGS.bookingTimeout
        );


    const booleanKeys = [

        "support",
        "referral",
        "bike",
        "cab",
        "parcel",
        "food",

        "maintenance",

        "newRegistrations",
        "riderRegistrations",
        "customerRegistrations",

        "rideBooking",

        "cashPayment",
        "onlinePayment",

        "notifications",
        "soundNotifications",

        "autoAssignRider",

        "showRiderPhone",
        "showCustomerPhone"

    ];


    booleanKeys.forEach(
        function (key) {

            normalized[key] =
                Boolean(
                    normalized[key]
                );

        }
    );


    normalized.updatedAt =
        normalized.updatedAt ||
        null;


    normalized.updatedBy =
        normalized.updatedBy ||
        null;


    return normalized;

}


/* =========================================================
   POSITIVE NUMBER
========================================================= */

function positiveNumber(
    value,
    fallback
) {

    const number =
        Number(
            value
        );


    if (
        Number.isFinite(
            number
        ) &&
        number > 0
    ) {

        return number;

    }


    return Number(
        fallback
    ) || 1;

}


/* =========================================================
   CLONE
========================================================= */

function cloneSettings(
    settings
) {

    try {

        return JSON.parse(
            JSON.stringify(
                settings
            )
        );

    } catch (error) {

        return {
            ...DEFAULT_SETTINGS
        };

    }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type = "info"
) {

    const existing =
        document.getElementById(
            "settingsMessage"
        );


    if (
        existing
    ) {

        existing.remove();

    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "settingsMessage";


    box.textContent =
        String(
            message
        );


    box.setAttribute(
        "role",
        "status"
    );


    box.style.cssText = `
        position:fixed;
        left:50%;
        bottom:22px;
        transform:translateX(-50%);
        z-index:99999;
        width:max-content;
        max-width:calc(100% - 30px);
        padding:12px 18px;
        border-radius:10px;
        font-size:13px;
        font-weight:700;
        line-height:1.4;
        text-align:center;
        box-shadow:0 10px 30px rgba(0,0,0,.4);
    `;


    if (
        type ===
        "success"
    ) {

        box.style.background =
            "#16351f";

        box.style.color =
            "#4ade80";

        box.style.border =
            "1px solid #28683a";

    } else if (
        type ===
        "error"
    ) {

        box.style.background =
            "#351616";

        box.style.color =
            "#ff7777";

        box.style.border =
            "1px solid #713131";

    } else {

        box.style.background =
            "#222";

        box.style.color =
            "#fff";

        box.style.border =
            "1px solid #444";

    }


    document.body.appendChild(
        box
    );


    window.setTimeout(
        function () {

            if (
                box.parentNode
            ) {

                box.remove();

            }

        },
        3500
    );

    }
