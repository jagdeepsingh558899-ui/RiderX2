/* =========================================================
   RiderX Admin - Fare Settings
   File: admin/js/fare-settings.js
   FINAL FIXED VERSION
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const FARE_STORAGE_KEY =
    "riderxFareSettings";


const DEFAULT_FARE_SETTINGS = {

    bike: {
        dayRate: 8,
        longDistanceRate: 9,
        nightRate: 11,
        longDistanceKm: 10,
        baseFare: 0,
        minimumFare: 0
    },

    cab: {
        dayRate: 12,
        longDistanceRate: 14,
        nightRate: 16,
        longDistanceKm: 10,
        baseFare: 50,
        minimumFare: 60
    },

    parcel: {
        dayRate: 10,
        longDistanceRate: 12,
        nightRate: 14,
        longDistanceKm: 10,
        baseFare: 20,
        minimumFare: 30
    },

    food: {
        dayRate: 8,
        longDistanceRate: 10,
        nightRate: 12,
        longDistanceKm: 10,
        baseFare: 20,
        minimumFare: 30
    },

    currency: "INR",

    city: "Chandigarh",

    enabled: true,

    updatedAt: null

};


let fareSettings =
    clone(
        DEFAULT_FARE_SETTINGS
    );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadFareSettings();

        bindFareEvents();

        renderFareSettings();

        updateFarePreview();

    }
);


/* =========================================================
   LOAD
========================================================= */

function loadFareSettings() {

    try {

        const raw =
            localStorage.getItem(
                FARE_STORAGE_KEY
            );


        if (!raw) {

            fareSettings =
                clone(
                    DEFAULT_FARE_SETTINGS
                );

            return;

        }


        const saved =
            JSON.parse(
                raw
            );


        if (
            saved &&
            typeof saved === "object"
        ) {

            fareSettings =
                mergeFareSettings(
                    DEFAULT_FARE_SETTINGS,
                    saved
                );

        } else {

            fareSettings =
                clone(
                    DEFAULT_FARE_SETTINGS
                );

        }

    } catch (error) {

        console.error(
            "RiderX fare settings load error:",
            error
        );


        fareSettings =
            clone(
                DEFAULT_FARE_SETTINGS
            );

    }

}


/* =========================================================
   SAVE
========================================================= */

function saveFareSettings() {

    try {

        localStorage.setItem(
            FARE_STORAGE_KEY,
            JSON.stringify(
                fareSettings
            )
        );


        return true;

    } catch (error) {

        console.error(
            "RiderX fare settings save error:",
            error
        );


        return false;

    }

}


/* =========================================================
   MERGE
========================================================= */

function mergeFareSettings(
    defaults,
    saved
) {

    return {

        ...defaults,

        ...saved,

        bike: {

            ...defaults.bike,

            ...(saved.bike || {})

        },

        cab: {

            ...defaults.cab,

            ...(saved.cab || {})

        },

        parcel: {

            ...defaults.parcel,

            ...(saved.parcel || {})

        },

        food: {

            ...defaults.food,

            ...(saved.food || {})

        }

    };

}


/* =========================================================
   EVENTS
========================================================= */

function bindFareEvents() {

    const form =
        document.getElementById(
            "fareSettingsForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveFromForm();

            }
        );

    }


    const saveButton =
        document.getElementById(
            "saveFareSettings"
        );


    if (
        saveButton &&
        !form
    ) {

        saveButton.addEventListener(
            "click",
            saveFromForm
        );

    }


    const resetButton =
        document.getElementById(
            "resetFareSettings"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetFareSettings
        );

    }


    const previewButton =
        document.getElementById(
            "calculateFare"
        );


    if (previewButton) {

        previewButton.addEventListener(
            "click",
            updateFarePreview
        );

    }


    document
        .querySelectorAll(
            "input, select"
        )
        .forEach(
            function (element) {

                element.addEventListener(
                    "input",
                    updateFarePreview
                );


                element.addEventListener(
                    "change",
                    updateFarePreview
                );

            }
        );

}


/* =========================================================
   RENDER
========================================================= */

function renderFareSettings() {

    setInput(
        "bikeDayRate",
        fareSettings.bike.dayRate
    );

    setInput(
        "bikeLongDistanceRate",
        fareSettings.bike.longDistanceRate
    );

    setInput(
        "bikeNightRate",
        fareSettings.bike.nightRate
    );

    setInput(
        "bikeLongDistanceKm",
        fareSettings.bike.longDistanceKm
    );

    setInput(
        "bikeBaseFare",
        fareSettings.bike.baseFare
    );

    setInput(
        "bikeMinimumFare",
        fareSettings.bike.minimumFare
    );


    setInput(
        "cabDayRate",
        fareSettings.cab.dayRate
    );

    setInput(
        "cabLongDistanceRate",
        fareSettings.cab.longDistanceRate
    );

    setInput(
        "cabNightRate",
        fareSettings.cab.nightRate
    );

    setInput(
        "cabLongDistanceKm",
        fareSettings.cab.longDistanceKm
    );

    setInput(
        "cabBaseFare",
        fareSettings.cab.baseFare
    );

    setInput(
        "cabMinimumFare",
        fareSettings.cab.minimumFare
    );


    setInput(
        "parcelDayRate",
        fareSettings.parcel.dayRate
    );

    setInput(
        "parcelLongDistanceRate",
        fareSettings.parcel.longDistanceRate
    );

    setInput(
        "parcelNightRate",
        fareSettings.parcel.nightRate
    );

    setInput(
        "parcelLongDistanceKm",
        fareSettings.parcel.longDistanceKm
    );

    setInput(
        "parcelBaseFare",
        fareSettings.parcel.baseFare
    );

    setInput(
        "parcelMinimumFare",
        fareSettings.parcel.minimumFare
    );


    setInput(
        "foodDayRate",
        fareSettings.food.dayRate
    );

    setInput(
        "foodLongDistanceRate",
        fareSettings.food.longDistanceRate
    );

    setInput(
        "foodNightRate",
        fareSettings.food.nightRate
    );

    setInput(
        "foodLongDistanceKm",
        fareSettings.food.longDistanceKm
    );

    setInput(
        "foodBaseFare",
        fareSettings.food.baseFare
    );

    setInput(
        "foodMinimumFare",
        fareSettings.food.minimumFare
    );


    setInput(
        "fareCity",
        fareSettings.city
    );


    const enabled =
        document.getElementById(
            "fareEnabled"
        );


    if (enabled) {

        enabled.checked =
            fareSettings.enabled !== false;

    }

}


/* =========================================================
   SAVE FROM FORM
========================================================= */

function saveFromForm() {

    const newSettings = {

        ...fareSettings,

        bike:
            readServiceForm(
                "bike",
                fareSettings.bike
            ),

        cab:
            readServiceForm(
                "cab",
                fareSettings.cab
            ),

        parcel:
            readServiceForm(
                "parcel",
                fareSettings.parcel
            ),

        food:
            readServiceForm(
                "food",
                fareSettings.food
            ),

        city:
            readText(
                "fareCity",
                fareSettings.city
            ),

        enabled:
            readChecked(
                "fareEnabled",
                fareSettings.enabled
            ),

        updatedAt:
            new Date().toISOString()

    };


    const validation =
        validateFareSettings(
            newSettings
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


    fareSettings =
        newSettings;


    if (
        !saveFareSettings()
    ) {

        showMessage(
            "Unable to save fare settings.",
            "error"
        );

        return false;

    }


    renderFareSettings();

    updateFarePreview();


    showMessage(
        "Fare settings saved successfully.",
        "success"
    );


    return true;

}


/* =========================================================
   SERVICE FORM
========================================================= */

function readServiceForm(
    service,
    fallback
) {

    return {

        dayRate:
            readNumber(
                service +
                "DayRate",
                fallback.dayRate
            ),

        longDistanceRate:
            readNumber(
                service +
                "LongDistanceRate",
                fallback.longDistanceRate
            ),

        nightRate:
            readNumber(
                service +
                "NightRate",
                fallback.nightRate
            ),

        longDistanceKm:
            readNumber(
                service +
                "LongDistanceKm",
                fallback.longDistanceKm
            ),

        baseFare:
            readNumber(
                service +
                "BaseFare",
                fallback.baseFare
            ),

        minimumFare:
            readNumber(
                service +
                "MinimumFare",
                fallback.minimumFare
            )

    };

}


/* =========================================================
   VALIDATION
========================================================= */

function validateFareSettings(
    settings
) {

    const services = [
        "bike",
        "cab",
        "parcel",
        "food"
    ];


    for (
        const service
        of services
    ) {

        const data =
            settings[
                service
            ];


        if (
            data.dayRate < 0 ||
            data.longDistanceRate < 0 ||
            data.nightRate < 0 ||
            data.longDistanceKm <= 0 ||
            data.baseFare < 0 ||
            data.minimumFare < 0
        ) {

            return {

                valid: false,

                message:
                    "Fare values cannot be negative and distance must be greater than 0."

            };

        }

    }


    return {

        valid: true

    };

}


/* =========================================================
   RESET
========================================================= */

function resetFareSettings() {

    const confirmed =
        window.confirm(
            "Reset all fare settings to RiderX default values?"
        );


    if (!confirmed) {

        return false;

    }


    fareSettings =
        clone(
            DEFAULT_FARE_SETTINGS
        );


    fareSettings.updatedAt =
        new Date().toISOString();


    if (
        !saveFareSettings()
    ) {

        showMessage(
            "Unable to reset fare settings.",
            "error"
        );

        return false;

    }


    renderFareSettings();

    updateFarePreview();


    showMessage(
        "Fare settings reset successfully.",
        "success"
    );


    return true;

}


/* =========================================================
   FARE CALCULATOR
========================================================= */

function calculateFare(
    distance,
    service = "bike",
    hour = null
) {

    const km =
        Number(
            distance
        );


    const serviceKey =
        normalizeService(
            service
        );


    if (
        !Number.isFinite(km) ||
        km <= 0
    ) {

        return {

            distance: 0,

            service:
                serviceKey,

            rate: 0,

            baseFare: 0,

            subtotal: 0,

            minimumFare: 0,

            fare: 0,

            period: "day"

        };

    }


    const settings =
        fareSettings[
            serviceKey
        ];


    const currentHour =
        hour === null
            ? new Date().getHours()
            : Number(hour);


    const validHour =
        Number.isFinite(
            currentHour
        )
            ? currentHour
            : new Date().getHours();


    const isNight =
        validHour >= 22 ||
        validHour < 6;


    const longDistanceKm =
        Number(
            settings.longDistanceKm
        ) || 10;


    let rate;

    let period;


    if (isNight) {

        rate =
            Number(
                settings.nightRate
            ) || 0;

        period =
            "night";

    } else if (
        km > longDistanceKm
    ) {

        rate =
            Number(
                settings.longDistanceRate
            ) || 0;

        period =
            "long-distance";

    } else {

        rate =
            Number(
                settings.dayRate
            ) || 0;

        period =
            "day";

    }


    const baseFare =
        Number(
            settings.baseFare
        ) || 0;


    const minimumFare =
        Number(
            settings.minimumFare
        ) || 0;


    const subtotal =
        baseFare +
        (
            km *
            rate
        );


    const fare =
        Math.max(
            subtotal,
            minimumFare
        );


    return {

        distance:
            roundMoney(
                km
            ),

        service:
            serviceKey,

        rate:
            roundMoney(
                rate
            ),

        baseFare:
            roundMoney(
                baseFare
            ),

        subtotal:
            roundMoney(
                subtotal
            ),

        minimumFare:
            roundMoney(
                minimumFare
            ),

        fare:
            roundMoney(
                fare
            ),

        period:
            period

    };

}


/* =========================================================
   PREVIEW
========================================================= */

function updateFarePreview() {

    const distanceElement =
        document.getElementById(
            "previewDistance"
        );


    const serviceElement =
        document.getElementById(
            "previewService"
        );


    const resultElement =
        document.getElementById(
            "farePreview"
        );


    if (!resultElement) {

        return null;

    }


    const distance =
        parseFloat(
            distanceElement?.value
        ) || 10;


    const service =
        normalizeService(
            serviceElement?.value ||
            "bike"
        );


    const result =
        calculateFare(
            distance,
            service
        );


    resultElement.innerHTML = `

        <div class="fare-preview-main">

            <strong>
                ₹${result.fare.toFixed(0)}
            </strong>

        </div>


        <div class="fare-preview-details">

            <span>
                Service:
                ${escapeHtml(result.service)}
            </span>

            <span>
                Distance:
                ${result.distance.toFixed(2)} km
            </span>

            <span>
                Rate:
                ₹${result.rate.toFixed(2)}/km
            </span>

            <span>
                Base:
                ₹${result.baseFare.toFixed(2)}
            </span>

            <span>
                Minimum:
                ₹${result.minimumFare.toFixed(2)}
            </span>

            <span>
                Period:
                ${escapeHtml(result.period)}
            </span>

        </div>

    `;


    return result;

}


/* =========================================================
   HELPERS
========================================================= */

function clone(
    value
) {

    return JSON.parse(
        JSON.stringify(
            value
        )
    );

}


/* =========================================================
   SET INPUT
========================================================= */

function setInput(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    element.value =
        value ?? "";

}


/* =========================================================
   READ NUMBER
========================================================= */

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
        parseFloat(
            element.value
        );


    return Number.isFinite(
        value
    )
        ? value
        : (
            Number(
                fallback
            ) || 0
        );

}


/* =========================================================
   READ TEXT
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
            fallback ??
            ""
        );

    }


    return String(
        element.value ??
        fallback ??
        ""
    ).trim();

}


/* =========================================================
   READ CHECKBOX
========================================================= */

function readChecked(
    id,
    fallback = true
) {

    const element =
        document.getElementById(
            id
        );


    return element
        ? Boolean(
            element.checked
        )
        : Boolean(
            fallback
        );

}


/* =========================================================
   NORMALIZE SERVICE
========================================================= */

function normalizeService(
    service
) {

    const value =
        String(
            service ||
            "bike"
        )
        .trim()
        .toLowerCase();


    return [

        "bike",

        "cab",

        "parcel",

        "food"

    ].includes(
        value
    )
        ? value
        : "bike";

}


/* =========================================================
   ROUND MONEY
========================================================= */

function roundMoney(
    value
) {

    return Math.round(
        (
            Number(
                value
            ) || 0
        ) * 100
    ) / 100;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )

    .replaceAll(
        "&",
        "&amp;"
    )

    .replaceAll(
        "<",
        "&lt;"
    )

    .replaceAll(
        ">",
        "&gt;"
    )

    .replaceAll(
        '"',
        "&quot;"
    )

    .replaceAll(
        "'",
        "&#039;"
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type = "success"
) {

    const existing =
        document.getElementById(
            "fareSettingsMessage"
        );


    if (existing) {

        existing.textContent =
            message;


        existing.className =
            `fare-settings-message ${type}`;


        clearTimeout(
            existing._hideTimer
        );


        existing._hideTimer =
            setTimeout(
                function () {

                    existing.textContent =
                        "";

                    existing.className =
                        "fare-settings-message";

                },
                4000
            );


        return;

    }


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.id =
        "fareSettingsMessage";


    messageElement.className =
        `fare-settings-message ${type}`;


    messageElement.textContent =
        message;


    document.body.prepend(
        messageElement
    );


    setTimeout(
        function () {

            if (
                messageElement.isConnected
            ) {

                messageElement.remove();

            }

        },
        4000
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

window.RiderXFareSettings = {

    getSettings:
        function () {

            return clone(
                fareSettings
            );

        },


    calculateFare:
        function (
            distance,
            service = "bike",
            hour = null
        ) {

            return calculateFare(
                distance,
                service,
                hour
            );

        },


    save:
        saveFromForm,


    reset:
        resetFareSettings,


    refresh:
        function () {

            loadFareSettings();

            renderFareSettings();

            updateFarePreview();

        }

};
