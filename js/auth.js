// =========================================
// RiderX Authentication System
// Firebase Compat Version
// =========================================


console.log("RiderX Auth Loaded");


// -----------------------------
// Toast Message
// -----------------------------

function showToast(message, type="info") {

    alert(message);

}


// -----------------------------
// Loader
// -----------------------------

function showLoader(){
    console.log("Loading...");
}

function hideLoader(){
    console.log("Loading Complete");
}


// -----------------------------
// Register User
// -----------------------------

async function registerUserAccount(data){

    try{

        const {
            role,
            fullName,
            mobileNumber,
            email,
            password
        } = data;


        showLoader();


        const result = await firebase
        .auth()
        .createUserWithEmailAndPassword(
            email,
            password
        );


        const user = result.user;


        await user.updateProfile({
            displayName: fullName
        });



        const userData = {

            uid:user.uid,
            name:fullName,
            mobile:mobileNumber,
            email:email,
            role:role,
            status: role==="rider" ? "Pending" : "Active",
            adminApproved: role==="rider" ? false : true,
            createdAt:
            firebase.firestore.FieldValue.serverTimestamp()

        };



        if(role==="rider"){

            await firebase.firestore()
            .collection("riders")
            .doc(user.uid)
            .set(userData);


            showToast(
            "Rider application submitted. Waiting for approval"
            );


            setTimeout(()=>{
                window.location.href="../rider/pending.html";
            },1500);


        }

        else{


            await firebase.firestore()
            .collection("customers")
            .doc(user.uid)
            .set(userData);



            showToast(
            "Account created successfully"
            );


            setTimeout(()=>{
                window.location.href="../customer/Home.html";
            },1500);

        }


    }
    catch(error){

        console.log(error);

        showToast(error.message);

    }
    finally{

        hideLoader();

    }

}



// -----------------------------
// Login User
// -----------------------------

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

window.location.href="../customer/Home.html";
return;

}



const rider =
await firebase.firestore()
.collection("riders")
.doc(uid)
.get();



if(rider.exists){


if(rider.data().adminApproved){

window.location.href="../rider/Home.html";

}
else{

window.location.href="../rider/pending.html";

}

return;

}



window.location.href="../auth/register.html";



}
catch(error){

showToast(error.message);

}



}



// -----------------------------
// Google Login
// -----------------------------

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
name:user.displayName,
email:user.email,
role:"customer",
createdAt:
firebase.firestore.FieldValue.serverTimestamp()

},{merge:true});



window.location.href="../customer/Home.html";


}
catch(error){

showToast(error.message);

}


}


// -----------------------------
// Password Toggle
// -----------------------------

function togglePasswordVisibility(id,icon){

const input=document.getElementById(id);


if(input.type==="password"){

input.type="text";

}
else{

input.type="password";

}

}


// Export Global Functions

window.registerUserAccount =
registerUserAccount;


window.loginUser =
loginUser;


window.handleGoogleSignUp =
handleGoogleSignUp;


window.togglePasswordVisibility =
togglePasswordVisibility;
