/* =========================================================
   RiderX Admin - Customers Manager
   File: admin/js/customers.js

   FINAL CUSTOMER MANAGEMENT ENGINE

   Handles:
   - Customer discovery from existing localStorage data
   - Customer normalization
   - Admin customer cache
   - Search
   - Status filtering
   - Statistics
   - Customer details
   - Block / unblock
   - Modal support
   - Refresh
   - Cross-tab synchronization
   - Safe HTML rendering
   - Public RiderXCustomers API

   IMPORTANT:
   - Does NOT create duplicate folders/files.
   - Keeps existing RiderX localStorage compatibility.
   - Does NOT treat riders/drivers as customers.
========================================================= */

"use strict";


/* =========================================================
   STORAGE KEYS
========================================================= */

const CUSTOMER_STORAGE_KEYS = [
    "riderxCustomers",
    "riderxUsers",
    "riderx_users",
    "users",
    "riderx_user",
    "riderx_customer"
];

const CUSTOMER_ADMIN_KEY =
    "riderxAdminCustomers";


/* =========================================================
   STATE
========================================================= */

let customers = [];

let selectedCustomerId = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeCustomers();

    }
);


/* =========================================================
   INITIALIZE
========================================================= */

function initializeCustomers() {

    bindCustomerEvents();

    loadCustomers();

}


/* =========================================================
   LOAD CUSTOMERS
========================================================= */

function loadCustomers() {

    const collected = [];

    /*
     * First load the admin-maintained customer cache.
     */
    readStorageArray(
        CUSTOMER_ADMIN_KEY
    ).forEach(
        function (user) {

            addCustomerIfValid(
                collected,
                user
            );

        }
    );


    /*
     * Then load customers from application storage.
     */
    CUSTOMER_STORAGE_KEYS.forEach(
        function (key) {

            readStorageArray(
                key
            ).forEach(
                function (user) {

                    addCustomerIfValid(
                        collected,
                        user
                    );

                }
            );

        }
    );


    /*
     * Final safety filter.
     */
    customers =
        collected.filter(
            function (customer) {

                return (
                    customer &&
                    customer.role ===
                    "customer"
                );

            }
        );


    /*
     * Keep a normalized admin cache.
     */
    saveCustomers();


    renderCustomerStats();

    renderCustomers();


    /*
     * Re-open selected customer if it still exists.
     */
    if (
        selectedCustomerId !==
        null
    ) {

        const selected =
            getCustomerById(
                selectedCustomerId
            );


        if (selected) {

            renderSelectedCustomer(
                selected
            );

        }
        else {

            selectedCustomerId =
                null;

        }

    }


    return [
        ...customers
    ];

}


/* =========================================================
   READ STORAGE ARRAY
========================================================= */

function readStorageArray(
    key
) {

    try {

        const raw =
            localStorage.getItem(
                key
            );


        if (!raw) {

            return [];

        }


        const data =
            JSON.parse(
                raw
            );


        if (
            Array.isArray(data)
        ) {

            return data;

        }


        if (
            data &&
            typeof data ===
            "object"
        ) {

            if (
                Array.isArray(
                    data.customers
                )
            ) {

                return data.customers;

            }


            if (
                Array.isArray(
                    data.users
                )
            ) {

                return data.users;

            }


            /*
             * Single stored user object.
             */
            if (
                data.id ||
                data.uid ||
                data.userId ||
                data.email ||
                data.phone
            ) {

                return [
                    data
                ];

            }

        }

    }
    catch (error) {

        console.error(
            "RiderX customer storage error:",
            key,
            error
        );

    }


    return [];

}


/* =========================================================
   ADD CUSTOMER IF VALID
========================================================= */

function addCustomerIfValid(
    list,
    user
) {

    if (
        !user ||
        typeof user !==
        "object"
    ) {

        return false;

    }


    const normalized =
        normalizeCustomer(
            user
        );


    if (
        normalized.role !==
        "customer"
    ) {

        return false;

    }


    const existingIndex =
        list.findIndex(
            function (item) {

                return sameCustomer(
                    item,
                    normalized
                );

            }
        );


    if (
        existingIndex ===
        -1
    ) {

        list.push(
            normalized
        );

        return true;

    }


    /*
     * Merge newer/useful values instead of silently
     * discarding the second source.
     */
    list[existingIndex] =
        mergeCustomer(
            list[existingIndex],
            normalized
        );


    return true;

}


/* =========================================================
   CUSTOMER IDENTITY
========================================================= */

function sameCustomer(
    first,
    second
) {

    if (
        !first ||
        !second
    ) {

        return false;

    }


    const firstId =
        String(
            first.id ||
            ""
        ).trim();


    const secondId =
        String(
            second.id ||
            ""
        ).trim();


    if (
        firstId &&
        secondId &&
        firstId ===
        secondId
    ) {

        return true;

    }


    const firstEmail =
        String(
            first.email ||
            ""
        )
        .trim()
        .toLowerCase();


    const secondEmail =
        String(
            second.email ||
            ""
        )
        .trim()
        .toLowerCase();


    if (
        firstEmail &&
        secondEmail &&
        firstEmail ===
        secondEmail
    ) {

        return true;

    }


    const firstPhone =
        normalizePhone(
            first.phone
        );


    const secondPhone =
        normalizePhone(
            second.phone
        );


    if (
        firstPhone &&
        secondPhone &&
        firstPhone ===
        secondPhone
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   MERGE CUSTOMER
========================================================= */

function mergeCustomer(
    oldCustomer,
    newCustomer
) {

    const merged = {

        ...oldCustomer,
        ...newCustomer

    };


    /*
     * Never replace useful values with empty values.
     */
    const protectedFields = [
        "name",
        "email",
        "phone",
        "photo",
        "city",
        "joinedAt"
    ];


    protectedFields.forEach(
        function (field) {

            const newValue =
                newCustomer[field];


            const oldValue =
                oldCustomer[field];


            if (
                (
                    newValue ===
                    null ||
                    newValue ===
                    undefined ||
                    String(
                        newValue
                    ).trim() ===
                    ""
                ) &&
                oldValue
            ) {

                merged[field] =
                    oldValue;

            }

        }
    );


    /*
     * Preserve blocked status if another source
     * still contains an older active record.
     */
    if (
        oldCustomer.status ===
        "blocked" &&
        newCustomer.status !==
        "blocked"
    ) {

        merged.status =
            "blocked";

    }


    return normalizeCustomer(
        merged
    );

}


/* =========================================================
   NORMALIZE CUSTOMER
========================================================= */

function normalizeCustomer(
    user
) {

    const rawRole =
        user.role ||
        user.userType ||
        user.type ||
        user.accountType ||
        "customer";


    const rawStatus =
        user.status ||
        user.accountStatus ||
        user.state ||
        "active";


    const ridesValue =
        user.rides ??
        user.totalRides ??
        user.completedRides ??
        0;


    const walletValue =
        user.wallet ??
        user.walletBalance ??
        user.balance ??
        0;


    return {

        id:
            String(
                user.id ||
                user.uid ||
                user.userId ||
                createId()
            ),


        name:
            cleanString(
                user.name ||
                user.fullName ||
                user.displayName ||
                user.username ||
                "RiderX Customer"
            ),


        email:
            cleanString(
                user.email
            ),


        phone:
            cleanString(
                user.phone ||
                user.phoneNumber ||
                user.mobile
            ),


        role:
            normalizeRole(
                rawRole
            ),


        status:
            normalizeStatus(
                rawStatus
            ),


        photo:
            cleanString(
                user.photo ||
                user.photoURL ||
                user.avatar ||
                user.profileImage
            ),


        city:
            cleanString(
                user.city ||
                user.locationCity ||
                "Chandigarh"
            ),


        rides:
            safeNumber(
                ridesValue
            ),


        wallet:
            safeNumber(
                walletValue
            ),


        joinedAt:
            user.joinedAt ||
            user.createdAt ||
            user.created ||
            user.registeredAt ||
            new Date().toISOString(),


        updatedAt:
            user.updatedAt ||
            null

    };

}


/* =========================================================
   SAVE ADMIN CUSTOMER CACHE
========================================================= */

function saveCustomers() {

    try {

        localStorage.setItem(
            CUSTOMER_ADMIN_KEY,
            JSON.stringify(
                customers
            )
        );


        return true;

    }
    catch (error) {

        console.error(
            "RiderX customer save error:",
            error
        );


        return false;

    }

}


/* =========================================================
   EVENTS
========================================================= */

function bindCustomerEvents() {

    /*
     * Search
     */
    const search =
        document.getElementById(
            "customerSearch"
        ) ||
        document.getElementById(
            "searchInput"
        );


    if (search) {

        search.addEventListener(
            "input",
            function () {

                renderCustomers();

            }
        );

    }


    /*
     * Status filter
     */
    const statusFilter =
        document.getElementById(
            "customerStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            function () {

                renderCustomers();

            }
        );

    }


    /*
     * Refresh button
     */
    const refresh =
        document.getElementById(
            "refreshCustomers"
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            function () {

                loadCustomers();

                showMessage(
                    "Customer list refreshed.",
                    "success"
                );

            }
        );

    }


    /*
     * Optional close buttons.
     */
    document
        .querySelectorAll(
            "[data-close-customer-modal]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    closeCustomerModal
                );

            }
        );


    /*
     * Close modal when clicking outside.
     */
    const modal =
        document.getElementById(
            "customerModal"
        );


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    modal
                ) {

                    closeCustomerModal();

                }

            }
        );

    }

}


/* =========================================================
   STATS
========================================================= */

function renderCustomerStats() {

    const total =
        customers.length;


    const active =
        customers.filter(
            function (customer) {

                return (
                    customer.status ===
                    "active"
                );

            }
        ).length;


    const blocked =
        customers.filter(
            function (customer) {

                return (
                    customer.status ===
                    "blocked"
                );

            }
        ).length;


    const pending =
        customers.filter(
            function (customer) {

                return (
                    customer.status ===
                    "pending"
                );

            }
        ).length;


    setText(
        "totalCustomers",
        total
    );


    setText(
        "customerCount",
        total
    );


    setText(
        "activeCustomers",
        active
    );


    setText(
        "blockedCustomers",
        blocked
    );


    setText(
        "pendingCustomers",
        pending
    );

}


/* =========================================================
   RENDER CUSTOMERS
========================================================= */

function renderCustomers() {

    const container =
        document.getElementById(
            "customersTable"
        ) ||
        document.getElementById(
            "customerList"
        ) ||
        document.getElementById(
            "customersContainer"
        );


    if (!container) {

        return;

    }


    const search =
        getSearchValue();


    const status =
        getStatusFilter();


    const filtered =
        customers.filter(
            function (customer) {

                if (
                    status !==
                    "all" &&
                    customer.status !==
                    status
                ) {

                    return false;

                }


                if (!search) {

                    return true;

                }


                const text =
                    [
                        customer.id,
                        customer.name,
                        customer.email,
                        customer.phone,
                        customer.city,
                        customer.role
                    ]
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    /*
     * Optional count elements.
     */
    setText(
        "customerCount",
        filtered.length
    );


    container.innerHTML =
        "";


    if (!filtered.length) {

        container.innerHTML = `

            <div class="empty">

                No customers found.

            </div>

        `;

        return;

    }


    const isTable =
        container.tagName ===
        "TBODY";


    filtered.forEach(
        function (customer) {

            if (isTable) {

                container.appendChild(
                    createCustomerRow(
                        customer
                    )
                );

            }
            else {

                container.appendChild(
                    createCustomerCard(
                        customer
                    )
                );

            }

        }
    );

}


/* =========================================================
   TABLE ROW
========================================================= */

function createCustomerRow(
    customer
) {

    const tr =
        document.createElement(
            "tr"
        );


    const name =
        customer.name ||
        "Customer";


    const initial =
        getInitial(
            name
        );


    const safeId =
        escapeJs(
            customer.id
        );


    tr.innerHTML = `

        <td>

            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                "
            >

                <div
                    style="
                        width:34px;
                        height:34px;
                        min-width:34px;
                        border-radius:10px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#292929;
                        color:#FFD400;
                        font-weight:900;
                    "
                >
                    ${escapeHtml(initial)}
                </div>

                <div>

                    <div
                        style="
                            font-weight:900;
                        "
                    >
                        ${escapeHtml(name)}
                    </div>

                    <div
                        style="
                            margin-top:3px;
                            color:#777;
                            font-size:11px;
                        "
                    >
                        ${escapeHtml(
                            customer.email ||
                            "No email"
                        )}
                    </div>

                </div>

            </div>

        </td>


        <td>
            ${escapeHtml(
                customer.phone ||
                "—"
            )}
        </td>


        <td>
            ${escapeHtml(
                customer.city ||
                "Chandigarh"
            )}
        </td>


        <td>
            ${customer.rides || 0}
        </td>


        <td>
            ₹${formatMoney(
                customer.wallet
            )}
        </td>


        <td>

            <span
                class="customer-status-badge"
                style="
                    display:inline-block;
                    padding:5px 8px;
                    border-radius:20px;
                    font-size:10px;
                    font-weight:800;
                    ${statusStyle(
                        customer.status
                    )}
                "
            >
                ${escapeHtml(
                    statusLabel(
                        customer.status
                    )
                )}
            </span>

        </td>


        <td>

            <button
                type="button"
                data-customer-view="${safeId}"
            >
                View
            </button>


            <button
                type="button"
                data-customer-toggle="${safeId}"
            >
                ${
                    customer.status ===
                    "blocked"
                        ? "Unblock"
                        : "Block"
                }
            </button>

        </td>

    `;


    bindCustomerRowActions(
        tr,
        customer.id
    );


    return tr;

}


/* =========================================================
   CARD
========================================================= */

function createCustomerCard(
    customer
) {

    const card =
        document.createElement(
            "div"
        );


    const name =
        customer.name ||
        "Customer";


    const initial =
        getInitial(
            name
        );


    card.className =
        "customer-card";


    card.style.cssText = `
        padding:14px;
        margin-bottom:9px;
        border:1px solid #303030;
        border-radius:14px;
        background:#151515;
    `;


    card.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:10px;
            "
        >

            <div
                style="
                    width:42px;
                    height:42px;
                    min-width:42px;
                    border-radius:12px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#292929;
                    color:#FFD400;
                    font-weight:900;
                "
            >
                ${escapeHtml(initial)}
            </div>


            <div
                style="
                    flex:1;
                    min-width:0;
                "
            >

                <div
                    style="
                        font-size:14px;
                        font-weight:900;
                    "
                >
                    ${escapeHtml(name)}
                </div>

                <div
                    style="
                        margin-top:4px;
                        color:#777;
                        font-size:11px;
                        overflow:hidden;
                        text-overflow:ellipsis;
                        white-space:nowrap;
                    "
                >
                    ${escapeHtml(
                        customer.phone ||
                        customer.email ||
                        "No contact"
                    )}
                </div>

            </div>


            <span
                style="
                    padding:5px 8px;
                    border-radius:20px;
                    font-size:9px;
                    font-weight:900;
                    ${statusStyle(
                        customer.status
                    )}
                "
            >
                ${escapeHtml(
                    statusLabel(
                        customer.status
                    )
                )}
            </span>

        </div>


        <div
            style="
                display:grid;
                grid-template-columns:
                    repeat(3,1fr);
                gap:7px;
                margin-top:12px;
            "
        >

            <div>

                <small style="color:#777">
                    RIDES
                </small>

                <div>
                    ${customer.rides || 0}
                </div>

            </div>


            <div>

                <small style="color:#777">
                    WALLET
                </small>

                <div>
                    ₹${formatMoney(
                        customer.wallet
                    )}
                </div>

            </div>


            <div>

                <small style="color:#777">
                    CITY
                </small>

                <div>
                    ${escapeHtml(
                        customer.city ||
                        "Chandigarh"
                    )}
                </div>

            </div>

        </div>


        <div
            style="
                display:flex;
                gap:7px;
                margin-top:12px;
            "
        >

            <button
                type="button"
                data-customer-view
                style="
                    flex:1;
                    height:36px;
                "
            >
                VIEW
            </button>


            <button
                type="button"
                data-customer-toggle
                style="
                    flex:1;
                    height:36px;
                "
            >
                ${
                    customer.status ===
                    "blocked"
                        ? "UNBLOCK"
                        : "BLOCK"
                }
            </button>

        </div>

    `;


    const viewButton =
        card.querySelector(
            "[data-customer-view]"
        );


    const toggleButton =
        card.querySelector(
            "[data-customer-toggle]"
        );


    if (viewButton) {

        viewButton.addEventListener(
            "click",
            function () {

                viewCustomer(
                    customer.id
                );

            }
        );

    }


    if (toggleButton) {

        toggleButton.addEventListener(
            "click",
            function () {

                toggleCustomerStatus(
                    customer.id
                );

            }
        );

    }


    return card;

}


/* =========================================================
   ROW ACTIONS
========================================================= */

function bindCustomerRowActions(
    row,
    id
) {

    const viewButton =
        row.querySelector(
            "[data-customer-view]"
        );


    const toggleButton =
        row.querySelector(
            "[data-customer-toggle]"
        );


    if (viewButton) {

        viewButton.addEventListener(
            "click",
            function () {

                viewCustomer(
                    id
                );

            }
        );

    }


    if (toggleButton) {

        toggleButton.addEventListener(
            "click",
            function () {

                toggleCustomerStatus(
                    id
                );

            }
        );

    }

}


/* =========================================================
   VIEW CUSTOMER
========================================================= */

function viewCustomer(
    id
) {

    const customer =
        getCustomerById(
            id
        );


    if (!customer) {

        showMessage(
            "Customer not found.",
            "error"
        );

        return;

    }


    selectedCustomerId =
        customer.id;


    const modal =
        document.getElementById(
            "customerModal"
        );


    const body =
        document.getElementById(
            "customerModalBody"
        );


    if (
        !modal ||
        !body
    ) {

        showCustomerFallback(
            customer
        );

        return;

    }


    renderCustomerModal(
        customer,
        body
    );


    modal.classList.add(
        "show"
    );


    /*
     * Support alternate modal implementations.
     */
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   RENDER CUSTOMER MODAL
========================================================= */

function renderCustomerModal(
    customer,
    body
) {

    const name =
        customer.name ||
        "Customer";


    const initial =
        getInitial(
            name
        );


    body.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:10px;
                padding-bottom:12px;
                border-bottom:1px solid #303030;
            "
        >

            <div
                style="
                    width:46px;
                    height:46px;
                    min-width:46px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border-radius:12px;
                    background:#292929;
                    color:#FFD400;
                    font-size:14px;
                    font-weight:900;
                "
            >
                ${escapeHtml(initial)}
            </div>


            <div
                style="
                    min-width:0;
                "
            >

                <div
                    style="
                        font-weight:900;
                        font-size:15px;
                    "
                >
                    ${escapeHtml(name)}
                </div>

                <div
                    style="
                        color:#777;
                        font-size:11px;
                        margin-top:4px;
                    "
                >
                    RiderX Customer
                </div>

            </div>

        </div>


        ${detailRow(
            "User ID",
            customer.id
        )}


        ${detailRow(
            "Email",
            customer.email ||
            "—"
        )}


        ${detailRow(
            "Phone",
            customer.phone ||
            "—"
        )}


        ${detailRow(
            "City",
            customer.city ||
            "Chandigarh"
        )}


        ${detailRow(
            "Total Rides",
            customer.rides ||
            0
        )}


        ${detailRow(
            "Wallet Balance",
            "₹" +
            formatMoney(
                customer.wallet
            )
        )}


        ${detailRow(
            "Status",
            statusLabel(
                customer.status
            )
        )}


        ${detailRow(
            "Joined",
            formatDate(
                customer.joinedAt
            )
        )}


        <div
            style="
                display:flex;
                gap:8px;
                margin-top:14px;
            "
        >

            <button
                type="button"
                id="modalCustomerToggle"
                style="
                    flex:1;
                    min-height:38px;
                "
            >
                ${
                    customer.status ===
                    "blocked"
                        ? "UNBLOCK CUSTOMER"
                        : "BLOCK CUSTOMER"
                }
            </button>

        </div>

    `;


    const toggle =
        document.getElementById(
            "modalCustomerToggle"
        );


    if (toggle) {

        toggle.addEventListener(
            "click",
            function () {

                toggleCustomerStatus(
                    customer.id
                );


                const updated =
                    getCustomerById(
                        customer.id
                    );


                if (
                    updated
                ) {

                    renderCustomerModal(
                        updated,
                        body
                    );

                }

            }
        );

    }

}


/* =========================================================
   RENDER SELECTED CUSTOMER
========================================================= */

function renderSelectedCustomer(
    customer
) {

    const modal =
        document.getElementById(
            "customerModal"
        );


    const body =
        document.getElementById(
            "customerModalBody"
        );


    if (
        modal &&
        body &&
        modal.classList.contains(
            "show"
        )
    ) {

        renderCustomerModal(
            customer,
            body
        );

    }

}


/* =========================================================
   FALLBACK CUSTOMER DETAIL
========================================================= */

function showCustomerFallback(
    customer
) {

    const message = [

        "Customer: " +
        (
            customer.name ||
            "Customer"
        ),

        "User ID: " +
        (
            customer.id ||
            "—"
        ),

        "Phone: " +
        (
            customer.phone ||
            "—"
        ),

        "Email: " +
        (
            customer.email ||
            "—"
        ),

        "City: " +
        (
            customer.city ||
            "Chandigarh"
        ),

        "Rides: " +
        (
            customer.rides ||
            0
        ),

        "Wallet: ₹" +
        formatMoney(
            customer.wallet
        ),

        "Status: " +
        statusLabel(
            customer.status
        )

    ].join("\n");


    window.alert(
        message
    );

}


/* =========================================================
   GET CUSTOMER
========================================================= */

function getCustomerById(
    id
) {

    return (
        customers.find(
            function (customer) {

                return (
                    String(
                        customer.id
                    ) ===
                    String(id)
                );

            }
        ) ||
        null
    );

}


/* =========================================================
   TOGGLE CUSTOMER STATUS
========================================================= */

function toggleCustomerStatus(
    id
) {

    const customer =
        getCustomerById(
            id
        );


    if (!customer) {

        showMessage(
            "Customer not found.",
            "error"
        );

        return false;

    }


    const wasBlocked =
        customer.status ===
        "blocked";


    customer.status =
        wasBlocked
            ? "active"
            : "blocked";


    customer.updatedAt =
        new Date().toISOString();


    saveCustomers();

    renderCustomerStats();

    renderCustomers();


    showMessage(
        wasBlocked
            ? "Customer unblocked."
            : "Customer blocked.",
        "success"
    );


    return true;

}


/* =========================================================
   BLOCK CUSTOMER
========================================================= */

function blockCustomer(
    id
) {

    const customer =
        getCustomerById(
            id
        );


    if (!customer) {

        return false;

    }


    customer.status =
        "blocked";


    customer.updatedAt =
        new Date().toISOString();


    saveCustomers();

    renderCustomerStats();

    renderCustomers();


    return true;

}


/* =========================================================
   UNBLOCK CUSTOMER
========================================================= */

function unblockCustomer(
    id
) {

    const customer =
        getCustomerById(
            id
        );


    if (!customer) {

        return false;

    }


    customer.status =
        "active";


    customer.updatedAt =
        new Date().toISOString();


    saveCustomers();

    renderCustomerStats();

    renderCustomers();


    return true;

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeCustomerModal() {

    const modal =
        document.getElementById(
            "customerModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );


        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    selectedCustomerId =
        null;

}


/* =========================================================
   DETAIL ROW
========================================================= */

function detailRow(
    label,
    value
) {

    return `

        <div
            style="
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:15px;
                padding:10px 0;
                border-bottom:1px solid #292929;
                font-size:12px;
            "
        >

            <span
                style="
                    color:#777;
                    flex-shrink:0;
                "
            >
                ${escapeHtml(label)}
            </span>

            <strong
                style="
                    text-align:right;
                    word-break:break-word;
                "
            >
                ${escapeHtml(value)}
            </strong>

        </div>

    `;

}


/* =========================================================
   SEARCH
========================================================= */

function getSearchValue() {

    const element =
        document.getElementById(
            "customerSearch"
        ) ||
        document.getElementById(
            "searchInput"
        );


    return String(
        element?.value ||
        ""
    )
    .toLowerCase()
    .trim();

}


/* =========================================================
   STATUS FILTER
========================================================= */

function getStatusFilter() {

    const element =
        document.getElementById(
            "customerStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    return String(
        element?.value ||
        "all"
    )
    .toLowerCase();

}


/* =========================================================
   ROLE NORMALIZATION
========================================================= */

function normalizeRole(
    role
) {

    const value =
        String(
            role ||
            "customer"
        )
        .toLowerCase()
        .trim();


    if (
        value ===
        "customer" ||
        value ===
        "user" ||
        value ===
        "passenger" ||
        value ===
        "client"
    ) {

        return "customer";

    }


    if (
        value.includes(
            "rider"
        ) ||
        value.includes(
            "driver"
        ) ||
        value ===
        "captain"
    ) {

        return "rider";

    }


    if (
        value.includes(
            "admin"
        )
    ) {

        return "admin";

    }


    /*
     * Unknown role must NOT accidentally become
     * a customer.
     */
    return "unknown";

}


/* =========================================================
   STATUS NORMALIZATION
========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status ||
            "active"
        )
        .toLowerCase()
        .trim();


    if (
        value ===
        "blocked" ||
        value ===
        "disabled" ||
        value ===
        "suspended" ||
        value ===
        "banned"
    ) {

        return "blocked";

    }


    if (
        value ===
        "pending" ||
        value ===
        "waiting" ||
        value ===
        "verification"
    ) {

        return "pending";

    }


    if (
        value ===
        "inactive" ||
        value ===
        "offline"
    ) {

        return "inactive";

    }


    return "active";

}


/* =========================================================
   STATUS LABEL
========================================================= */

function statusLabel(
    status
) {

    const labels = {

        active:
            "Active",

        blocked:
            "Blocked",

        pending:
            "Pending",

        inactive:
            "Inactive"

    };


    return (
        labels[
            status
        ] ||
        "Active"
    );

}


/* =========================================================
   STATUS STYLE
========================================================= */

function statusStyle(
    status
) {

    if (
        status ===
        "blocked"
    ) {

        return `
            background:#321717;
            color:#ff7777;
        `;

    }


    if (
        status ===
        "pending"
    ) {

        return `
            background:#30240d;
            color:#fbbf24;
        `;

    }


    if (
        status ===
        "inactive"
    ) {

        return `
            background:#272727;
            color:#aaa;
        `;

    }


    return `
        background:#102719;
        color:#4ade80;
    `;

}


/* =========================================================
   HELPERS
========================================================= */

function createId() {

    return (
        "customer-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 9)
    );

}


function cleanString(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return "";

    }


    return String(
        value
    ).trim();

}


function safeNumber(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return 0;

    }


    return number;

}


function normalizePhone(
    value
) {

    return String(
        value ||
        ""
    )
    .replace(
        /\D/g,
        ""
    )
    .slice(
        -15
    );

}


function getInitial(
    name
) {

    const value =
        String(
            name ||
            "C"
        ).trim();


    return (
        value.charAt(0)
        .toUpperCase() ||
        "C"
    );

}


function formatMoney(
    value
) {

    const amount =
        safeNumber(
            value
        );


    return amount.toLocaleString(
        "en-IN",
        {
            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2
        }
    );

}


function formatDate(
    value
) {

    if (!value) {

        return "—";

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

            return "—";

        }


        return date.toLocaleString(
            "en-IN",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

    }
    catch (error) {

        return "—";

    }

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ??
        ""
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
   JS ESCAPE
========================================================= */

function escapeJs(
    value
) {

    return String(
        value ??
        ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    )
    .replace(
        /"/g,
        '\\"'
    )
    .replace(
        /\r/g,
        "\\r"
    )
    .replace(
        /\n/g,
        "\\n"
    );

}


/* =========================================================
   MESSAGE / TOAST
========================================================= */

function showMessage(
    message,
    type = "info"
) {

    const old =
        document.getElementById(
            "customerMessage"
        );


    if (old) {

        old.remove();

    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "customerMessage";


    box.textContent =
        String(
            message ||
            ""
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


    window.setTimeout(
        function () {

            if (
                box &&
                box.parentNode
            ) {

                box.remove();

            }

        },
        2800
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

window.RiderXCustomers = {

    getAll:
        function () {

            return [
                ...customers
            ];

        },


    getById:
        function (id) {

            return getCustomerById(
                id
            );

        },


    refresh:
        function () {

            return loadCustomers();

        },


    block:
        function (id) {

            return blockCustomer(
                id
            );

        },


    unblock:
        function (id) {

            return unblockCustomer(
                id
            );

        },


    toggle:
        function (id) {

            return toggleCustomerStatus(
                id
            );

        },


    getStats:
        function () {

            return {

                total:
                    customers.length,

                active:
                    customers.filter(
                        function (customer) {

                            return (
                                customer.status ===
                                "active"
                            );

                        }
                    ).length,

                blocked:
                    customers.filter(
                        function (customer) {

                            return (
                                customer.status ===
                                "blocked"
                            );

                        }
                    ).length,

                pending:
                    customers.filter(
                        function (customer) {

                            return (
                                customer.status ===
                                "pending"
                            );

                        }
                    ).length

            };

        }

};


/* =========================================================
   CROSS-TAB SYNC
========================================================= */

window.addEventListener(
    "storage",
    function (event) {

        if (
            CUSTOMER_STORAGE_KEYS.includes(
                event.key
            ) ||
            event.key ===
            CUSTOMER_ADMIN_KEY
        ) {

            loadCustomers();

        }

    }
);


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.loadCustomers =
    loadCustomers;

window.renderCustomers =
    renderCustomers;

window.viewCustomer =
    viewCustomer;

window.toggleCustomerStatus =
    toggleCustomerStatus;

window.blockCustomer =
    blockCustomer;

window.unblockCustomer =
    unblockCustomer;

window.closeCustomerModal =
    closeCustomerModal;
