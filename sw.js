// ==========================================
// RiderX Service Worker V2
// PWA + Cache System
// ==========================================


const CACHE_NAME = "riderx-v2";



const FILES_TO_CACHE = [


"/",

"/index.html",

"/manifest.json",



"/css/style.css",



"/assets/logo.png",



"/auth/login.html",

"/auth/register.html",



"/customer/Home.html",

"/customer/booking.html",

"/customer/map.html",

"/customer/History.html",



"/rider/Home.html",

"/rider/History.html",



"/js/App.js",

"/js/booking.js",

"/js/Map.js",

"/js/Chat.js",

"/js/History.js",

"/js/RiderHistory.js",



];








// INSTALL


self.addEventListener(

"install",

event=>{


event.waitUntil(


caches.open(CACHE_NAME)

.then(cache=>{


return cache.addAll(

FILES_TO_CACHE

);


})


);


self.skipWaiting();


}

);









// ACTIVATE


self.addEventListener(

"activate",

event=>{


event.waitUntil(


caches.keys()

.then(keys=>{


return Promise.all(


keys.map(key=>{


if(

key!==CACHE_NAME

){


return caches.delete(key);


}


})


);


})


);



self.clients.claim();


}

);









// FETCH


self.addEventListener(

"fetch",

event=>{


event.respondWith(


caches.match(

event.request

)

.then(response=>{


return response || fetch(event.request);


})


);



}

);
