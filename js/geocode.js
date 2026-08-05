// =================================
// RiderX Address To Location
// =================================


export async function getCoordinates(address){


try{


let url =

"https://nominatim.openstreetmap.org/search?format=json&q="

+

encodeURIComponent(address);



let response = await fetch(url);



let data = await response.json();



if(data.length > 0){


return {


lat:Number(data[0].lat),


lng:Number(data[0].lon)


};


}



return null;


}

catch(error){


console.log(error);


return null;


}


}
