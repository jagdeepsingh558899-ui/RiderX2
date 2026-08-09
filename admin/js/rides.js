/* =========================================================
   RiderX Admin - Rides Manager
   File: admin/js/rides.js
========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const RIDES_STORAGE_KEYS = [
    "riderxRides",
    "riderxRideRequests",
    "riderxBookings",
    "rides",
    "rideRequests",
    "bookings"
];

const RIDES_ADMIN_KEY =
    "riderxAdminRides";


/* =========================================================
   STATE
========================================================= */

let rides = [];

let selectedRideId = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadRides();

        bindRideEvents();

        renderRideStats();

        renderRides();

    }
);


/* =========================================================
   LOAD RIDES
========================================================= */

function loadRides() {

    const collected = [];


    /* Admin rides */

    readArray(
        RIDES_ADMIN_KEY
    ).forEach(
        function (ride) {

            addRide(
                collected,
                ride
            );

        }
    );


    /* Application rides */

    RIDES_STORAGE_KEYS.forEach(
        function (key) {

            readArray(
                key
            ).forEach(
                function (ride) {

                    addRide(
                        collected,
                        ride
                    );

                }
            );

        }
    );


    rides =
        collected.map(
            normalizeRide
        );


    saveRides();

    renderRideStats();

    renderRides();

}


/* =========================================================
   READ ARRAY
========================================================= */

function readArray(
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
                    data.rides
                )
            ) {

                return data.rides;

            }


            if (
                Array.isArray(
                    data.bookings
                )
            ) {

                return data.bookings;

            }


            if (
                Array.isArray(
                    data.requests
                )
            ) {

                return data.requests;

            }

        }

    } catch (error) {

        console.error(
            "Ride storage error:",
            key,
            error
        );

    }


    return [];

}


/* =========================================================
   ADD RIDE
========================================================= */

function addRide(
    list,
    ride
) {

    if (
        !ride ||
        typeof ride !==
        "object"
    ) {

        return;

    }


    const normalized =
        normalizeRide(
            ride
        );


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
   NORMALIZE RIDE
========================================================= */

function normalizeRide(
    ride
) {

    const pickup =
        ride.pickup ||
        ride.pickupLocation ||
        ride.from ||
        ride.source ||
        ride.origin ||
        "";


    const drop =
        ride.drop ||
        ride.dropoff ||
        ride.dropoffLocation ||
        ride.to ||
        ride.destination ||
        "";


    const rider =
        ride.rider ||
        ride.driver ||
        ride.driverName ||
        ride.riderName ||
        {};


    const customer =
        ride.customer ||
        ride.user ||
        ride.passenger ||
        {};


    return {

        id:
            ride.id ||
            ride.rideId ||
            ride.bookingId ||
            createRideId(),


        customerId:
            ride.customerId ||
            ride.userId ||
            customer.id ||
            customer.uid ||
            "",


        customerName:
            ride.customerName ||
            customer.name ||
            customer.fullName ||
            customer.displayName ||
            "Customer",


        customerPhone:
            ride.customerPhone ||
            customer.phone ||
            customer.phoneNumber ||
            "",


        riderId:
            ride.riderId ||
            ride.driverId ||
            rider.id ||
            rider.uid ||
            "",


        riderName:
            ride.riderName ||
            ride.driverName ||
            rider.name ||
            rider.fullName ||
            "Unassigned",


        riderPhone:
            ride.riderPhone ||
            ride.driverPhone ||
            rider.phone ||
            rider.phoneNumber ||
            "",


        service:
            normalizeService(
                ride.service ||
                ride.serviceType ||
                ride.rideType ||
                ride.vehicleType ||
                "bike"
            ),


        status:
            normalizeStatus(
                ride.status ||
                ride.rideStatus ||
                ride.bookingStatus
            ),


        paymentMethod:
            normalizePayment(
                ride.paymentMethod ||
                ride.payment ||
                ride.paymentType ||
                "cash"
            ),


        paymentStatus:
            normalizePaymentStatus(
                ride.paymentStatus
            ),


        pickup:
            formatLocation(
                pickup
            ),


        drop:
            formatLocation(
                drop
            ),


        distance:
            Number(
                ride.distance ||
                ride.distanceKm ||
                ride.km ||
                0
            ) || 0,


        fare:
            Number(
                ride.fare ||
                ride.amount ||
                ride.totalFare ||
                ride.price ||
                0
            ) || 0,


        commission:
            Number(
                ride.commission ||
                ride.platformFee ||
                0
            ) || 0,


        createdAt:
            ride.createdAt ||
            ride.bookedAt ||
            ride.requestedAt ||
            ride.date ||
            new Date().toISOString(),


        acceptedAt:
            ride.acceptedAt ||
            null,


        completedAt:
            ride.completedAt ||
            null,


        cancelledAt:
            ride.cancelledAt ||
            null,


        cancelReason:
            ride.cancelReason ||
            ride.cancellationReason ||
            "",


        notes:
            ride.notes ||
            "",


        updatedAt:
            ride.updatedAt ||
            null

    };

}


/* =========================================================
   SAVE RIDES
========================================================= */

function saveRides() {

    try {

        localStorage.setItem(
            RIDES_ADMIN_KEY,
            JSON.stringify(
                rides
            )
        );

        return true;

    } catch (error) {

        console.error(
            "Ride save error:",
            error
        );

        return false;

    }

}


/* =========================================================
   EVENTS
========================================================= */

function bindRideEvents() {

    const search =
        document.getElementById(
            "rideSearch"
        ) ||
        document.getElementById(
            "searchInput"
        );


    if (search) {

        search.addEventListener(
            "input",
            renderRides
        );

    }


    const statusFilter =
        document.getElementById(
            "rideStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderRides
        );

    }


    const serviceFilter =
        document.getElementById(
            "rideServiceFilter"
        ) ||
        document.getElementById(
            "serviceFilter"
        );


    if (serviceFilter) {

        serviceFilter.addEventListener(
            "change",
            renderRides
        );

    }


    const refresh =
        document.getElementById(
            "refreshRides"
        );


    if (refresh) {

        refresh.addEventListener(
            "click",
            function () {

                loadRides();

                showMessage(
                    "Ride list refreshed.",
                    "success"
                );

            }
        );

    }

}


/* =========================================================
   STATS
========================================================= */

function renderRideStats() {

    const total =
        rides.length;


    const pending =
        rides.filter(
            function (ride) {

                return ride.status ===
                    "pending";

            }
        ).length;


    const active =
        rides.filter(
            function (ride) {

                return [
                    "accepted",
                    "arrived",
                    "started",
                    "ongoing"
                ].includes(
                    ride.status
                );

            }
        ).length;


    const completed =
        rides.filter(
            function (ride) {

                return ride.status ===
                    "completed";

            }
        ).length;


    const cancelled =
        rides.filter(
            function (ride) {

                return [
                    "cancelled",
                    "rejected"
                ].includes(
                    ride.status
                );

            }
        ).length;


    const revenue =
        rides
            .filter(
                function (ride) {

                    return ride.status ===
                        "completed";

                }
            )
            .reduce(
                function (
                    total,
                    ride
                ) {

                    return total +
                        Number(
                            ride.fare
                        );

                },
                0
            );


    setText(
        "totalRides",
        total
    );

    setText(
        "rideCount",
        total
    );

    setText(
        "pendingRides",
        pending
    );

    setText(
        "activeRides",
        active
    );

    setText(
        "completedRides",
        completed
    );

    setText(
        "cancelledRides",
        cancelled
    );

    setText(
        "totalRevenue",
        "₹" +
        formatMoney(
            revenue
        )
    );

}


/* =========================================================
   RENDER RIDES
========================================================= */

function renderRides() {

    const container =
        document.getElementById(
            "ridesTable"
        ) ||
        document.getElementById(
            "rideList"
        ) ||
        document.getElementById(
            "ridesContainer"
        );


    if (!container) {

        return;

    }


    const search =
        getSearch();


    const status =
        getStatus();


    const service =
        getService();


    const filtered =
        rides.filter(
            function (ride) {

                if (
                    status !==
                    "all" &&
                    ride.status !==
                    status
                ) {

                    return false;

                }


                if (
                    service !==
                    "all" &&
                    ride.service !==
                    service
                ) {

                    return false;

                }


                if (!search) {

                    return true;

                }


                const text =
                    [

                        ride.id,

                        ride.customerName,

                        ride.customerPhone,

                        ride.riderName,

                        ride.riderPhone,

                        ride.pickup,

                        ride.drop,

                        ride.service,

                        ride.status

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

                No rides found.

            </div>

        `;

        return;

    }


    const isTable =
        container.tagName ===
        "TBODY";


    filtered.forEach(
        function (ride) {

            if (isTable) {

                container.appendChild(
                    createRideRow(
                        ride
                    )
                );

            } else {

                container.appendChild(
                    createRideCard(
                        ride
                    )
                );

            }

        }
    );

}


/* =========================================================
   TABLE ROW
========================================================= */

function createRideRow(
    ride
) {

    const tr =
        document.createElement(
            "tr"
        );


    tr.innerHTML = `

        <td>

            <strong>
                ${escapeHtml(
                    ride.id
                )}
            </strong>

            <div
                style="
                    margin-top:3px;
                    color:#777;
                    font-size:10px;
                "
            >
                ${escapeHtml(
                    formatDate(
                        ride.createdAt
                    )
                )}
            </div>

        </td>


        <td>

            <div>
                ${escapeHtml(
                    ride.customerName
                )}
            </div>

            <small>
                ${escapeHtml(
                    ride.customerPhone ||
                    "—"
                )}
            </small>

        </td>


        <td>

            <div>
                ${escapeHtml(
                    ride.riderName
                )}
            </div>

            <small>
                ${escapeHtml(
                    ride.riderPhone ||
                    "—"
                )}
            </small>

        </td>


        <td>
            ${serviceLabel(
                ride.service
            )}
        </td>


        <td>
            ₹${formatMoney(
                ride.fare
            )}
        </td>


        <td>
            ${escapeHtml(
                paymentLabel(
                    ride.paymentMethod
                )
            )}
        </td>


        <td>

            <span
                style="
                    display:inline-block;
                    padding:5px 8px;
                    border-radius:20px;
                    font-size:10px;
                    font-weight:800;
                    ${statusStyle(
                        ride.status
                    )}
                "
            >
                ${escapeHtml(
                    statusLabel(
                        ride.status
                    )
                )}
            </span>

        </td>


        <td>

            <button
                type="button"
                onclick="viewRide('${escapeJs(
                    ride.id
                )}')"
            >
                View
            </button>

        </td>

    `;


    return tr;

}


/* =========================================================
   CARD
========================================================= */

function createRideCard(
    ride
) {

    const card =
        document.createElement(
            "div"
        );


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
                justify-content:space-between;
                gap:10px;
                align-items:center;
            "
        >

            <div>

                <div
                    style="
                        font-size:13px;
                        font-weight:900;
                    "
                >
                    ${escapeHtml(
                        ride.id
                    )}
                </div>

                <div
                    style="
                        margin-top:4px;
                        color:#777;
                        font-size:10px;
                    "
                >
                    ${escapeHtml(
                        formatDate(
                            ride.createdAt
                        )
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
                        ride.status
                    )}
                "
            >
                ${escapeHtml(
                    statusLabel(
                        ride.status
                    )
                )}
            </span>

        </div>


        <div
            style="
                margin-top:12px;
                display:grid;
                gap:8px;
            "
        >

            <div>

                <small
                    style="color:#777"
                >
                    CUSTOMER
                </small>

                <div>
                    ${escapeHtml(
                        ride.customerName
                    )}
                </div>

            </div>


            <div>

                <small
                    style="color:#777"
                >
                    RIDER
                </small>

                <div>
                    ${escapeHtml(
                        ride.riderName
                    )}
                </div>

            </div>


            <div>

                <small
                    style="color:#777"
                >
                    ROUTE
                </small>

                <div>
                    ${escapeHtml(
                        ride.pickup
                    )}
                    →
                    ${escapeHtml(
                        ride.drop
                    )}
                </div>

            </div>

        </div>


        <div
            style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-top:12px;
                padding-top:10px;
                border-top:1px solid #292929;
            "
        >

            <div>

                <small
                    style="color:#777"
                >
                    ${escapeHtml(
                        serviceLabel(
                            ride.service
                        )
                    )}
                </small>

                <div
                    style="
                        color:#FFD400;
                        font-size:18px;
                        font-weight:900;
                    "
                >
                    ₹${formatMoney(
                        ride.fare
                    )}
                </div>

            </div>


            <button
                type="button"
                onclick="viewRide('${escapeJs(
                    ride.id
                )}')"
                style="
                    height:36px;
                    padding:0 14px;
                "
            >
                VIEW
            </button>

        </div>

    `;


    return card;

}


/* =========================================================
   VIEW RIDE
========================================================= */

function viewRide(
    id
) {

    const ride =
        findRide(
            id
        );


    if (!ride) {

        showMessage(
            "Ride not found.",
            "error"
        );

        return;

    }


    selectedRideId =
        id;


    const modal =
        document.getElementById(
            "rideModal"
        );


    const body =
        document.getElementById(
            "rideModalBody"
        );


    if (
        !modal ||
        !body
    ) {

        showRideFallback(
            ride
        );

        return;

    }


    body.innerHTML = `

        ${detailRow(
            "Ride ID",
            ride.id
        )}

        ${detailRow(
            "Customer",
            ride.customerName
        )}

        ${detailRow(
            "Customer Phone",
            ride.customerPhone ||
            "—"
        )}

        ${detailRow(
            "Rider",
            ride.riderName
        )}

        ${detailRow(
            "Rider Phone",
            ride.riderPhone ||
            "—"
        )}

        ${detailRow(
            "Service",
            serviceLabel(
                ride.service
            )
        )}

        ${detailRow(
            "Pickup",
            ride.pickup ||
            "—"
        )}

        ${detailRow(
            "Drop",
            ride.drop ||
            "—"
        )}

        ${detailRow(
            "Distance",
            formatDistance(
                ride.distance
            )
        )}

        ${detailRow(
            "Fare",
            "₹" +
            formatMoney(
                ride.fare
            )
        )}

        ${detailRow(
            "Commission",
            "₹" +
            formatMoney(
                ride.commission
            )
        )}

        ${detailRow(
            "Payment",
            paymentLabel(
                ride.paymentMethod
            )
        )}

        ${detailRow(
            "Payment Status",
            paymentStatusLabel(
                ride.paymentStatus
            )
        )}

        ${detailRow(
            "Status",
            statusLabel(
                ride.status
            )
        )}

        ${detailRow(
            "Booked At",
            formatDate(
                ride.createdAt
            )
        )}

        ${
            ride.cancelReason
                ? detailRow(
                    "Cancel Reason",
                    ride.cancelReason
                )
                : ""
        }

    `;


    modal.classList.add(
        "show"
    );

}


/* =========================================================
   FALLBACK VIEW
========================================================= */

function showRideFallback(
    ride
) {

    const message = [

        "Ride: " +
        ride.id,

        "Customer: " +
        ride.customerName,

        "Rider: " +
        ride.riderName,

        "Service: " +
        serviceLabel(
            ride.service
        ),

        "Status: " +
        statusLabel(
            ride.status
        ),

        "Fare: ₹" +
        formatMoney(
            ride.fare
        ),

        "Payment: " +
        paymentLabel(
            ride.paymentMethod
        ),

        "Pickup: " +
        ride.pickup,

        "Drop: " +
        ride.drop

    ].join("\n");


    window.alert(
        message
    );

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeRideModal() {

    const modal =
        document.getElementById(
            "rideModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    selectedRideId =
        null;

}


/* =========================================================
   UPDATE STATUS
========================================================= */

function updateRideStatus(
    id,
    newStatus
) {

    const ride =
        findRide(
            id
        );


    if (!ride) {

        showMessage(
            "Ride not found.",
            "error"
        );

        return false;

    }


    const status =
        normalizeStatus(
            newStatus
        );


    ride.status =
        status;


    ride.updatedAt =
        new Date().toISOString();


    if (
        status ===
        "accepted"
    ) {

        ride.acceptedAt =
            ride.acceptedAt ||
            new Date().toISOString();

    }


    if (
        status ===
        "completed"
    ) {

        ride.completedAt =
            new Date().toISOString();

        ride.paymentStatus =
            ride.paymentStatus ===
            "paid"
                ? "paid"
                : ride.paymentStatus;

    }


    if (
        status ===
        "cancelled"
    ) {

        ride.cancelledAt =
            new Date().toISOString();

    }


    saveRides();

    renderRideStats();

    renderRides();


    showMessage(
        "Ride status updated.",
        "success"
    );


    return true;

}


/* =========================================================
   CANCEL RIDE
========================================================= */

function cancelRide(
    id,
    reason = "Cancelled by admin"
) {

    const ride =
        findRide(
            id
        );


    if (!ride) {

        showMessage(
            "Ride not found.",
            "error"
        );

        return false;

    }


    ride.status =
        "cancelled";


    ride.cancelReason =
        reason;


    ride.cancelledAt =
        new Date().toISOString();


    ride.updatedAt =
        new Date().toISOString();


    saveRides();

    renderRideStats();

    renderRides();


    showMessage(
        "Ride cancelled.",
        "success"
    );


    return true;

}


/* =========================================================
   FIND
========================================================= */

function findRide(
    id
) {

    return rides.find(
        function (ride) {

            return String(
                ride.id
            ) ===
            String(id);

        }
    ) || null;

}


/* =========================================================
   FILTER HELPERS
========================================================= */

function getSearch() {

    const element =
        document.getElementById(
            "rideSearch"
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


function getStatus() {

    const element =
        document.getElementById(
            "rideStatusFilter"
        ) ||
        document.getElementById(
            "statusFilter"
        );


    return (
        element?.value ||
        "all"
    );

}


function getService() {

    const element =
        document.getElementById(
            "rideServiceFilter"
        ) ||
        document.getElementById(
            "serviceFilter"
        );


    return (
        element?.value ||
        "all"
    );

}


/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeService(
    service
) {

    const value =
        String(
            service ||
            "bike"
        )
        .toLowerCase()
        .trim();


    if (
        value === "cab" ||
        value === "car" ||
        value === "taxi"
    ) {

        return "cab";

    }


    if (
        value === "parcel" ||
        value === "delivery"
    ) {

        return "parcel";

    }


    if (
        value === "food" ||
        value === "food_delivery" ||
        value === "food-delivery"
    ) {

        return "food";

    }


    return "bike";

}


function normalizeStatus(
    status
) {

    const value =
        String(
            status ||
            "pending"
        )
        .toLowerCase()
        .trim();


    const map = {

        requested:
            "pending",

        searching:
            "pending",

        waiting:
            "pending",

        accepted:
            "accepted",

        confirmed:
            "accepted",

        arrived:
            "arrived",

        started:
            "started",

        ongoing:
            "ongoing",

        in_progress:
            "ongoing",

        "in-progress":
            "ongoing",

        completed:
            "completed",

        complete:
            "completed",

        cancelled:
            "cancelled",

        canceled:
            "cancelled",

        rejected:
            "rejected"

    };


    return (
        map[value] ||
        "pending"
    );

}


function normalizePayment(
    payment
) {

    const value =
        String(
            payment ||
            "cash"
        )
        .toLowerCase()
        .trim();


    if (
        value === "online" ||
        value === "upi" ||
        value === "card" ||
        value === "wallet"
    ) {

        return value;

    }


    return "cash";

}


function normalizePaymentStatus(
    status
) {

    const value =
        String(
            status ||
            "pending"
        )
        .toLowerCase()
        .trim();


    if (
        [
            "paid",
            "success",
            "successful"
        ].includes(
            value
        )
    ) {

        return "paid";

    }


    if (
        [
            "failed",
            "failure"
        ].includes(
            value
        )
    ) {

        return "failed";

    }


    return "pending";

}


/* =========================================================
   LABELS
========================================================= */

function serviceLabel(
    service
) {

    const labels = {

        bike:
            "Bike Taxi",

        cab:
            "Cab",

        parcel:
            "Parcel",

        food:
            "Food Delivery"

    };


    return (
        labels[
            normalizeService(
                service
            )
        ] ||
        "Bike Taxi"
    );

}


function statusLabel(
    status
) {

    const labels = {

        pending:
            "Pending",

        accepted:
            "Accepted",

        arrived:
            "Rider Arrived",

        started:
            "Started",

        ongoing:
            "Ongoing",

        completed:
            "Completed",

        cancelled:
            "Cancelled",

        rejected:
            "Rejected"

    };


    return (
        labels[
            normalizeStatus(
                status
            )
        ] ||
        "Pending"
    );

}


function paymentLabel(
    payment
) {

    const labels = {

        cash:
            "Cash",

        online:
            "Online",

        upi:
            "UPI",

        card:
            "Card",

        wallet:
            "Wallet"

    };


    return (
        labels[
            normalizePayment(
                payment
            )
        ] ||
        "Cash"
    );

}


function paymentStatusLabel(
    status
) {

    if (
        status ===
        "paid"
    ) {

        return "Paid";

    }


    if (
        status ===
        "failed"
    ) {

        return "Failed";

    }


    return "Pending";

}


function statusStyle(
    status
) {

    const value =
        normalizeStatus(
            status
        );


    if (
        value ===
        "completed"
    ) {

        return `
            background:#102719;
            color:#4ade80;
        `;

    }


    if (
        [
            "accepted",
            "arrived",
            "started",
            "ongoing"
        ].includes(
            value
        )
    ) {

        return `
            background:#30240d;
            color:#FFD400;
        `;

    }


    if (
        [
            "cancelled",
            "rejected"
        ].includes(
            value
        )
    ) {

        return `
            background:#321717;
            color:#ff7777;
        `;

    }


    return `
        background:#222;
        color:#aaa;
    `;

}


/* =========================================================
   LOCATION
========================================================= */

function formatLocation(
    location
) {

    if (!location) {

        return "—";

    }


    if (
        typeof location ===
        "string"
    ) {

        return location;

    }


    if (
        typeof location ===
        "object"
    ) {

        return (
            location.address ||
            location.name ||
            location.label ||
            location.formattedAddress ||
            (
                location.lat !== undefined &&
                location.lng !== undefined
                    ? `${location.lat}, ${location.lng}`
                    : "Location"
            )
        );

    }


    return String(
        location
    );

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
                ${escapeHtml(
                    label
                )}
            </span>

            <strong
                style="
                    text-align:right;
                    max-width:65%;
                "
            >
                ${escapeHtml(
                    value
                )}
            </strong>

        </div>

    `;

}


/* =========================================================
   HELPERS
========================================================= */

function createRideId() {

    return (
        "RX-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2,7)
            .toUpperCase()
    );

}


function formatMoney(
    value
) {

    return (
        Number(
            value
        ) || 0
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits:2,
            maximumFractionDigits:2
        }
    );

}


function formatDistance(
    value
) {

    const distance =
        Number(
            value
        ) || 0;


    return (
        distance
            .toFixed(2)
            .replace(
                /\.00$/,
                ""
            )
        +
        " km"
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
            "rideMessage"
        );


    if (old) {

        old.remove();

    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "rideMessage";


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

            box.remove();

        },
        2800
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

window.RiderXRides = {

    getAll:
        function () {

            return [
                ...rides
            ];

        },


    getById:
        function (id) {

            return findRide(
                id
            );

        },


    refresh:
        loadRides,


    updateStatus:
        updateRideStatus,


    cancel:
        cancelRide

};


/* =========================================================
   STORAGE SYNC
========================================================= */

window.addEventListener(
    "storage",
    function (event) {

        if (
            RIDES_STORAGE_KEYS.includes(
                event.key
            ) ||
            event.key ===
            RIDES_ADMIN_KEY
        ) {

            loadRides();

        }

    }
);
