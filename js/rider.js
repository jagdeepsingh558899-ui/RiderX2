// RiderX Rider Engine: Online Status, Accepting Rides, & Job Execution
let isOnline = false;

function toggleRiderStatus() {
  const user = JSON.parse(localStorage.getItem('riderx_user'));
  if (!user) return;

  isOnline = !isOnline;
  const statusToggle = document.getElementById('riderStatusBtn');
  
  if (isOnline) {
    statusToggle.innerText = 'Go Offline';
    statusToggle.style.background = '#ff3333';
    listenForNearbyRides();
  } else {
    statusToggle.innerText = 'Go Online';
    statusToggle.style.background = '#ffcc00';
    document.getElementById('availableRides').innerHTML = '<p>You are currently offline.</p>';
  }

  db.collection('users').doc(user.uid).update({
    isOnline: isOnline
  });
}

function listenForNearbyRides() {
  const ridesContainer = document.getElementById('availableRides');
  ridesContainer.innerHTML = '<p>Searching for nearby ride requests...</p>';

  db.collection('rides')
    .where('status', '==', 'REQUESTED')
    .onSnapshot((snapshot) => {
      ridesContainer.innerHTML = '';
      if (snapshot.empty) {
        ridesContainer.innerHTML = '<p style="color: #aaa;">No active ride requests nearby.</p>';
        return;
      }

      snapshot.forEach((doc) => {
        const ride = doc.data();
        const rideId = doc.id;

        const card = document.createElement('div');
        card.className = 'ride-card';
        card.style = 'background: #1e1e1e; border: 1px solid #333; padding: 15px; margin-bottom: 10px; border-radius: 8px; color: #fff;';
        card.innerHTML = `
          <h4 style="color: #ffcc00; margin: 0 0 5px 0;">${ride.serviceType.toUpperCase()} RIDE</h4>
          <p>Pickup: ${ride.pickupLocation}</p>
          <p>Dropoff: ${ride.dropoffLocation}</p>
          <p>Fare: <b>₹${ride.fare}</b> (${ride.paymentMethod})</p>
          <button onclick="acceptRide('${rideId}')" style="background: #ffcc00; color: #000; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">Accept Ride</button>
        `;
        ridesContainer.appendChild(card);
      });
    });
}

async function acceptRide(rideId) {
  const user = JSON.parse(localStorage.getItem('riderx_user'));
  try {
    await db.collection('rides').doc(rideId).update({
      status: 'ACCEPTED',
      riderId: user.uid,
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Ride Accepted! Navigate to pickup location.');
    renderActiveRide(rideId);
  } catch (err) {
    alert('Failed to accept ride: ' + err.message);
  }
}

function renderActiveRide(rideId) {
  const ridesContainer = document.getElementById('availableRides');
  ridesContainer.innerHTML = `
    <div style="background: #222; border: 1px solid #00ff66; padding: 15px; border-radius: 8px; color: #fff;">
      <h3 style="color: #00ff66; margin: 0 0 10px 0;">Active Job in Progress</h3>
      <p>Ride ID: ${rideId}</p>
      <button onclick="completeRide('${rideId}')" style="background: #00ff66; color: #000; border: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 10px;">Complete Ride</button>
    </div>
  `;
}

async function completeRide(rideId) {
  try {
    await db.collection('rides').doc(rideId).update({
      status: 'COMPLETED',
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Ride completed successfully!');
    if (isOnline) listenForNearbyRides();
  } catch (err) {
    alert('Error completing ride: ' + err.message);
  }
}
