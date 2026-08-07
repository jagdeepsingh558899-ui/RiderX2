// RiderX Customer Engine: Fare Calculation, Booking, & Realtime Tracking
let map, pickupMarker, dropoffMarker;

const BASE_FARES = {
  bike: { base: 20, perKm: 8 },
  cab: { base: 50, perKm: 15 },
  parcel: { base: 30, perKm: 10 },
  food: { base: 25, perKm: 9 }
};

function initCustomerMap() {
  const defaultLoc = [28.6139, 77.2090]; // Default New Delhi
  map = L.map('map').setView(defaultLoc, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function calculateFare(serviceType, distanceKm) {
  const rate = BASE_FARES[serviceType] || BASE_FARES.bike;
  const fare = rate.base + (rate.perKm * distanceKm);
  return Math.round(fare);
}

async function requestRide(event) {
  event.preventDefault();
  const user = JSON.parse(localStorage.getItem('riderx_user'));
  if (!user) {
    alert('Please login first.');
    window.location.href = '../auth/login.html';
    return;
  }

  const pickup = document.getElementById('pickupLocation').value;
  const dropoff = document.getElementById('dropoffLocation').value;
  const serviceType = document.getElementById('serviceType').value;
  const paymentMethod = document.getElementById('paymentMethod').value;

  // Simulated 5km ride for calculation
  const estimatedDist = 5.5; 
  const estimatedFare = calculateFare(serviceType, estimatedDist);

  const rideData = {
    customerId: user.uid,
    customerName: user.name || 'Customer',
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    serviceType: serviceType,
    paymentMethod: paymentMethod,
    fare: estimatedFare,
    status: 'REQUESTED',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    const docRef = await db.collection('rides').add(rideData);
    document.getElementById('bookingStatus').innerHTML = `
      <div style="background: #222; border: 1px solid #ffcc00; padding: 15px; border-radius: 8px; margin-top: 15px; color: #fff;">
        <h4 style="color: #ffcc00; margin: 0 0 8px 0;">Ride Requested!</h4>
        <p>Ride ID: <b>${docRef.id}</b></p>
        <p>Estimated Fare: <b>₹${estimatedFare}</b></p>
        <p>Status: <span id="liveStatus" style="color: #00ff66;">Searching for Driver...</span></p>
      </div>
    `;
    listenForRideUpdates(docRef.id);
  } catch (err) {
    alert('Failed to book ride: ' + err.message);
  }
}

function listenForRideUpdates(rideId) {
  db.collection('rides').doc(rideId).onSnapshot((doc) => {
    if (doc.exists) {
      const ride = doc.data();
      const statusElem = document.getElementById('liveStatus');
      if (statusElem) {
        statusElem.innerText = ride.status;
        if (ride.status === 'ACCEPTED') {
          statusElem.style.color = '#00e5ff';
          alert('A driver has accepted your ride request!');
        } else if (ride.status === 'COMPLETED') {
          statusElem.style.color = '#00ff66';
          alert('Ride completed! Thank you for riding with RiderX.');
        }
      }
    }
  });
}
