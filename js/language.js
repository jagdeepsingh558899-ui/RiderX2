// RiderX Language System
// English + Hindi

const translations = {

en: {

home:"Home",
booking:"Booking",
history:"History",
wallet:"Wallet",
profile:"Profile",
settings:"Settings",
language:"Language",

bookRide:"Book Ride",
bikeTaxi:"Bike Taxi",
cab:"Cab",
parcel:"Parcel",
food:"Food Delivery",

balance:"Wallet Balance",
addMoney:"Add Money",

save:"Save",
logout:"Logout",

install:"Install RiderX App",

darkMode:"Dark Mode",

notifications:"Notifications",

welcome:"Welcome to RiderX"

},


hi: {

home:"होम",
booking:"बुकिंग",
history:"इतिहास",
wallet:"वॉलेट",
profile:"प्रोफाइल",
settings:"सेटिंग्स",
language:"भाषा",

bookRide:"राइड बुक करें",
bikeTaxi:"बाइक टैक्सी",
cab:"कैब",
parcel:"पार्सल",
food:"फूड डिलीवरी",

balance:"वॉलेट बैलेंस",
addMoney:"पैसे जोड़ें",

save:"सेव करें",
logout:"लॉगआउट",

install:"RiderX ऐप इंस्टॉल करें",

darkMode:"डार्क मोड",

notifications:"सूचनाएं",

welcome:"RiderX में आपका स्वागत है"

}

};





function setLanguage(lang){


localStorage.setItem(
"riderx_language",
lang
);


applyLanguage();


}




function applyLanguage(){


let lang =
localStorage.getItem(
"riderx_language"
) || "en";



document.querySelectorAll(
"[data-lang]"
)
.forEach((element)=>{


let key =
element.getAttribute(
"data-lang"
);



if(translations[lang][key]){

element.innerText =
translations[lang][key];

}


});



let selector =
document.getElementById(
"language"
);


if(selector){

selector.value=lang;

}



}





document.addEventListener(
"DOMContentLoaded",
()=>{


applyLanguage();



let selector =
document.getElementById(
"language"
);



if(selector){


selector.addEventListener(
"change",
()=>{


setLanguage(
selector.value
);


alert(
selector.value==="hi"
?
"हिंदी भाषा चालू हो गई"
:
"English language activated"
);


});


}



});
``
