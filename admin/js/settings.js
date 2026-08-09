/* =========================================================
   RiderX Admin - Settings Manager
   File: admin/js/settings.js
========================================================= */

"use strict";

const SETTINGS_STORAGE_KEY = "riderxAdminSettings";

const DEFAULT_SETTINGS = {
    appName: "RiderX",
    city: "Chandigarh",
    country: "India",
    currency: "INR",
    language: "en",
    timezone: "Asia/Kolkata",

    maintenanceMode: false,
    newRegistrations: true,
    riderRegistrations: true,
    customerRegistrations: true,

    rideBooking: true,
    cashPayment: true,
    onlinePayment: true,

    notifications: true,
    soundNotifications: true,

    autoAssignRider: true,
    showRiderPhone: true,
    showCustomerPhone: true,

    maxSearchRadius: 10,
    bookingTimeout: 60,

    supportPhone: "",
    supportEmail: "",

    updatedAt: null
};

let adminSettings = cloneSettings(
    DEFAULT_SETTINGS
);


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadSettings();

        bindSettingsEvents();

        renderSettings();

    }
);


/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadSettings() {

    try {

        const saved =
            localStorage.getItem(
                SETTINGS_STORAGE_KEY
            );

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(
                saved
            );

        if (
            parsed &&
            typeof parsed === "object"
        ) {

            adminSettings = {
                ...DEFAULT_SETTINGS,
                ...parsed
            };

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
   SAVE SETTINGS
========================================================= */

function saveSettings() {

    try {

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
   EVENTS
========================================================= */

function bindSettingsEvents() {

    const form =
        document.getElementById(
            "settingsForm"
        );


    if (form) {

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
        );


    if (
        saveButton &&
        !form
    ) {

        saveButton.addEventListener(
            "click",
            saveSettingsFromForm
        );

    }


    const resetButton =
        document.getElementById(
            "resetSettings"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetSettings
        );

    }


    const maintenance =
        document.getElementById(
            "maintenanceMode"
        );


    if (maintenance) {

        maintenance.addEventListener(
            "change",
            updateMaintenanceUI
        );

    }


    document
        .querySelectorAll(
            "input, select"
        )
        .forEach(
            function (element) {

                element.addEventListener(
                    "change",
                    function () {

                        if (
                            element.id ===
                            "maintenanceMode"
                        ) {

                            updateMaintenanceUI();

                        }

                    }
                );

            }
        );

}


/* =========================================================
   RENDER
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


    setChecked(
        "maintenanceMode",
        adminSettings.maintenanceMode
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
   SAVE FROM FORM
========================================================= */

function saveSettingsFromForm() {

    const updated = {

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


        maintenanceMode:
            readChecked(
                "maintenanceMode",
                adminSettings.maintenanceMode
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
            ),

        updatedAt:
            new Date().toISOString()

    };


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

        return;

    }


    adminSettings =
        updated;


    if (
        !saveSettings()
    ) {

        showMessage(
            "Settings could not be saved.",
            "error"
        );

        return;

    }


    renderSettings();

    showMessage(
        "RiderX settings saved successfully.",
        "success"
    );


    dispatchSettingsEvent();

}


/* =========================================================
   VALIDATION
========================================================= */

function validateSettings(
    settings
) {

    if (
        !settings.appName.trim()
    ) {

        return {

            valid: false,

            message:
                "App name is required."

        };

    }


    if (
        !settings.city.trim()
    ) {

        return {

            valid: false,

            message:
                "City is required."

        };

    }


    if (
        settings.maxSearchRadius <= 0
    ) {

        return {

            valid: false,

            message:
                "Search radius must be greater than 0."

        };

    }


    if (
        settings.bookingTimeout <= 0
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


    return {
        valid: true
    };

}


/* =========================================================
   RESET
========================================================= */

function resetSettings() {

    const confirmed =
        window.confirm(
            "Reset RiderX admin settings to default?"
        );


    if (!confirmed) {
        return;
    }


    adminSettings =
        cloneSettings(
            DEFAULT_SETTINGS
        );


    adminSettings.updatedAt =
        new Date().toISOString();


    saveSettings();

    renderSettings();

    dispatchSettingsEvent();


    showMessage(
        "Settings reset successfully.",
        "success"
    );

}


/* =========================================================
   MAINTENANCE UI
========================================================= */

function updateMaintenanceUI() {

    const checkbox =
        document.getElementById(
            "maintenanceMode"
        );


    const indicator =
        document.getElementById(
            "maintenanceStatus"
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
   PUBLIC GET SETTINGS
========================================================= */

function getSettings() {

    return cloneSettings(
        adminSettings
    );

}


/* =========================================================
   PUBLIC SETTING
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
   UPDATE SINGLE SETTING
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


    adminSettings[key] =
        value;


    if (
        !saveSettings()
    ) {

        return false;

    }


    dispatchSettingsEvent();

    return true;

}


/* =========================================================
   SETTINGS EVENT
========================================================= */

function dispatchSettingsEvent() {

    try {

        window.dispatchEvent(
            new CustomEvent(
                "riderxSettingsUpdated",
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
            "Settings event error:",
            error
        );

    }

}


/* =========================================================
   EXPORT
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
        resetSettings

};


/* =========================================================
   STORAGE SYNC
========================================================= */

window.addEventListener(
    "storage",
    function (event) {

        if (
            event.key ===
            SETTINGS_STORAGE_KEY
        ) {

            loadSettings();

            renderSettings();

        }

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


    if (!element) {

        return String(
            fallback
        );

    }


    return String(
        element.value ??
        fallback
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


    if (!element) {

        return Number(
            fallback
        ) || 0;

    }


    const value =
        Number(
            element.value
        );


    return Number.isFinite(
        value
    )
        ? value
        : Number(fallback) || 0;

}


function readChecked(
    id,
    fallback = false
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return Boolean(
            fallback
        );

    }


    return Boolean(
        element.checked
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


    if (element) {

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


    if (element) {

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
            email
        );

}


function cloneSettings(
    settings
) {

    return JSON.parse(
        JSON.stringify(
            settings
        )
    );

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


    if (existing) {

        existing.remove();

    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "settingsMessage";


    box.textContent =
        message;


    box.style.cssText = `
        position:fixed;
        left:50%;
        bottom:22px;
        transform:translateX(-50%);
        z-index:99999;
        max-width:calc(100% - 30px);
        padding:12px 18px;
        border-radius:10px;
        font-size:13px;
        font-weight:700;
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

    }
    else if (
        type ===
        "error"
    ) {

        box.style.background =
            "#351616";

        box.style.color =
            "#ff7777";

        box.style.border =
            "1px solid #713131";

    }
    else {

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


    setTimeout(
        function () {

            if (box.parentNode) {

                box.remove();

            }

        },
        3000
    );

}


/* =========================================================
   OPTIONAL FIREBASE SYNC
========================================================= */

async function loadSettingsFromFirebase() {

    try {

        if (
            typeof window.db ===
            "undefined"
        ) {

            return null;

        }


        if (
            typeof window.doc !==
            "function" ||
            typeof window.getDoc !==
            "function"
        ) {

            return null;

        }


        const ref =
            window.doc(
                window.db,
                "settings",
                "app"
            );


        const snapshot =
            await window.getDoc(
                ref
            );


        if (
            !snapshot.exists()
        ) {

            return null;

        }


        const firebaseData =
            snapshot.data();


        adminSettings = {

            ...DEFAULT_SETTINGS,

            ...firebaseData

        };


        saveSettings();

        renderSettings();


        return firebaseData;

    } catch (error) {

        console.warn(
            "Firebase settings sync unavailable:",
            error
        );

        return null;

    }

}


/* =========================================================
   AUTO FIREBASE LOAD
========================================================= */

setTimeout(
    function () {

        loadSettingsFromFirebase();

    },
    1200
);
