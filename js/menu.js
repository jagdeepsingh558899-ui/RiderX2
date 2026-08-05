// =================================
// RiderX Menu System
// =================================



// Mobile Menu Toggle


export function toggleMenu(){


let menu = document.getElementById("menu");


if(!menu){

return;

}



if(menu.style.display==="block"){


menu.style.display="none";


}

else{


menu.style.display="block";


}


}






// Logout Menu


export function logoutMenu(){


localStorage.clear();


window.location.href="../index.html";


}
