/* ============================================================
   RIDERX - RIDE ACCEPT
   File: js/ride-accept.js

   Rider incoming ride request controller.

   Flow:
   Request received
        ↓
   Request card shown
        ↓
   Countdown
        ↓
   Accept / Reject
        ↓
   ride-flow.js
        ↓
   Navigation / Arrival / OTP / Trip
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Accept = RX.rideAccept =
        RX.rideAccept || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Accept.config = {

        requestPath:
            "rideRequests",

        ridePath:
            "rides",

        activeRequestKey:
            "riderx_active_request",

        requestTimeout:
            30,

        maxRequests:
            20
    };


    /* ========================================================
       STATE
       ======================================================== */

    Accept.state = {

        initialized:
            false,

        riderId:
            null,

        online:
            false,

        listening:
            false,

        requests:
            {},

        activeRequest:
            null,

        timer:
            null,

        seconds:
            0,

        listeners:
            [],

        accepted:
            false
    };


    /* ========================================================
       FIREBASE
       ======================================================== */

    Accept.getDatabase =
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

    Accept.getUser =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.auth
                ) {

                    return RX.firebase.auth
                        .currentUser;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth()
                        .currentUser;
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


    Accept.getRiderId =
        function () {

            if (
                Accept.state.riderId
            ) {

                return Accept.state.riderId;
            }


            const user =
                Accept.getUser();


            const id =
                user?.uid ||
                user?.id ||
                user?.riderId ||
                user?.driverId ||
                localStorage.getItem(
                    "riderx_uid"
                );


            if (
                id
            ) {

                Accept.state.riderId =
                    id;
            }


            return id || null;
        };


    /* ========================================================
       ROLE CHECK
       ======================================================== */

    Accept.isRider =
        function () {

            const user =
                Accept.getUser();


            const role =
                String(
                    user?.role ||
                    localStorage.getItem(
                        "riderx_role"
                    ) ||
                    ""
                )
                .toLowerCase();


            return (
                role === "rider" ||
                role === "driver"
            );
        };


    /* ========================================================
       ONLINE STATUS
       ======================================================== */

    Accept.setOnline =
        async function (
            online
        ) {

            online =
                Boolean(
                    online
                );


            Accept.state.online =
                online;


            const riderId =
                Accept.getRiderId();


            if (
                !riderId
            ) {

                return false;
            }


            const database =
                Accept.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            "riders/" +
                            riderId
                        )
                        .update(
                            {

                                online:
                                    online,

                                isOnline:
                                    online,

                                updatedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Rider online status failed:",
                        error
                    );
                }
            }


            if (
                online
            ) {

                Accept.startListening();

            } else {

                Accept.stopListening();
                Accept.clearAllRequests();

            }


            Accept.emit(
                "online",
                {

                    online:
                        online
                }
            );


            return true;
        };


    /* ========================================================
       START REQUEST LISTENER
       ======================================================== */

    Accept.startListening =
        function () {

            if (
                Accept.state.listening
            ) {

                return true;
            }


            const database =
                Accept.getDatabase();


            const riderId =
                Accept.getRiderId();


            if (
                !database ||
                !riderId
            ) {

                return false;
            }


            Accept.state.listening =
                true;


            /*
             * Listen to new ride requests.
             */

            const requestsRef =
                database.ref(
                    Accept.config
                        .requestPath
                );


            const callback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val();


                    if (
                        !data
                    ) {

                        return;
                    }


                    Accept.processRequest(
                        data
                    );

                };


            requestsRef.on(
                "child_added",
                callback
            );


            Accept.state.listeners.push(
                {

                    ref:
                        requestsRef,

                    event:
                        "child_added",

                    callback:
                        callback
                }
            );


            /*
             * Listen for request changes.
             */

            const changeCallback =
                function (
                    snapshot
                ) {

                    const data =
                        snapshot.val();


                    if (
                        !data
                    ) {

                        return;
                    }


                    Accept.processRequest(
                        data
                    );

                };


            requestsRef.on(
                "child_changed",
                changeCallback
            );


            Accept.state.listeners.push(
                {

                    ref:
                        requestsRef,

                    event:
                        "child_changed",

                    callback:
                        changeCallback
                }
            );


            return true;
        };


    /* ========================================================
       STOP LISTENER
       ======================================================== */

    Accept.stopListening =
        function () {

            const listeners =
                Accept.state.listeners ||
                [];


            listeners.forEach(
                function (
                    item
                ) {

                    try {

                        item.ref.off(
                            item.event,
                            item.callback
                        );

                    } catch (error) {}

                }
            );


            Accept.state.listeners =
                [];

            Accept.state.listening =
                false;


            return true;
        };


    /* ========================================================
       PROCESS REQUEST
       ======================================================== */

    Accept.processRequest =
        function (
            request
        ) {

            if (
                !request
            ) {

                return;
            }


            const rideId =
                request.rideId ||
                request.id ||
                request.key;


            if (
                !rideId
            ) {

                return;
            }


            /*
             * Do not show cancelled/completed requests.
             */

            const status =
                String(
                    request.status ||
                    "searching"
                )
                .toLowerCase();


            if (
                [
                    "accepted",
                    "completed",
                    "cancelled",
                    "canceled",
                    "expired",
                    "rejected"
                ].includes(
                    status
                )
            ) {

                delete Accept.state
                    .requests[
                        rideId
                    ];

                Accept.removeRequestCard(
                    rideId
                );

                return;
            }


            /*
             * Do not show own previous accepted ride.
             */

            if (
                request.riderId &&
                request.riderId !==
                Accept.getRiderId()
            ) {

                return;
            }


            /*
             * If another rider already accepted,
             * don't show it.
             */

            if (
                request.assignedRiderId &&
                request.assignedRiderId !==
                Accept.getRiderId()
            ) {

                return;
            }


            /*
             * Save request.
             */

            Accept.state.requests[
                rideId
            ] =
                {

                    ...request,

                    rideId:
                        rideId,

                    receivedAt:
                        request.receivedAt ||
                        Date.now()
                };


            Accept.saveRequests();


            Accept.renderRequest(
                Accept.state.requests[
                    rideId
                ]
            );


            Accept.emit(
                "request",
                {

                    request:
                        request
                }
            );


            /*
             * Sound + vibration.
             */

            Accept.notifyRider();


            return true;
        };


    /* ========================================================
       REQUEST FILTER
       ======================================================== */

    Accept.getRequests =
        function () {

            return Object.values(
                Accept.state.requests
            )
            .sort(
                function (
                    a,
                    b
                ) {

                    return (
                        Number(
                            b.receivedAt ||
                            0
                        ) -
                        Number(
                            a.receivedAt ||
                            0
                        )
                    );

                }
            )
            .slice(
                0,
                Accept.config
                    .maxRequests
            );
        };


    /* ========================================================
       ACCEPT REQUEST
       ======================================================== */

    Accept.accept =
        async function (
            rideId
        ) {

            rideId =
                rideId ||
                Accept.state.activeRequest
                    ?.rideId;


            if (
                !rideId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride request not found."
                };
            }


            const request =
                Accept.state.requests[
                    rideId
                ];


            if (
                !request
            ) {

                return {

                    success:
                        false,

                    error:
                        "Ride request expired."
                };
            }


            if (
                Accept.state.accepted
            ) {

                return {

                    success:
                        false,

                    error:
                        "You already accepted a ride."
                };
            }


            const riderId =
                Accept.getRiderId();


            if (
                !riderId
            ) {

                return {

                    success:
                        false,

                    error:
                        "Rider login required."
                };
            }


            const database =
                Accept.getDatabase();


            const now =
                Date.now();


            /*
             * Atomic transaction if Firebase
             * Realtime Database is available.
             */

            if (
                database
            ) {

                try {

                    const rideRef =
                        database.ref(
                            Accept.config
                                .ridePath +
                            "/" +
                            rideId
                        );


                    const result =
                        await rideRef
                            .transaction(
                                function (
                                    ride
                                ) {

                                    if (
                                        !ride
                                    ) {

                                        return ride;
                                    }


                                    const current =
                                        String(
                                            ride.status ||
                                            "searching"
                                        )
                                        .toLowerCase();


                                    /*
                                     * Someone else
                                     * already accepted.
                                     */

                                    if (
                                        current !==
                                            "searching" &&
                                        current !==
                                            "pending" &&
                                        current !==
                                            "requested"
                                    ) {

                                        return;
                                    }


                                    return {

                                        ...ride,

                                        riderId:
                                            riderId,

                                        driverId:
                                            riderId,

                                        rider:
                                            Accept.getRiderData(),

                                        status:
                                            "accepted",

                                        acceptedAt:
                                            now,

                                        updatedAt:
                                            now
                                    };

                                }
                            );


                    if (
                        !result.committed
                    ) {

                        Accept.removeRequestCard(
                            rideId
                        );


                        delete Accept.state
                            .requests[
                                rideId
                            ];


                        Accept.emit(
                            "already-accepted",
                            {

                                rideId:
                                    rideId
                            }
                        );


                        return {

                            success:
                                false,

                            error:
                                "This ride was accepted by another rider."
                        };
                    }


                    /*
                     * Update request.
                     */

                    await database
                        .ref(
                            Accept.config
                                .requestPath +
                            "/" +
                            rideId
                        )
                        .update(
                            {

                                status:
                                    "accepted",

                                riderId:
                                    riderId,

                                driverId:
                                    riderId,

                                assignedRiderId:
                                    riderId,

                                acceptedAt:
                                    now,

                                updatedAt:
                                    now
                            }
                        );

                } catch (error) {

                    console.error(
                        "Ride accept failed:",
                        error
                    );


                    return {

                        success:
                            false,

                        error:
                            error.message
                    };
                }
            }


            /*
             * Save active request.
             */

            Accept.state.accepted =
                true;

            Accept.state.activeRequest =
                request;


            localStorage.setItem(
                Accept.config
                    .activeRequestKey,
                rideId
            );


            Accept.stopTimer(
                rideId
            );


            Accept.removeRequestCard(
                rideId
            );


            delete Accept.state
                .requests[
                    rideId
                ];


            Accept.saveRequests();


            /*
             * Connect to ride-flow.js
             */

            let flowResult =
                true;


            try {

                if (
                    RX.rideFlow &&
                    typeof RX.rideFlow
                        .acceptRide ===
                    "function"
                ) {

                    flowResult =
                        await RX
                            .rideFlow
                            .acceptRide(
                                {

                                    rideId:
                                        rideId,

                                    riderId:
                                        riderId,

                                    name:
                                        Accept.getRiderData()
                                            .name,

                                    phone:
                                        Accept.getRiderData()
                                            .phone,

                                    photo:
                                        Accept.getRiderData()
                                            .photo,

                                    vehicle:
                                        Accept.getRiderData()
                                            .vehicle,

                                    rating:
                                        Accept.getRiderData()
                                            .rating
                                }
                            );

                }

            } catch (error) {

                console.warn(
                    "ride-flow accept error:",
                    error
                );

            }


            /*
             * Notify application.
             */

            Accept.emit(
                "accepted",
                {

                    success:
                        true,

                    rideId:
                        rideId,

                    request:
                        request
                }
            );


            /*
             * Redirect / navigation.
             */

            Accept.openAcceptedRide(
                request
            );


            return {

                success:
                    true,

                rideId:
                    rideId,

                flow:
                    flowResult
            };
        };


    /* ========================================================
       REJECT REQUEST
       ======================================================== */

    Accept.reject =
        async function (
            rideId,
            reason
        ) {

            rideId =
                rideId ||
                Accept.state.activeRequest
                    ?.rideId;


            reason =
                reason ||
                "Rider declined";


            if (
                !rideId
            ) {

                return false;
            }


            const riderId =
                Accept.getRiderId();


            const database =
                Accept.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Accept.config
                                .requestPath +
                            "/" +
                            rideId +
                            "/declinedBy/" +
                            riderId
                        )
                        .set(
                            {

                                reason:
                                    reason,

                                declinedAt:
                                    Date.now()
                            }
                        );

                } catch (error) {

                    console.warn(
                        "Reject save failed:",
                        error
                    );
                }
            }


            Accept.stopTimer(
                rideId
            );


            Accept.removeRequestCard(
                rideId
            );


            delete Accept.state
                .requests[
                    rideId
                ];


            Accept.saveRequests();


            Accept.emit(
                "rejected",
                {

                    rideId:
                        rideId,

                    reason:
                        reason
                }
            );


            return true;
        };


    /* ========================================================
       RIDER DATA
       ======================================================== */

    Accept.getRiderData =
        function () {

            const user =
                Accept.getUser() ||
                {};


            let vehicle =
                user.vehicle ||
                null;


            if (
                !vehicle
            ) {

                try {

                    const savedVehicle =
                        localStorage.getItem(
                            "riderx_vehicle"
                        );


                    if (
                        savedVehicle
                    ) {

                        vehicle =
                            JSON.parse(
                                savedVehicle
                            );

                    }

                } catch (error) {}
            }


            return {

                riderId:
                    Accept.getRiderId(),

                driverId:
                    Accept.getRiderId(),

                name:
                    user.name ||
                    user.displayName ||
                    localStorage.getItem(
                        "riderx_name"
                    ) ||
                    "Rider",

                phone:
                    user.phone ||
                    user.phoneNumber ||
                    "",

                photo:
                    user.photoURL ||
                    user.photo ||
                    "",

                rating:
                    Number(
                        user.rating ||
                        5
                    ),

                vehicle:
                    vehicle
            };
        };


    /* ========================================================
       REQUEST CARD
       ======================================================== */

    Accept.getContainer =
        function () {

            return (
                document.querySelector(
                    "#rideRequests"
                ) ||

                document.querySelector(
                    "#rideRequestList"
                ) ||

                document.querySelector(
                    ".ride-request-list"
                ) ||

                document.querySelector(
                    "[data-ride-requests]"
                )
            );
        };


    Accept.renderRequest =
        function (
            request
        ) {

            if (
                !request
            ) {

                return;
            }


            const container =
                Accept.getContainer();


            if (
                !container
            ) {

                return;
            }


            let card =
                container.querySelector(
                    `[data-request-id="${request.rideId}"]`
                );


            if (
                !card
            ) {

                card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    "ride-request-card";


                card.dataset.requestId =
                    request.rideId;


                container.prepend(
                    card
                );

            }


            const fare =
                Accept.getFare(
                    request
                );


            const service =
                Accept.getServiceName(
                    request
                );


            const distance =
                Number(
                    request.distanceKm ||
                    request.distance ||
                    0
                );


            const pickup =
                request.pickupAddress ||
                request.pickup?.address ||
                request.pickup?.name ||
                "Pickup location";


            const destination =
                request.destinationAddress ||
                request.destination?.address ||
                request.destination?.name ||
                "Destination";


            card.innerHTML = `

                <div class="ride-request-header">

                    <div>

                        <strong>
                            ${Accept.escape(
                                service
                            )}
                        </strong>

                        <span>
                            New ride
                        </span>

                    </div>

                    <div
                        class="ride-request-timer"
                        data-request-timer="${Accept.escape(
                            request.rideId
                        )}"
                    >
                        ${Accept.config.requestTimeout}s
                    </div>

                </div>


                <div class="ride-request-fare">

                    ₹${Number(
                        fare || 0
                    ).toFixed(0)}

                    ${
                        distance
                        ? `<small>
                            • ${distance.toFixed(1)} km
                           </small>`
                        : ""
                    }

                </div>


                <div class="ride-request-route">

                    <div class="route-point pickup">

                        <span class="route-dot"></span>

                        <div>

                            <small>
                                PICKUP
                            </small>

                            <p>
                                ${Accept.escape(
                                    pickup
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="route-line"></div>


                    <div class="route-point destination">

                        <span class="route-dot"></span>

                        <div>

                            <small>
                                DROP-OFF
                            </small>

                            <p>
                                ${Accept.escape(
                                    destination
                                )}
                            </p>

                        </div>

                    </div>

                </div>


                <div class="ride-request-actions">

                    <button
                        type="button"
                        class="ride-reject-btn"
                        data-request-reject="${Accept.escape(
                            request.rideId
                        )}"
                    >
                        Reject
                    </button>


                    <button
                        type="button"
                        class="ride-accept-btn"
                        data-request-accept="${Accept.escape(
                            request.rideId
                        )}"
                    >
                        Accept Ride
                    </button>

                </div>

            `;


            Accept.bindCard(
                card,
                request
            );


            Accept.startTimer(
                request.rideId
            );
        };


    /* ========================================================
       CARD EVENTS
       ======================================================== */

    Accept.bindCard =
        function (
            card,
            request
        ) {

            const acceptButton =
                card.querySelector(
                    "[data-request-accept]"
                );


            const rejectButton =
                card.querySelector(
                    "[data-request-reject]"
                );


            if (
                acceptButton
            ) {

                acceptButton.onclick =
                    async function () {

                        acceptButton.disabled =
                            true;


                        acceptButton.textContent =
                            "Accepting…";


                        const result =
                            await Accept.accept(
                                request.rideId
                            );


                        if (
                            !result.success
                        ) {

                            acceptButton.disabled =
                                false;

                            acceptButton.textContent =
                                "Accept Ride";


                            Accept.showMessage(
                                result.error ||
                                "Unable to accept ride."
                            );
                        }
                    };
            }


            if (
                rejectButton
            ) {

                rejectButton.onclick =
                    async function () {

                        await Accept.reject(
                            request.rideId
                        );

                    };
            }
        };


    /* ========================================================
       TIMER
       ======================================================== */

    Accept.startTimer =
        function (
            rideId
        ) {

            Accept.stopTimer(
                rideId
            );


            const request =
                Accept.state.requests[
                    rideId
                ];


            if (
                !request
            ) {

                return;
            }


            const received =
                Number(
                    request.receivedAt ||
                    Date.now()
                );


            const timeout =
                Accept.config
                    .requestTimeout;


            const elapsed =
                Math.floor(
                    (
                        Date.now() -
                        received
                    ) /
                    1000
                );


            let remaining =
                Math.max(
                    0,
                    timeout -
                    elapsed
                );


            Accept.state.timer =
                setInterval(
                    async function () {

                        remaining =
                            Math.max(
                                0,
                                remaining -
                                1
                            );


                        document
                            .querySelectorAll(
                                `[data-request-timer="${rideId}"]`
                            )
                            .forEach(
                                function (
                                    element
                                ) {

                                    element.textContent =
                                        remaining +
                                        "s";

                                }
                            );


                        if (
                            remaining <=
                            0
                        ) {

                            Accept.stopTimer(
                                rideId
                            );


                            await Accept.reject(
                                rideId,
                                "Request expired"
                            );

                        }

                    },
                    1000
                );
        };


    Accept.stopTimer =
        function () {

            if (
                Accept.state.timer
            ) {

                clearInterval(
                    Accept.state.timer
                );

                Accept.state.timer =
                    null;
            }
        };


    /* ========================================================
       REMOVE CARD
       ======================================================== */

    Accept.removeRequestCard =
        function (
            rideId
        ) {

            document
                .querySelectorAll(
                    `[data-request-id="${rideId}"]`
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.remove();

                    }
                );
        };


    /* ========================================================
       OPEN ACCEPTED RIDE
       ======================================================== */

    Accept.openAcceptedRide =
        function (
            request
        ) {

            Accept.emit(
                "open-ride",
                {

                    request:
                        request
                }
            );


            /*
             * Existing rider pages are used first.
             */

            const paths = [

                "ride-details.html",
                "trip.html",
                "request.html",
                "rides.html"

            ];


            /*
             * Only navigate if current page
             * does not already handle the flow.
             */

            const current =
                window.location.pathname
                    .split("/")
                    .pop()
                    .toLowerCase();


            if (
                [
                    "ride-details.html",
                    "trip.html",
                    "request.html"
                ].includes(
                    current
                )
            ) {

                return;
            }


            /*
             * Keep navigation lightweight.
             */

            const target =
                paths[0];


            try {

                if (
                    request.rideId
                ) {

                    window.location.href =
                        target +
                        "?rideId=" +
                        encodeURIComponent(
                            request.rideId
                        );

                }

            } catch (error) {}

        };


    /* ========================================================
       NOTIFICATION
       ======================================================== */

    Accept.notifyRider =
        function () {

            /*
             * Sound.
             */

            try {

                const sound =
                    document.querySelector(
                        "#rideRequestSound"
                    );


                if (
                    sound
                ) {

                    sound.currentTime =
                        0;

                    sound.play()
                        .catch(
                            function () {}
                        );

                }

            } catch (error) {}


            /*
             * Vibration.
             */

            try {

                if (
                    navigator.vibrate
                ) {

                    navigator.vibrate(
                        [
                            300,
                            150,
                            300
                        ]
                    );

                }

            } catch (error) {}


            /*
             * Browser notification.
             */

            try {

                if (
                    "Notification" in
                    window &&
                    Notification.permission ===
                    "granted"
                ) {

                    new Notification(
                        "RiderX",
                        {

                            body:
                                "New ride request received.",

                            icon:
                                "../assest/logo.png"
                        }
                    );

                }

            } catch (error) {}
        };


    /* ========================================================
       FARE
       ======================================================== */

    Accept.getFare =
        function (
            request
        ) {

            if (
                request.fare != null
            ) {

                if (
                    typeof request.fare ===
                    "object"
                ) {

                    return (
                        request.fare.finalFare ??
                        request.fare.total ??
                        request.fare.amount ??
                        0
                    );
                }


                return request.fare;
            }


            return (
                request.estimatedFare ??
                request.totalFare ??
                request.amount ??
                0
            );
        };


    /* ========================================================
       SERVICE
       ======================================================== */

    Accept.getServiceName =
        function (
            request
        ) {

            const service =
                String(
                    request.service ||
                    request.serviceType ||
                    "bike"
                )
                .toLowerCase();


            const names = {

                bike:
                    "Bike Taxi",

                bike_taxi:
                    "Bike Taxi",

                cab:
                    "Cab",

                car:
                    "Cab",

                parcel:
                    "Parcel",

                food:
                    "Food Delivery"
            };


            return (
                names[service] ||
                "Ride"
            );
        };


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

    Accept.escape =
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
       LOCAL STORAGE
       ======================================================== */

    Accept.saveRequests =
        function () {

            try {

                localStorage.setItem(
                    "riderx_ride_requests",
                    JSON.stringify(
                        Accept.state.requests
                    )
                );

            } catch (error) {}
        };


    Accept.restoreRequests =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        "riderx_ride_requests"
                    );


                if (
                    saved
                ) {

                    Accept.state.requests =
                        JSON.parse(
                            saved
                        ) || {};

                }

            } catch (error) {

                Accept.state.requests =
                    {};
            }
        };


    Accept.clearAllRequests =
        function () {

            Accept.state.requests =
                {};

            Accept.saveRequests();


            const container =
                Accept.getContainer();


            if (
                container
            ) {

                container.innerHTML =
                    "";

            }
        };


    /* ========================================================
       MESSAGE
       ======================================================== */

    Accept.showMessage =
        function (
            message
        ) {

            if (
                RX.notification &&
                typeof RX.notification.show ===
                "function"
            ) {

                RX.notification.show(
                    message
                );

                return;
            }


            const existing =
                document.querySelector(
                    "#riderXToast"
                );


            if (
                existing
            ) {

                existing.textContent =
                    message;

                existing.classList.add(
                    "show"
                );


                setTimeout(
                    function () {

                        existing.classList.remove(
                            "show"
                        );

                    },
                    3000
                );


                return;
            }


            console.warn(
                message
            );
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Accept.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-ride-accept-" +
                    name,
                    {

                        detail:
                            data || {}
                    }
                )
            );
        };


    Accept.on =
        function (
            name,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                return;
            }


            const eventName =
                "riderx-ride-accept-" +
                name;


            const handler =
                function (
                    event
                ) {

                    callback(
                        event.detail || {},
                        event
                    );

                };


            window.addEventListener(
                eventName,
                handler
            );


            return function () {

                window.removeEventListener(
                    eventName,
                    handler
                );

            };
        };


    /* ========================================================
       RESTORE ACTIVE REQUEST
       ======================================================== */

    Accept.restoreActiveRequest =
        function () {

            try {

                const rideId =
                    localStorage.getItem(
                        Accept.config
                            .activeRequestKey
                    );


                if (
                    rideId &&
                    Accept.state.requests[
                        rideId
                    ]
                ) {

                    Accept.state.activeRequest =
                        Accept.state.requests[
                            rideId
                        ];

                }

            } catch (error) {}
        };


    /* ========================================================
       INIT
       ======================================================== */

    Accept.init =
        function () {

            if (
                Accept.state.initialized
            ) {

                return;
            }


            Accept.state.initialized =
                true;


            Accept.restoreRequests();


            Accept.restoreActiveRequest();


            if (
                Accept.isRider()
            ) {

                /*
                 * Don't automatically mark rider
                 * online. Existing online page /
                 * dashboard controls this.
                 */

                const online =
                    localStorage.getItem(
                        "riderx_online"
                    );


                if (
                    online === "true"
                ) {

                    Accept.state.online =
                        true;

                    Accept.startListening();

                }

            }


            console.log(
                "RiderX ride-accept.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.acceptIncomingRide =
        Accept.accept;

    RX.rejectIncomingRide =
        Accept.reject;

    RX.startRideRequests =
        Accept.startListening;

    RX.stopRideRequests =
        Accept.stopListening;

    RX.setRiderOnline =
        Accept.setOnline;


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Accept.init
        );

    } else {

        Accept.init();

    }


})();
