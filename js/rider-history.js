/* ============================================================
   RIDERX - RIDER HISTORY
   File: js/rider-history.js

   Handles:
   - Rider ride history
   - Completed rides
   - Cancelled rides
   - Search
   - Status filter
   - Date filter
   - Earnings total
   - Ride details
   - Firebase + local fallback
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const History = RX.riderHistory =
        RX.riderHistory || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    History.config = {

        ridesPath:
            "rides",

        ridersPath:
            "riders",

        pageSize:
            20,

        cacheKey:
            "riderx_rider_history",

        currency:
            "INR"
    };


    /* ========================================================
       STATE
       ======================================================== */

    History.state = {

        initialized:
            false,

        riderId:
            null,

        rides:
            [],

        filtered:
            [],

        displayed:
            [],

        search:
            "",

        status:
            "all",

        date:
            "all",

        sort:
            "newest",

        page:
            1,

        loading:
            false,

        hasMore:
            false,

        totals:
            {

                rides:
                    0,

                completed:
                    0,

                cancelled:
                    0,

                earnings:
                    0,

                distance:
                    0
            }
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    History.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       USER
       ======================================================== */

    History.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth.currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth().currentUser;
                }

            } catch (error) {}


            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );

                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       RIDER ID
       ======================================================== */

    History.getRiderId =
        function () {

            if (
                History.state.riderId
            ) {

                return History.state.riderId;
            }


            const user =
                History.getUser() ||
                {};


            const id =
                user.uid ||
                user.id ||
                user.riderId ||
                user.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                );


            if (
                id
            ) {

                History.state.riderId =
                    id;
            }


            return id || null;
        };


    /* ========================================================
       NORMALIZE RIDE
       ======================================================== */

    History.normalizeRide =
        function (
            ride,
            fallbackId
        ) {

            if (
                !ride
            ) {

                return null;
            }


            const normalized =
                {

                    ...ride
                };


            normalized.rideId =
                ride.rideId ||
                ride.id ||
                fallbackId ||
                "";


            normalized.status =
                History.normalizeStatus(
                    ride.status
                );


            normalized.createdAt =
                History.toTimestamp(
                    ride.createdAt ||
                    ride.bookedAt ||
                    ride.requestedAt ||
                    ride.timestamp
                );


            normalized.acceptedAt =
                History.toTimestamp(
                    ride.acceptedAt
                );


            normalized.startedAt =
                History.toTimestamp(
                    ride.startedAt ||
                    ride.tripStartedAt
                );


            normalized.completedAt =
                History.toTimestamp(
                    ride.completedAt ||
                    ride.endedAt ||
                    ride.finishedAt
                );


            normalized.pickupAddress =
                ride.pickupAddress ||
                ride.pickup?.address ||
                ride.fromAddress ||
                ride.pickupLocation?.address ||
                "Pickup";


            normalized.destinationAddress =
                ride.destinationAddress ||
                ride.dropAddress ||
                ride.destination?.address ||
                ride.toAddress ||
                ride.dropLocation?.address ||
                "Destination";


            normalized.customerName =
                ride.customerName ||
                ride.passengerName ||
                ride.userName ||
                "Customer";


            normalized.fare =
                Number(
                    ride.finalFare ??
                    ride.actualFare ??
                    ride.fare ??
                    ride.totalFare ??
                    ride.estimatedFare ??
                    0
                ) || 0;


            normalized.distance =
                Number(
                    ride.distance ??
                    ride.distanceKm ??
                    ride.km ??
                    0
                ) || 0;


            normalized.paymentMethod =
                ride.paymentMethod ||
                ride.payment ||
                "cash";


            return normalized;
        };


    /* ========================================================
       STATUS
       ======================================================== */

    History.normalizeStatus =
        function (
            status
        ) {

            const value =
                String(
                    status ||
                    ""
                )
                .toLowerCase()
                .trim();


            const aliases =
                {

                    finished:
                        "completed",

                    complete:
                        "completed",

                    success:
                        "completed",

                    canceled:
                        "cancelled",

                    cancel:
                        "cancelled",

                    inprogress:
                        "in_progress",

                    ongoing:
                        "in_progress"
                };


            return (
                aliases[value] ||
                value ||
                "unknown"
            );
        };


    /* ========================================================
       TIMESTAMP
       ======================================================== */

    History.toTimestamp =
        function (
            value
        ) {

            if (
                !value
            ) {

                return 0;
            }


            if (
                typeof value ===
                "number"
            ) {

                return value < 10000000000
                    ? value * 1000
                    : value;
            }


            if (
                value instanceof Date
            ) {

                return value.getTime();
            }


            if (
                typeof value ===
                "object" &&
                typeof value.toDate ===
                "function"
            ) {

                try {

                    return value
                        .toDate()
                        .getTime();

                } catch (error) {}
            }


            const parsed =
                Date.parse(
                    value
                );


            return Number.isNaN(
                parsed
            )
                ? 0
                : parsed;
        };


    /* ========================================================
       LOAD HISTORY
       ======================================================== */

    History.load =
        async function () {

            if (
                History.state.loading
            ) {

                return History.state.rides;
            }


            History.state.loading =
                true;


            try {

                const riderId =
                    History.getRiderId();


                if (
                    !riderId
                ) {

                    History.loadCache();

                    History.applyFilters();

                    return History.state.rides;
                }


                const database =
                    History.getDatabase();


                if (
                    database
                ) {

                    try {

                        const snapshot =
                            await database
                                .ref(
                                    History.config
                                        .ridesPath
                                )
                                .orderByChild(
                                    "riderId"
                                )
                                .equalTo(
                                    riderId
                                )
                                .once(
                                    "value"
                                );


                        const data =
                            snapshot.val() ||
                            {};


                        const rides =
                            Object.entries(
                                data
                            )
                            .map(
                                function (
                                    [
                                        id,
                                        ride
                                    ]
                                ) {

                                    return History
                                        .normalizeRide(
                                            ride,
                                            id
                                        );

                                }
                            )
                            .filter(
                                Boolean
                            );


                        History.state.rides =
                            rides;


                        History.saveCache();


                    } catch (error) {

                        console.warn(
                            "Firebase rider history query failed:",
                            error
                        );


                        History.loadCache();
                    }

                } else {

                    History.loadCache();
                }


                History.applyFilters();


                return History.state.rides;

            } finally {

                History.state.loading =
                    false;
            }
        };


    /* ========================================================
       LOCAL CACHE
       ======================================================== */

    History.saveCache =
        function () {

            try {

                localStorage.setItem(
                    History.config.cacheKey,
                    JSON.stringify(
                        History.state.rides
                    )
                );

            } catch (error) {}
        };


    History.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        History.config.cacheKey
                    );


                if (
                    !saved
                ) {

                    History.state.rides =
                        [];

                    return;
                }


                const rides =
                    JSON.parse(
                        saved
                    );


                History.state.rides =
                    Array.isArray(
                        rides
                    )
                        ? rides
                        : [];

            } catch (error) {

                History.state.rides =
                    [];
            }
        };


    /* ========================================================
       FILTER
       ======================================================== */

    History.applyFilters =
        function () {

            let rides =
                [
                    ...History.state.rides
                ];


            const search =
                History.state.search
                    .toLowerCase()
                    .trim();


            /*
             * Search.
             */

            if (
                search
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            const text =
                                [

                                    ride.rideId,

                                    ride.customerName,

                                    ride.pickupAddress,

                                    ride.destinationAddress,

                                    ride.paymentMethod,

                                    ride.status

                                ]
                                .join(
                                    " "
                                )
                                .toLowerCase();


                            return text.includes(
                                search
                            );
                        }
                    );
            }


            /*
             * Status.
             */

            if (
                History.state.status !==
                "all"
            ) {

                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            return (
                                ride.status ===
                                History.state.status
                            );
                        }
                    );
            }


            /*
             * Date.
             */

            if (
                History.state.date !==
                "all"
            ) {

                const now =
                    new Date();


                let start =
                    0;


                if (
                    History.state.date ===
                    "today"
                ) {

                    start =
                        new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate()
                        )
                        .getTime();

                } else if (
                    History.state.date ===
                    "week"
                ) {

                    start =
                        Date.now() -
                        (
                            7 *
                            24 *
                            60 *
                            60 *
                            1000
                        );

                } else if (
                    History.state.date ===
                    "month"
                ) {

                    start =
                        Date.now() -
                        (
                            30 *
                            24 *
                            60 *
                            60 *
                            1000
                        );
                }


                rides =
                    rides.filter(
                        function (
                            ride
                        ) {

                            return (
                                (
                                    ride.completedAt ||
                                    ride.createdAt ||
                                    0
                                ) >= start
                            );
                        }
                    );
            }


            /*
             * Sort.
             */

            rides.sort(
                function (
                    a,
                    b
                ) {

                    const dateA =
                        a.completedAt ||
                        a.createdAt ||
                        0;


                    const dateB =
                        b.completedAt ||
                        b.createdAt ||
                        0;


                    return History.state.sort ===
                        "oldest"

                        ? dateA - dateB

                        : dateB - dateA;
                }
            );


            History.state.filtered =
                rides;


            History.state.page =
                1;


            History.state.displayed =
                rides.slice(
                    0,
                    History.config.pageSize
                );


            History.state.hasMore =
                rides.length >
                History.state.displayed.length;


            History.calculateTotals();


            History.render();


            return rides;
        };


    /* ========================================================
       CALCULATE TOTALS
       ======================================================== */

    History.calculateTotals =
        function () {

            const rides =
                History.state.filtered;


            const totals =
                {

                    rides:
                        rides.length,

                    completed:
                        0,

                    cancelled:
                        0,

                    earnings:
                        0,

                    distance:
                        0
                };


            rides.forEach(
                function (
                    ride
                ) {

                    if (
                        ride.status ===
                        "completed"
                    ) {

                        totals.completed++;

                        totals.earnings +=
                            Number(
                                ride.fare
                            ) || 0;
                    }


                    if (
                        ride.status ===
                        "cancelled"
                    ) {

                        totals.cancelled++;
                    }


                    totals.distance +=
                        Number(
                            ride.distance
                        ) || 0;

                }
            );


            totals.earnings =
                Number(
                    totals.earnings.toFixed(
                        2
                    )
                );


            totals.distance =
                Number(
                    totals.distance.toFixed(
                        2
                    )
                );


            History.state.totals =
                totals;


            History.updateTotalsUI(
                totals
            );


            return totals;
        };


    /* ========================================================
       LOAD MORE
       ======================================================== */

    History.loadMore =
        function () {

            const currentLength =
                History.state.displayed
                    .length;


            const next =
                History.state.filtered
                    .slice(
                        0,
                        currentLength +
                        History.config.pageSize
                    );


            History.state.displayed =
                next;


            History.state.page++;


            History.state.hasMore =
                next.length <
                History.state.filtered.length;


            History.render();


            return next;
        };


    /* ========================================================
       SEARCH
       ======================================================== */

    History.setSearch =
        function (
            value
        ) {

            History.state.search =
                String(
                    value ||
                    ""
                );


            History.applyFilters();
        };


    /* ========================================================
       STATUS FILTER
       ======================================================== */

    History.setStatus =
        function (
            status
        ) {

            History.state.status =
                History.normalizeStatus(
                    status
                );


            if (
                status ===
                "all"
            ) {

                History.state.status =
                    "all";
            }


            History.applyFilters();
        };


    /* ========================================================
       DATE FILTER
       ======================================================== */

    History.setDate =
        function (
            date
        ) {

            date =
                String(
                    date ||
                    "all"
                );


            History.state.date =
                date;


            History.applyFilters();
        };


    /* ========================================================
       SORT
       ======================================================== */

    History.setSort =
        function (
            sort
        ) {

            History.state.sort =
                sort ===
                "oldest"
                    ? "oldest"
                    : "newest";


            History.applyFilters();
        };


    /* ========================================================
       FIND RIDE
       ======================================================== */

    History.getRide =
        function (
            rideId
        ) {

            return History.state.rides
                .find(
                    function (
                        ride
                    ) {

                        return String(
                            ride.rideId
                        ) ===
                        String(
                            rideId
                        );

                    }
                ) ||
                null;
        };


    /* ========================================================
       OPEN DETAILS
       ======================================================== */

    History.openDetails =
        function (
            rideId
        ) {

            const ride =
                History.getRide(
                    rideId
                );


            if (
                !ride
            ) {

                return null;
            }


            History.state.selectedRide =
                ride;


            /*
             * If a ride-details page exists,
             * pass the ride ID to it.
             */

            try {

                sessionStorage.setItem(
                    "riderx_selected_ride",
                    JSON.stringify(
                        ride
                    )
                );

            } catch (error) {}


            const detailsUrl =
                "ride-details.html?rideId=" +
                encodeURIComponent(
                    ride.rideId
                );


            /*
             * Don't force navigation when
             * page is embedded inside another UI.
             */

            const event =
                new CustomEvent(
                    "riderx-history-details",
                    {

                        detail:
                            {

                                ride:
                                    ride,

                                url:
                                    detailsUrl
                            }
                    }
                );


            window.dispatchEvent(
                event
            );


            return ride;
        };


    /* ========================================================
       RENDER
       ======================================================== */

    History.render =
        function () {

            const container =
                document.querySelector(
                    "[data-rider-history]"
                ) ||
                document.querySelector(
                    "#rideHistory"
                ) ||
                document.querySelector(
                    ".ride-history-list"
                );


            if (
                !container
            ) {

                History.updateTotalsUI(
                    History.state.totals
                );

                return;
            }


            const rides =
                History.state.displayed;


            if (
                !rides.length
            ) {

                container.innerHTML =
                    History.emptyTemplate();

                History.updateLoadMoreUI();

                return;
            }


            container.innerHTML =
                rides
                    .map(
                        History.rideTemplate
                    )
                    .join(
                        ""
                    );


            History.updateLoadMoreUI();
        };


    /* ========================================================
       RIDE TEMPLATE
       ======================================================== */

    History.rideTemplate =
        function (
            ride
        ) {

            const date =
                History.formatDate(
                    ride.completedAt ||
                    ride.createdAt
                );


            const statusClass =
                History.statusClass(
                    ride.status
                );


            const fare =
                History.formatMoney(
                    ride.fare
                );


            const distance =
                ride.distance
                    ? `${ride.distance.toFixed(1)} km`
                    : "—";


            return `
                <article
                    class="rider-history-card"
                    data-ride-id="${History.escape(
                        ride.rideId
                    )}"
                    data-history-card
                >

                    <div class="rider-history-card__top">

                        <div>

                            <div class="rider-history-card__date">
                                ${History.escape(date)}
                            </div>

                            <div class="rider-history-card__id">
                                #${History.escape(
                                    ride.rideId
                                )}
                            </div>

                        </div>

                        <span
                            class="rider-history-status ${statusClass}"
                        >
                            ${History.escape(
                                History.statusLabel(
                                    ride.status
                                )
                            )}
                        </span>

                    </div>


                    <div class="rider-history-route">

                        <div class="rider-history-route__line">
                            <span class="rider-history-dot rider-history-dot--pickup"></span>
                            <span class="rider-history-route-line"></span>
                            <span class="rider-history-dot rider-history-dot--drop"></span>
                        </div>


                        <div class="rider-history-route__addresses">

                            <div>
                                ${History.escape(
                                    ride.pickupAddress
                                )}
                            </div>

                            <div>
                                ${History.escape(
                                    ride.destinationAddress
                                )}
                            </div>

                        </div>

                    </div>


                    <div class="rider-history-card__bottom">

                        <div>
                            <strong>
                                ${fare}
                            </strong>

                            <small>
                                ${History.escape(
                                    distance
                                )}
                            </small>
                        </div>


                        <button
                            type="button"
                            class="rider-history-details"
                            data-history-details
                            data-ride-id="${History.escape(
                                ride.rideId
                            )}"
                        >
                            View details
                        </button>

                    </div>

                </article>
            `;
        };


    /* ========================================================
       EMPTY
       ======================================================== */

    History.emptyTemplate =
        function () {

            return `
                <div class="rider-history-empty">

                    <div class="rider-history-empty-icon">
                        🛵
                    </div>

                    <h3>
                        No rides found
                    </h3>

                    <p>
                        Your completed rides will appear here.
                    </p>

                </div>
            `;
        };


    /* ========================================================
       STATUS CLASS
       ======================================================== */

    History.statusClass =
        function (
            status
        ) {

            status =
                History.normalizeStatus(
                    status
                );


            return (
                "status-" +
                status.replace(
                    /[^a-z0-9_-]/g,
                    ""
                )
            );
        };


    /* ========================================================
       STATUS LABEL
       ======================================================== */

    History.statusLabel =
        function (
            status
        ) {

            const labels =
                {

                    completed:
                        "Completed",

                    cancelled:
                        "Cancelled",

                    accepted:
                        "Accepted",

                    arriving:
                        "On the way",

                    arrived:
                        "Arrived",

                    in_progress:
                        "In progress",

                    unknown:
                        "Ride"
                };


            return (
                labels[
                    History.normalizeStatus(
                        status
                    )
                ] ||
                "Ride"
            );
        };


    /* ========================================================
       TOTALS UI
       ======================================================== */

    History.updateTotalsUI =
        function (
            totals
        ) {

            History.setText(
                "history-total-rides",
                totals.rides
            );


            History.setText(
                "history-completed-rides",
                totals.completed
            );


            History.setText(
                "history-cancelled-rides",
                totals.cancelled
            );


            History.setText(
                "history-earnings",
                History.formatMoney(
                    totals.earnings
                )
            );


            History.setText(
                "history-distance",
                totals.distance.toFixed(
                    1
                ) + " km"
            );


            document
                .querySelectorAll(
                    "[data-history-total-rides]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            totals.rides;
                    }
                );


            document
                .querySelectorAll(
                    "[data-history-earnings]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            History.formatMoney(
                                totals.earnings
                            );
                    }
                );
        };


    /* ========================================================
       LOAD MORE UI
       ======================================================== */

    History.updateLoadMoreUI =
        function () {

            document
                .querySelectorAll(
                    "[data-history-load-more]"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.hidden =
                            !History.state.hasMore;

                    }
                );
        };


    /* ========================================================
       FORMAT MONEY
       ======================================================== */

    History.formatMoney =
        function (
            value
        ) {

            value =
                Number(
                    value
                ) || 0;


            return "₹" +
                value.toLocaleString(
                    "en-IN",
                    {

                        minimumFractionDigits:
                            0,

                        maximumFractionDigits:
                            2
                    }
                );
        };


    /* ========================================================
       FORMAT DATE
       ======================================================== */

    History.formatDate =
        function (
            timestamp
        ) {

            if (
                !timestamp
            ) {

                return "Date unavailable";
            }


            const date =
                new Date(
                    timestamp
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return "Date unavailable";
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
        };


    /* ========================================================
       ESCAPE
       ======================================================== */

    History.escape =
        function (
            value
        ) {

            const text =
                String(
                    value ??
                    ""
                );


            return text
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
        };


    /* ========================================================
       SET TEXT
       ======================================================== */

    History.setText =
        function (
            id,
            value
        ) {

            const selectors = [

                `#${id}`,

                `[data-history="${id}"]`,

                `[data-${id}]`

            ];


            selectors.forEach(
                function (
                    selector
                ) {

                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.textContent =
                                    value;

                            }
                        );
                }
            );
        };


    /* ========================================================
       EVENT BINDING
       ======================================================== */

    History.bindEvents =
        function () {

            /*
             * Search.
             */

            document.addEventListener(
                "input",
                function (
                    event
                ) {

                    const input =
                        event.target.closest(
                            "[data-history-search]"
                        );


                    if (
                        !input
                    ) {

                        return;
                    }


                    History.setSearch(
                        input.value
                    );
                }
            );


            /*
             * Status filter.
             */

            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const status =
                        event.target.closest(
                            "[data-history-status]"
                        );


                    if (
                        status
                    ) {

                        History.setStatus(
                            status.value
                        );

                        return;
                    }


                    const date =
                        event.target.closest(
                            "[data-history-date]"
                        );


                    if (
                        date
                    ) {

                        History.setDate(
                            date.value
                        );

                        return;
                    }


                    const sort =
                        event.target.closest(
                            "[data-history-sort]"
                        );


                    if (
                        sort
                    ) {

                        History.setSort(
                            sort.value
                        );
                    }

                }
            );


            /*
             * Click actions.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const loadMore =
                        event.target.closest(
                            "[data-history-load-more]"
                        );


                    if (
                        loadMore
                    ) {

                        History.loadMore();

                        return;
                    }


                    const details =
                        event.target.closest(
                            "[data-history-details]"
                        );


                    if (
                        details
                    ) {

                        const rideId =
                            details.dataset
                                .rideId;


                        const ride =
                            History.openDetails(
                                rideId
                            );


                        if (
                            ride
                        ) {

                            /*
                             * Navigate only when
                             * explicitly requested.
                             */

                            if (
                                details.dataset
                                    .navigate ===
                                "true"
                            ) {

                                window.location.href =
                                    "ride-details.html?rideId=" +
                                    encodeURIComponent(
                                        rideId
                                    );
                            }
                        }

                    }

                }
            );


            /*
             * Refresh.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const refresh =
                        event.target.closest(
                            "[data-refresh-history]"
                        );


                    if (
                        refresh
                    ) {

                        History.load();
                    }

                }
            );


            /*
             * New completed ride.
             */

            window.addEventListener(
                "riderx-ride-complete-completed",
                function () {

                    History.load();

                }
            );


            window.addEventListener(
                "riderx-ride-flow-completed",
                function () {

                    History.load();

                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.loadRiderHistory =
        History.load;

    RX.filterRiderHistory =
        History.applyFilters;

    RX.getRiderHistory =
        function () {

            return History.state.filtered;
        };


    /* ========================================================
       INIT
       ======================================================== */

    History.init =
        async function () {

            if (
                History.state.initialized
            ) {

                return;
            }


            History.state.initialized =
                true;


            History.bindEvents();


            await History.load();


            console.log(
                "RiderX rider-history.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            History.init
        );

    } else {

        History.init();

    }

})();
