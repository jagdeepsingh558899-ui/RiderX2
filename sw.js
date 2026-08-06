/* =========================================
   RiderX Service Worker
   Final Cache Version
========================================= */


const CACHE_NAME = "riderx-v2";



const FILES_TO_CACHE = [


"/",

"/index.html",

"/manifest.json",


"/css/Style.css",

"/css/Responsive.css",

"/css/Animation.css",


"/assets/logo.png"


];






// Install


self.addEventListener(

"install",

(event)=>{


event.waitUntil(


caches.open(CACHE_NAME)

.then((cache)=>{


return cache.addAll(FILES_TO_CACHE);


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

.then((cacheNames)=>{


return Promise.all(


cacheNames.map((cache)=>{


if(cache !== CACHE_NAME){


return caches.delete(cache);


}



})


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


fetch(event.request)

.then((response)=>{


return response;


})

.catch(()=>{


return caches.match(event.request);


})


);



}

);
