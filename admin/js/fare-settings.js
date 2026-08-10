/* =========================================================
   RiderX Admin - Fare Settings
   File: admin/js/fare-settings.js

   FINAL RIDERX 2.0 FARE ENGINE

   Supports:
   - Bike Taxi
   - Cab
   - Parcel
   - Food Delivery
   - Day / Long Distance / Night rates
   - Base fare
   - Minimum fare
   - Admin save/reset
   - LocalStorage persistence
   - Customer booking compatibility
   - Rider fare compatibility
   - Public RiderXFareSettings API

   Default RiderX pricing:
   06:00 - 22:00
     <= 10 km  : normal rate
     > 10 km   : long-distance rate

   22:00 - 06:00
     night rate

   IMPORTANT:
   This file does not create duplicate storage systems.
   Existing RiderX fare storage key is preserved.
========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const FARE_STORAGE_KEY =
    "riderxFareSettings";


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

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
   INITIALIZATION
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
   LOAD SETTINGS
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
            typeof saved === "object" &&
            !Array.isArray(saved)
        ) {

            fareSettings =
                mergeFareSettings(
                    DEFAULT_FARE_SETTINGS,
                    saved
                );

        }
        else {

            fareSettings =
                clone(
                    DEFAULT_FARE_SETTINGS
                );

        }

    }
    catch (error) {

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
   SAVE SETTINGS
========================================================= */

function saveFareSettings() {

    try {

        localStorage.setItem(
            FARE_STORAGE_KEY,
            JSON.stringify(
                fareSettings
            )
        );


        /*
         * Keep a second in-memory/global copy
         * available to pages loaded in the same
         * browser context.
         */
        window.riderxFareSettings =
            clone(
                fareSettings
            );


        /*
         * Notify other RiderX pages/scripts.
         */
        try {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx:fare-settings-updated",
                    {
                        detail:
                            clone(
                                fareSettings
                            )
                    }
                )
            );

        }
        catch (eventError) {

            console.warn(
                "Fare settings event error:",
                eventError
            );

        }


        return true;

    }
    catch (error) {

        console.error(
            "RiderX fare settings save error:",
            error
        );

        return false;

    }

}


/* =========================================================
   MERGE SETTINGS
========================================================= */

function mergeFareSettings(
    defaults,
    saved
) {

    const safeSaved =
        saved &&
        typeof saved === "object"
            ? saved
            : {};


    return {

        ...clone(
            defaults
        ),

        ...safeSaved,

        bike: {
            ...defaults.bike,
            ...(safeSaved.bike || {})
        },

        cab: {
            ...defaults.cab,
            ...(safeSaved.cab || {})
        },

        parcel: {
            ...defaults.parcel,
            ...(safeSaved.parcel || {})
        },

        food: {
            ...defaults.food,
            ...(safeSaved.food || {})
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
            function (event) {

                if (
                    event &&
                    typeof event.preventDefault ===
                    "function"
                ) {

                    event.preventDefault();

                }

                saveFromForm();

            }
        );

    }


    const resetButton =
        document.getElementById(
            "resetFareSettings"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            function (event) {

                if (
                    event &&
                    typeof event.preventDefault ===
                    "function"
                ) {

                    event.preventDefault();

                }

                resetFareSettings();

            }
        );

    }


    const previewButton =
        document.getElementById(
            "calculateFare"
        );


    if (previewButton) {

        previewButton.addEventListener(
            "click",
            function (event) {

                if (
                    event &&
                    typeof event.preventDefault ===
                    "function"
                ) {

                    event.preventDefault();

                }

                updateFarePreview();

            }
        );

    }


    document
        .querySelectorAll(
            "#fareSettingsForm input, " +
            "#fareSettingsForm select, " +
            "#previewDistance, " +
            "#previewService"
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
   RENDER SETTINGS
========================================================= */

function renderFareSettings() {

    const services = [
        "bike",
        "cab",
        "parcel",
        "food"
    ];


    services.forEach(
        function (service) {

            const data =
                fareSettings[
                    service
                ] ||
                DEFAULT_FARE_SETTINGS[
                    service
                ];


            setInput(
                service + "DayRate",
                data.dayRate
            );

            setInput(
                service + "LongDistanceRate",
                data.longDistanceRate
            );

            setInput(
                service + "NightRate",
                data.nightRate
            );

            setInput(
                service + "LongDistanceKm",
                data.longDistanceKm
            );

            setInput(
                service + "BaseFare",
                data.baseFare
            );

            setInput(
                service + "MinimumFare",
                data.minimumFare
            );

        }
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
   READ FORM + SAVE
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

        currency:
            "INR",

        city:
            readText(
                "fareCity",
                fareSettings.city
            ) ||
            "Chandigarh",

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


    if (!validation.valid) {

        showMessage(
            validation.message,
            "error"
        );

        return false;

    }


    fareSettings =
        newSettings;


    if (!saveFareSettings()) {

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
   READ SERVICE
========================================================= */

function readServiceForm(
    service,
    fallback
) {

    const safeFallback =
        fallback ||
        DEFAULT_FARE_SETTINGS[
            service
        ] ||
        DEFAULT_FARE_SETTINGS.bike;


    return {

        dayRate:
            readNumber(
                service +
                "DayRate",
                safeFallback.dayRate
            ),

        longDistanceRate:
            readNumber(
                service +
                "LongDistanceRate",
                safeFallback.longDistanceRate
            ),

        nightRate:
            readNumber(
                service +
                "NightRate",
                safeFallback.nightRate
            ),

        longDistanceKm:
            readNumber(
                service +
                "LongDistanceKm",
                safeFallback.longDistanceKm
            ),

        baseFare:
            readNumber(
                service +
                "BaseFare",
                safeFallback.baseFare
            ),

        minimumFare:
            readNumber(
                service +
                "MinimumFare",
                safeFallback.minimumFare
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
        const service of services
    ) {

        const data =
            settings[
                service
            ];


        if (
            !data ||
            !Number.isFinite(
                Number(
                    data.dayRate
                )
            ) ||
            !Number.isFinite(
                Number(
                    data.longDistanceRate
                )
            ) ||
            !Number.isFinite(
                Number(
                    data.nightRate
                )
            ) ||
            !Number.isFinite(
                Number(
                    data.longDistanceKm
                )
            ) ||
            !Number.isFinite(
                Number(
                    data.baseFare
                )
            ) ||
            !Number.isFinite(
                Number(
                    data.minimumFare
                )
            )
        ) {

            return {

                valid: false,

                message:
                    "Please enter valid numeric fare values."

            };

        }


        if (
            Number(data.dayRate) < 0 ||
            Number(data.longDistanceRate) < 0 ||
            Number(data.nightRate) < 0 ||
            Number(data.longDistanceKm) <= 0 ||
            Number(data.baseFare) < 0 ||
            Number(data.minimumFare) < 0
        ) {

            return {

                valid: false,

                message:
                    "Fare values cannot be negative and distance must be greater than 0."

            };

        }


        /*
         * A minimum fare greater than the normal
         * fare is allowed intentionally.
         *
         * Example:
         * Cab base + distance = ₹55
         * minimum = ₹60
         * final = ₹60
         */

    }


    const city =
        String(
            settings.city ||
            ""
        ).trim();


    if (!city) {

        return {

            valid: false,

            message:
                "Please enter the service city."

        };

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


    if (!saveFareSettings()) {

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
   MAIN FARE CALCULATOR
========================================================= */

/*
   RiderX pricing rule:

   Day:
     06:00 <= hour < 22:00

   Night:
     22:00 <= hour OR hour < 06:00

   Long distance:
     distance > longDistanceKm

   IMPORTANT:
   Night rate takes priority over long-distance
   rate, matching the RiderX pricing rule.
*/

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

            period: "day",

            currency: "INR"

        };

    }


    const settings =
        fareSettings[
            serviceKey
        ] ||
        DEFAULT_FARE_SETTINGS[
            serviceKey
        ];


    const currentHour =
        normalizeHour(
            hour
        );


    const isNight =
        currentHour >= 22 ||
        currentHour < 6;


    const longDistanceKm =
        positiveNumber(
            settings.longDistanceKm,
            10
        );


    let rate;

    let period;


    if (isNight) {

        rate =
            positiveOrZero(
                settings.nightRate
            );

        period =
            "night";

    }
    else if (
        km >
        longDistanceKm
    ) {

        rate =
            positiveOrZero(
                settings.longDistanceRate
            );

        period =
            "long-distance";

    }
    else {

        rate =
            positiveOrZero(
                settings.dayRate
            );

        period =
            "day";

    }


    const baseFare =
        positiveOrZero(
            settings.baseFare
        );


    const minimumFare =
        positiveOrZero(
            settings.minimumFare
        );


    const subtotal =
        baseFare +
        (
            km *
            rate
        );


    const finalFare =
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
                finalFare
            ),

        period:
            period,

        currency:
            fareSettings.currency ||
            "INR",

        city:
            fareSettings.city ||
            "Chandigarh"

    };

}


/* =========================================================
   PREVIEW
========================================================= */

function updateFarePreview() {

    const resultElement =
        document.getElementById(
            "farePreview"
        );


    if (!resultElement) {

        return null;

    }


    const distanceElement =
        document.getElementById(
            "previewDistance"
        );


    const serviceElement =
        document.getElementById(
            "previewService"
        );


    const distance =
        parseFloat(
            distanceElement?.value
        );


    const safeDistance =
        Number.isFinite(
            distance
        ) &&
        distance > 0
            ? distance
            : 10;


    const service =
        normalizeService(
            serviceElement?.value ||
            "bike"
        );


    const result =
        calculateFare(
            safeDistance,
            service
        );


    const currency =
        result.currency === "INR"
            ? "₹"
            : result.currency + " ";


    resultElement.innerHTML = `

        <div class="fare-preview-main">

            <strong>
                ${currency}${result.fare.toFixed(0)}
            </strong>

        </div>

        <div class="fare-preview-details">

            <span>
                Service:
                ${escapeHtml(
                    formatServiceName(
                        result.service
                    )
                )}
            </span>

            <span>
                Distance:
                ${result.distance.toFixed(2)} km
            </span>

            <span>
                Rate:
                ${currency}${result.rate.toFixed(2)}/km
            </span>

            <span>
                Base:
                ${currency}${result.baseFare.toFixed(2)}
            </span>

            <span>
                Minimum:
                ${currency}${result.minimumFare.toFixed(2)}
            </span>

            <span>
                Period:
                ${escapeHtml(
                    formatPeriod(
                        result.period
                    )
                )}
            </span>

        </div>

    `;


    return result;

}


/* =========================================================
   SERVICE NAME
========================================================= */

function formatServiceName(
    service
) {

    const names = {

        bike: "Bike Taxi",

        cab: "Cab",

        parcel: "Parcel",

        food: "Food Delivery"

    };


    return (
        names[
            normalizeService(
                service
            )
        ] ||
        "Bike Taxi"
    );

}


/* =========================================================
   PERIOD NAME
========================================================= */

function formatPeriod(
    period
) {

    const labels = {

        day:
            "Day",

        night:
            "Night",

        "long-distance":
            "Long Distance"

    };


    return (
        labels[
            period
        ] ||
        "Day"
    );

}


/* =========================================================
   NORMALIZE HOUR
========================================================= */

function normalizeHour(
    hour
) {

    if (
        hour === null ||
        hour === undefined ||
        hour === ""
    ) {

        return new Date().getHours();

    }


    const numeric =
        Number(
            hour
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return new Date().getHours();

    }


    /*
     * Supports:
     * 0-23
     * decimal values are converted
     * into a valid hour range.
     */

    const normalized =
        Math.floor(
            numeric
        );


    return (
        (
            normalized %
            24
        ) +
        24
    ) % 24;

}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function positiveNumber(
    value,
    fallback
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    ) &&
    number > 0
        ? number
        : fallback;

}


function positiveOrZero(
    value
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    ) &&
    number >= 0
        ? number
        : 0;

}


/* =========================================================
   CLONE
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
   INPUT HELPERS
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


function readNumber(
    id,
    fallback = 0
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return (
            Number(
                fallback
            ) || 0
        );

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
            fallback ?? ""
        );

    }


    return String(
        element.value ??
        fallback ??
        ""
    ).trim();

}


function readChecked(
    id,
    fallback = true
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


/* =========================================================
   SERVICE NORMALIZATION
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


    /*
     * Customer/booking compatibility:
     * bike taxi / bike-taxi / motorcycle
     * cab / car
     * parcel / delivery
     * food / food delivery
     */

    if (
        value === "bike" ||
        value === "bike taxi" ||
        value === "bike-taxi" ||
        value === "motorcycle" ||
        value === "motorbike"
    ) {

        return "bike";

    }


    if (
        value === "cab" ||
        value === "car" ||
        value === "taxi"
    ) {

        return "cab";

    }


    if (
        value === "parcel" ||
        value === "delivery" ||
        value === "parcel delivery"
    ) {

        return "parcel";

    }


    if (
        value === "food" ||
        value === "food delivery" ||
        value === "food-delivery"
    ) {

        return "food";

    }


    return "bike";

}


/* =========================================================
   MONEY
========================================================= */

function roundMoney(
    value
) {

    return Math.round(
        (
            Number(
                value
            ) || 0
        ) *
        100
    ) / 100;

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
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

    let element =
        document.getElementById(
            "fareSettingsMessage"
        );


    if (!element) {

        element =
            document.createElement(
                "div"
            );


        element.id =
            "fareSettingsMessage";


        element.className =
            "fare-settings-message";


        document.body.prepend(
            element
        );

    }


    element.textContent =
        message;


    element.className =
        "fare-settings-message " +
        (
            type === "error"
                ? "error"
                : "success"
        );


    clearTimeout(
        element._hideTimer
    );


    element._hideTimer =
        setTimeout(
            function () {

                if (!element) {

                    return;

                }


                element.textContent =
                    "";

                element.className =
                    "fare-settings-message";

            },
            4000
        );

}


/* =========================================================
   CROSS-PAGE STORAGE SYNC
========================================================= */

window.addEventListener(
    "storage",
    function (event) {

        if (
            event.key !==
            FARE_STORAGE_KEY
        ) {

            return;

        }


        loadFareSettings();

        renderFareSettings();

        updateFarePreview();

    }
);


/* =========================================================
   PUBLIC RIDERX API
========================================================= */

window.RiderXFareSettings = {

    getSettings:
        function () {

            return clone(
                fareSettings
            );

        },


    getDefaultSettings:
        function () {

            return clone(
                DEFAULT_FARE_SETTINGS
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
        function () {

            return saveFromForm();

        },


    reset:
        function () {

            return resetFareSettings();

        },


    refresh:
        function () {

            loadFareSettings();

            renderFareSettings();

            updateFarePreview();

            return clone(
                fareSettings
            );

        },


    normalizeService:
        function (
            service
        ) {

            return normalizeService(
                service
            );

        },


    getFare:
        function (
            distance,
            service = "bike",
            hour = null
        ) {

            return calculateFare(
                distance,
                service,
                hour
            ).fare;

        }

};


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

/*
 * These globals allow existing RiderX pages such as
 * booking.js / customer pages to call the same fare
 * calculation engine when this script is loaded.
 */

window.calculateRiderXFare =
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

    };


window.getRiderXFare =
    function (
        distance,
        service = "bike",
        hour = null
    ) {

        return calculateFare(
            distance,
            service,
            hour
        ).fare;

    };


/* =========================================================
   INITIAL GLOBAL SETTINGS COPY
========================================================= */

window.riderxFareSettings =
    clone(
        fareSettings
    );
