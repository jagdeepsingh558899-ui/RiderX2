// =================================
// RiderX OTP System
// =================================



// Generate OTP


export function generateOTP(){


let otp = Math.floor(

100000 + Math.random() * 900000

);



return otp.toString();


}





// Verify OTP


export function verifyOTP(

enteredOTP,

realOTP

){


if(

enteredOTP === realOTP

){


return true;


}



return false;


}
