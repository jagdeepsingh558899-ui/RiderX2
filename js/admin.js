// RiderX Admin Portal Controller
document.addEventListener('DOMContentLoaded', () => {
  loadAdminStats();
  loadRidersTable();
  loadRidesTable();
});

function loadAdminStats() {
  db.collection('users').where('role', '==', 'customer').onSnapshot(snap => {
    document.getElementById('totalCustomers').innerText = snap.size;
  });

  db.collection('users').where('role', '==', 'rider').onSnapshot(snap => {
    document.getElementById('totalRiders').innerText = snap.size;
  });

  db.collection('rides').onSnapshot(snap => {
    document.getElementById('totalRides').innerText = snap.size;
    let revenue = 0;
    snap.forEach(doc => {
      const data = doc.data();
      if (data.status === 'COMPLETED' && data.fare) {
        revenue += data.fare * 0.20; // 20% platform commission
      }
    });
    document.getElementById('totalRevenue').innerText = '₹' + Math.round(revenue);
  });
}

function loadRidersTable() {
  const tableBody = document.getElementById('ridersTableBody');
  if (!tableBody) return;

  db.collection('users').where('role', '==', 'rider').onSnapshot(snap => {
    tableBody.innerHTML = '';
    snap.forEach(doc => {
      const rider = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rider.name || 'N/A'}</td>
        <td>${rider.email}</td>
        <td>${rider.phone || 'N/A'}</td>
        <td><span class="badge ${rider.status === 'active' ? 'bg-success' : 'bg-warning'}">${rider.status}</span></td>
        <td>
          <button class="btn btn-sm btn-success" onclick="updateRiderStatus('${doc.id}', 'active')">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="updateRiderStatus('${doc.id}', 'blocked')">Block</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  });
}

async function updateRiderStatus(uid, status) {
  try {
    await db.collection('users').doc(uid).update({ status: status });
    alert(`Rider status updated to ${status}`);
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
}

function loadRidesTable() {
  const tableBody = document.getElementById('ridesTableBody');
  if (!tableBody) return;

  db.collection('rides').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
    tableBody.innerHTML = '';
    snap.forEach(doc => {
      const ride = doc.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${doc.id.substring(0, 8)}...</td>
        <td>${ride.serviceType}</td>
        <td>${ride.pickupLocation} -> ${ride.dropoffLocation}</td>
        <td>₹${ride.fare}</td>
        <td><span class="badge bg-primary">${ride.status}</span></td>
      `;
      tableBody.appendChild(tr);
    });
  });
}
