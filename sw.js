// =================================
// RiderX Service Worker
// =================================


const CACHE_NAME = "riderx-v1";


const FILES_TO_CACHE = [

"index.html",

"manifest.json",

"assets/logo.svg",

"css/style.css",

"auth/login.html",

"auth/register.html",

"customer/dashboard.html",

"customer/booking.html",

"customer/history.html",

"customer/profile.html",

"rider/dashboard.html",

"rider/requests.html",

"rider/earnings.html",

"rider/profile.html"

];



// Install

self.addEventListener("install", (event)=>{


event.waitUntil(

caches.open(CACHE_NAME)

.then(cache=>{

return cache.addAll(FILES_TO_CACHE);

})

);


});




// Activate

self.addEventListener("activate",(event)=>{


event.waitUntil(

caches.keys().then(keys=>{

return Promise.all(

keys.map(key=>{

if(key!==CACHE_NAME){

return caches.delete(key);

}

})

);

})

);


});





// Fetch

self.addEventListener("fetch",(event)=>{


event.respondWith(

caches.match(event.request)

.then(response=>{

return response || fetch(event.request);

})

);


});
