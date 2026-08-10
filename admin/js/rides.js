/* =========================================================
   RIDERX 2.0
   ADMIN - RIDES MANAGER
   File: admin/js/rides.js

   Purpose:
   - Load rides from Firebase Firestore
   - Real-time admin ride monitoring
   - LocalStorage fallback
   - Ride search/filter
   - Ride statistics
   - Ride details
   - Admin status updates
   - Admin cancellation
   - Customer/Rider ride compatibility

   Firebase:
   Uses the SINGLE Firebase initialization point:
   firebase/firebase-config.js

   IMPORTANT:
   This file does NOT initialize Firebase itself.
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
   FIRESTORE COLLECTIONS
   ---------------------------------------------------------
   Primary collection is "rides".

   "bookings" is supported as a compatibility fallback.
========================================================= */

const RIDES_FIRESTORE_COLLECTIONS = [

    "rides",

    "bookings"

];


/* =========================================================
   STATE
========================================================= */

let rides = [];

let selectedRideId = null;

let ridesInitialized = false;

let firebaseLoaded = false;

let firebaseUnsubscribers = [];

let rideEventBound = false;

let firestoreWriteInProgress = false;


/* =========================================================
   FIREBASE REFERENCES
========================================================= */

let firebaseModule = null;

let firestoreDb = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initRidesManager
);


async function initRidesManager() {

    if (
        ridesInitialized
    ) {

        return;

    }


    ridesInitialized =
        true;


    /*
     * Always load local data first.
     * This gives the admin an immediate UI.
     */

    loadLocalRides();


    bindRideEvents();


    renderRideStats();

    renderRides();


    /*
     * Then connect Firebase.
     */

    await connectFirebase();


    /*
     * If Firebase is available,
     * use real-time Firestore.
     */

    if (
        firebaseLoaded
    ) {

        subscribeToFirestore();

    }

}


/* =========================================================
   FIREBASE CONNECT
========================================================= */

async function connectFirebase() {

    try {

        /*
         * Reuse the existing RiderX Firebase module
         * when it is already loaded.
         */

        if (
            window.RiderXFirebase
        ) {

            firebaseModule =
                window.RiderXFirebase;

        }


        /*
         * Some pages may load this file without the Firebase
         * module being loaded first.
         *
         * Dynamically import the single canonical config.
         */

        if (
            !firebaseModule
        ) {

            firebaseModule =
                await import(
                    "../../firebase/firebase-config.js"
                );

        }


        firestoreDb =
            firebaseModule.db ||
            firebaseModule.firestore ||
            null;


        if (
            !firestoreDb
        ) {

            throw new Error(
                "Firebase Firestore instance is unavailable."
            );

        }


        firebaseLoaded =
            true;


        console.info(
            "RiderX Admin Rides: Firebase connected."
        );


        return true;

    } catch (error) {

        firebaseLoaded =
            false;


        console.warn(
            "RiderX Admin Rides: Firebase unavailable. Using local data.",
            error
        );


        return false;

    }

}


/* =========================================================
   LOAD LOCAL RIDES
========================================================= */

function loadLocalRides() {

    const collected = [];


    /*
     * Admin rides first.
     */

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


    /*
     * Application local storage.
     */

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
   FIRESTORE REAL-TIME SUBSCRIPTION
========================================================= */

function subscribeToFirestore() {

    unsubscribeFirestore();


    if (
        !firestoreDb
    ) {

        return;

    }


    /*
     * Dynamically use the same Firebase module
     * instead of initializing another Firebase app.
     */

    const onSnapshotFunction =
        firebaseModule?.onSnapshot;


    const collectionFunction =
        firebaseModule?.collection;


    if (
        typeof onSnapshotFunction !==
        "function" ||
        typeof collectionFunction !==
        "function"
    ) {

        console.warn(
            "RiderX Admin Rides: Firestore helpers unavailable."
        );

        return;

    }


    RIDES_FIRESTORE_COLLECTIONS.forEach(
        function (collectionName) {

            try {

                const collectionRef =
                    collectionFunction(
                        firestoreDb,
                        collectionName
                    );


                const unsubscribe =
                    onSnapshotFunction(
                        collectionRef,
                        function (snapshot) {

                            handleFirestoreSnapshot(
                                snapshot,
                                collectionName
                            );

                        },
                        function (error) {

                            console.warn(
                                "RiderX Admin Rides Firestore listener error:",
                                collectionName,
                                error
                            );

                        }
                    );


                if (
                    typeof unsubscribe ===
                    "function"
                ) {

                    firebaseUnsubscribers.push(
                        unsubscribe
                    );

                }

            } catch (error) {

                console.warn(
                    "Unable to subscribe to Firestore collection:",
                    collectionName,
                    error
                );

            }

        }
    );

}


/* =========================================================
   FIRESTORE SNAPSHOT
========================================================= */

function handleFirestoreSnapshot(
    snapshot,
    collectionName
) {

    if (
        !snapshot
    ) {

        return;

    }


    const firestoreRides = [];


    snapshot.forEach(
        function (documentSnapshot) {

            const data =
                documentSnapshot.data() ||
                {};


            const ride = {

                ...data,

                id:
                    data.id ||
                    data.rideId ||
                    data.bookingId ||
                    documentSnapshot.id,

                _firestoreCollection:
                    collectionName,

                _firestoreDocumentId:
                    documentSnapshot.id

            };


            firestoreRides.push(
                normalizeRide(
                    ride
                )
            );

        }
    );


    /*
     * Merge Firestore data with local data.
     *
     * Firestore is considered authoritative for rides
     * that have the same ID.
     */

    const merged = new Map();


    rides.forEach(
        function (ride) {

            merged.set(
                String(
                    ride.id
                ),
                ride
            );

        }
    );


    firestoreRides.forEach(
        function (ride) {

            merged.set(
                String(
                    ride.id
                ),
                ride
            );

        }
    );


    rides =
        Array.from(
            merged.values()
        );


    saveRides();


    renderRideStats();

    renderRides();

}


/* =========================================================
   UNSUBSCRIBE FIRESTORE
========================================================= */

function unsubscribeFirestore() {

    firebaseUnsubscribers.forEach(
        function (unsubscribe) {

            try {

                unsubscribe();

            } catch (error) {

                console.warn(
                    "Firestore unsubscribe error:",
                    error
                );

            }

        }
    );


    firebaseUnsubscribers = [];

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


        if (
            !raw
        ) {

            return [];

        }


        const data =
            JSON.parse(
                raw
            );


        if (
            Array.isArray(
                data
            )
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


    if (
        !normalized.id
    ) {

        return;

    }


    const index =
        list.findIndex(
            function (item) {

                return String(
                    item.id
                ) ===
                String(
                    normalized.id
                );

            }
        );


    if (
        index === -1
    ) {

        list.push(
            normalized
        );

        return;

    }


    /*
     * Merge newer information without creating duplicates.
     */

    list[index] = {

        ...list[index],

        ...normalized

    };

}


/* =========================================================
   NORMALIZE RIDE
========================================================= */

function normalizeRide(
    ride
) {

    if (
        !ride ||
        typeof ride !==
        "object"
    ) {

        return null;

    }


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
        ride.driverInfo ||
        ride.driverDetails ||
        {};


    const customer =
        ride.customer ||
        ride.user ||
        ride.passenger ||
        ride.customerInfo ||
        ride.userInfo ||
        {};


    const id =
        ride.id ||
        ride.rideId ||
        ride.bookingId ||
        ride.requestId ||
        ride._firestoreDocumentId ||
        "";


    return {

        id:
            String(
                id ||
                createRideId()
            ),


        customerId:
            ride.customerId ||
            ride.userId ||
            ride.passengerId ||
            customer.id ||
            customer.uid ||
            customer.userId ||
            "",


        customerName:
            ride.customerName ||
            customer.name ||
            customer.fullName ||
            customer.displayName ||
            "Customer",


        customerPhone:
            ride.customerPhone ||
            ride.phone ||
            customer.phone ||
            customer.phoneNumber ||
            "",


        riderId:
            ride.riderId ||
            ride.driverId ||
            ride.partnerId ||
            rider.id ||
            rider.uid ||
            rider.userId ||
            "",


        riderName:
            ride.riderName ||
            ride.driverName ||
            ride.partnerName ||
            rider.name ||
            rider.fullName ||
            rider.displayName ||
            "Unassigned",


        riderPhone:
            ride.riderPhone ||
            ride.driverPhone ||
            ride.partnerPhone ||
            rider.phone ||
            rider.phoneNumber ||
            "",


        service:
            normalizeService(
                ride.service ||
                ride.serviceType ||
                ride.rideType ||
                ride.vehicleType ||
                ride.category ||
                "bike"
            ),


        status:
            normalizeStatus(
                ride.status ||
                ride.rideStatus ||
                ride.bookingStatus ||
                ride.requestStatus ||
                "pending"
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
                ride.paymentStatus ||
                ride.payment_state ||
                ride.transactionStatus
            ),


        pickup:
            formatLocation(
                pickup
            ),


        drop:
            formatLocation(
                drop
            ),


        pickupData:
            pickup && typeof pickup === "object"
                ? pickup
                : null,


        dropData:
            drop && typeof drop === "object"
                ? drop
                : null,


        distance:
            Number(
                ride.distance ??
                ride.distanceKm ??
                ride.km ??
                0
            ) || 0,


        fare:
            Number(
                ride.fare ??
                ride.amount ??
                ride.totalFare ??
                ride.totalAmount ??
                ride.price ??
                0
            ) || 0,


        commission:
            Number(
                ride.commission ??
                ride.platformFee ??
                ride.platformCommission ??
                0
            ) || 0,


        createdAt:
            ride.createdAt ||
            ride.bookedAt ||
            ride.requestedAt ||
            ride.created_at ||
            ride.date ||
            new Date().toISOString(),


        acceptedAt:
            ride.acceptedAt ||
            null,


        arrivedAt:
            ride.arrivedAt ||
            null,


        startedAt:
            ride.startedAt ||
            ride.tripStartedAt ||
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
            ride.cancelledReason ||
            "",


        notes:
            ride.notes ||
            ride.note ||
            "",


        updatedAt:
            ride.updatedAt ||
            ride.updated_at ||
            null,


        firestoreCollection:
            ride._firestoreCollection ||
            "rides",


        firestoreDocumentId:
            ride._firestoreDocumentId ||
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

    if (
        rideEventBound
    ) {

        return;

    }


    rideEventBound =
        true;


    const search =
        document.getElementById(
            "rideSearch"
        ) ||
        document.getElementById(
            "searchInput"
        );


    if (
        search
    ) {

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


    if (
        statusFilter
    ) {

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


    if (
        serviceFilter
    ) {

        serviceFilter.addEventListener(
            "change",
            renderRides
        );

    }


    const refresh =
        document.getElementById(
            "refreshRides"
        );


    if (
        refresh
    ) {

        refresh.addEventListener(
            "click",
            async function () {

                loadLocalRides();


                if (
                    !firebaseLoaded
                ) {

                    await connectFirebase();

                }


                if (
                    firebaseLoaded
                ) {

                    subscribeToFirestore();

                }


                showMessage(
                    "Ride list refreshed.",
                    "success"
                );

            }
        );

    }


    /*
     * Close modal when clicking outside content.
     */

    const modal =
        document.getElementById(
            "rideModal"
        );


    if (
        modal
    ) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    modal
                ) {

                    closeRideModal();

                }

            }
        );

    }


    /*
     * Escape closes modal.
     */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key ===
                "Escape"
            ) {

                closeRideModal();

            }

        }
    );

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
                    totalAmount,
                    ride
                ) {

                    return (
                        totalAmount +
                        Number(
                            ride.fare
                        )
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


    if (
        !container
    ) {

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


                if (
                    !search
                ) {

                    return true;

                }


                const text = [

                    ride.id,

                    ride.customerName,

                    ride.customerPhone,

                    ride.riderName,

                    ride.riderPhone,

                    ride.pickup,

                    ride.drop,

                    ride.service,

                    ride.status,

                    serviceLabel(
                        ride.service
                    ),

                    statusLabel(
                        ride.status
                    )

                ]
                .join(" ")
                .toLowerCase();


                return text.includes(
                    search
                );

            }
        );


    container.innerHTML =
        "";


    if (
        !filtered.length
    ) {

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

            if (
                isTable
            ) {

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
            ${escapeHtml(
                serviceLabel(
                    ride.service
                )
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


    if (
        !ride
    ) {

        showMessage(
            "Ride not found.",
            "error"
        );


        return;

    }


    selectedRideId =
        String(
            id
        );


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
            ride.acceptedAt
                ? detailRow(
                    "Accepted At",
                    formatDate(
                        ride.acceptedAt
                    )
                )
                : ""
        }

        ${
            ride.startedAt
                ? detailRow(
                    "Started At",
                    formatDate(
                        ride.startedAt
                    )
                )
                : ""
        }

        ${
            ride.completedAt
                ? detailRow(
                    "Completed At",
                    formatDate(
                        ride.completedAt
                    )
                )
                : ""
        }

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


    if (
        modal
    ) {

        modal.classList.remove(
            "show"
        );

    }


    selectedRideId =
        null;

}


/* =========================================================
   UPDATE RIDE STATUS
========================================================= */

async function updateRideStatus(
    id,
    newStatus
) {

    const ride =
        findRide(
            id
        );


    if (
        !ride
    ) {

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


    const now =
        new Date().toISOString();


    ride.status =
        status;


    ride.updatedAt =
        now;


    if (
        status ===
        "accepted"
    ) {

        ride.acceptedAt =
            ride.acceptedAt ||
            now;

    }


    if (
        status ===
        "arrived"
    ) {

        ride.arrivedAt =
            ride.arrivedAt ||
            now;

    }


    if (
        [
            "started",
            "ongoing"
        ].includes(
            status
        )
    ) {

        ride.startedAt =
            ride.startedAt ||
            now;

    }


    if (
        status ===
        "completed"
    ) {

        ride.completedAt =
            ride.completedAt ||
            now;

    }


    if (
        status ===
        "cancelled"
    ) {

        ride.cancelledAt =
            ride.cancelledAt ||
            now;

    }


    saveRides();


    renderRideStats();

    renderRides();


    /*
     * Sync status to Firestore.
     */

    const synced =
        await updateRideInFirestore(
            ride
        );


    if (
        synced
    ) {

        showMessage(
            "Ride status updated.",
            "success"
        );

    } else if (
        firebaseLoaded
    ) {

        showMessage(
            "Ride updated locally. Firebase sync failed.",
            "error"
        );

    } else {

        showMessage(
            "Ride status updated locally.",
            "success"
        );

    }


    return true;

}


/* =========================================================
   CANCEL RIDE
========================================================= */

async function cancelRide(
    id,
    reason = "Cancelled by admin"
) {

    const ride =
        findRide(
            id
        );


    if (
        !ride
    ) {

        showMessage(
            "Ride not found.",
            "error"
        );


        return false;

    }


    const now =
        new Date().toISOString();


    ride.status =
        "cancelled";


    ride.cancelReason =
        String(
            reason ||
            "Cancelled by admin"
        );


    ride.cancelledAt =
        now;


    ride.updatedAt =
        now;


    saveRides();


    renderRideStats();

    renderRides();


    const synced =
        await updateRideInFirestore(
            ride
        );


    if (
        synced
    ) {

        showMessage(
            "Ride cancelled.",
            "success"
        );

    } else if (
        firebaseLoaded
    ) {

        showMessage(
            "Ride cancelled locally. Firebase sync failed.",
            "error"
        );

    } else {

        showMessage(
            "Ride cancelled locally.",
            "success"
        );

    }


    return true;

}


/* =========================================================
   UPDATE RIDE IN FIRESTORE
========================================================= */

async function updateRideInFirestore(
    ride
) {

    if (
        !firebaseLoaded ||
        !firestoreDb ||
        !ride
    ) {

        return false;

    }


    if (
        firestoreWriteInProgress
    ) {

        return false;

    }


    const collectionFunction =
        firebaseModule?.collection;


    const docFunction =
        firebaseModule?.doc;


    const updateDocFunction =
        firebaseModule?.updateDoc;


    const setDocFunction =
        firebaseModule?.setDoc;


    const serverTimestampFunction =
        firebaseModule?.serverTimestamp;


    if (
        typeof collectionFunction !==
        "function" ||
        typeof docFunction !==
        "function"
    ) {

        return false;

    }


    firestoreWriteInProgress =
        true;


    try {

        /*
         * Prefer the collection where the ride originally
         * came from.
         */

        const collectionNames = [

            ride.firestoreCollection,

            ...RIDES_FIRESTORE_COLLECTIONS

        ]
        .filter(
            function (value, index, array) {

                return (
                    value &&
                    array.indexOf(
                        value
                    ) === index
                );

            }
        );


        const documentId =
            ride.firestoreDocumentId ||
            ride.id;


        const payload = {

            status:
                ride.status,

            updatedAt:
                typeof serverTimestampFunction ===
                "function"
                    ? serverTimestampFunction()
                    : new Date().toISOString()

        };


        if (
            ride.acceptedAt
        ) {

            payload.acceptedAt =
                ride.acceptedAt;

        }


        if (
            ride.arrivedAt
        ) {

            payload.arrivedAt =
                ride.arrivedAt;

        }


        if (
            ride.startedAt
        ) {

            payload.startedAt =
                ride.startedAt;

        }


        if (
            ride.completedAt
        ) {

            payload.completedAt =
                ride.completedAt;

        }


        if (
            ride.cancelledAt
        ) {

            payload.cancelledAt =
                ride.cancelledAt;

        }


        if (
            ride.cancelReason
        ) {

            payload.cancelReason =
                ride.cancelReason;

        }


        /*
         * If we know the original collection, update it first.
         */

        for (
            const collectionName of collectionNames
        ) {

            try {

                const rideRef =
                    docFunction(
                        firestoreDb,
                        collectionName,
                        String(
                            documentId
                        )
                    );


                if (
                    typeof updateDocFunction ===
                    "function"
                ) {

                    await updateDocFunction(
                        rideRef,
                        payload
                    );

                    firestoreWriteInProgress =
                        false;

                    return true;

                }


                if (
                    typeof setDocFunction ===
                    "function"
                ) {

                    await setDocFunction(
                        rideRef,
                        payload,
                        {
                            merge:true
                        }
                    );

                    firestoreWriteInProgress =
                        false;

                    return true;

                }

            } catch (error) {

                /*
                 * Try the next compatible collection.
                 */

                console.warn(
                    "Firestore ride update attempt failed:",
                    collectionName,
                    error
                );

            }

        }


    } catch (error) {

        console.error(
            "Firestore ride update failed:",
            error
        );

    }


    firestoreWriteInProgress =
        false;


    return false;

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
            String(
                id
            );

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
        .trim()
        .replace(
            /\s+/g,
            "_"
        );


    if (
        [
            "cab",
            "car",
            "taxi"
        ].includes(
            value
        )
    ) {

        return "cab";

    }


    if (
        [
            "parcel",
            "delivery",
            "parcel_delivery",
            "parcel-delivery"
        ].includes(
            value
        )
    ) {

        return "parcel";

    }


    if (
        [
            "food",
            "food_delivery",
            "food-delivery"
        ].includes(
            value
        )
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
        .trim()
        .replace(
            /\s+/g,
            "_"
        );


    const map = {

        requested:
            "pending",

        request:
            "pending",

        searching:
            "pending",

        waiting:
            "pending",

        pending:
            "pending",

        accepted:
            "accepted",

        confirmed:
            "accepted",

        driver_assigned:
            "accepted",

        rider_assigned:
            "accepted",

        arrived:
            "arrived",

        rider_arrived:
            "arrived",

        started:
            "started",

        start:
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

        finished:
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
        .trim()
        .replace(
            /\s+/g,
            "_"
        );


    if (
        [
            "online",
            "upi",
            "card",
            "wallet"
        ].includes(
            value
        )
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
            "successful",
            "completed"
        ].includes(
            value
        )
    ) {

        return "paid";

    }


    if (
        [
            "failed",
            "failure",
            "declined"
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

    const value =
        normalizePaymentStatus(
            status
        );


    if (
        value ===
        "paid"
    ) {

        return "Paid";

    }


    if (
        value ===
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

    if (
        !location
    ) {

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

            location.formatted_address ||

            location.description ||

            (
                location.lat !==
                    undefined &&
                location.lng !==
                    undefined

                    ? `${location.lat}, ${location.lng}`

                    : location.latitude !==
                        undefined &&
                      location.longitude !==
                        undefined

                        ? `${location.latitude}, ${location.longitude}`

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
                    word-break:break-word;
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
            .slice(
                2,
                7
            )
            .toUpperCase()

    );

}


function formatMoney(
    value
) {

    const amount =
        Number(
            value
        ) || 0;


    return amount.toLocaleString(
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

    if (
        !value
    ) {

        return "—";

    }


    try {

        /*
         * Firebase Timestamp.
         */

        if (
            typeof value ===
            "object" &&
            typeof value.toDate ===
            "function"
        ) {

            value =
                value.toDate();

        }


        /*
         * Firestore timestamp object.
         */

        else if (
            typeof value ===
            "object" &&
            typeof value.seconds ===
            "number"
        ) {

            value =
                new Date(
                    value.seconds *
                    1000
                );

        }


        const date =
            value instanceof Date
                ? value
                : new Date(
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


    if (
        element
    ) {

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
   JAVASCRIPT STRING ESCAPE
========================================================= */

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


    if (
        old
    ) {

        old.remove();

    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "rideMessage";


    box.textContent =
        String(
            message
        );


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
        async function () {

            loadLocalRides();


            if (
                !firebaseLoaded
            ) {

                await connectFirebase();

            }


            if (
                firebaseLoaded
            ) {

                subscribeToFirestore();

            }


            return [
                ...rides
            ];

        },


    updateStatus:
        updateRideStatus,


    cancel:
        cancelRide,


    isFirebaseConnected:
        function () {

            return firebaseLoaded;

        },


    destroy:
        function () {

            unsubscribeFirestore();

            ridesInitialized =
                false;

            rideEventBound =
                false;

        }

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

            loadLocalRides();

        }

    }
);


/* =========================================================
   PAGE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        unsubscribeFirestore();

    }
);
