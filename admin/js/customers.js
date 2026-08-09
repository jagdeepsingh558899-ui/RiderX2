/* =========================================================
   RiderX Admin - Customers Manager
   File: admin/js/customers.js
========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const CUSTOMER_STORAGE_KEYS = [
    "riderxCustomers",
    "riderxUsers",
    "riderx_users",
    "users"
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

        loadCustomers();

        bindCustomerEvents();

    }
);


/* =========================================================
   LOAD CUSTOMERS
========================================================= */

function loadCustomers() {

    const collected = [];

    /* First check admin/customer storage */

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


    /* Then check application storage */

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


    customers =
        collected.filter(
            function (customer) {

                return (
                    customer.role ===
                    "customer"
                );

            }
        );


    saveCustomers();

    renderCustomerStats();

    renderCustomers();

}


/* =========================================================
   READ STORAGE
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
            typeof data === "object"
        ) {

            if (
                Array.isArray(
                    data.users
                )
            ) {

                return data.users;

            }

            if (
                Array.isArray(
                    data.customers
                )
            ) {

                return data.customers;

            }

        }

    } catch (error) {

        console.error(
            "Customer storage error:",
            key,
            error
        );

    }


    return [];

}


/* =========================================================
   ADD CUSTOMER
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

        return;

    }


    const normalized =
        normalizeCustomer(
            user
        );


    if (
        normalized.role !==
        "customer"
    ) {

        return;

    }


    const exists =
        list.some(
            function (item) {

                return String(
                    item.id
                ) ===
                String(
                    normalized.id
                );

            }
        );


    if (!exists) {

        list.push(
            normalized
        );

    }

}


/* =========================================================
   NORMALIZE CUSTOMER
========================================================= */

function normalizeCustomer(
    user
) {

    return {

        id:
            user.id ||
            user.uid ||
            user.userId ||
            createId(),

        name:
            user.name ||
            user.fullName ||
            user.displayName ||
            "RiderX Customer",

        email:
            user.email ||
            "",

        phone:
            user.phone ||
            user.phoneNumber ||
            "",

        role:
            normalizeRole(
                user.role ||
                user.userType ||
                user.type
            ),

        status:
            normalizeStatus(
                user.status ||
                user.accountStatus
            ),

        photo:
            user.photo ||
            user.photoURL ||
            user.avatar ||
            "",

        city:
            user.city ||
            "Chandigarh",

        rides:
            Number(
                user.rides ||
                user.totalRides ||
                0
            ) || 0,

        wallet:
            Number(
                user.wallet ||
                user.walletBalance ||
                0
            ) || 0,

        joinedAt:
            user.joinedAt ||
            user.createdAt ||
            user.created ||
            new Date().toISOString(),

        updatedAt:
            user.updatedAt ||
            null

    };

}


/* =========================================================
   SAVE
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

    } catch (error) {

        console.error(
            "Customer save error:",
            error
        );

        return false;

    }

}


/* =========================================================
   EVENTS
========================================================= */

function bindCustomerEvents() {

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
            renderCustomers
        );

    }


    const roleFilter =
        document.getElementById(
            "customerStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    if (roleFilter) {

        roleFilter.addEventListener(
            "change",
            renderCustomers
        );

    }


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

                return customer.status ===
                    "active";

            }
        ).length;


    const blocked =
        customers.filter(
            function (customer) {

                return customer.status ===
                    "blocked";

            }
        ).length;


    const pending =
        customers.filter(
            function (customer) {

                return customer.status ===
                    "pending";

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
                        customer.city
                    ]
                    .join(" ")
                    .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    container.innerHTML = "";


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

            } else {

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
        String(
            name
        )
        .charAt(0)
        .toUpperCase();


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
                onclick="viewCustomer('${escapeJs(
                    customer.id
                )}')"
            >
                View
            </button>


            <button
                type="button"
                onclick="toggleCustomerStatus('${escapeJs(
                    customer.id
                )}')"
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
        String(
            name
        )
        .charAt(0)
        .toUpperCase();


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
                onclick="viewCustomer('${escapeJs(
                    customer.id
                )}')"
                style="
                    flex:1;
                    height:36px;
                "
            >
                VIEW
            </button>


            <button
                type="button"
                onclick="toggleCustomerStatus('${escapeJs(
                    customer.id
                )}')"
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


    return card;

}


/* =========================================================
   VIEW CUSTOMER
========================================================= */

function viewCustomer(
    id
) {

    const customer =
        customers.find(
            function (item) {

                return String(
                    item.id
                ) ===
                String(id);

            }
        );


    if (!customer) {

        showMessage(
            "Customer not found.",
            "error"
        );

        return;

    }


    selectedCustomerId =
        id;


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

        /* If current HTML has no modal,
           open a simple detail dialog. */

        showCustomerFallback(
            customer
        );

        return;

    }


    const name =
        customer.name ||
        "Customer";


    const initial =
        String(
            name
        )
        .charAt(0)
        .toUpperCase();


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


            <div>

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
                    Customer
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

    `;


    modal.classList.add(
        "show"
    );

}


/* =========================================================
   FALLBACK DETAIL
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
   TOGGLE STATUS
========================================================= */

function toggleCustomerStatus(
    id
) {

    const customer =
        customers.find(
            function (item) {

                return String(
                    item.id
                ) ===
                String(id);

            }
        );


    if (!customer) {

        showMessage(
            "Customer not found.",
            "error"
        );

        return;

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

}


/* =========================================================
   MODAL CLOSE
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
                gap:15px;
                padding:10px 0;
                border-bottom:1px solid #292929;
                font-size:12px;
            "
        >

            <span
                style="
                    color:#777;
                "
            >
                ${escapeHtml(label)}
            </span>

            <strong>
                ${escapeHtml(value)}
            </strong>

        </div>

    `;

}


/* =========================================================
   FILTER HELPERS
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


function getStatusFilter() {

    const element =
        document.getElementById(
            "customerStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    return (
        element?.value ||
        "all"
    );

}


/* =========================================================
   STATUS
========================================================= */

function normalizeRole(
    role
) {

    const value =
        String(
            role ||
            "customer"
        )
        .toLowerCase();


    if (
        value.includes(
            "rider"
        ) ||
        value.includes(
            "driver"
        )
    ) {

        return "rider";

    }


    return "customer";

}


function normalizeStatus(
    status
) {

    const value =
        String(
            status ||
            "active"
        )
        .toLowerCase();


    if (
        value === "blocked" ||
        value === "disabled" ||
        value === "suspended"
    ) {

        return "blocked";

    }


    if (
        value === "pending" ||
        value === "waiting"
    ) {

        return "pending";

    }


    return "active";

}


function statusLabel(
    status
) {

    if (
        status ===
        "blocked"
    ) {

        return "Blocked";

    }


    if (
        status ===
        "pending"
    ) {

        return "Pending";

    }


    return "Active";

}


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
            .slice(2,8)
    );

}


function formatMoney(
    value
) {

    const amount =
        Number(value) || 0;


    return amount.toLocaleString(
        "en-IN",
        {
            minimumFractionDigits:2,
            maximumFractionDigits:2
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

        return new Date(
            value
        ).toLocaleString(
            "en-IN",
            {
                day:"2-digit",
                month:"short",
                year:"numeric",
                hour:"2-digit",
                minute:"2-digit"
            }
        );

    } catch (error) {

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


function escapeJs(
    value
) {

    return String(
        value ?? ""
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
    );

}


/* =========================================================
   MESSAGE
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
        message;


    box.style.cssText = `
        position:fixed;
        left:50%;
        bottom:22px;
        transform:translateX(-50%);
        z-index:9999;
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

            box.remove();

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

            return customers.find(
                function (customer) {

                    return String(
                        customer.id
                    ) ===
                    String(id);

                }
            ) || null;

        },


    refresh:
        loadCustomers,


    block:
        function (id) {

            const customer =
                customers.find(
                    function (item) {

                        return String(
                            item.id
                        ) ===
                        String(id);

                    }
                );


            if (!customer) {
                return false;
            }


            customer.status =
                "blocked";


            customer.updatedAt =
                new Date()
                    .toISOString();


            saveCustomers();

            renderCustomerStats();

            renderCustomers();


            return true;

        },


    unblock:
        function (id) {

            const customer =
                customers.find(
                    function (item) {

                        return String(
                            item.id
                        ) ===
                        String(id);

                    }
                );


            if (!customer) {
                return false;
            }


            customer.status =
                "active";


            customer.updatedAt =
                new Date()
                    .toISOString();


            saveCustomers();

            renderCustomerStats();

            renderCustomers();


            return true;

        }

};


/* =========================================================
   CROSS TAB SYNC
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
