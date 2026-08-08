// ============================================================
// RiderX Rider Engine
// Firebase v10 Modular
// ONLINE / OFFLINE / RIDE ACCEPT / COMPLETE
// ============================================================

import {
    auth,
    db,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from "../firebase/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let riderData = null;
let isOnline = false;
let ridesUnsubscribe = null;


// ============================================================
// ELEMENT HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


// ============================================================
// GET RIDER
// ============================================================

async function loadRider(user) {

    const riderRef =
        doc(
            db,
            "riders",
            user.uid
        );


    const riderSnap =
        await getDoc(riderRef);


    if (
        riderSnap.exists()
    ) {

        riderData =
            riderSnap.data();

    } else {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


        if (userSnap.exists()) {

            riderData =
                userSnap.data();

        }

    }


    return riderData;
}


// ============================================================
// APPROVAL CHECK
// ============================================================

function isApproved(data) {

    if (!data) {
        return false;
    }


    const status =
        String(
            data.status ??
            data.approvalStatus ??
            data.riderStatus ??
            data.accountStatus ??
            ""
        )
        .trim()
        .toLowerCase();


    return (
        data.approved === true ||
        data.isApproved === true ||
        data.adminApproved === true ||
        [
            "approved",
            "active",
            "verified"
        ].includes(status)
    );
}


// ============================================================
// SHOW STATUS
// ============================================================

function updateOnlineButton() {

    const button =
        $("onlineBtn") ||
        $("riderStatusBtn");


    if (!button) {
        return;
    }


    if (isOnline) {

        button.innerText =
            "🔴 Go Offline";

        button.style.background =
            "#ff3333";

    } else {

        button.innerText =
            "🟢 Go Online";

        button.style.background =
            "#FFD600";

    }

}


// ============================================================
// ONLINE / OFFLINE
// ============================================================

async function toggleRiderStatus() {

    if (!currentUser) {
        return;
    }


    if (
        !isApproved(riderData)
    ) {

        alert(
            "Your rider account is not approved yet."
        );

        return;
    }


    isOnline =
        !isOnline;


    updateOnlineButton();


    try {

        const riderRef =
            doc(
                db,
                "riders",
                currentUser.uid
            );


        await updateDoc(
            riderRef,
            {
                online: isOnline,
                isOnline: isOnline,
                status:
                    isOnline
                        ? "online"
                        : "active",
                updatedAt:
                    serverTimestamp()
            }
        );


        const userRef =
            doc(
                db,
                "users",
                currentUser.uid
            );


        await updateDoc(
            userRef,
            {
                online: isOnline,
                isOnline: isOnline,
                updatedAt:
                    serverTimestamp()
            }
        );


        if (isOnline) {

            listenForNearbyRides();

        } else {

            stopRideListener();

            showOfflineMessage();

        }

    } catch (error) {

        console.error(
            "Online status error:",
            error
        );


        isOnline =
            !isOnline;


        updateOnlineButton();


        alert(
            "Unable to change online status.\n\n" +
            error.message
        );

    }

}


// ============================================================
// OFFLINE MESSAGE
// ============================================================

function showOfflineMessage() {

    const container =
        $("availableRides");


    if (!container) {
        return;
    }


    container.innerHTML = `
        <p style="
            color:#aaa;
            text-align:center;
            padding:20px;
        ">
            You are currently offline.
        </p>
    `;

}


// ============================================================
// STOP LISTENER
// ============================================================

function stopRideListener() {

    if (
        typeof ridesUnsubscribe ===
        "function"
    ) {

        ridesUnsubscribe();

        ridesUnsubscribe =
            null;
    }

}


// ============================================================
// LISTEN RIDES
// ============================================================

function listenForNearbyRides() {

    const container =
        $("availableRides");


    if (!container) {
        return;
    }


    stopRideListener();


    container.innerHTML = `
        <p style="
            color:#aaa;
            text-align:center;
            padding:20px;
        ">
            Searching for nearby ride requests...
        </p>
    `;


    const ridesRef =
        collection(
            db,
            "rides"
        );


    const ridesQuery =
        query(
            ridesRef,
            where(
                "status",
                "==",
                "REQUESTED"
            )
        );


    ridesUnsubscribe =
        onSnapshot(
            ridesQuery,
            snapshot => {

                if (!isOnline) {
                    return;
                }


                container.innerHTML =
                    "";


                if (
                    snapshot.empty
                ) {

                    container.innerHTML = `
                        <p style="
                            color:#aaa;
                            text-align:center;
                            padding:20px;
                        ">
                            No active ride requests nearby.
                        </p>
                    `;

                    return;
                }


                snapshot.forEach(
                    rideDoc => {

                        const ride =
                            rideDoc.data();


                        const rideId =
                            rideDoc.id;


                        const card =
                            document.createElement(
                                "div"
                            );


                        card.style.cssText = `
                            background:#1e1e1e;
                            border:1px solid #333;
                            padding:15px;
                            margin-bottom:10px;
                            border-radius:15px;
                            color:#fff;
                        `;


                        const service =
                            String(
                                ride.serviceType ||
                                "Ride"
                            )
                            .toUpperCase();


                        const pickup =
                            ride.pickupLocation ||
                            ride.pickup ||
                            "Not provided";


                        const drop =
                            ride.dropoffLocation ||
                            ride.drop ||
                            ride.destination ||
                            "Not provided";


                        const fare =
                            Number(
                                ride.fare ??
                                ride.amount ??
                                0
                            );


                        const payment =
                            ride.paymentMethod ||
                            "Cash";


                        card.innerHTML = `

                            <h4 style="
                                color:#FFD600;
                                margin:0 0 10px;
                            ">
                                ${service} RIDE
                            </h4>

                            <p>
                                Pickup:
                                ${escapeHtml(pickup)}
                            </p>

                            <p>
                                Drop:
                                ${escapeHtml(drop)}
                            </p>

                            <p>
                                Fare:
                                <b>₹${fare}</b>
                            </p>

                            <p>
                                Payment:
                                ${escapeHtml(payment)}
                            </p>

                            <button
                                class="accept-ride-btn"
                                style="
                                    width:100%;
                                    background:#FFD600;
                                    color:#000;
                                    border:0;
                                    padding:12px;
                                    border-radius:10px;
                                    font-weight:bold;
                                    cursor:pointer;
                                "
                            >
                                Accept Ride
                            </button>

                        `;


                        const acceptButton =
                            card.querySelector(
                                ".accept-ride-btn"
                            );


                        acceptButton.addEventListener(
                            "click",
                            () => {
                                acceptRide(
                                    rideId
                                );
                            }
                        );


                        container.appendChild(
                            card
                        );

                    }
                );

            },
            error => {

                console.error(
                    "Ride listener error:",
                    error
                );


                container.innerHTML = `
                    <p style="
                        color:#ff5555;
                        padding:20px;
                    ">
                        Unable to load ride requests.
                    </p>
                `;

            }
        );

}


// ============================================================
// ACCEPT RIDE
// ============================================================

async function acceptRide(
    rideId
) {

    if (!currentUser) {
        return;
    }


    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        const rideSnap =
            await getDoc(rideRef);


        if (!rideSnap.exists()) {

            alert(
                "This ride is no longer available."
            );

            return;
        }


        const ride =
            rideSnap.data();


        if (
            String(
                ride.status || ""
            ).toUpperCase() !==
            "REQUESTED"
        ) {

            alert(
                "Another rider has already accepted this ride."
            );

            return;
        }


        await updateDoc(
            rideRef,
            {
                status: "ACCEPTED",
                riderId:
                    currentUser.uid,
                riderName:
                    riderData?.name ||
                    riderData?.fullName ||
                    "",
                acceptedAt:
                    serverTimestamp()
            }
        );


        alert(
            "Ride Accepted! Navigate to pickup location."
        );


        renderActiveRide(
            rideId,
            ride
        );

    } catch (error) {

        console.error(
            "Accept ride error:",
            error
        );


        alert(
            "Failed to accept ride:\n\n" +
            error.message
        );

    }

}


// ============================================================
// ACTIVE RIDE
// ============================================================

function renderActiveRide(
    rideId,
    ride = {}
) {

    const container =
        $("availableRides");


    if (!container) {
        return;
    }


    container.innerHTML = `

        <div style="
            background:#151515;
            border:1px solid #00c853;
            padding:20px;
            border-radius:18px;
            color:#fff;
        ">

            <h3 style="
                color:#00c853;
                margin-top:0;
            ">
                Active Ride
            </h3>

            <p>
                Ride ID:
                ${escapeHtml(rideId)}
            </p>

            <p>
                Pickup:
                ${escapeHtml(
                    ride.pickupLocation ||
                    ride.pickup ||
                    "—"
                )}
            </p>

            <p>
                Drop:
                ${escapeHtml(
                    ride.dropoffLocation ||
                    ride.drop ||
                    ride.destination ||
                    "—"
                )}
            </p>

            <button
                id="completeActiveRide"
                style="
                    width:100%;
                    margin-top:12px;
                    background:#00c853;
                    color:#fff;
                    border:0;
                    padding:14px;
                    border-radius:12px;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                Complete Ride
            </button>

        </div>

    `;


    const button =
        $("completeActiveRide");


    if (button) {

        button.addEventListener(
            "click",
            () => {
                completeRide(
                    rideId
                );
            }
        );

    }

}


// ============================================================
// COMPLETE RIDE
// ============================================================

async function completeRide(
    rideId
) {

    try {

        const rideRef =
            doc(
                db,
                "rides",
                rideId
            );


        await updateDoc(
            rideRef,
            {
                status: "COMPLETED",
                completedAt:
                    serverTimestamp()
            }
        );


        alert(
            "Ride completed successfully!"
        );


        if (isOnline) {

            listenForNearbyRides();

        } else {

            showOfflineMessage();

        }

    } catch (error) {

        console.error(
            "Complete ride error:",
            error
        );


        alert(
            "Error completing ride:\n\n" +
            error.message
        );

    }

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

    return String(
        value ?? ""
    )
    .replace(
        /[&<>"']/g,
        char => ({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#039;"
        }[char])
    );

}


// ============================================================
// BUTTON EVENTS
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const onlineButton =
            $("onlineBtn") ||
            $("riderStatusBtn");


        if (onlineButton) {

            onlineButton.addEventListener(
                "click",
                toggleRiderStatus
            );

        }


        updateOnlineButton();

    }
);


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.replace(
                "../auth/login.html?role=rider"
            );

            return;
        }


        currentUser =
            user;


        try {

            riderData =
                await loadRider(user);


            if (
                !isApproved(riderData)
            ) {

                alert(
                    "Your rider account is not approved yet."
                );


                window.location.replace(
                    "../auth/login.html?role=rider"
                );

                return;
            }


            console.log(
                "RiderX Rider Ready:",
                riderData
            );


        } catch (error) {

            console.error(
                "Rider initialization error:",
                error
            );


            alert(
                "Unable to load rider profile."
            );

        }

    }
);


// ============================================================
// GLOBAL COMPATIBILITY
// ============================================================

window.toggleRiderStatus =
    toggleRiderStatus;

window.acceptRide =
    acceptRide;

window.completeRide =
    completeRide;
