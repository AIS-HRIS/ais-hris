'use client';
import {useEffect,useState} from 'react';
import {getBaseline,saveBaseline} from '../models/baseline';
export function useBaseline(empId){
 const [baseline,setBaseline]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const load=async()=>{setLoading(true);setBaseline(null);try{const record=await getBaseline(empId);if(alive){setBaseline(record);setError('');}}catch(e){if(alive)setError(e.message);}finally{if(alive)setLoading(false);}};load();const changed=e=>{if(e.detail?.empId===empId)load();};window.addEventListener('ais:baseline',changed);return()=>{alive=false;window.removeEventListener('ais:baseline',changed);};},[empId]);
 async function enroll(capture){const record=await saveBaseline(empId,capture);setBaseline(record);setError('');return record;}
 return {baseline,loading,error,enroll};
}
