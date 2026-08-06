// =========================================
// RiderX Authentication System
// Firebase Compat Version
// =========================================

console.log("RiderX Auth Loaded");


// Toast
function showToast(message, type = "info") {
    alert(message);
}


// Loader
function showLoader() {
    console.log("RiderX Loading...");
}

function hideLoader() {
    console.log("RiderX Loaded");
}


// Password Toggle
function togglePasswordVisibility(id, icon) {

    const input = document.getElementById(id);

    if (!input) return;

    if (input.type === "password") {
        input.type = "text";

        if(icon){
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }

    } else {

        input.type = "password";

        if(icon){
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }
}


// Register Customer / Rider
async function registerUserAccount(data){

    try {

        showLoader();

        const {
            role,
            fullName,
            mobileNumber,
            email,
            password
        } = data;


        const userCredential =
        await firebase.auth()
        .createUserWithEmailAndPassword(
            email,
            password
        );


        const user = userCredential.user;


        await user.updateProfile({
            displayName: fullName
        });



        const userData = {

            uid:user.uid,

            fullName:fullName,

            mobileNumber:mobileNumber,

            email:email,

            role:role,

            createdAt:
            firebase.firestore.FieldValue.serverTimestamp()

        };



        if(role === "rider"){


            userData.status="Pending";
            userData.adminApproved=false;


            await firebase.firestore()
            .collection("riders")
            .doc(user.uid)
            .set(userData);



            showToast(
            "Rider registration completed. Waiting for approval"
            );


            setTimeout(()=>{

                window.location.href =
                "../rider/pending.html";

            },1500);



        } else {


            userData.status="Active";


            await firebase.firestore()
            .collection("customers")
            .doc(user.uid)
            .set(userData);



            showToast(
            "Customer account created successfully"
            );


            setTimeout(()=>{

                window.location.href =
                "../customer/home.html";

            },1500);

        }


    }

    catch(error){

        console.error(error);

        showToast(error.message);

    }

    finally{

        hideLoader();

    }

}



// Login
async function loginUser(email,password){

    try{


        const result =
        await firebase.auth()
        .signInWithEmailAndPassword(
            email,
            password
        );


        const uid=result.user.uid;



        const customer =
        await firebase.firestore()
        .collection("customers")
        .doc(uid)
        .get();



        if(customer.exists){

            window.location.href =
            "../customer/home.html";

            return;
        }




        const rider =
        await firebase.firestore()
        .collection("riders")
        .doc(uid)
        .get();



        if(rider.exists){


            const data=rider.data();


            if(data.adminApproved){

                window.location.href =
                "../rider/Home.html";

            }
            else{

                window.location.href =
                "../rider/pending.html";

            }

            return;

        }



        window.location.href =
        "../auth/register.html";


    }

    catch(error){

        showToast(error.message);

    }

}



// Google Login

async function handleGoogleSignUp(){

    try{


        const provider =
        new firebase.auth.GoogleAuthProvider();



        const result =
        await firebase.auth()
        .signInWithPopup(provider);



        const user=result.user;



        await firebase.firestore()
        .collection("customers")
        .doc(user.uid)
        .set({

            uid:user.uid,

            fullName:
            user.displayName || "Customer",

            email:user.email,

            role:"customer",

            createdAt:
            firebase.firestore.FieldValue.serverTimestamp()


        },
        {merge:true});



        window.location.href =
        "../customer/Home.html";


    }

    catch(error){

        showToast(error.message);

    }

}



// OTP

let confirmationResult = null;


function openPhoneOTPModal(){

    document.getElementById("otpModal").style.display="flex";


    window.recaptchaVerifier =
    new firebase.auth.RecaptchaVerifier(
        "recaptcha-container",
        {
            size:"invisible"
        }
    );

}



async function requestOTP(){

    const phone =
    document.getElementById("otpPhoneNumber").value;



    try{


        confirmationResult =
        await firebase.auth()
        .signInWithPhoneNumber(
            phone,
            window.recaptchaVerifier
        );



        document.getElementById("otpInputGroup")
        .style.display="block";


        document.getElementById("sendOtpBtn")
        .style.display="none";


        document.getElementById("verifyOtpBtn")
        .style.display="block";


        showToast("OTP sent");


    }

    catch(error){

        showToast(error.message);

    }

}



async function verifyOTP(){

    const code =
    document.getElementById("otpCode").value;


    try{

        await confirmationResult.confirm(code);


        window.location.href =
        "../customer/Home.html";


    }

    catch(error){

        showToast(error.message);

    }

}



// Close OTP

function closePhoneOTPModal(){

    document.getElementById("otpModal")
    .style.display="none";

}



// Make Functions Global

window.registerUserAccount = registerUserAccount;

window.loginUser = loginUser;

window.handleGoogleSignUp = handleGoogleSignUp;

window.openPhoneOTPModal = openPhoneOTPModal;

window.requestOTP = requestOTP;

window.verifyOTP = verifyOTP;

window.closePhoneOTPModal = closePhoneOTPModal;

window.togglePasswordVisibility =
togglePasswordVisibility;
