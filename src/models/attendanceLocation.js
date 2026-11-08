export function readAttendanceLocation(geolocation=globalThis.navigator?.geolocation) {
 return new Promise((resolve,reject)=>{
  if(!geolocation?.getCurrentPosition){reject(new Error('GPS tidak tersedia. Buka aplikasi pada browser yang mendukung lokasi.'));return;}
  geolocation.getCurrentPosition(position=>{
   const {latitude,longitude,accuracy}=position.coords||{};
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){reject(new Error('Koordinat GPS belum valid. Coba kembali di area terbuka.'));return;}
   resolve({lat:latitude,lng:longitude,accuracy:Number.isFinite(accuracy)?accuracy:null,simulated:false});
  },error=>reject(new Error(error?.code===1?'Izin lokasi belum diberikan. Aktifkan akses lokasi untuk melakukan attendance.':error?.code===3?'GPS belum mendapatkan lokasi. Coba kembali di area terbuka.':'Lokasi belum dapat diperoleh. Periksa GPS dan coba kembali.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 });
}
