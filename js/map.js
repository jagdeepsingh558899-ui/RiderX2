/**
 * ============================================================================
 * RiderX Super App - Map & GPS Tracking Module (js/Map.js)
 * ============================================================================
 * Premium Ride Hailing Super App
 * Theme: Black + Electric Yellow
 * Map Provider: OpenStreetMap / Leaflet.js
 * Firebase v10 Modular SDK Integration
 * ============================================================================
 */

import { auth, db } from '../firebase/firebase-config.js';
import { 
    doc, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global Map State
window.RiderXMapState = {
    mapInstance: null,
    currentMarker: null,
    watchId: null,
    isFollowing: true,
    currentTheme: 'dark',
    darkTileLayer: null,
    lightTileLayer: null
};

/**
 * Initialize Leaflet Map with Custom Dark/Light Themes
 */
export function initMap(containerId = 'map', initialLat = 12.9716, initialLng = 77.5946) {
    const mapElement = document.getElementById(containerId);
    if (!mapElement) return null;

    // Initialize Leaflet Map
    const map = L.map(containerId, {
        zoomControl: false,
        attributionControl: false
    }).setView([initialLat, initialLng], 14);

    // Custom Dark CartoDB Tiles
    const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    });

    // Light CartoDB Tiles
    const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    });

    darkTiles.addTo(map);

    window.RiderXMapState.mapInstance = map;
    window.RiderXMapState.darkTileLayer = darkTiles;
    window.RiderXMapState.lightTileLayer = lightTiles;

    // Add Zoom Control to Top Right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialize Location Tracking
    initLiveGPS();

    return map;
}

/**
 * Toggle Map Theme (Dark / Light)
 */
export function toggleMapTheme(theme) {
    const state = window.RiderXMapState;
    if (!state.mapInstance) return;

    if (theme === 'light') {
        state.mapInstance.removeLayer(state.darkTileLayer);
        state.lightTileLayer.addTo(state.mapInstance);
        state.currentTheme = 'light';
    } else {
        state.mapInstance.removeLayer(state.lightTileLayer);
        state.darkTileLayer.addTo(state.mapInstance);
        state.currentTheme = 'dark';
    }
}

/**
 * Live GPS Tracking & High Accuracy WatchPosition
 */
export function initLiveGPS() {
    if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    window.RiderXMapState.watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy, heading } = position.coords;
            updateUserLocationOnMap(latitude, longitude, accuracy, heading);
            updateFirebaseDriverLocation(latitude, longitude);
        },
        (error) => {
            console.error("GPS Error:", error.message);
        },
        options
    );
}

function updateUserLocationOnMap(lat, lng, accuracy, heading) {
    const state = window.RiderXMapState;
    if (!state.mapInstance) return;

    const latLng = [lat, lng];

    // Create custom Electric Yellow Pulsing Marker
    if (!state.currentMarker) {
        const customIcon = L.divIcon({
            className: 'riderx-gps-marker',
            html: `<div style="width: 20px; height: 20px; background-color: #FFE500; border: 3px solid #08080A; border-radius: 50%; box-shadow: 0 0 15px #FFE500;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        state.currentMarker = L.marker(latLng, { icon: customIcon }).addTo(state.mapInstance);
    } else {
        state.currentMarker.setLatLng(latLng);
    }

    // Auto Center if enabled
    if (state.isFollowing) {
        state.mapInstance.setView(latLng, state.mapInstance.getZoom());
    }
}

/**
 * Sync Driver/User Location to Firebase Firestore
 */
async function updateFirebaseDriverLocation(lat, lng) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const driverRef = doc(db, "drivers", user.uid);
        await updateDoc(driverRef, {
            location: {
                lat: lat,
                lng: lng
            },
            lastUpdated: serverTimestamp()
        }, { merge: true });
    } catch (err) {
        // Silent catch for customers or non-drivers
    }
}

/**
 * Recenter Map to Current User Location
 */
export function centerToCurrentLocation() {
    const state = window.RiderXMapState;
    if (!state.mapInstance) return;

    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        state.mapInstance.setView([latitude, longitude], 16, { animate: true });
        state.isFollowing = true;
    }, (error) => {
        console.error("Unable to retrieve location:", error);
    }, { enableHighAccuracy: true });
}

/**
 * Draw Route between Pickup and Drop coordinates
 */
export function drawRoute(pickup, drop) {
    const state = window.RiderXMapState;
    if (!state.mapInstance) return;

    // Use Leaflet Routing Machine if available, otherwise fallback to polyline
    if (L.Routing) {
        if (window.RiderXRoutingControl) {
            state.mapInstance.removeControl(window.RiderXRoutingControl);
        }

        window.RiderXRoutingControl = L.Routing.control({
            waypoints: [
                L.latLng(pickup.lat, pickup.lng),
                L.latLng(drop.lat, drop.lng)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            fitSelectedRoutes: true,
            lineOptions: {
                styles: [{ color: '#FFE500', weight: 6, opacity: 0.9 }]
            },
            createMarker: function() { return null; } // Hide default markers
        }).addTo(state.mapInstance);
    }
}

// Bind Global Map Controller Object
window.RiderXMap = {
    initMap,
    toggleMapTheme,
    initLiveGPS,
    centerToCurrentLocation,
    drawRoute
};

// Auto-initialize if map container exists on page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('map')) {
            initMap('map');
        }
    });
} else {
    if (document.getElementById('map')) {
        initMap('map');
    }
}
