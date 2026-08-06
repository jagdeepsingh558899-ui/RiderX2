// =================================
// RiderX Service Worker
// Fast App Loading + Cache
// =================================


const CACHE_NAME = "riderx-v1";


const FILES_TO_CACHE = [

    "/",

    "/index.html",

    "/manifest.json",


    "/assets/logo.png",


    "/css/Style.css",

    "/css/Responsive.css",

    "/css/Dashboard.css",

    "/css/Auth.css",

    "/css/Animation.css",


    "/auth/login.html",

    "/auth/register.html",


    "/customer/home.html",

    "/customer/booking.html",

    "/customer/profile.html",


    "/rider/home.html",

    "/rider/rides.html",

    "/rider/profile.html",


    "/admin/dashboard.html"

];





// Install

self.addEventListener(
"install",
event=>{


event.waitUntil(

caches.open(CACHE_NAME)

.then(cache=>{


return cache.addAll(FILES_TO_CACHE);


})

);


self.skipWaiting();


});







// Activate

self.addEventListener(
"activate",
event=>{


event.waitUntil(

caches.keys()

.then(keys=>{


return Promise.all(

keys.map(key=>{


if(key !== CACHE_NAME){


return caches.delete(key);


}


})


);


})

);


self.clients.claim();


});








// Fetch

self.addEventListener(
"fetch",
event=>{


event.respondWith(

caches.match(event.request)

.then(response=>{


return response || fetch(event.request);


})


);


});








// Push Notification Ready

self.addEventListener(
"push",
event=>{


let data={

title:"RiderX",

body:"New ride notification"

};



if(event.data){

data=event.data.json();

}



event.waitUntil(

self.registration.showNotification(

data.title,

{

body:data.body,

icon:"assets/logo.png",

badge:"assets/logo.png"

}

)

);


});
