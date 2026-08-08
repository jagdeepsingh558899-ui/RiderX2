// ============================================================
// RiderX Admin Portal Controller
// Firebase v10 Modular SDK
// ============================================================

import { db } from "../firebase/firebase-config.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

function money(value) {
  return "₹" + (Number(value) || 0).toLocaleString("en-IN");
}

function safe(value, fallback = "N/A") {
  return value !== undefined &&
         value !== null &&
         value !== ""
    ? String(value)
    : fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getRole(data) {
  return normalize(
    data?.role ??
    data?.userType ??
    data?.type
  );
}

function getStatus(data) {
  return normalize(
    data?.status ??
    data?.approvalStatus ??
    data?.riderStatus
  );
}

function getFare(data) {
  return Number(
    data?.fare ??
    data?.amount ??
    data?.price ??
    data?.totalFare ??
    data?.totalAmount ??
    0
  ) || 0;
}


// ============================================================
// ADMIN STATS
// ============================================================

export function loadAdminStats() {

  const customersEl = $("totalCustomers");
  const ridersEl = $("totalRiders");
  const ridesEl = $("totalRides");
  const revenueEl = $("totalRevenue");

  // ----------------------------------------------------------
  // CUSTOMERS
  // ----------------------------------------------------------

  if (customersEl) {

    const customersQuery = query(
      collection(db, "users"),
      where("role", "==", "customer")
    );

    onSnapshot(
      customersQuery,
      snap => {
        customersEl.textContent =
          snap.size.toLocaleString("en-IN");
      },
      error => {
        console.error("Customer stats error:", error);
        customersEl.textContent = "0";
      }
    );
  }


  // ----------------------------------------------------------
  // RIDERS
  // ----------------------------------------------------------

  if (ridersEl) {

    const ridersQuery = query(
      collection(db, "users"),
      where("role", "==", "rider")
    );

    onSnapshot(
      ridersQuery,
      snap => {
        ridersEl.textContent =
          snap.size.toLocaleString("en-IN");
      },
      error => {
        console.error("Rider stats error:", error);
        ridersEl.textContent = "0";
      }
    );
  }


  // ----------------------------------------------------------
  // RIDES + COMMISSION
  // ----------------------------------------------------------

  if (ridesEl || revenueEl) {

    const ridesRef =
      collection(db, "rides");

    onSnapshot(
      ridesRef,
      snap => {

        if (ridesEl) {
          ridesEl.textContent =
            snap.size.toLocaleString("en-IN");
        }

        let commission = 0;

        snap.forEach(item => {

          const ride = item.data();

          const status =
            normalize(
              ride.status ??
              ride.rideStatus
            );

          if (
            [
              "completed",
              "complete",
              "finished",
              "success"
            ].includes(status)
          ) {

            const fare =
              getFare(ride);

            commission += fare * 0.20;
          }
        });

        if (revenueEl) {
          revenueEl.textContent =
            money(Math.round(commission));
        }

      },
      error => {

        console.error(
          "Ride stats error:",
          error
        );

        if (ridesEl) {
          ridesEl.textContent = "0";
        }

        if (revenueEl) {
          revenueEl.textContent = "₹0";
        }
      }
    );
  }
}


// ============================================================
// RIDERS TABLE
// ============================================================

export function loadRidersTable() {

  const tableBody =
    $("ridersTableBody");

  if (!tableBody) return;


  const ridersQuery = query(
    collection(db, "users"),
    where("role", "==", "rider")
  );


  onSnapshot(
    ridersQuery,

    snap => {

      tableBody.innerHTML = "";


      if (snap.empty) {

        tableBody.innerHTML = `
          <tr>
            <td colspan="5"
                style="text-align:center;padding:20px;color:#999">
              No riders found
            </td>
          </tr>
        `;

        return;
      }


      snap.forEach(item => {

        const rider =
          item.data();

        const uid =
          item.id;

        const name =
          rider.name ||
          rider.fullName ||
          rider.displayName ||
          "N/A";

        const email =
          rider.email ||
          "N/A";

        const phone =
          rider.phone ||
          rider.mobile ||
          rider.phoneNumber ||
          "N/A";

        const status =
          getStatus(rider) ||
          "pending";


        let badgeClass =
          "bg-warning";

        if (
          [
            "active",
            "approved",
            "verified"
          ].includes(status)
        ) {
          badgeClass =
            "bg-success";
        }

        if (
          [
            "blocked",
            "rejected",
            "declined"
          ].includes(status)
        ) {
          badgeClass =
            "bg-danger";
        }


        const tr =
          document.createElement("tr");


        tr.innerHTML = `

          <td>
            ${escapeHtml(name)}
          </td>

          <td>
            ${escapeHtml(email)}
          </td>

          <td>
            ${escapeHtml(phone)}
          </td>

          <td>
            <span class="badge ${badgeClass}">
              ${escapeHtml(status)}
            </span>
          </td>

          <td>

            <button
              class="btn btn-sm btn-success"
              data-rider-action="approve"
              data-rider-id="${escapeHtml(uid)}">

              Approve

            </button>

            <button
              class="btn btn-sm btn-danger"
              data-rider-action="block"
              data-rider-id="${escapeHtml(uid)}">

              Block

            </button>

          </td>
        `;


        tableBody.appendChild(tr);
      });
    },

    error => {

      console.error(
        "Riders table error:",
        error
      );

      tableBody.innerHTML = `
        <tr>
          <td colspan="5"
              style="text-align:center;padding:20px;color:#ff7777">

            Unable to load riders.

          </td>
        </tr>
      `;
    }
  );
}


// ============================================================
// UPDATE RIDER STATUS
// ============================================================

export async function updateRiderStatus(
  uid,
  status
) {

  if (!uid) {
    throw new Error(
      "Rider UID is missing."
    );
  }


  const normalizedStatus =
    normalize(status);


  let payload = {};


  // ----------------------------------------------------------
  // APPROVE
  // ----------------------------------------------------------

  if (
    [
      "active",
      "approve",
      "approved"
    ].includes(normalizedStatus)
  ) {

    payload = {

      status: "approved",

      approvalStatus:
        "approved",

      riderStatus:
        "approved",

      verificationStatus:
        "approved",

      approved:
        true,

      isApproved:
        true,

      accountStatus:
        "active",

      online:
        false,

      isOnline:
        false
    };
  }


  // ----------------------------------------------------------
  // BLOCK
  // ----------------------------------------------------------

  else if (
    [
      "blocked",
      "block"
    ].includes(normalizedStatus)
  ) {

    payload = {

      status:
        "blocked",

      approvalStatus:
        "blocked",

      riderStatus:
        "blocked",

      verificationStatus:
        "blocked",

      approved:
        false,

      isApproved:
        false,

      accountStatus:
        "blocked",

      online:
        false,

      isOnline:
        false
    };
  }


  // ----------------------------------------------------------
  // REJECT
  // ----------------------------------------------------------

  else if (
    [
      "rejected",
      "reject",
      "declined"
    ].includes(normalizedStatus)
  ) {

    payload = {

      status:
        "rejected",

      approvalStatus:
        "rejected",

      riderStatus:
        "rejected",

      verificationStatus:
        "rejected",

      approved:
        false,

      isApproved:
        false,

      accountStatus:
        "rejected",

      online:
        false,

      isOnline:
        false
    };
  }


  else {

    payload = {
      status:
        normalizedStatus
    };
  }


  const riderRef =
    doc(
      db,
      "users",
      uid
    );


  const riderSnap =
    await getDoc(riderRef);


  if (!riderSnap.exists()) {

    throw new Error(
      "Rider account not found."
    );
  }


  await updateDoc(
    riderRef,
    payload
  );


  // ----------------------------------------------------------
  // ALSO UPDATE RIDERS COLLECTION IF IT EXISTS
  // ----------------------------------------------------------

  try {

    const riderProfileRef =
      doc(
        db,
        "riders",
        uid
      );

    const riderProfileSnap =
      await getDoc(
        riderProfileRef
      );


    if (
      riderProfileSnap.exists()
    ) {

      await updateDoc(
        riderProfileRef,
        payload
      );
    }

  } catch(error) {

    console.warn(
      "Riders profile update skipped:",
      error
    );
  }


  return true;
}


// ============================================================
// RIDER TABLE BUTTON EVENTS
// ============================================================

document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        "[data-rider-action]"
      );

    if (!button) return;


    const action =
      button.dataset.riderAction;

    const uid =
      button.dataset.riderId;


    if (!uid) return;


    let status =
      action;


    if (
      action === "approve"
    ) {
      status =
        "approved";
    }

    if (
      action === "block"
    ) {
      status =
        "blocked";
    }


    const confirmation =
      confirm(
        `Are you sure you want to ${action} this rider?`
      );


    if (!confirmation) {
      return;
    }


    const originalText =
      button.textContent;


    button.disabled =
      true;

    button.textContent =
      "Updating...";


    try {

      await updateRiderStatus(
        uid,
        status
      );


      alert(
        action === "approve"
          ? "Rider approved successfully."
          : "Rider blocked successfully."
      );

    } catch(error) {

      console.error(
        "Rider status update error:",
        error
      );

      alert(
        "Error updating rider:\n" +
        error.message
      );

    } finally {

      button.disabled =
        false;

      button.textContent =
        originalText;
    }
  }
);


// ============================================================
// RIDES TABLE
// ============================================================

export function loadRidesTable() {

  const tableBody =
    $("ridesTableBody");

  if (!tableBody) return;


  const ridesQuery =
    query(
      collection(db, "rides"),
      orderBy(
        "createdAt",
        "desc"
      ),
      limit(20)
    );


  onSnapshot(
    ridesQuery,

    snap => {

      tableBody.innerHTML = "";


      if (snap.empty) {

        tableBody.innerHTML = `
          <tr>
            <td colspan="5"
                style="text-align:center;padding:20px;color:#999">

              No rides found

            </td>
          </tr>
        `;

        return;
      }


      snap.forEach(item => {

        const ride =
          item.data();


        const rideId =
          item.id;


        const serviceType =
          ride.serviceType ||
          ride.service ||
          "Bike Taxi";


        const pickup =
          ride.pickupLocation ||
          ride.pickupAddress ||
          ride.pickup ||
          "N/A";


        const dropoff =
          ride.dropoffLocation ||
          ride.dropoffAddress ||
          ride.dropoff ||
          "N/A";


        const fare =
          getFare(ride);


        const status =
          normalize(
            ride.status ??
            ride.rideStatus
          ) || "pending";


        let badgeClass =
          "bg-primary";


        if (
          [
            "completed",
            "complete",
            "finished"
          ].includes(status)
        ) {

          badgeClass =
            "bg-success";
        }


        if (
          [
            "cancelled",
            "canceled",
            "rejected"
          ].includes(status)
        ) {

          badgeClass =
            "bg-danger";
        }


        if (
          [
            "pending",
            "searching",
            "requested"
          ].includes(status)
        ) {

          badgeClass =
            "bg-warning";
        }


        const tr =
          document.createElement("tr");


        tr.innerHTML = `

          <td>
            ${escapeHtml(
              rideId.substring(
                0,
                8
              )
            )}...
          </td>

          <td>
            ${escapeHtml(
              serviceType
            )}
          </td>

          <td>
            ${escapeHtml(
              pickup
            )}
            →
            ${escapeHtml(
              dropoff
            )}
          </td>

          <td>
            ${money(fare)}
          </td>

          <td>
            <span class="badge ${badgeClass}">
              ${escapeHtml(status)}
            </span>
          </td>

        `;


        tableBody.appendChild(
          tr
        );
      });
    },

    error => {

      console.error(
        "Rides table error:",
        error
      );


      /*
        orderBy(createdAt) can fail if some
        old rides do not contain createdAt.

        Show a useful message instead of
        leaving the page stuck.
      */

      tableBody.innerHTML = `
        <tr>
          <td colspan="5"
              style="text-align:center;padding:20px;color:#ff7777">

            Unable to load rides.<br>
            <small>
              Check Firestore rules or make sure
              rides have a createdAt field.
            </small>

          </td>
        </tr>
      `;
    }
  );
}


// ============================================================
// OPTIONAL: MANUAL RIDER FETCH
// ============================================================

export async function getAllRiders() {

  const snapshot =
    await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "rider")
      )
    );


  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


// ============================================================
// OPTIONAL: MANUAL RIDE FETCH
// ============================================================

export async function getRecentRides() {

  const snapshot =
    await getDocs(
      query(
        collection(db, "rides"),
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(20)
      )
    );


  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


// ============================================================
// AUTO INITIALIZATION
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    try {

      loadAdminStats();

      loadRidersTable();

      loadRidesTable();

    } catch(error) {

      console.error(
        "RiderX Admin initialization error:",
        error
      );
    }
  }
);
