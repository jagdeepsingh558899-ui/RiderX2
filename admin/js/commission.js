/* =========================================================
   RiderX Admin - Commission Manager
   File: admin/js/commission.js

   FINAL VERSION
   - Bike commission
   - Cab commission
   - Parcel commission
   - Food commission
   - Minimum / Maximum commission
   - Enable / Disable
   - LocalStorage persistence
   - Commission history
   - Preview
   - Safe DOM handling
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


        if (!raw) {

            commissionSettings = {
                ...DEFAULT_COMMISSION
            };

            return;

        }


        const saved =
            JSON.parse(raw);


        if (
            saved &&
            typeof saved === "object"
        ) {

            commissionSettings = {

                ...DEFAULT_COMMISSION,

                ...saved

            };

        } else {

            commissionSettings = {
                ...DEFAULT_COMMISSION
            };

        }

    } catch (error) {

        console.error(
            "RiderX commission settings load error:",
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


        if (!raw) {

            commissionHistory = [];

            return;

        }


        const saved =
            JSON.parse(raw);


        if (
            Array.isArray(saved)
        ) {

            commissionHistory =
                saved;

        } else {

            commissionHistory = [];

        }

    } catch (error) {

        console.error(
            "RiderX commission history load error:",
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
            "RiderX commission settings save error:",
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
            "RiderX commission history save error:",
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


    const enabled =
        document.getElementById(
            "commissionEnabled"
        );


    if (enabled) {

        enabled.addEventListener(
            "change",
            function () {

                commissionSettings.enabled =
                    enabled.checked;


                updateCommissionPreview();

            }
        );

    }

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


            updateCommissionPreview();

        }
    );

}


/* =========================================================
   RENDER COMMISSION
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


    /* -----------------------------------------------------
       VALIDATE SERVICE COMMISSION
    ----------------------------------------------------- */

    if (
        !validatePercentage(bike) ||
        !validatePercentage(cab) ||
        !validatePercentage(parcel) ||
        !validatePercentage(food)
    ) {

        showMessage(
            "Commission must be between 0% and 100%.",
            "error"
        );

        return;

    }


    /* -----------------------------------------------------
       VALIDATE MINIMUM / MAXIMUM
    ----------------------------------------------------- */

    if (
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum)
    ) {

        showMessage(
            "Please enter valid minimum and maximum commission values.",
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


    if (
        minimum > 100 ||
        maximum > 100
    ) {

        showMessage(
            "Minimum and maximum commission cannot exceed 100%.",
            "error"
        );

        return;

    }


    /* -----------------------------------------------------
       ENABLED
    ----------------------------------------------------- */

    const enabled =
        document.getElementById(
            "commissionEnabled"
        );


    const isEnabled =
        enabled
            ? enabled.checked
            : commissionSettings.enabled !== false;


    /* -----------------------------------------------------
       NEW SETTINGS
    ----------------------------------------------------- */

    commissionSettings = {

        bike: bike,

        cab: cab,

        parcel: parcel,

        food: food,

        minimum: minimum,

        maximum: maximum,

        enabled: isEnabled,

        updatedAt:
            new Date().toISOString()

    };


    /* -----------------------------------------------------
       SAVE
    ----------------------------------------------------- */

    const saved =
        saveCommissionSettings();


    if (!saved) {

        showMessage(
            "Unable to save commission settings.",
            "error"
        );

        return;

    }


    /* -----------------------------------------------------
       HISTORY
    ----------------------------------------------------- */

    addHistoryEntry(
        commissionSettings,
        "Updated"
    );


    /* -----------------------------------------------------
       UPDATE UI
    ----------------------------------------------------- */

    renderCommission();


    showMessage(
        "Commission settings saved successfully.",
        "success"
    );

}


/* =========================================================
   RESET COMMISSION
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


    const saved =
        saveCommissionSettings();


    if (!saved) {

        showMessage(
            "Unable to reset commission settings.",
            "error"
        );

        return;

    }


    renderCommission();


    addHistoryEntry(
        commissionSettings,
        "Reset to default"
    );


    showMessage(
        "Commission settings reset successfully.",
        "success"
    );

}


/* =========================================================
   ADD HISTORY ENTRY
========================================================= */

function addHistoryEntry(
    settings,
    action = "Updated"
) {

    if (
        !settings ||
        typeof settings !== "object"
    ) {

        return;

    }


    const entry = {

        id:
            "COM-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 7),

        action:
            String(
                action ||
                "Updated"
            ),

        bike:
            Number(
                settings.bike || 0
            ),

        cab:
            Number(
                settings.cab || 0
            ),

        parcel:
            Number(
                settings.parcel || 0
            ),

        food:
            Number(
                settings.food || 0
            ),

        minimum:
            Number(
                settings.minimum || 0
            ),

        maximum:
            Number(
                settings.maximum || 0
            ),

        enabled:
            settings.enabled !== false,

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

            <div
                class="empty"
                style="
                    padding:20px;
                    text-align:center;
                    color:#777;
                "
            >
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
                                    align-items:center;
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
                                        white-space:nowrap;
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
                                        repeat(4,minmax(0,1fr));
                                    gap:6px;
                                    margin-top:10px;
                                    font-size:11px;
                                    color:#aaa;
                                "
                            >

                                <span>
                                    Bike:
                                    ${formatPercentage(
                                        item.bike
                                    )}
                                </span>


                                <span>
                                    Cab:
                                    ${formatPercentage(
                                        item.cab
                                    )}
                                </span>


                                <span>
                                    Parcel:
                                    ${formatPercentage(
                                        item.parcel
                                    )}
                                </span>


                                <span>
                                    Food:
                                    ${formatPercentage(
                                        item.food
                                    )}
                                </span>

                            </div>


                            <div
                                style="
                                    margin-top:8px;
                                    font-size:10px;
                                    color:#777;
                                "
                            >

                                Min:
                                ${formatPercentage(
                                    item.minimum
                                )}

                                &nbsp; • &nbsp;

                                Max:
                                ${formatPercentage(
                                    item.maximum
                                )}

                                &nbsp; • &nbsp;

                                Status:
                                ${
                                    item.enabled
                                        ? "Enabled"
                                        : "Disabled"
                                }

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   COMMISSION PREVIEW
========================================================= */

function updateCommissionPreview() {

    const preview =
        document.getElementById(
            "commissionPreview"
        );


    if (!preview) {
        return;
    }


    const bike =
        safeNumber(
            commissionSettings.bike
        );


    const cab =
        safeNumber(
            commissionSettings.cab
        );


    const parcel =
        safeNumber(
            commissionSettings.parcel
        );


    const food =
        safeNumber(
            commissionSettings.food
        );


    const minimum =
        safeNumber(
            commissionSettings.minimum
        );


    const maximum =
        safeNumber(
            commissionSettings.maximum
        );


    const enabled =
        commissionSettings.enabled !== false;


    preview.innerHTML = `

        <div
            class="commission-preview-grid"
            style="
                display:grid;
                grid-template-columns:
                    repeat(2,minmax(0,1fr));
                gap:10px;
            "
        >

            <div
                class="commission-preview-item"
                style="
                    padding:12px;
                    border-radius:12px;
                    background:#151515;
                    border:1px solid #2d2d2d;
                "
            >

                <div
                    style="
                        color:#777;
                        font-size:10px;
                    "
                >
                    Bike Taxi
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:3px;
                        font-size:20px;
                    "
                >
                    ${formatPercentage(bike)}
                </strong>

            </div>


            <div
                class="commission-preview-item"
                style="
                    padding:12px;
                    border-radius:12px;
                    background:#151515;
                    border:1px solid #2d2d2d;
                "
            >

                <div
                    style="
                        color:#777;
                        font-size:10px;
                    "
                >
                    Cab
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:3px;
                        font-size:20px;
                    "
                >
                    ${formatPercentage(cab)}
                </strong>

            </div>


            <div
                class="commission-preview-item"
                style="
                    padding:12px;
                    border-radius:12px;
                    background:#151515;
                    border:1px solid #2d2d2d;
                "
            >

                <div
                    style="
                        color:#777;
                        font-size:10px;
                    "
                >
                    Parcel
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:3px;
                        font-size:20px;
                    "
                >
                    ${formatPercentage(parcel)}
                </strong>

            </div>


            <div
                class="commission-preview-item"
                style="
                    padding:12px;
                    border-radius:12px;
                    background:#151515;
                    border:1px solid #2d2d2d;
                "
            >

                <div
                    style="
                        color:#777;
                        font-size:10px;
                    "
                >
                    Food
                </div>

                <strong
                    style="
                        display:block;
                        margin-top:3px;
                        font-size:20px;
                    "
                >
                    ${formatPercentage(food)}
                </strong>

            </div>

        </div>


        <div
            style="
                margin-top:10px;
                padding:12px;
                border-radius:12px;
                background:#111;
                border:1px solid #292929;
                color:#aaa;
                font-size:11px;
            "
        >

            <div>
                Minimum:
                <strong>
                    ${formatPercentage(minimum)}
                </strong>
            </div>


            <div
                style="
                    margin-top:5px;
                "
            >
                Maximum:
                <strong>
                    ${formatPercentage(maximum)}
                </strong>
            </div>


            <div
                style="
                    margin-top:5px;
                "
            >
                Commission:
                <strong
                    style="
                        color:${
                            enabled
                                ? "#22c55e"
                                : "#ef4444"
                        };
                    "
                >
                    ${
                        enabled
                            ? "Enabled"
                            : "Disabled"
                    }
                </strong>
            </div>

        </div>

    `;

}


/* =========================================================
   SET INPUT VALUE
========================================================= */

function setInputValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {
        return;
    }


    if (
        value === null ||
        value === undefined
    ) {

        element.value = "";

        return;

    }


    element.value =
        String(value);

}


/* =========================================================
   READ NUMBER
========================================================= */

function readNumber(
    elementId,
    fallback = 0
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {

        return safeNumber(
            fallback
        );

    }


    const value =
        parseFloat(
            String(
                element.value
            )
            .replace(
                "%",
                ""
            )
            .trim()
        );


    if (
        Number.isFinite(value)
    ) {

        return value;

    }


    return safeNumber(
        fallback
    );

}


/* =========================================================
   VALIDATE PERCENTAGE
========================================================= */

function validatePercentage(
    value
) {

    return (
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
    );

}


/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(
    value
) {

    const number =
        Number(value);


    if (
        Number.isFinite(number)
    ) {

        return number;

    }


    return 0;

}


/* =========================================================
   FORMAT PERCENTAGE
========================================================= */

function formatPercentage(
    value
) {

    const number =
        safeNumber(
            value
        );


    return (
        Number.isInteger(number)
            ? number
            : number.toFixed(2)
    ) + "%";

}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {

        return "Unknown";

    }


    try {

        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "Unknown";

        }


        return date.toLocaleString(
            undefined,
            {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (error) {

        return "Unknown";

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value === null ||
        value === undefined
            ? ""
            : value
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

    const existing =
        document.getElementById(
            "commissionMessage"
        );


    if (existing) {

        existing.remove();

    }


    const element =
        document.createElement(
            "div"
        );


    element.id =
        "commissionMessage";


    const isError =
        type === "error";


    element.textContent =
        String(
            message || ""
        );


    element.style.cssText = `

        position:fixed;

        top:20px;

        right:20px;

        z-index:99999;

        max-width:calc(100vw - 40px);

        padding:13px 17px;

        border-radius:12px;

        font-size:13px;

        font-weight:600;

        line-height:1.4;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,.35);

        color:
            ${isError ? "#fff" : "#000"};

        background:
            ${isError ? "#ef4444" : "#ffe500"};

    `;


    document.body.appendChild(
        element
    );


    window.setTimeout(
        function () {

            if (
                element &&
                element.parentNode
            ) {

                element.remove();

            }

        },
        3500
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

window.RiderXCommission = {

    getSettings:
        function () {

            return {
                ...commissionSettings
            };

        },


    getHistory:
        function () {

            return commissionHistory
                .map(
                    function (item) {

                        return {
                            ...item
                        };

                    }
                );

        },


    save:
        saveCommission,


    reset:
        resetCommission,


    refresh:
        function () {

            loadCommissionSettings();

            loadCommissionHistory();

            renderCommission();

            renderCommissionHistory();

        },


    calculate:
        function (
            service,
            rideFare
        ) {

            const key =
                String(
                    service ||
                    "bike"
                )
                .trim()
                .toLowerCase();


            const fare =
                Math.max(
                    0,
                    safeNumber(
                        rideFare
                    )
                );


            const percentage =
                safeNumber(
                    commissionSettings[
                        key
                    ]
                );


            if (
                commissionSettings.enabled ===
                false
            ) {

                return {

                    service: key,

                    rideFare: fare,

                    percentage: 0,

                    commission: 0,

                    riderAmount: fare

                };

            }


            let commission =
                fare *
                percentage /
                100;


            const minimum =
                Math.max(
                    0,
                    safeNumber(
                        commissionSettings.minimum
                    )
                );


            const maximum =
                Math.max(
                    minimum,
                    safeNumber(
                        commissionSettings.maximum
                    )
                );


            commission =
                Math.max(
                    commission,
                    minimum
                );


            commission =
                Math.min(
                    commission,
                    maximum
                );


            commission =
                Math.min(
                    commission,
                    fare
                );


            commission =
                Number(
                    commission.toFixed(2)
                );


            return {

                service: key,

                rideFare: fare,

                percentage:
                    percentage,

                commission:
                    commission,

                riderAmount:
                    Number(
                        (
                            fare -
                            commission
                        )
                        .toFixed(2)
                    )

            };

        }

};


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.RiderXAdminCommission =

    window.RiderXCommission;


/* =========================================================
   END
========================================================= */
