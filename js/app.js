// ==========================================
// RiderX PWA Install System V1
// Download / Install App Button
// ==========================================


let deferredPrompt = null;



const installBtn = document.getElementById(
"installApp"
);





window.addEventListener(

"beforeinstallprompt",

(event)=>{


event.preventDefault();


deferredPrompt = event;



if(installBtn){


installBtn.style.display="block";


}



}

);








if(installBtn){


installBtn.onclick=async()=>{



if(!deferredPrompt)

return;



deferredPrompt.prompt();



const result =

await deferredPrompt.userChoice;



if(result.outcome==="accepted"){


console.log(

"RiderX App Installed"

);


}



deferredPrompt=null;



installBtn.style.display="none";



};



}








// REGISTER SERVICE WORKER


if(

"serviceWorker" in navigator

){



window.addEventListener(

"load",

()=>{


navigator.serviceWorker.register(

"/sw.js"

)

.then(()=>{


console.log(

"RiderX Service Worker Active"

);


})

.catch(error=>{


console.log(

"SW Error",

error

);


});



}

);


}





console.log(

"RiderX App System Loaded"

);
