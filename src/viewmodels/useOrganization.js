'use client';
import {useEffect,useMemo,useState} from 'react';
import {ORGANIZATION_KEY,createOrganization,normalizeOrganization,projectOrganization,changeOrganization,organizationAccess} from '../models/organization';
import {read,write,audit,employees as defaults,stores as defaultStores} from '../models/workspace';
export function useOrganization(account){
 const [version,setVersion]=useState(0),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setReady(true);const refresh=()=>setVersion(v=>v+1);window.addEventListener('ais:data',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('ais:data',refresh);window.removeEventListener('storage',refresh);};},[]);
 const state=useMemo(()=>{if(!ready)return null;const employees=read('ais-employees',defaults);const org=normalizeOrganization(read(ORGANIZATION_KEY,null)||createOrganization(employees));return {org,employees,view:projectOrganization(org,account,employees)};},[ready,account,version]);
 function save(action){setError('');try{if(organizationAccess(account)!=='manage')throw Error('Akses kelola struktur tidak tersedia.');const employees=read('ais-employees',defaults),current=normalizeOrganization(read(ORGANIZATION_KEY,null)||createOrganization(employees));if(current.revision!==state.org.revision)throw Error('Struktur telah diperbarui di tab lain. Muat ulang tampilan dan coba kembali.');const next=changeOrganization(current,action,account,employees,read('ais-stores',defaultStores));write(ORGANIZATION_KEY,next);audit(account,'Struktur perusahaan diperbarui',`${action.kind} · revisi ${next.revision}`);return true;}catch(e){setError(e.message);return false;}}
 return {ready,state,view:state?.view,error,save,clearError:()=>setError('')};
}
