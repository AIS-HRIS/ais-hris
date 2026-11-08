const DB_NAME = 'ais-identity-photos';
const STORE_NAME = 'baselines';
export function validBaseline(record, employeeId) {
  return Boolean(record && record.empId === employeeId && record.id && record.source === 'front-camera' && record.photo instanceof Blob && record.photo.type === 'image/jpeg' && record.photo.size > 0 && record.photo.size <= 2*1024*1024 && record.width >= 240 && record.height >= 240);
}
export function assertAttendanceBaseline(record, baseline) {
  if (!validBaseline(baseline, record.empId)) throw new Error('Daftarkan foto baseline Anda sebelum melakukan attendance.');
  return { ...record, baselineId: baseline.id, baselineVersion: baseline.version, baselineCapturedAt: baseline.createdAt };
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'empId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Penyimpanan foto tidak tersedia. Izinkan penyimpanan situs lalu coba kembali.'));
    request.onblocked = () => reject(new Error('Tutup tab AIS lain lalu coba kembali.'));
  });
}
export async function getBaseline(empId) {
  if (!empId) return null;
  const db = await openDB();
  try { return await new Promise((resolve,reject) => { const req=db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).get(empId);req.onsuccess=()=>resolve(validBaseline(req.result,empId)?req.result:null);req.onerror=()=>reject(req.error); }); }
  finally { db.close(); }
}
export async function saveBaseline(empId,capture) {
  const record={...capture,empId,id:crypto.randomUUID(),version:1,createdAt:new Date().toISOString(),source:'front-camera'};
  if(!validBaseline(record,empId)) throw new Error('Foto belum siap. Ambil foto baru dari kamera depan.');
  if(record.photo.size>2*1024*1024) throw new Error('Foto terlalu besar. Ambil ulang foto.');
  const db=await openDB();
  let enrolled=record,changed=false;
  try { await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite'),store=tx.objectStore(STORE_NAME),existing=store.get(empId);existing.onsuccess=()=>{if(validBaseline(existing.result,empId)){enrolled=existing.result;}else{store.put(record);changed=true;}};tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('Foto belum tersimpan. Periksa ruang penyimpanan perangkat.'));tx.onabort=()=>reject(new Error('Penyimpanan foto dibatalkan.'));}); }
  finally {db.close();}
  if(changed)window.dispatchEvent(new CustomEvent('ais:baseline',{detail:{empId}}));
  return enrolled;
}
