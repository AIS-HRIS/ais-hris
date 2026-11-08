import {ACCESS_MAP} from './referenceData';
import {projectOrganization,createOrganization} from './organization';
export function analyticsPolicy(account){
 const access=ACCESS_MAP[account?.admin?.access]||{};const has=k=>Boolean(access[k]);
 return {approvals:has('laporan_approval'),people:has('absensi_rekap')?'team':'self',contracts:has('karyawan_master')||account?.admin?.access==='admin_utama',requests:has('absensi_ijin')||['spv','tl'].includes(account?.group),operations:['laporan_approval','laporan_produksi','laporan_sales'].some(has),sales:has('laporan_sales'),expenses:has('laporan_pengeluaran'),purchases:has('laporan_pembelian'),inventory:['inventory_ringkasan','laporan_opname','laporan_waste'].some(has),pnl:has('laporan_pnl'),modules:Object.keys(access).filter(has)};
}
export function jakartaDate(value=new Date()){return new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});}
export function shiftDate(date,offset){const d=new Date(`${date}T12:00:00+07:00`);d.setUTCDate(d.getUTCDate()+offset);return jakartaDate(d);}
export function datesBetween(start,end){const days=[];for(let d=start;d<=end&&days.length<366;d=shiftDate(d,1))days.push(d);return days;}
const asDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$)/.test(value)?value.slice(0,10):value&&Number.isFinite(Date.parse(value))?jakartaDate(value):null;
const numeric=value=>typeof value==='number'&&Number.isFinite(value);
const present=r=>Boolean(r.clockIn||r.jamKerja>0||['hadir','terlambat'].includes(r.status));
const arrived=r=>['in','clock_in'].includes(r.type);
const OFF=new Set(['-','O','OFF','off','libur','Libur']);
export function analyzeData({account,source,start,end,branch='all',today=jakartaDate(),sla=3}){
 const policy=analyticsPolicy(account),allEmployees=source.employees.filter(e=>e.group!=='toko_device');
 const storeScope=['spv','tl'].includes(account.group)?account.stores||[account.store].filter(Boolean):account.admin?source.stores.map(s=>s.id):[account.store].filter(Boolean);
 const availableStores=source.stores.filter(s=>storeScope.includes(s.id));const stores=availableStores.filter(s=>branch==='all'||s.id===branch);const storeIds=new Set(stores.map(s=>s.id));
 const employees=allEmployees.filter(e=>(policy.people==='self'?e.id===account.id:['spv','tl'].includes(account.group)?(e.stores||[e.store]).some(id=>storeScope.includes(id)):true)&&(branch==='all'||(e.stores||[e.store]).some(id=>storeIds.has(id))));
 const employeeIds=new Set(employees.map(e=>e.id)),inRange=d=>d&&d>=start&&d<=end;const days=datesBetween(start,end),previousEnd=shiftDate(start,-1),previousStart=shiftDate(start,-days.length);
 const attendanceDays=new Set(),knownLate=new Map();
 source.attendance.forEach(r=>{if(!employeeIds.has(r.empId))return;if(present(r))attendanceDays.add(`${r.empId}_${r.date}`);if(present(r)&&(typeof r.telat==='boolean'||numeric(r.lateMinutes)||numeric(r.telatMenit)))knownLate.set(`${r.empId}_${r.date}`,r.telat===true||r.lateMinutes>0||r.telatMenit>0);});
 source.logs.forEach(r=>{if(employeeIds.has(r.empId)&&arrived(r))attendanceDays.add(`${r.empId}_${r.date}`);});
 const countFor=(a,b)=>[...attendanceDays].filter(key=>{const d=key.slice(-10);return d>=a&&d<=b;}).length;
 const attendance=countFor(start,end),previousAttendance=countFor(previousStart,previousEnd),late=[...knownLate].filter(([key,value])=>inRange(key.slice(-10))&&value).length,classified=[...knownLate.keys()].filter(key=>inRange(key.slice(-10))).length;
 const schedules=Object.entries(source.schedule).map(([key,shift])=>({empId:key.slice(0,-11),date:key.slice(-10),shift})).filter(r=>employeeIds.has(r.empId)&&inRange(r.date)&&r.shift&&!OFF.has(r.shift));
 const pastSchedules=schedules.filter(r=>r.date<today),matchedSchedules=pastSchedules.filter(r=>attendanceDays.has(`${r.empId}_${r.date}`)).length,missingSchedules=pastSchedules.filter(r=>!attendanceDays.has(`${r.empId}_${r.date}`));
 const requestsAll=source.requests.filter(r=>employeeIds.has(r.empId));const requests=requestsAll.filter(r=>inRange(asDate(r.submittedAt)||r.tanggalMulai));const pending=requests.filter(r=>r.status==='pending');const overdue=pending.filter(r=>{const d=asDate(r.submittedAt);return d&&d<=shiftDate(today,-sla);});
 const contract=policy.contracts?employees.filter(e=>e.status!=='nonaktif'&&e.kontrakEnd):[];const expiring=contract.filter(e=>e.kontrakEnd>=today&&e.kontrakEnd<=shiftDate(today,30)),expired=contract.filter(e=>e.kontrakEnd<today);
 const reports=Object.entries(source.reports).map(([key,data])=>({storeId:key.slice(0,-11),date:key.slice(-10),data})).filter(r=>storeIds.has(r.storeId)&&inRange(r.date));
 const operationalReports=policy.operations?reports:[];const opened=operationalReports.filter(r=>r.data.opening?.submittedAt).length,closed=operationalReports.filter(r=>r.data.closing?.submittedAt).length;
 const incomplete=operationalReports.filter(r=>r.date<today&&r.data.opening?.submittedAt&&!r.data.closing?.submittedAt);
 const salesRows=policy.sales?reports.flatMap(r=>['sales_shift1','sales_shift2'].filter(k=>r.data[k]?.submittedAt).map(k=>({...r,stage:r.data[k]}))):[];
 const expenseRows=policy.expenses?reports.flatMap(r=>['sales_shift1','sales_shift2'].filter(k=>r.data[k]?.submittedAt).map(k=>({...r,stage:r.data[k]}))):[];
 const salesValues=salesRows.map(r=>r.stage.omsetKotor).filter(numeric),expenseValues=expenseRows.map(r=>r.stage.pengeluaran).filter(numeric);
 const purchases=policy.purchases?source.purchases.filter(r=>storeIds.has(r.storeId)&&inRange(r.tanggal)):[],purchaseValues=purchases.map(r=>r.total).filter(numeric);
 const opnames=policy.inventory?source.opnames.filter(r=>storeIds.has(r.storeId)&&inRange(r.tanggal)):[],discrepancies=opnames.flatMap(r=>(r.items||[]).filter(i=>numeric(i.aktual)&&numeric(i.tercatat)&&i.aktual!==i.tercatat).map(item=>({...item,storeId:r.storeId,date:r.tanggal})));
 const approvals=policy.approvals?source.approvals.filter(r=>storeIds.has(r.storeId)&&inRange(r.date||asDate(r.requestedAt))):[];
 const org=projectOrganization(source.organization||createOrganization(source.employees),account,source.employees);
 const activeEmployees=employees.filter(e=>e.status!=='nonaktif');
 const orgEmployees=['manage','company','team'].includes(org.access)?activeEmployees:activeEmployees.filter(e=>e.id===account.id||org.employees.some(v=>v.id===e.id));
 const chart=days.map(date=>({date,label:new Date(`${date}T12:00:00+07:00`).toLocaleDateString('id-ID',{day:'numeric',month:'short',timeZone:'Asia/Jakarta'}),count:[...attendanceDays].filter(key=>key.endsWith(`_${date}`)).length}));
 const locationRows=stores.map(s=>{const rows=operationalReports.filter(r=>r.storeId===s.id);const sales=salesRows.filter(r=>r.storeId===s.id).map(r=>r.stage.omsetKotor).filter(numeric);const purchase=purchases.filter(r=>r.storeId===s.id).map(r=>r.total).filter(numeric);return {id:s.id,name:s.name,opening:rows.filter(r=>r.data.opening?.submittedAt).length,closing:rows.filter(r=>r.data.closing?.submittedAt).length,reports:rows.length,sales:sales.length?sales.reduce((n,v)=>n+v,0):null,purchases:purchase.length?purchase.reduce((n,v)=>n+v,0):null};});
 const insights=[];const add=(tone,title,evidence,action,target)=>insights.push({tone,title,evidence,action,target});
 if(expired.length)add('orange','Validasi kontrak yang melewati tanggal akhir',`${expired.length} karyawan aktif memiliki tanggal akhir kontrak sebelum ${today}.`,'Tinjau pembaruan master sebelum menentukan tindak lanjut.','admin:karyawan_master');
 if(expiring.length)add('blue','Siapkan review kontrak mendatang',`${expiring.length} kontrak akan berakhir dalam 30 hari.`,'Jadwalkan review dengan penanggung jawab unit.','admin:karyawan_master');
 if(missingSchedules.length)add('orange','Cocokkan jadwal dengan catatan kehadiran',`${missingSchedules.length} jadwal pada hari yang sudah lewat belum memiliki catatan hadir.`,'Verifikasi izin, koreksi jadwal, dan kelengkapan catatan; belum disimpulkan sebagai alpa.','admin:absensi_rekap');
 if(overdue.length)add('violet','Tinjau antrean pengajuan yang menua',`${overdue.length} pengajuan periode ini menunggu setidaknya ${sla} hari kalender.`,'Minta approver memeriksa permohonan sesuai kewenangan.',policy.requests?'admin:absensi_ijin':'mobile:ijin');
 if(incomplete.length)add('blue','Lengkapi laporan penutupan',`${incomplete.length} laporan hari yang sudah lewat memiliki opening tanpa closing.`,'Hubungi penanggung jawab toko dan periksa kelengkapan laporan.','admin:laporan_approval');
 if(discrepancies.length)add('orange','Rekonsiliasi selisih stok',`${discrepancies.length} baris opname memiliki perbedaan fisik dan tercatat.`,'Periksa per bahan dan satuan. Selisih tidak dijumlahkan lintas satuan.','admin:laporan_opname');
 if(!insights.length)add('mint','Tidak ada pengecualian pada aturan yang diperiksa','Berdasarkan data yang tersedia dan filter saat ini.','Tinjau cakupan data sebelum menyimpulkan performa tim.',null);
 return {policy,start,end,days,previousStart,previousEnd,stores,availableStores,employees:employees.map(e=>({id:e.id,name:e.name,jabatan:e.jabatan,status:e.status})),activeEmployees:activeEmployees.map(e=>({id:e.id,name:e.name})),attendance,previousAttendance,late,classified,schedules:pastSchedules.length,matchedSchedules,missingSchedules:missingSchedules.length,chart,requests:requests.length,pending:pending.length,overdue:overdue.length,approved:requests.filter(r=>r.status==='approved').length,rejected:requests.filter(r=>r.status==='rejected').length,expiring,expired,opened,closed,incomplete:incomplete.length,reportCount:operationalReports.length,sales:salesValues.length?salesValues.reduce((n,v)=>n+v,0):null,salesCount:salesValues.length,expenses:expenseValues.length?expenseValues.reduce((n,v)=>n+v,0):null,purchases:purchaseValues.length?purchaseValues.reduce((n,v)=>n+v,0):null,purchaseCount:purchases.length,opnameCount:opnames.length,discrepancyCount:discrepancies.length,approvalPending:approvals.filter(r=>r.status==='pending').length,locationRows,org:{units:org.units.length,positions:org.positions.length,vacancies:org.positions.filter(p=>!p.employeeId).length,unmapped:orgEmployees.filter(e=>!org.positions.some(p=>p.employeeId===e.id)).length,draft:org.draft},insights,quality:{attendanceDays:attendance,classified,unclassified:Math.max(0,attendance-classified),undatedRequests:requestsAll.filter(r=>!asDate(r.submittedAt)).length,invalidSales:salesRows.length-salesValues.length,invalidPurchases:purchases.length-purchaseValues.length,reportDates:new Set(operationalReports.map(r=>r.date)).size}};
}
