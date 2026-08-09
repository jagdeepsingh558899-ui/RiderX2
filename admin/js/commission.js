/* =========================================================
   RiderX Admin - Commission Manager
   File: admin/js/commission.js
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const COMMISSION_STORAGE_KEY =
    "riderxCommissionSettings";

const COMMISSION_HISTORY_KEY =
    "riderxCommissionHistory";


const DEFAULT_COMMISSION = {
    bike: 10,
    cab: 10,
    parcel: 10,
    food: 10,
    minimum: 0,
    maximum: 100,
    enabled: true,
    updatedAt: null
};


/* =========================================================
   STATE
========================================================= */

let commissionSettings = {
    ...DEFAULT_COMMISSION
};

let commissionHistory = [];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadCommissionSettings();

        loadCommissionHistory();

        bindCommissionEvents();

        renderCommission();

        renderCommissionHistory();

    }
);


/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadCommissionSettings() {

    try {

        const raw =
            localStorage.getItem(
                COMMISSION_STORAGE_KEY
            );

        if (raw) {

            const saved =
                JSON.parse(raw);

            commissionSettings = {
                ...DEFAULT_COMMISSION,
                ...saved
            };

        }

    } catch (error) {

        console.error(
            "Commission settings load error:",
            error
        );

        commissionSettings = {
            ...DEFAULT_COMMISSION
        };

    }

}


/* =========================================================
   LOAD HISTORY
========================================================= */

function loadCommissionHistory() {

    try {

        const raw =
            localStorage.getItem(
                COMMISSION_HISTORY_KEY
            );

        if (raw) {

            const saved =
                JSON.parse(raw);

            if (
                Array.isArray(saved)
            ) {

                commissionHistory =
                    saved;

            }

        }

    } catch (error) {

        console.error(
            "Commission history load error:",
            error
        );

        commissionHistory = [];

    }

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

function saveCommissionSettings() {

    try {

        localStorage.setItem(
            COMMISSION_STORAGE_KEY,
            JSON.stringify(
                commissionSettings
            )
        );

        return true;

    } catch (error) {

        console.error(
            "Commission settings save error:",
            error
        );

        return false;

    }

}


/* =========================================================
   SAVE HISTORY
========================================================= */

function saveCommissionHistory() {

    try {

        localStorage.setItem(
            COMMISSION_HISTORY_KEY,
            JSON.stringify(
                commissionHistory
            )
        );

        return true;

    } catch (error) {

        console.error(
            "Commission history save error:",
            error
        );

        return false;

    }

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindCommissionEvents() {

    const form =
        document.getElementById(
            "commissionForm"
        );

    if (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveCommission();

            }
        );

    }


    const saveButton =
        document.getElementById(
            "saveCommission"
        );

    if (
        saveButton &&
        !form
    ) {

        saveButton.addEventListener(
            "click",
            function () {

                saveCommission();

            }
        );

    }


    const resetButton =
        document.getElementById(
            "resetCommission"
        );

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetCommission
        );

    }


    bindInput(
        "bikeCommission",
        "bike"
    );

    bindInput(
        "cabCommission",
        "cab"
    );

    bindInput(
        "parcelCommission",
        "parcel"
    );

    bindInput(
        "foodCommission",
        "food"
    );

    bindInput(
        "minimumCommission",
        "minimum"
    );

    bindInput(
        "maximumCommission",
        "maximum"
    );

}


/* =========================================================
   BIND INPUT
========================================================= */

function bindInput(
    elementId,
    property
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return;
    }


    element.addEventListener(
        "input",
        function () {

            const value =
                parseFloat(
                    element.value
                );

            if (
                Number.isFinite(value)
            ) {

                commissionSettings[
                    property
                ] = value;

            }

        }
    );

}


/* =========================================================
   RENDER
========================================================= */

function renderCommission() {

    setInputValue(
        "bikeCommission",
        commissionSettings.bike
    );

    setInputValue(
        "cabCommission",
        commissionSettings.cab
    );

    setInputValue(
        "parcelCommission",
        commissionSettings.parcel
    );

    setInputValue(
        "foodCommission",
        commissionSettings.food
    );

    setInputValue(
        "minimumCommission",
        commissionSettings.minimum
    );

    setInputValue(
        "maximumCommission",
        commissionSettings.maximum
    );


    const enabled =
        document.getElementById(
            "commissionEnabled"
        );

    if (enabled) {

        enabled.checked =
            commissionSettings.enabled !== false;

    }


    updateCommissionPreview();

}


/* =========================================================
   SAVE COMMISSION
========================================================= */

function saveCommission() {

    const bike =
        readNumber(
            "bikeCommission",
            commissionSettings.bike
        );

    const cab =
        readNumber(
            "cabCommission",
            commissionSettings.cab
        );

    const parcel =
        readNumber(
            "parcelCommission",
            commissionSettings.parcel
        );

    const food =
        readNumber(
            "foodCommission",
            commissionSettings.food
        );

    const minimum =
        readNumber(
            "minimumCommission",
            commissionSettings.minimum
        );

    const maximum =
        readNumber(
            "maximumCommission",
            commissionSettings.maximum
        );


    if (
        !validatePercentage(
            bike
        ) ||
        !validatePercentage(
            cab
        ) ||
        !validatePercentage(
            parcel
        ) ||
        !validatePercentage(
            food
        )
    ) {

        showMessage(
            "Commission must be between 0% and 100%.",
            "error"
        );

        return;

    }


    if (
        minimum < 0 ||
        maximum < 0
    ) {

        showMessage(
            "Minimum and maximum commission cannot be negative.",
            "error"
        );

        return;

    }


    if (
        minimum > maximum
    ) {

        showMessage(
            "Minimum commission cannot be greater than maximum commission.",
            "error"
        );

        return;

    }


    const enabled =
        document.getElementById(
            "commissionEnabled"
        );


    commissionSettings = {

        bike: bike,

        cab: cab,

        parcel: parcel,

        food: food,

        minimum: minimum,

        maximum: maximum,

        enabled:
            enabled
                ? enabled.checked
                : commissionSettings.enabled,

        updatedAt:
            new Date().toISOString()

    };


    const saved =
        saveCommissionSettings();


    if (!saved) {

        showMessage(
            "Unable to save commission settings.",
            "error"
        );

        return;

    }


    addHistoryEntry(
        commissionSettings
    );


    updateCommissionPreview();

    showMessage(
        "Commission settings saved successfully.",
        "success"
    );

}


/* =========================================================
   RESET
========================================================= */

function resetCommission() {

    const confirmed =
        window.confirm(
            "Reset commission settings to default 10%?"
        );


    if (!confirmed) {
        return;
    }


    commissionSettings = {

        ...DEFAULT_COMMISSION,

        updatedAt:
            new Date().toISOString()

    };


    saveCommissionSettings();


    renderCommission();


    addHistoryEntry(
        commissionSettings,
        "Reset to default"
    );


    showMessage(
        "Commission settings reset.",
        "success"
    );

}


/* =========================================================
   HISTORY
========================================================= */

function addHistoryEntry(
    settings,
    action = "Updated"
) {

    const entry = {

        id:
            "COM-" +
            Date.now(),

        action:
            action,

        bike:
            settings.bike,

        cab:
            settings.cab,

        parcel:
            settings.parcel,

        food:
            settings.food,

        minimum:
            settings.minimum,

        maximum:
            settings.maximum,

        enabled:
            settings.enabled,

        createdAt:
            new Date().toISOString()

    };


    commissionHistory.unshift(
        entry
    );


    if (
        commissionHistory.length >
        50
    ) {

        commissionHistory =
            commissionHistory.slice(
                0,
                50
            );

    }


    saveCommissionHistory();

    renderCommissionHistory();

}


/* =========================================================
   RENDER HISTORY
========================================================= */

function renderCommissionHistory() {

    const container =
        document.getElementById(
            "commissionHistory"
        );


    if (!container) {
        return;
    }


    if (
        !commissionHistory.length
    ) {

        container.innerHTML = `

            <div class="empty">
                No commission history available.
            </div>

        `;

        return;

    }


    container.innerHTML =
        commissionHistory
            .map(
                function (item) {

                    return `

                        <div
                            class="commission-history-item"
                            style="
                                padding:12px;
                                margin-bottom:8px;
                                border:1px solid #303030;
                                border-radius:10px;
                                background:#151515;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    gap:10px;
                                "
                            >

                                <strong>
                                    ${escapeHtml(
                                        item.action ||
                                        "Updated"
                                    )}
                                </strong>

                                <span
                                    style="
                                        color:#777;
                                        font-size:11px;
                                    "
                                >
                                    ${escapeHtml(
                                        formatDate(
                                            item.createdAt
                                        )
                                    )}
                                </span>

                            </div>


                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:
                                        repeat(4,1fr);
                                    gap:6px;
                                    margin-top:10px;
                                    font-size:11px;
                                    color:#aaa;
                                "
                            >

                                <span>
                                    Bike:
                                    ${item.bike}%
                                </span>

                                <span>
                                    Cab:
                                    ${item.cab}%
                                </span>

                                <span>
                                    Parcel:
                                    ${item.parcel}%
                                </span>

                                <span>
                                    Food:
                                    ${item.food}%
                                </span>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   PREVIEW
========================================================= */

function updateCommissionPreview() {

    const preview =
        document.getElementById(
            "commissionPreview"
        );


    if (!preview) {
        return;
    }


    preview.innerHTML = `

        <div>
            Bike Taxi:
            <strong>
                ${commissionSettings.bike}%
            </strong>
        </div>

        <div>
            Cab:
            <strong
