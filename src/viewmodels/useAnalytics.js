'use client';
import {useEffect,useMemo,useState} from 'react';
import {analyzeData,jakartaDate,shiftDate} from '../models/analytics';
import {read,employees,stores} from '../models/workspace';
import {ORGANIZATION_KEY} from '../models/organization';
export function useAnalytics(account){
 const today=jakartaDate(),[range,setRange]=useState('30'),[branch,setBranch]=useState('all'),[sla,setSla]=useState(3),[version,setVersion]=useState(0),[ready,setReady]=useState(false);
 useEffect(()=>{setReady(true);const sync=()=>setVersion(v=>v+1);window.addEventListener('ais:data',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('ais:data',sync);window.removeEventListener('storage',sync);};},[]);
 const data=useMemo(()=>{if(!ready)return null;const source={employees:read('ais-employees',employees),stores:read('ais-stores',stores),attendance:read('ais-attendance-summary',[]),logs:read('ais-attendance-log',[]),schedule:read('ais-schedule',{}),requests:read('ais-ijin-kerja',[]),reports:read('ais-report-log',{}),purchases:read('ais-purchase-reports',[]),opnames:read('ais-stock-opname',[]),approvals:read('ais-approval-queue',[]),organization:read(ORGANIZATION_KEY,null)};return analyzeData({account,source,start:shiftDate(today,1-Number(range)),end:today,branch,today,sla});},[account,range,branch,sla,version,ready,today]);
 return {data,range,setRange,branch,setBranch,sla,setSla,today};
}
