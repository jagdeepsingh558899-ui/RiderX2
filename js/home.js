// =================================
// RiderX Home System
// =================================



// Check Login Status


export function checkUser(){


let user = localStorage.getItem(

"riderx_user"

);



if(user){


return JSON.parse(user);


}



return null;


}







// Save User Session


export function saveUser(user){


localStorage.setItem(

"riderx_user",

JSON.stringify(user)

);


}






// Welcome Message


export function showWelcome(){


let box = document.getElementById("welcome");


if(!box){

return;

}



let user = checkUser();



if(user){


box.innerHTML =

"Welcome "+user.name;


}



}
