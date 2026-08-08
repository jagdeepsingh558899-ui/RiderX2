/* ============================================================
   RIDERX - RIDER RIDES
   File: js/rider-rides.js

   Handles:
   - Rider ride request list
   - Available ride requests
   - Active rides
   - Completed/cancelled rides
   - Filtering
   - Sorting
   - Real-time Firebase updates
   - Accept ride integration
   - Ride list rendering
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Rides =
        RX.riderRides ||
        (RX.riderRides = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Rides.config = {

        ridesPath:
            "rides",

        requestsPath:
            "rideRequests",

        ridersPath:
            "riders",

        cacheKey:
            "riderx_rides_cache",

        pageSize:
            50,

        refreshInterval:
            15000
    };


    /* ========================================================
       STATE
       ======================================================== */

    Rides.state = {

        initialized:
            false,

        loading:
            false,

        riderId:
            null,

        rides:
            [],

        available:
            [],

        active:
            [],

        completed:
            [],

        cancelled:
            [],

        filter:
            "all",

        search:
            "",

        sort:
            "newest",

        listener:
            null,

        refreshTimer:
            null
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Rides.getDatabase =
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
       RIDER ID
       ======================================================== */

    Rides.getRiderId =
        function () {

            if (
                Rides.state.riderId
            ) {

                return Rides.state.riderId;
            }


            try {

                if (
                    RX.getRiderProfile
                ) {

                    const profile =
                        RX.getRiderProfile();


                    if (
                        profile &&
                        (
                            profile.uid ||
                            profile.id
                        )
                    ) {

                        Rides.state.riderId =
                            profile.uid ||
                            profile.id;

                        return Rides.state.riderId;
                    }
                }

            } catch (error) {}


            try {

                const uid =
                    localStorage.getItem(
                        "riderx_uid"
                    );


                if (
                    uid
                ) {

                    Rides.state.riderId =
                        uid;

                    return uid;
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       NORMALIZE
       ======================================================== */

    Rides.normalize =
        function (
            ride,
            id
        ) {

            if (
                !ride
            ) {

                return null;
            }


            return {

                ...ride,

                id:
                    ride.id ||
                    ride.rideId ||
                    id ||
                    "",

                rideId:
                    ride.rideId ||
                    ride.id ||
                    id ||
                    "",

                customerId:
                    ride.customerId ||
                    ride.userId ||
                    ride.passengerId ||
                    "",

                customerName:
                    ride.customerName ||
                    ride.passengerName ||
                    ride.userName ||
                    "Customer",

                customerPhone:
                    ride.customerPhone ||
                    ride.passengerPhone ||
                    ride.userPhone ||
                    "",

                riderId:
                    ride.riderId ||
                    ride.driverId ||
                    "",

                status:
                    String(
                        ride.status ||
                        "requested"
                    ).toLowerCase(),

                pickup:
                    ride.pickup ||
                    ride.pickupLocation ||
                    null,

                destination:
                    ride.destination ||
                    ride.dropoff ||
                    ride.dropoffLocation ||
                    null,

                pickupAddress:
                    ride.pickupAddress ||
                    ride.pickup?.address ||
                    "",

                destinationAddress:
                    ride.destinationAddress ||
                    ride.destination?.address ||
                    ride.dropoff?.address ||
                    "",

                fare:
                    Number(
                        ride.fare ??
                        ride.estimatedFare ??
                        ride.totalFare ??
                        0
                    ),

                distance:
                    Number(
                        ride.distance ??
                        ride.distanceKm ??
                        0
                    ),

                duration:
                    Number(
                        ride.duration ??
                        ride.durationMinutes ??
                        0
                    ),

                paymentMethod:
                    ride.paymentMethod ||
                    ride.payment ||
                    "cash",

                serviceType:
                    ride.serviceType ||
                    ride.rideType ||
                    "Bike Taxi",

                createdAt:
                    ride.createdAt ||
                    0,

                updatedAt:
                    ride.updatedAt ||
                    ride.createdAt ||
                    0
            };
        };


    /* ========================================================
       STATUS GROUPS
       ======================================================== */

    Rides.isAvailable =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            return (

                (
                    ride.status ===
                    "requested"
                ) ||

                (
                    ride.status ===
                    "searching"
                )

            ) &&
            !ride.riderId;
        };


    Rides.isActive =
        function (
            ride
        ) {

            if (
                !ride
            ) {

                return false;
            }


            return [

                "accepted",
                "arriving",
                "arrived",
                "started",
                "in_progress"

            ].includes(
                ride.status
            );
        };


    Rides.isCompleted =
        function (
            ride
        ) {

            return (
                ride &&
                ride.status ===
                "completed"
            );
        };


    Rides.isCancelled =
        function (
            ride
        ) {

            return (
                ride &&
                ride.status ===
                "cancelled"
            );
        };


    /* ========================================================
       LOAD RIDES
       ======================================================== */

    Rides.load =
        async function () {

            if (
                Rides.state.loading
            ) {

                return Rides.state.rides;
            }


            Rides.state.loading =
                true;


            try {

                const database =
                    Rides.getDatabase();


                const riderId =
                    Rides.getRiderId();


                if (
                    !database
                ) {

                    Rides.loadCache();

                    Rides.rebuildGroups();

                    Rides.render();

                    return Rides.state.rides;
                }


                let rides =
                    [];


                /*
                 * First get rides assigned to
                 * this rider.
                 */

                if (
                    riderId
                ) {

                    try {

                        const snapshot =
                            await database
                                .ref(
                                    Rides.config
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


                        Object.entries(
                            data
                        )
                        .forEach(
                            function (
                                [
                                    id,
                                    ride
                                ]
                            ) {

                                const normalized =
                                    Rides.normalize(
                                        ride,
                                        id
                                    );


                                if (
                                    normalized
                                ) {

                                    rides.push(
                                        normalized
                                    );
                                }

                            }
                        );

                    } catch (error) {

                        console.warn(
                            "Assigned ride query failed:",
                            error
                        );
                    }
                }


                /*
                 * Also get recent open rides.
                 */

                try {

                    const snapshot =
                        await database
                            .ref(
                                Rides.config
                                    .ridesPath
                            )
                            .orderByChild(
                                "createdAt"
                            )
                            .limitToLast(
                                Rides.config
                                    .pageSize
                            )
                            .once(
                                "value"
                            );


                    const data =
                        snapshot.val() ||
                        {};


                    Object.entries(
                        data
                    )
                    .forEach(
                        function (
                            [
                                id,
                                ride
                            ]
                        ) {

                            const normalized =
                                Rides.normalize(
                                    ride,
                                    id
                                );


                            if (
                                normalized
                            ) {

                                rides.push(
                                    normalized
                                );
                            }

                        }
                    );

                } catch (error) {

                    console.warn(
                        "Recent rides query failed:",
                        error
                    );
                }


                /*
                 * Remove duplicates.
                 */

                const unique =
                    new Map();


                rides.forEach(
                    function (
                        ride
                    ) {

                        if (
                            ride.id
                        ) {

                            unique.set(
                                ride.id,
                                ride
                            );
                        }

                    }
                );


                rides =
                    Array.from(
                        unique.values()
                    );


                Rides.state.rides =
                    rides;


                Rides.saveCache();


                Rides.rebuildGroups();

                Rides.render();


                return rides;

            } finally {

                Rides.state.loading =
                    false;
            }
        };


    /* ========================================================
       LOAD AVAILABLE REQUESTS
       ======================================================== */

    Rides.loadAvailable =
        async function () {

            const database =
                Rides.getDatabase();


            if (
                !database
            ) {

                return Rides.state.available;
            }


            try {

                const snapshot =
                    await database
                        .ref(
                            Rides.config
                                .ridesPath
                        )
                        .orderByChild(
                            "status"
                        )
                        .equalTo(
                            "searching"
                        )
                        .once(
                            "value"
                        );


                const data =
                    snapshot.val() ||
                    {};


                const result =
                    [];


                Object.entries(
                    data
                )
                .forEach(
                    function (
                        [
                            id,
                            ride
                        ]
                    ) {

                        const normalized =
                            Rides.normalize(
                                ride,
                                id
                            );


                        if (
                            Rides.isAvailable(
                                normalized
                            )
                        ) {

                            result.push(
                                normalized
                            );
                        }

                    }
                );


                /*
                 * Also include requested rides.
                 */

                const requested =
                    await database
                        .ref(
                            Rides.config
                                .ridesPath
                        )
                        .orderByChild(
                            "status"
                        )
                        .equalTo(
                            "requested"
                        )
                        .once(
                            "value"
                        );


                const requestedData =
                    requested.val() ||
                    {};


                Object.entries(
                    requestedData
                )
                .forEach(
                    function (
                        [
                            id,
                            ride
                        ]
                    ) {

                        const normalized =
                            Rides.normalize(
                                ride,
                                id
                            );


                        if (
                            Rides.isAvailable(
                                normalized
                            )
                        ) {

                            result.push(
                                normalized
                            );
                        }

                    }
                );


                const unique =
                    new Map();


                result.forEach(
                    function (
                        ride
                    ) {

                        unique.set(
                            ride.id,
                            ride
                        );
                    }
                );


                Rides.state.available =
                    Array.from(
                        unique.values()
                    );


                Rides.sortArray(
                    Rides.state.available
                );


                Rides.renderAvailable();


                return Rides.state.available;

            } catch (error) {

                console.error(
                    "Load available rides failed:",
                    error
                );


                return [];
            }
        };


    /* ========================================================
       REBUILD GROUPS
       ======================================================== */

    Rides.rebuildGroups =
        function () {

            const rides =
                Rides.state.rides ||
                [];


            Rides.state.active =
                rides.filter(
                    Rides.isActive
                );


            Rides.state.completed =
                rides.filter(
                    Rides.isCompleted
                );


            Rides.state.cancelled =
                rides.filter(
                    Rides.isCancelled
                );


            Rides.state.available =
                rides.filter(
                    Rides.isAvailable
                );


            Rides.sortArray(
                Rides.state.active
            );


            Rides.sortArray(
                Rides.state.completed
            );


            Rides.sortArray(
                Rides.state.cancelled
            );


            Rides.sortArray(
                Rides.state.available
            );
        };


    /* ========================================================
       SORT
       ======================================================== */

    Rides.sortArray =
        function (
            array
        ) {

            if (
                !Array.isArray(
                    array
                )
            ) {

                return;
            }


            array.sort(
                function (
                    a,
                    b
                ) {

                    const aTime =
                        Number(
                            a.createdAt ||
                            0
                        );


                    const bTime =
                        Number(
                            b.createdAt ||
                            0
                        );


                    if (
                        Rides.state.sort ===
                        "oldest"
                    ) {

                        return (
                            aTime -
                            bTime
                        );
                    }


                    if (
                        Rides.state.sort ===
                        "fare-high"
                    ) {

                        return (
                            Number(
                                b.fare ||
                                0
                            ) -
                            Number(
                                a.fare ||
                                0
                            )
                        );
                    }


                    if (
                        Rides.state.sort ===
                        "fare-low"
                    ) {

                        return (
                            Number(
                                a.fare ||
                                0
                            ) -
                            Number(
                                b.fare ||
                                0
                            )
                        );
                    }


                    return (
                        bTime -
                        aTime
                    );
                }
            );
        };


    /* ========================================================
       SEARCH
       ======================================================== */

    Rides.matchesSearch =
        function (
            ride
        ) {

            const search =
                String(
                    Rides.state.search ||
                    ""
                )
                .trim()
                .toLowerCase();


            if (
                !search
            ) {

                return true;
            }


            const text =
                [

                    ride.id,

                    ride.customerName,

                    ride.customerPhone,

                    ride.pickupAddress,

                    ride.destinationAddress,

                    ride.serviceType,

                    ride.paymentMethod

                ]
                .join(
                    " "
                )
                .toLowerCase();


            return text.includes(
                search
            );
        };


    /* ========================================================
       FILTER
       ======================================================== */

    Rides.getFiltered =
        function () {

            let list =
                Rides.state.rides ||
                [];


            switch (
                Rides.state.filter
            ) {

                case "active":

                    list =
                        Rides.state.active;

                    break;


                case "completed":

                    list =
                        Rides.state.completed;

                    break;


                case "cancelled":

                    list =
                        Rides.state.cancelled;

                    break;


                case "available":

                    list =
                        Rides.state.available;

                    break;


                default:

                    list =
                        list;
            }


            return list.filter(
                Rides.matchesSearch
            );
        };


    /* ========================================================
       SET FILTER
       ======================================================== */

    Rides.setFilter =
        function (
            filter
        ) {

            Rides.state.filter =
                filter ||
                "all";


            Rides.render();


            Rides.emit(
                "filter-changed",
                {

                    filter:
                        Rides.state.filter
                }
            );
        };


    /* ========================================================
       SET SEARCH
       ======================================================== */

    Rides.setSearch =
        function (
            value
        ) {

            Rides.state.search =
                String(
                    value ||
                    ""
                );


            Rides.render();
        };


    /* ========================================================
       SET SORT
       ======================================================== */

    Rides.setSort =
        function (
            value
        ) {

            Rides.state.sort =
                value ||
                "newest";


            Rides.rebuildGroups();

            Rides.render();
        };


    /* ========================================================
       ACCEPT
       ======================================================== */

    Rides.accept =
        async function (
            rideId
        ) {

            const ride =
                Rides.state.rides
                    .find(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                rideId
                            );
                        }
                    ) ||
                Rides.state.available
                    .find(
                        function (
                            item
                        ) {

                            return (
                                item.id ===
                                rideId
                            );
                        }
                    );


            if (
                !ride
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride not found."
                };
            }


            if (
                RX.acceptRiderRide
            ) {

                const result =
                    await RX.acceptRiderRide(
                        ride
                    );


                if (
                    result.success
                ) {

                    /*
                     * Update local state.
                     */

                    const index =
                        Rides.state.rides
                            .findIndex(
                                function (
                                    item
                                ) {

                                    return (
                                        item.id ===
                                        rideId
                                    );
                                }
                            );


                    if (
                        index >=
                        0
                    ) {

                        Rides.state.rides[
                            index
                        ] =
                            Rides.normalize(
                                result.ride,
                                rideId
                            );

                    } else {

                        Rides.state.rides.push(
                            Rides.normalize(
                                result.ride,
                                rideId
                            )
                        );
                    }


                    Rides.rebuildGroups();

                    Rides.saveCache();

                    Rides.render();


                    return result;
                }


                return result;
            }


            return {

                success:
                    false,

                error:
                    "Ride acceptance module is unavailable."
            };
        };


    /* ========================================================
       GET RIDE
       ======================================================== */

    Rides.get =
        function (
            rideId
        ) {

            return (
                Rides.state.rides
                    .find(
                        function (
                            ride
                        ) {

                            return (
                                ride.id ===
                                rideId
                            );
                        }
                    ) ||
                null
            );
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Rides.saveCache =
        function () {

            try {

                localStorage.setItem(
                    Rides.config.cacheKey,
                    JSON.stringify(
                        Rides.state.rides
                    )
                );

            } catch (error) {}
        };


    Rides.loadCache =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Rides.config.cacheKey
                    );


                if (
                    saved
                ) {

                    const data =
                        JSON.parse(
                            saved
                        );


                    if (
                        Array.isArray(
                            data
                        )
                    ) {

                        Rides.state.rides =
                            data.map(
                                function (
                                    ride
                                ) {

                                    return Rides.normalize(
                                        ride,
                                        ride.id
                                    );

                                }
                            );
                    }
                }

            } catch (error) {}
        };


    /* ========================================================
       REAL-TIME LISTENER
       ======================================================== */

    Rides.listen =
        function () {

            Rides.stopListening();


            const database =
                Rides.getDatabase();


            if (
                !database
            ) {

                return;
            }


            const riderId =
                Rides.getRiderId();


            const ref =
                database.ref(
                    Rides.config
                        .ridesPath
                );


            const callback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val() ||
                        {};


                    const rides =
                        [];


                    Object.entries(
                        data
                    )
                    .forEach(
                        function (
                            [
                                id,
                                ride
                            ]
                        ) {

                            const normalized =
                                Rides.normalize(
                                    ride,
                                    id
                                );


                            if (
                                !normalized
                            ) {

                                return;
                            }


                            /*
                             * Show rides assigned to
                             * current rider OR open requests.
                             */

                            if (
                                normalized.riderId ===
                                riderId ||
                                Rides.isAvailable(
                                    normalized
                                )
                            ) {

                                rides.push(
                                    normalized
                                );
                            }
                        }
                    );


                    Rides.state.rides =
                        rides;


                    Rides.rebuildGroups();

                    Rides.saveCache();

                    Rides.render();


                    Rides.emit(
                        "updated",
                        {

                            rides:
                                rides
                        }
                    );
                };


            ref.on(
                "value",
                callback
            );


            Rides.state.listener =
                {

                    ref:
                        ref,

                    callback:
                        callback
                };
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    Rides.stopListening =
        function () {

            if (
                Rides.state.listener
            ) {

                try {

                    Rides.state.listener
                        .ref
                        .off(
                            "value",
                            Rides.state.listener
                                .callback
                        );

                } catch (error) {}


                Rides.state.listener =
                    null;
            }
        };


    /* ========================================================
       RENDER
       ======================================================== */

    Rides.render =
        function () {

            const list =
                Rides.getFiltered();


            const container =
                document.querySelector(
                    "[data-rides-list]"
                );


            if (
                container
            ) {

                container.innerHTML =
                    "";


                if (
                    !list.length
                ) {

                    container.innerHTML =
                        `
                        <div class="rx-empty-state">
                            <div class="rx-empty-icon">🚕</div>
                            <h3>No rides found</h3>
                            <p>New ride requests will appear here.</p>
                        </div>
                        `;

                } else {

                    list.forEach(
                        function (
                            ride
                        ) {

                            container.appendChild(
                                Rides.createCard(
                                    ride
                                )
                            );
                        }
                    );
                }
            }


            Rides.renderCounters();

            Rides.renderAvailable();
        };


    /* ========================================================
       RENDER AVAILABLE
       ======================================================== */

    Rides.renderAvailable =
        function () {

            const container =
                document.querySelector(
                    "[data-available-rides]"
                );


            if (
                !container
            ) {

                return;
            }


            const list =
                Rides.state.available
                    .filter(
                        Rides.matchesSearch
                    );


            container.innerHTML =
                "";


            if (
                !list.length
            ) {

                container.innerHTML =
                    `
                    <div class="rx-empty-state">
                        <div class="rx-empty-icon">🔎</div>
                        <h3>No nearby requests</h3>
                        <p>Stay online to receive new ride requests.</p>
                    </div>
                    `;

                return;
            }


            list.forEach(
                function (
                    ride
                ) {

                    container.appendChild(
                        Rides.createCard(
                            ride,
                            true
                        )
                    );
                }
            );
        };


    /* ========================================================
       CREATE RIDE CARD
       ======================================================== */

    Rides.createCard =
        function (
            ride,
            available
        ) {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "rx-ride-card";


            card.dataset.rideId =
                ride.id;


            const fare =
                Rides.formatMoney(
                    ride.fare
                );


            const created =
                Rides.formatTime(
                    ride.createdAt
                );


            const action =
                available
                    ? `
                        <button
                            type="button"
                            class="rx-btn rx-btn-primary"
                            data-accept-ride
                            data-ride-id="${Rides.escape(
                                ride.id
                            )}">
                            Accept Ride
                        </button>
                      `
                    : "";


            card.innerHTML =
                `
                <div class="rx-ride-card-header">

                    <div>

                        <strong>
                            ${Rides.escape(
                                ride.serviceType
                            )}
                        </strong>

                        <small>
                            ${Rides.escape(
                                created
                            )}
                        </small>

                    </div>

                    <strong>
                        ${Rides.escape(
                            fare
                        )}
                    </strong>

                </div>


                <div class="rx-route">

                    <div class="rx-route-point">

                        <span class="rx-dot"></span>

                        <div>
                            <small>Pickup</small>

                            <div>
                                ${Rides.escape(
                                    ride.pickupAddress ||
                                    "Pickup location"
                                )}
                            </div>
                        </div>

                    </div>


                    <div class="rx-route-line"></div>


                    <div class="rx-route-point">

                        <span class="rx-dot"></span>

                        <div>
                            <small>Drop-off</small>

                            <div>
                                ${Rides.escape(
                                    ride.destinationAddress ||
                                    "Destination"
                                )}
                            </div>

                        </div>

                    </div>

                </div>


                <div class="rx-ride-meta">

                    <span>
                        ${Rides.escape(
                            ride.distance
                                ? ride.distance +
                                  " km"
                                : "Distance —"
                        )}
                    </span>

                    <span>
                        ${Rides.escape(
                            ride.paymentMethod
                        )}
                    </span>

                    <span>
                        ${Rides.escape(
                            ride.status
                        )}
                    </span>

                </div>


                ${
                    ride.customerName
                        ? `
                            <div class="rx-customer">

                                <strong>
                                    ${Rides.escape(
                                        ride.customerName
                                    )}
                                </strong>

                                ${
                                    ride.customerPhone
                                        ? `
                                            <a
                                                href="tel:${Rides.escape(
                                                    ride.customerPhone
                                                )}">
                                                Call
                                            </a>
                                          `
                                        : ""
                                }

                            </div>
                          `
                        : ""
                }


                ${action}
                `;


            return card;
        };


    /* ========================================================
       COUNTERS
       ======================================================== */

    Rides.renderCounters =
        function () {

            const counters =
                {

                    all:
                        Rides.state.rides
                            .length,

                    available:
                        Rides.state.available
                            .length,

                    active:
                        Rides.state.active
                            .length,

                    completed:
                        Rides.state.completed
                            .length,

                    cancelled:
                        Rides.state.cancelled
                            .length
                };


            Object.entries(
                counters
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    document
                        .querySelectorAll(
                            `[data-rides-count="${key}"]`
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
       FORMAT MONEY
       ======================================================== */

    Rides.formatMoney =
        function (
            amount
        ) {

            try {

                return new Intl.NumberFormat(
                    "en-IN",
                    {

                        style:
                            "currency",

                        currency:
                            "INR",

                        maximumFractionDigits:
                            0

                    }
                ).format(
                    Number(
                        amount ||
                        0
                    )
                );

            } catch (error) {

                return "₹" +
                    Math.round(
                        Number(
                            amount ||
                            0
                        )
                    );
            }
        };


    /* ========================================================
       FORMAT TIME
       ======================================================== */

    Rides.formatTime =
        function (
            timestamp
        ) {

            if (
                !timestamp
            ) {

                return "Just now";
            }


            try {

                return new Date(
                    timestamp
                ).toLocaleString(
                    "en-IN",
                    {

                        day:
                            "2-digit",

                        month:
                            "short",

                        hour:
                            "2-digit",

                        minute:
                            "2-digit"
                    }
                );

            } catch (error) {

                return "";
            }
        };


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

    Rides.escape =
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
       MESSAGE
       ======================================================== */

    Rides.showMessage =
        function (
            message,
            type
        ) {

            try {

                if (
                    RX.toast &&
                    typeof RX.toast ===
                    "function"
                ) {

                    RX.toast(
                        message,
                        type
                    );

                    return;
                }

            } catch (error) {}


            document
                .querySelectorAll(
                    "[data-rides-message]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            message;

                        element.dataset.type =
                            type ||
                            "info";

                        element.hidden =
                            false;
                    }
                );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Rides.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-rides-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    Rides.bindEvents =
        function () {

            /*
             * Filter buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-rides-filter]"
                        );


                    if (
                        button
                    ) {

                        Rides.setFilter(
                            button.dataset
                                .ridesFilter
                        );
                    }
                }
            );


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
                            "[data-rides-search]"
                        );


                    if (
                        input
                    ) {

                        Rides.setSearch(
                            input.value
                        );
                    }
                }
            );


            /*
             * Sort.
             */

            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const select =
                        event.target.closest(
                            "[data-rides-sort]"
                        );


                    if (
                        select
                    ) {

                        Rides.setSort(
                            select.value
                        );
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

                    const button =
                        event.target.closest(
                            "[data-refresh-rides]"
                        );


                    if (
                        button
                    ) {

                        Rides.load();
                    }
                }
            );
        };


    /* ========================================================
       AUTO REFRESH
       ======================================================== */

    Rides.startRefresh =
        function () {

            Rides.stopRefresh();


            Rides.state.refreshTimer =
                setInterval(
                    function () {

                        Rides.load();

                    },
                    Rides.config
                        .refreshInterval
                );
        };


    Rides.stopRefresh =
        function () {

            if (
                Rides.state.refreshTimer
            ) {

                clearInterval(
                    Rides.state.refreshTimer
                );

                Rides.state.refreshTimer =
                    null;
            }
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.loadRiderRides =
        Rides.load;


    RX.getRiderRides =
        function () {

            return Rides.state.rides;
        };


    RX.getAvailableRiderRides =
        function () {

            return Rides.state.available;
        };


    RX.acceptRideRequest =
        Rides.accept;


    RX.setRiderRideFilter =
        Rides.setFilter;


    /* ========================================================
       INIT
       ======================================================== */

    Rides.init =
        async function () {

            if (
                Rides.state.initialized
            ) {

                return;
            }


            Rides.state.initialized =
                true;


            Rides.bindEvents();


            await Rides.load();


            Rides.listen();

            Rides.startRefresh();


            console.log(
                "RiderX rider-rides.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Rides.init
        );

    } else {

        Rides.init();

    }

})();
