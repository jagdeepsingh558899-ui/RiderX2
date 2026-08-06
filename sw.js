//
// =====================================
// RiderX Premium Service Worker
// PWA Offline + Cache System
// =====================================
//


const CACHE_NAME = "riderx-v1";



const FILES_TO_CACHE = [


"/",

"/index.html",

"/manifest.json",



"/css/Style.css",

"/css/Responsive.css",

"/css/Animation.css",



"/assets/logo.png",



"/auth/login.html",

"/auth/register.html",



"/customer/booking.html",

"/customer/profile.html",

"/customer/wallet.html",

"/customer/history.html",



"/rider/profile.html",

"/rider/wallet.html"



];








// Install


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


})



);


self.skipWaiting();



}

);








// Activate


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


})



);



self.clients.claim();


}

);








// Fetch


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

fetch(

event.request

);



})


);



}

);
