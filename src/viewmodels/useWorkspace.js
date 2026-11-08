'use client';
import { useEffect, useMemo, useState } from 'react';
import { sidikJariPerangkat, labelPerangkat, perluKunciPerangkat } from '../models/referenceData';
import { accounts, audit, dateKey, demoPassword, employees, installStorage, navigation, read, stores, write } from '../models/workspace';
export function useWorkspace() {
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(max-width: 767px)');const sync=()=>setIsMobile(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
  const [ready,setReady]=useState(false),[account,setAccount]=useState(null),[page,setPage]=useState('home'),[version,setVersion]=useState(0),[query,setQuery]=useState(''),[branch,setBranch]=useState('all'),[period,setPeriod]=useState('week'),[online,setOnline]=useState(true),[toast,setToast]=useState(''),[installPrompt,setInstallPrompt]=useState(null);
  useEffect(()=>{ installStorage(); try { const session=JSON.parse(sessionStorage.getItem('ais-session')); if(session && Date.now()-session.at < 8*3600*1000) {const restored=accounts.find(a=>a.id===session.id)||null;setAccount(restored);if(restored?.admin&&!window.matchMedia('(max-width: 767px)').matches)setPage('insights');} }catch{} setReady(true); setOnline(navigator.onLine);
    const refresh=()=>setVersion(v=>v+1), on=()=>setOnline(navigator.onLine), prompt=e=>{e.preventDefault();setInstallPrompt(e);};
    const signout=()=>{sessionStorage.removeItem('ais-session');setAccount(null);setPage('home');};window.addEventListener('ais:logout',signout);window.addEventListener('ais:data',refresh);window.addEventListener('storage',refresh);window.addEventListener('online',on);window.addEventListener('offline',on);window.addEventListener('beforeinstallprompt',prompt);
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    return()=>{window.removeEventListener('ais:logout',signout);window.removeEventListener('ais:data',refresh);window.removeEventListener('storage',refresh);window.removeEventListener('online',on);window.removeEventListener('offline',on);window.removeEventListener('beforeinstallprompt',prompt);};
  },[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);}},[toast]);
  const groups=useMemo(()=>account?navigation(account):[],[account]);
  const items=groups.flatMap(g=>g.items);
  function go(id){ if(!items.some(i=>i.id===id)) return setToast('Modul ini tidak tersedia untuk akun Anda.'); setPage(id);setQuery(''); }
  function login(nik,password) { const found=accounts.find(a=>a.nik===nik.trim()); if(!found || password!==demoPassword) throw Error('NIK atau password tidak sesuai.'); const master = read('ais-employees',employees).find(e=>e.id===found.id); if(!master || master.status==='nonaktif') throw Error('Akun tidak aktif. Hubungi admin.');
    if(perluKunciPerangkat(found)){ const binding=read('ais-device-binding',{}); const deviceId=sidikJariPerangkat(); if(binding[found.id] && binding[found.id].deviceId!==deviceId) throw Error('Akun terikat ke perangkat demo lain. Minta admin mereset perangkat.'); if(!binding[found.id])write('ais-device-binding',{...binding,[found.id]:{deviceId,label:labelPerangkat(),boundAt:new Date().toISOString()}}); } sessionStorage.setItem('ais-session',JSON.stringify({id:found.id,at:Date.now()}));setAccount(found);setPage(found.admin&&!isMobile?'insights':'home');audit(found,'Masuk ke workspace','Sesi demo'); }
  function logout(){audit(account,'Keluar dari workspace','Sesi demo');sessionStorage.removeItem('ais-session');setAccount(null);setPage('home');setBranch('all');}
  const data=useMemo(()=>{
    if(!ready||!account)return null;
    const isSpv=['spv','tl'].includes(account.group), isPersonal=!account.admin;
    const scope=isSpv?(account.stores||[account.store]):isPersonal?[account.store].filter(Boolean):stores.map(s=>s.id);
    const availableStores=stores.filter(s=>scope.includes(s.id));
    const selected=branch==='all'?scope:scope.filter(id=>id===branch);
    const team=read('ais-employees',employees).filter(e=>e.group!=='toko_device' && (isPersonal?e.id===account.id:isSpv||branch!=='all'?(e.stores||[e.store]).some(id=>selected.includes(id)):true));
    const ids=new Set(team.map(e=>e.id));
    const logs=read('ais-attendance-log',[]).filter(r=>ids.has(r.empId));
    const summary=read('ais-attendance-summary',[]).filter(r=>ids.has(r.empId));
    const today=dateKey();
    const checked=new Set(logs.filter(r=>r.date===today && ['in','clock_in'].includes(r.type)).map(r=>r.empId));
    summary.filter(r=>r.date===today && (r.clockIn||r.jamKerja>0||r.status==='hadir')).forEach(r=>checked.add(r.empId));
    const late=summary.filter(r=>r.date===today && (r.telat||r.lateMinutes>0||r.status==='terlambat')).length;
    const requests=read('ais-ijin-kerja',[]).filter(r=>ids.has(r.empId));
    const pending=requests.filter(r=>r.status==='pending');
    const chart=Array.from({length:period==='week'?7:14},(_,i)=>{const date=new Date();date.setDate(date.getDate()-(period==='week'?6:13)+i);const key=dateKey(date);const unique=new Set(logs.filter(r=>r.date===key&&['in','clock_in'].includes(r.type)).map(r=>r.empId));summary.filter(r=>r.date===key&&(r.clockIn||r.jamKerja>0||r.status==='hadir')).forEach(r=>unique.add(r.empId));return {label:date.toLocaleDateString('id-ID',{weekday:'short',timeZone:'Asia/Jakarta'}),date:key,count:unique.size};});
    const contract=team.filter(e=>e.kontrakEnd && e.kontrakEnd>=today && e.kontrakEnd<=dateKey(new Date(Date.now()+30*86400000)));
    return {team,logs,summary,checked:checked.size,late,requests,pending,chart,contract,availableStores,stores:availableStores.filter(s=>selected.includes(s.id)),isPersonal,isSpv,activities:read('ais-workspace-audit',[]).filter(a=>account.admin?.access==='all'||a.actorId===account.id)};
  },[ready,account,version,branch,period]);
  async function install(){if(installPrompt){await installPrompt.prompt();const result=await installPrompt.userChoice;if(result.outcome==='accepted')setToast('AIS People berhasil ditambahkan.');setInstallPrompt(null);}else{setToast('Gunakan menu browser “Install app” atau di Safari: Bagikan → Tambah ke Layar Utama.');}}
  return {isMobile,ready,account,page,groups,items,query,setQuery,branch,setBranch,period,setPeriod,data,online,toast,setToast,go,login,logout,install};
}
