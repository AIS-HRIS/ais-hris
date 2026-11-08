export function readAttendanceLocation(geolocation=globalThis.navigator?.geolocation,{timeoutMs=15000}={}) {
 return new Promise((resolve,reject)=>{
  let timer,settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
  if(!geolocation?.getCurrentPosition){finish(reject,new Error('GPS tidak tersedia. Buka aplikasi pada browser yang mendukung lokasi.'));return;}
  const timeout=()=>finish(reject,new Error('GPS belum mendapatkan lokasi. Pastikan izin lokasi aktif, lalu coba kembali di area terbuka.'));
  timer=setTimeout(timeout,timeoutMs);
  try{geolocation.getCurrentPosition(position=>{
   const {latitude,longitude,accuracy}=position.coords||{};
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){finish(reject,new Error('Koordinat GPS belum valid. Coba kembali di area terbuka.'));return;}
   finish(resolve,{lat:latitude,lng:longitude,accuracy:Number.isFinite(accuracy)?accuracy:null,simulated:false});
  },error=>finish(reject,new Error(error?.code===1?'Izin lokasi belum diberikan. Aktifkan akses lokasi untuk melakukan attendance.':error?.code===3?'GPS belum mendapatkan lokasi. Coba kembali di area terbuka.':'Lokasi belum dapat diperoleh. Periksa GPS dan coba kembali.')),{enableHighAccuracy:true,maximumAge:0,timeout:timeoutMs});}
  catch{finish(reject,new Error('Lokasi belum dapat diperoleh. Periksa GPS dan coba kembali.'));}
 });
}
