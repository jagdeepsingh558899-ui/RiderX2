// ==========================================
// RiderX Service Worker V1
// PWA Cache + Fast Loading
// ==========================================


const CACHE_NAME = "riderx-v1";


const FILES_TO_CACHE = [

"/",

"/index.html",

"/manifest.json",


"/css/style.css",


"/assets/logo.png",

"/assets/icon-192.png",

"/assets/icon-512.png",


"/auth/login.html",

"/auth/register.html",


"/customer/Home.html",

"/customer/Booking.html",

"/customer/Profile.html",

"/customer/Settings.html",


"/rider/Home.html",

"/rider/Profile.html",

"/rider/Settings.html"

];








// INSTALL


self.addEventListener(

"install",

(event)=>{


event.waitUntil(

caches.open(CACHE_NAME)

.then(

(cache)=>{


return cache.addAll(

FILES_TO_CACHE

);


}

)

);


self.skipWaiting();


}

);









// ACTIVATE


self.addEventListener(

"activate",

(event)=>{


event.waitUntil(

caches.keys()

.then(

(keys)=>{


return Promise.all(

keys.map(

(key)=>{


if(

key !== CACHE_NAME

){


return caches.delete(key);


}


}

)

);


}

)

);


self.clients.claim();


}

);









// FETCH


self.addEventListener(

"fetch",

(event)=>{


event.respondWith(


caches.match(

event.request

)

.then(

(response)=>{


return response ||

fetch(event.request);


}

)


);


}

);
