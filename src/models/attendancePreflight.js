import {getBaseline} from './baseline.js';

export const CLOCK_TOLERANCE_SECONDS=120;
export async function withAttendanceDeadline(task,ms,message){
 let timer;
 try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}
 finally{clearTimeout(timer);}
}

// HTTPS response time is a demo clock reference, not a server-side attendance record.
export async function validateDeviceTime({fetcher=globalThis.fetch,href=globalThis.location?.href,now=Date.now,timeoutMs=8000}={}){
 const controller=new AbortController();
 try{
  const url=new URL('manifest.webmanifest',href);url.searchParams.set('ais_time',String(now()));
  const start=now();
  const response=await withAttendanceDeadline(()=>fetcher(url.href,{method:'HEAD',cache:'no-store',signal:controller.signal}),timeoutMs,'Pemeriksaan waktu melewati batas tunggu.');
  if(!response.ok)return {ok:null,serverTime:null,driftSec:0};
  const date=Date.parse(response.headers.get('date'));
  const age=Number(response.headers.get('age')||0),end=now();
  if(!Number.isFinite(date)||!Number.isFinite(age)||age<0)return {ok:null,serverTime:null,driftSec:0};
  const serverTime=date+age*1000+Math.max(0,end-start)/2;
  const driftSec=Math.abs(end-serverTime)/1000;
  return {ok:driftSec<=CLOCK_TOLERANCE_SECONDS,serverTime,driftSec,measuredAt:globalThis.performance?.now()??null};
 }catch{return {ok:null,serverTime:null,driftSec:0};}
 finally{controller.abort();}
}

export async function prepareAttendance(employeeId,{loadBaseline=getBaseline,checkTime=validateDeviceTime,onStage=()=>{},timeoutMs=10000}={}){
 if(!employeeId)throw Error('Identitas attendance belum siap. Masuk kembali ke akun Anda.');
 onStage('baseline');
 const baseline=await withAttendanceDeadline(()=>loadBaseline(employeeId),timeoutMs,'Pemeriksaan baseline terlalu lama. Tutup tab AIS lain, lalu coba lagi.');
 if(!baseline)throw Error('Daftarkan foto baseline sebelum melakukan attendance.');
 onStage('time');
 const time=await withAttendanceDeadline(()=>checkTime(),timeoutMs,'Pemeriksaan waktu terlalu lama. Periksa koneksi dan coba lagi.');
 if(time?.ok===false){const difference=time.driftSec>=60?`${Math.round(time.driftSec/60)} menit`:`${Math.round(time.driftSec)} detik`;throw Error(`Absen ditolak — jam perangkat menyimpang ${difference}. Aktifkan waktu otomatis di perangkat, lalu coba lagi.`);}
 if(time?.ok!==true)throw Error('Waktu jaringan belum dapat diverifikasi. Pastikan internet aktif, lalu tekan clock-in kembali.');
 return time;
}
