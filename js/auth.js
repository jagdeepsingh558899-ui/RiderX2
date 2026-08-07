// RiderX Authentication & Session Management
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = e.target.email.value;
      const password = e.target.password.value;
      const role = e.target.role ? e.target.role.value : 'customer';

      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Fetch User Record
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : { role: role };
        
        localStorage.setItem('riderx_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          role: userData.role || role
        }));

        alert('Login Successful!');
        redirectUser(userData.role || role);
      } catch (error) {
        alert('Login Failed: ' + error.message);
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = e.target.name.value;
      const email = e.target.email.value;
      const password = e.target.password.value;
      const phone = e.target.phone.value;
      const role = e.target.role ? e.target.role.value : 'customer';

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const profileData = {
          uid: user.uid,
          name: name,
          email: email,
          phone: phone,
          role: role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: role === 'rider' ? 'pending_approval' : 'active',
          walletBalance: 0
        };

        await db.collection('users').doc(user.uid).set(profileData);

        localStorage.setItem('riderx_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          role: role,
          name: name
        }));

        alert('Registration Successful!');
        redirectUser(role);
      } catch (error) {
        alert('Signup Failed: ' + error.message);
      }
    });
  }
});

function redirectUser(role) {
  if (role === 'admin') {
    window.location.href = '../admin/dashboard.html';
  } else if (role === 'rider') {
    window.location.href = '../rider/dashboard.html';
  } else {
    window.location.href = '../customer/dashboard.html';
  }
}

function logoutUser() {
  auth.signOut().then(() => {
    localStorage.removeItem('riderx_user');
    window.location.href = '../index.html';
  });
}
