/**
 * ============================================================================
 * RiderX Super App - Booking & Ride Dispatch Controller (js/Booking.js)
 * ============================================================================
 * Premium Ride Hailing Super App
 * Theme: Black + Electric Yellow
 * Firebase v10 Modular SDK Integration
 * ============================================================================
 */

import { auth, db } from '../firebase/firebase-config.js';
import { 
    collection, 
    addDoc, 
    doc, 
    getDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    where, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Booking State
window.RiderXBookingState = {
    activeService: 'cab',
    pickupLocation: null,
    dropLocation: null,
    estimatedFare: 0,
    estimatedDistance: 0,
    estimatedDuration: 0,
    currentRideId: null,
    rideListener: null
};

/**
 * Initialize Booking Module
 */
export function initBookingModule() {
    console.log("Initializing RiderX Booking & Dispatch Module...");
    setupServiceSelectors();
}

function setupServiceSelectors() {
    const serviceButtons = document.querySelectorAll('.service-select-btn');
    serviceButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            serviceButtons.forEach(b => b.classList.remove('border-brand-yellow', 'bg-brand-yellow/10'));
            btn.classList.add('border-brand-yellow', 'bg-brand-yellow/10');
            window.RiderXBookingState.activeService = btn.dataset.service || 'cab';
            calculateFareEstimate();
        });
    });
}

/**
 * Set Pickup & Drop Locations
 */
export function setPickupLocation(lat, lng, address) {
    window.RiderXBookingState.pickupLocation = { lat, lng, address };
    calculateFareEstimate();
}

export function setDropLocation(lat, lng, address) {
    window.RiderXBookingState.dropLocation = { lat, lng, address };
    calculateFareEstimate();
}

/**
 * Calculate Fare Estimate based on Service Type & Distance
 */
export function calculateFareEstimate() {
    const state = window.RiderXBookingState;
    if (!state.pickupLocation || !state.dropLocation) return;

    // Haversine distance calculation in KM
    const R = 6371;
    const dLat = (state.dropLocation.lat - state.pickupLocation.lat) * Math.PI / 180;
    const dLon = (state.dropLocation.lon - state.pickupLocation.lon) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(state.pickupLocation.lat * Math.PI / 180) * Math.cos(state.dropLocation.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in KM

    state.estimatedDistance = parseFloat(distance.toFixed(2));
    state.estimatedDuration = Math.round(distance * 3); // Approx 3 mins per KM in city traffic

    // Base fare multipliers per service
    const baseFares = {
        bike: { base: 30, perKm: 12 },
        cab: { base: 80, perKm: 22 },
        auto: { base: 45, perKm: 15 },
        parcel: { base: 50, perKm: 18 },
        food: { base: 40, perKm: 14 }
    };

    const rates = baseFares[state.activeService] || baseFares.cab;
    let fare = rates.base + (state.estimatedDistance * rates.perKm);
    state.estimatedFare = Math.max(Math.round(fare), 50);

    updateFareUI();
}

function updateFareUI() {
    const state = window.RiderXBookingState;
    const fareEl = document.getElementById('estimated-fare-display');
    if (fareEl) fareEl.innerText = `₹${state.estimatedFare}`;

    const distEl = document.getElementById('estimated-distance-display');
    if (distEl) distEl.innerText = `${state.estimatedDistance} KM`;

    const timeEl = document.getElementById('estimated-time-display');
    if (timeEl) timeEl.innerText = `${state.estimatedDuration} mins`;
}

/**
 * Create & Dispatch Ride Request
 */
export async function createRideRequest(paymentMethod = 'cash') {
    const state = window.RiderXBookingState;
    const user = auth.currentUser;

    if (!user) {
        alert("Please sign in to book a ride.");
        window.location.href = '../auth/login.html';
        return;
    }

    if (!state.pickupLocation || !state.dropLocation) {
        alert("Please select both pickup and drop locations.");
        return;
    }

    try {
        const rideData = {
            customerId: user.uid,
            customerName: user.displayName || 'RiderX User',
            customerPhone: user.phoneNumber || '',
            serviceType: state.activeService,
            pickup: state.pickupLocation,
            drop: state.dropLocation,
            fare: state.estimatedFare,
            distance: state.estimatedDistance,
            duration: state.estimatedDuration,
            paymentMethod: paymentMethod,
            status: 'searching', // searching, accepted, arriving, started, completed, cancelled
            driverId: null,
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, "rides"), rideData);
        window.RiderXBookingState.currentRideId = docRef.id;
        
        console.log("Ride Dispatched successfully with ID:", docRef.id);
        startRideStatusListener(docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Failed to create ride request:", error);
        alert("Ride dispatch failed. Please try again.");
    }
}

/**
 * Realtime Ride Status Listener
 */
export function startRideStatusListener(rideId) {
    if (window.RiderXBookingState.rideListener) {
        window.RiderXBookingState.rideListener();
    }

    const docRef = doc(db, "rides", rideId);
    window.RiderXBookingState.rideListener = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const ride = docSnap.data();
            handleRideStatusChange(ride);
        }
    });
}

function handleRideStatusChange(ride) {
    const statusEvent = new CustomEvent('riderx:rideStatusUpdated', { detail: ride });
    window.dispatchEvent(statusEvent);

    if (ride.status === 'accepted') {
        console.log("Driver accepted the ride:", ride.driverId);
    } else if (ride.status === 'completed') {
        console.log("Ride completed successfully.");
        if (window.RiderXBookingState.rideListener) {
            window.RiderXBookingState.rideListener();
        }
    }
}

/**
 * Cancel Active Ride
 */
export async function cancelRide(rideId) {
    try {
        const targetId = rideId || window.RiderXBookingState.currentRideId;
        if (!targetId) return;

        await updateDoc(doc(db, "rides", targetId), {
            status: 'cancelled',
            cancelledAt: Timestamp.now()
        });

        if (window.RiderXBookingState.rideListener) {
            window.RiderXBookingState.rideListener();
        }
        window.RiderXBookingState.currentRideId = null;
        alert("Ride cancelled successfully.");
    } catch (error) {
        console.error("Error cancelling ride:", error);
    }
}

// Bind Global Booking Object for Inline UI Interactions
window.RiderXBooking = {
    initBookingModule,
    setPickupLocation,
    setDropLocation,
    calculateFareEstimate,
    createRideRequest,
    cancelRide
};

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingModule);
} else {
    initBookingModule();
}
