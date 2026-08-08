// ============================================================
// RiderX - Rider Registration
// FINAL VERSION
// ============================================================

import {
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
  serverTimestamp
} from "../firebase/firebase-config.js";


// ============================================================
// DOM HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const registerForm =
  $("riderRegisterForm") ||
  $("registerForm") ||
  $("riderForm");

const submitButton =
  $("registerBtn") ||
  $("registerButton") ||
  $("submitBtn") ||
  $("register");

const messageBox =
  $("message") ||
  $("errorMessage") ||
  $("successMessage");


// ============================================================
// MESSAGE
// ============================================================

function showMessage(message, type = "error") {

  if (!messageBox) {
    alert(message);
    return;
  }

  messageBox.textContent = message;

  messageBox.style.display = "block";

  if (type === "success") {
    messageBox.style.color = "#19d36b";
  } else {
    messageBox.style.color = "#ff5555";
  }
}


function clearMessage() {

  if (!messageBox) return;

  messageBox.textContent = "";

  messageBox.style.display = "none";
}


// ============================================================
// LOADING
// ============================================================

function setLoading(active) {

  if (!submitButton) return;

  submitButton.disabled = active;

  if (active) {

    submitButton.dataset.oldText =
      submitButton.textContent;

    submitButton.textContent =
      "Registering...";

  } else {

    submitButton.textContent =
      submitButton.dataset.oldText ||
      "Register";

  }
}


// ============================================================
// READ FIELD
// ============================================================

function valueOf(...ids) {

  for (const id of ids) {

    const element = $(id);

    if (element && element.value !== undefined) {

      const value =
        String(element.value).trim();

      if (value) return value;
    }
  }

  return "";
}


// ============================================================
// FILE READ
// ============================================================

function fileOf(...ids) {

  for (const id of ids) {

    const element = $(id);

    if (
      element &&
      element.files &&
      element.files.length
    ) {

      return element.files[0];
    }
  }

  return null;
}


// ============================================================
// NORMALIZE PHONE
// ============================================================

function normalizePhone(phone) {

  return String(phone || "")
    .replace(/\s+/g, "")
    .replace(/^\+91/, "")
    .replace(/^91/, "")
    .replace(/\D/g, "");
}


// ============================================================
// VALIDATE PHONE
// ============================================================

function validPhone(phone) {

  return /^[6-9]\d{9}$/.test(
    normalizePhone(phone)
  );
}


// ============================================================
// EMAIL VALIDATION
// ============================================================

function validEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


// ============================================================
// SAFE ERROR
// ============================================================

function firebaseErrorMessage(error) {

  if (!error) {
    return "Registration failed.";
  }

  switch (error.code) {

    case "auth/email-already-in-use":
      return "This email is already registered.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Password must be at least 6 characters.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet.";

    case "permission-denied":
      return "Firestore permission denied.";

    default:

      if (
        String(error.message || "")
          .toLowerCase()
          .includes("missing or insufficient permissions")
      ) {

        return "Firestore permission denied.";
      }

      return (
        error.message ||
        "Registration failed."
      );
  }
}


// ============================================================
// REGISTRATION
// ============================================================

async function registerRider(event) {

  if (event) {
    event.preventDefault();
  }

  clearMessage();

  // ----------------------------------------------------------
  // BASIC DETAILS
  // ----------------------------------------------------------

  const name =
    valueOf(
      "name",
      "fullName",
      "riderName"
    );

  const email =
    valueOf(
      "email",
      "riderEmail"
    );

  const password =
    valueOf(
      "password",
      "riderPassword"
    );

  const confirmPassword =
    valueOf(
      "confirmPassword",
      "confirm_password",
      "password2"
    );

  const phone =
    normalizePhone(
      valueOf(
        "phone",
        "mobile",
        "phoneNumber"
      )
    );

  // ----------------------------------------------------------
  // PERSONAL DETAILS
  // ----------------------------------------------------------

  const dob =
    valueOf(
      "dob",
      "dateOfBirth"
    );

  const address =
    valueOf(
      "address",
      "fullAddress"
    );

  const city =
    valueOf(
      "city"
    ) || "Chandigarh";

  // ----------------------------------------------------------
  // VEHICLE DETAILS
  // ----------------------------------------------------------

  const vehicleType =
    valueOf(
      "vehicleType",
      "vehicle",
      "vehicle_type"
    ) || "Bike";

  const vehicleNumber =
    valueOf(
      "vehicleNumber",
      "vehicleNo",
      "bikeNumber",
      "registrationNumber"
    );

  const vehicleModel =
    valueOf(
      "vehicleModel",
      "bikeModel",
      "model"
    );

  // ----------------------------------------------------------
  // LICENSE DETAILS
  // ----------------------------------------------------------

  const licenseNumber =
    valueOf(
      "licenseNumber",
      "license",
      "drivingLicense",
      "dlNumber"
    );

  // ----------------------------------------------------------
  // DOCUMENT FILES
  // ----------------------------------------------------------

  const profileFile =
    fileOf(
      "profilePhoto",
      "profileImage",
      "photo"
    );

  const licenseFile =
    fileOf(
      "licenseFile",
      "licenseImage",
      "drivingLicenseFile"
    );

  const vehicleFile =
    fileOf(
      "vehicleFile",
      "vehicleImage",
      "rcFile"
    );


  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!name) {

    showMessage(
      "Please enter your full name."
    );

    return;
  }


  if (!email || !validEmail(email)) {

    showMessage(
      "Please enter a valid email address."
    );

    return;
  }


  if (!validPhone(phone)) {

    showMessage(
      "Please enter a valid 10-digit mobile number."
    );

    return;
  }


  if (!password || password.length < 6) {

    showMessage(
      "Password must be at least 6 characters."
    );

    return;
  }


  if (
    confirmPassword &&
    password !== confirmPassword
  ) {

    showMessage(
      "Passwords do not match."
    );

    return;
  }


  if (!vehicleNumber) {

    showMessage(
      "Please enter your vehicle number."
    );

    return;
  }


  if (!licenseNumber) {

    showMessage(
      "Please enter your driving licence number."
    );

    return;
  }


  // ==========================================================
  // START
  // ==========================================================

  setLoading(true);

  try {

    // --------------------------------------------------------
    // CREATE FIREBASE AUTH ACCOUNT
    // --------------------------------------------------------

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user =
      credential.user;

    const uid =
      user.uid;


    // ========================================================
    // RIDER APPLICATION DATA
    // ========================================================

    const riderData = {

      uid: uid,

      userId: uid,

      riderId: uid,

      name: name,

      fullName: name,

      displayName: name,

      email: email,

      phone: phone,

      mobile: phone,

      phoneNumber: phone,

      dob: dob || "",

      dateOfBirth: dob || "",

      address: address || "",

      city: city,

      vehicleType: vehicleType,

      vehicle: vehicleType,

      vehicleNumber: vehicleNumber,

      vehicleModel: vehicleModel || "",

      bikeModel: vehicleModel || "",

      licenseNumber: licenseNumber,

      drivingLicense: licenseNumber,

      // ------------------------------------------------------
      // ADMIN APPROVAL
      // ------------------------------------------------------

      role: "rider",

      userType: "rider",

      type: "rider",

      status: "pending",

      approvalStatus: "pending",

      riderStatus: "pending",

      verificationStatus: "pending",

      accountStatus: "pending",

      approved: false,

      isApproved: false,

      adminApproved: false,

      online: false,

      isOnline: false,

      applicationSubmitted: true,

      registrationCompleted: true,

      documentsSubmitted:
        !!(
          licenseFile ||
          vehicleFile
        ),

      documentsUploaded:
        !!(
          licenseFile ||
          vehicleFile
        ),

      // ------------------------------------------------------
      // SECURITY / TIMESTAMPS
      // ------------------------------------------------------

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      submittedAt:
        serverTimestamp()
    };


    // ========================================================
    // CREATE USERS DOCUMENT
    // ========================================================

    await setDoc(
      doc(db, "users", uid),
      riderData,
      {
        merge: true
      }
    );


    // ========================================================
    // CREATE RIDERS DOCUMENT
    // ========================================================

    await setDoc(
      doc(db, "riders", uid),
      {
        ...riderData,

        riderProfile: {
          name: name,
          phone: phone,
          email: email
        }
      },
      {
        merge: true
      }
    );


    // ========================================================
    // SUCCESS
    // ========================================================

    showMessage(
      "Registration successful. Your application has been sent to RiderX Admin for approval.",
      "success"
    );


    // --------------------------------------------------------
    // Redirect to pending page
    // --------------------------------------------------------

    setTimeout(
      () => {

        window.location.replace(
          "pending.html"
        );

      },
      800
    );


  } catch (error) {

    console.error(
      "Rider registration error:",
      error
    );


    showMessage(
      firebaseErrorMessage(error)
    );


    setLoading(false);
  }
}


// ============================================================
// ATTACH FORM
// ============================================================

if (registerForm) {

  registerForm.addEventListener(
    "submit",
    registerRider
  );

}


// ============================================================
// ATTACH BUTTON
// ============================================================

if (
  submitButton &&
  !registerForm
) {

  submitButton.addEventListener(
    "click",
    registerRider
  );

}


// ============================================================
// GLOBAL FUNCTION
// ============================================================

window.registerRider =
  registerRider;


// ============================================================
// DEBUG
// ============================================================

console.log(
  "RiderX Rider Registration loaded successfully."
);
