// =====================================
// RiderX App Loader
// =====================================

window.addEventListener("load", () => {

    const splash = document.getElementById("splash");
    const app = document.getElementById("app");

    // 3 Second Splash Screen

    setTimeout(() => {

        splash.style.opacity = "0";
        splash.style.transition = "0.8s";

        setTimeout(() => {

            splash.style.display = "none";

            app.style.display = "block";

            app.style.opacity = "0";

            setTimeout(() => {

                app.style.transition = "0.6s";
                app.style.opacity = "1";

            }, 100);

        }, 800);

    }, 3000);

});


// =====================================
// Disable Right Click
// =====================================

document.addEventListener("contextmenu", (e) => {

    e.preventDefault();

});


// =====================================
// Network Status
// =====================================

window.addEventListener("online", () => {

    console.log("Internet Connected");

});

window.addEventListener("offline", () => {

    alert("No Internet Connection");

});


// =====================================
// Service Worker
// =====================================

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("sw.js")
            .then(() => {

                console.log("Service Worker Registered");

            })
            .catch((err) => {

                console.log(err);

            });

    });

}


// =====================================
// App Ready
// =====================================

console.log("==================================");
console.log(" RiderX Mobile App Loaded ");
console.log(" Splash Animation Ready ");
console.log(" Professional UI Enabled ");
console.log("==================================");
