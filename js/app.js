// =====================================
// RiderX App Loader + Auth Redirect
// =====================================


import { auth, db } from "../firebase/config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";



// =====================================
// Splash Screen
// =====================================

window.addEventListener("load", () => {


    const splash = document.getElementById("splash");


    setTimeout(() => {


        if(splash){

            splash.style.opacity="0";
            splash.style.transition="0.8s";


            setTimeout(()=>{

                splash.style.display="none";

                checkUser();


            },800);


        }else{

            checkUser();

        }



    },3000);



});




// =====================================
// Firebase User Check
// =====================================


function checkUser(){


onAuthStateChanged(auth, async(user)=>{


    if(user){


        try{


            const userRef = doc(db,"users",user.uid);

            const userSnap = await getDoc(userRef);



            if(userSnap.exists()){


                const role = userSnap.data().role;



                if(role==="admin"){

                    window.location.href =
                    "admin/dashboard.html";

                }


                else if(role==="rider"){

                    window.location.href =
                    "rider/dashboard.html";

                }


                else{

                    window.location.href =
                    "customer/home.html";

                }


            }

            else{


                window.location.href =
                "auth/role.html";


            }



        }catch(error){


            console.log(
            "Role Check Error:",
            error
            );


            window.location.href =
            "auth/login.html";


        }



    }

    else{


        window.location.href =
        "auth/login.html";


    }



});


}





// =====================================
// Disable Right Click
// =====================================

document.addEventListener(
"contextmenu",
(e)=>{

e.preventDefault();

});




// =====================================
// Network Status
// =====================================


window.addEventListener(
"online",
()=>{

console.log(
"RiderX Internet Connected"
);

});


window.addEventListener(
"offline",
()=>{

alert(
"No Internet Connection"
);

});




// =====================================
// Service Worker
// =====================================


if("serviceWorker" in navigator){


window.addEventListener(
"load",
()=>{


navigator.serviceWorker.register(
"sw.js"
)

.then(()=>{

console.log(
"RiderX Service Worker Active"
);

})


.catch((error)=>{

console.log(
"SW Error",
error
);

});


});


}




console.log(
"RiderX App Loaded"
);
