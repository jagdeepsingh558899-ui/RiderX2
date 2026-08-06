// =================================
// RiderX Service Worker
// =================================


const CACHE_NAME = "riderx-v2";


const FILES_TO_CACHE = [

"/",

"index.html",

"manifest.json",

"assets/logo.png",

"css/style.css",

"auth/login.html",

"auth/register.html",

"auth/role.html",

"customer/home.html",

"customer/booking.html",

"customer/map.html",

"customer/dashboard.html",

"rider/dashboard.html"

];




// Install

self.addEventListener(
"install",
(event)=>{


self.skipWaiting();


event.waitUntil(

caches.open(CACHE_NAME)

.then(cache=>{

return cache.addAll(FILES_TO_CACHE);

})

);


});




// Activate

self.addEventListener(
"activate",
(event)=>{


event.waitUntil(

caches.keys()

.then(keys=>{


return Promise.all(

keys.map(key=>{


if(key!==CACHE_NAME){

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
(event)=>{


event.respondWith(

fetch(event.request)

.catch(()=>{

return caches.match(event.request);

})

);


});
