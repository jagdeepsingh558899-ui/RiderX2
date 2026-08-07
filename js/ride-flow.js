// =================================
// RiderX Ride Flow System
// Firebase Modular SDK
// =================================

import {
  db,
  doc,
  updateDoc
} from "../firebase/firebase-config.js";


// =================================
// ASSIGN RIDER TO RIDE
// =================================

export async function assignRider(rideId, riderId) {
  try {
    if (!rideId || !riderId) {
      throw new Error("Ride ID or Rider ID missing");
    }

    await updateDoc(
      doc(db, "rides", rideId),
      {
        riderId: riderId,
        status: "ACCEPTED",
        acceptedAt: new Date()
      }
    );

    return true;

  } catch (error) {
    console.error("RiderX assign rider error:", error);
    return false;
  }
}


// =================================
// START RIDE
// =================================

export async function startRide(rideId) {
  try {
    if (!rideId) {
      throw new Error("Ride ID missing");
    }

    await updateDoc(
      doc(db, "rides", rideId),
      {
        status: "STARTED",
        startedAt: new Date()
      }
    );

    return true;

  } catch (error) {
    console.error("RiderX start ride error:", error);
    return false;
  }
}


// =================================
// COMPLETE RIDE
// =================================

export async function completeRide(rideId) {
  try {
    if (!rideId) {
      throw new Error("Ride ID missing");
    }

    await updateDoc(
      doc(db, "rides", rideId),
      {
        status: "COMPLETED",
        completedAt: new Date()
      }
    );

    return true;

  } catch (error) {
    console.error("RiderX complete ride error:", error);
    return false;
  }
}


// =================================
// CANCEL RIDE
// =================================

export async function cancelRide(rideId, reason = "Cancelled") {
  try {
    if (!rideId) {
      throw new Error("Ride ID missing");
    }

    await updateDoc(
      doc(db, "rides", rideId),
      {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date()
      }
    );

    return true;

  } catch (error) {
    console.error("RiderX cancel ride error:", error);
    return false;
  }
}
