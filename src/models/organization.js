import {SEED_STORES} from './referenceData';
// Organization structure and application permissions are separate concerns.
export const ORGANIZATION_KEY='ais-organization-v1';
export const DEFAULT_LEVELS=[
 {id:'dir',code:'DIR',name:'Direktorat'}, {id:'div',code:'DIV',name:'Divisi'},
 {id:'dep',code:'DEP',name:'Departemen'}, {id:'unit',code:'UNIT',name:'Unit'},
 {id:'section',code:'SECTION',name:'Section'}, {id:'team',code:'TEAM',name:'Team'},
 {id:'frontline',code:'FRONTLINE',name:'Frontline'}
];
// Upgrade metadata without changing saved reporting lines, assignments or revision.
export function normalizeOrganization(source){
 const org=structuredClone(source);
 if(!org.levels){
  org.levels=structuredClone(DEFAULT_LEVELS);
  for(const u of org.units){const depth=ancestors(org.units,u.id).length-1;
   while(depth>=org.levels.length){const i=org.levels.length+1;org.levels.push({id:`legacy_level_${i}`,code:`L${i}`,name:`Level ${i}`});}
   u.levelId=org.levels[depth].id;
  }
 }
 org.schemaVersion=2;return org;
}
export const levelOf=(org,unitId)=>org.levels?.find(l=>l.id===org.units.find(u=>u.id===unitId)?.levelId);

export function organizationAccess(account){
 if(!account||account.group==='toko_device')return 'none';
 if(account.admin?.access==='all')return 'manage';
 if(account.admin?.access==='admin_utama')return 'company';
 if(['spv','tl'].includes(account.group))return 'team';
 if(account.admin)return 'department';
 return 'personal';
}
const unitFor=e=>e.group==='direksi'?'leadership':['crew','parttime','tl','spv'].includes(e.group)?'operations':e.jabatan==='Finance'?'finance':e.jabatan==='Admin Inventory'?'inventory':e.jabatan==='Graphic Designer'?'creative':'people';
export function createOrganization(employees){
 const initial={revision:0,draft:true,levels:structuredClone(DEFAULT_LEVELS),company:{name:'AIS',code:'AIS',industry:'HRIS & Operations',location:''},units:[{id:'leadership',name:'Direksi',levelId:'dir',parentId:null},{id:'people',name:'People & Administration',levelId:'div',parentId:'leadership'},{id:'operations',name:'Operasional Toko',levelId:'div',parentId:'leadership'},{id:'finance',name:'Finance',levelId:'div',parentId:'leadership'},{id:'inventory',name:'Inventory',levelId:'dep',parentId:'operations'},{id:'creative',name:'Creative',levelId:'div',parentId:'leadership'}],positions:employees.filter(e=>e.group!=='toko_device'&&e.status!=='nonaktif').map(e=>({id:`position_${e.id}`,title:e.jabatan||'Posisi belum diisi',unitId:unitFor(e),parentId:null,employeeId:e.id})),updatedAt:null,updatedBy:null};
 return initial.positions.some(p=>employees.find(e=>e.id===p.employeeId)?.jabatan==='Direksi')?structuralDemo(idealOrganization(initial,employees,SEED_STORES),employees,SEED_STORES):normalizeOrganization(initial);
}

// An illustrative small-company structure, never an authorization or approval map.
export function idealOrganization(org,employees,stores=[]){
 const next=structuredClone(org),byEmployee=new Map(next.positions.filter(p=>p.employeeId).map(p=>[p.employeeId,p]));
 const director=byEmployee.get('juhaeri')||next.positions.find(p=>employees.find(e=>e.id===p.employeeId)?.jabatan==='Direksi');
 const operations=byEmployee.get('kurnia');
 if(!director)throw Error('Contoh ideal memerlukan posisi Direksi yang terisi.');
 for(const p of next.positions){
  const e=employees.find(e=>e.id===p.employeeId);if(!e||p.id===director.id||p.parentId)continue;
  let manager=director;
  if(['spv','tl'].includes(e.group)||e.jabatan==='Admin Inventory')manager=operations||director;
  if(['crew','parttime'].includes(e.group)){
   const responsible=stores.find(s=>s.id===e.store)?.pjId;
   manager=(responsible!==e.id?byEmployee.get(responsible):null)||operations||director;
  }
  p.parentId=manager.id;
 }
 if(operations?.unitId==='leadership'&&next.units.some(u=>u.id==='operations'))operations.unitId='operations';
 for(const u of next.units){if(u.parentId||!['people','operations','finance','inventory','creative'].includes(u.id))continue;const parent=u.id==='inventory'?'operations':'leadership';if(next.units.some(x=>x.id===parent))u.parentId=parent;}
 next.demoTemplate='ideal-v1';next.draft=true;return validateOrganization(normalizeOrganization(next),employees);
}
// Structural nodes describe the organization; position.parentId remains the reporting line.
export function structuralDemo(source,employees,stores=SEED_STORES){
 const next=normalizeOrganization(source);
 if(next.structuralDemo)return next;
 if(!DEFAULT_LEVELS.every(l=>next.levels.some(x=>x.id===l.id)))throw Error('Contoh 7 level memerlukan level DIR sampai FRONTLINE.');
 const ensure=(id,name,levelId,parentId)=>{if(!next.units.some(u=>u.id===id))next.units.push({id,name,levelId,parentId});return id;};
 const root=next.units.find(u=>u.id==='leadership')?.id;
 const ops=next.units.find(u=>u.id==='operations')?.id;
 if(!root||!ops)throw Error('Contoh memerlukan Direktorat dan Divisi Operasional.');
 const department=ensure('demo_ops_dep','Operasi Jaringan','dep',ops);
 const area=ensure('demo_ops_unit','Area Sukabumi','unit',department);
 for(const store of stores){
  const supervisor=employees.find(e=>e.id===store.pjId&&e.group==='spv');
  const section=ensure(`demo_section_${supervisor?.id||store.id}`,supervisor?`Cluster ${supervisor.name}`:`Cluster ${store.name}`,'section',area);
  const team=ensure(`demo_team_${store.id}`,`Team ${store.name}`,'team',section);
  const frontline=ensure(`demo_frontline_${store.id}`,`Frontline ${store.name}`,'frontline',team);
  for(const p of next.positions){
   // Keep manually created units and placements; enrich only the original demo's broad operations unit.
   if(p.unitId!=='operations')continue;
   const employee=employees.find(e=>e.id===p.employeeId);
   if(employee?.id===supervisor?.id)p.unitId=section;
   else if(employee?.store===store.id&&employee.group==='tl')p.unitId=team;
   else if(employee?.store===store.id&&['crew','parttime'].includes(employee.group))p.unitId=frontline;
  }
 }
 next.structuralDemo='seven-level-v1';next.draft=true;return validateOrganization(next,employees);
}
export function ancestors(items,id){const found=[],seen=new Set();let current=items.find(i=>i.id===id);while(current&&!seen.has(current.id)){seen.add(current.id);found.push(current.id);current=items.find(i=>i.id===current.parentId);}return found;}
function assertTree(items,label){
 const ids=new Set(items.map(i=>i.id));if(ids.size!==items.length)throw Error(`ID ${label} tidak boleh ganda.`);
 for(const i of items){if(i.parentId&&!ids.has(i.parentId))throw Error(`Induk ${label} tidak ditemukan.`);const seen=new Set([i.id]);let p=i.parentId;while(p){if(seen.has(p))throw Error(`Hubungan ${label} tidak boleh membentuk siklus.`);seen.add(p);p=items.find(x=>x.id===p)?.parentId;}}
}
export function validateOrganization(org,employees){
 if(!org.company?.name?.trim()||org.company.name.length>100)throw Error('Nama perusahaan wajib diisi, maksimal 100 karakter.');
 assertTree(org.units,'unit');assertTree(org.positions,'posisi');
 if(!Array.isArray(org.levels)||!org.levels.length||org.levels.length>32)throw Error('Organisasi memerlukan 1–32 level.');
 const levelIds=new Set(),codes=new Set();
 for(const l of org.levels){if(!l.id||levelIds.has(l.id))throw Error('ID level tidak valid atau ganda.');levelIds.add(l.id);
  if(!l.name?.trim()||l.name.length>60||!l.code?.trim()||l.code.length>16)throw Error('Nama level wajib diisi (maksimal 60 karakter), kode maksimal 16 karakter.');
  const code=l.code.trim().toUpperCase();if(codes.has(code))throw Error('Kode level tidak boleh ganda.');codes.add(code);
 }
 for(const u of org.units){
  if(!levelIds.has(u.levelId))throw Error('Level organisasi wajib dipilih.');
  const parent=org.units.find(x=>x.id===u.parentId);
  if(parent&&org.levels.findIndex(l=>l.id===parent.levelId)>=org.levels.findIndex(l=>l.id===u.levelId))throw Error('Level induk harus lebih tinggi dari level anak. Periksa cabang sebelum mengubah urutan.');
 }
 const unitIds=new Set(org.units.map(u=>u.id)),employeeIds=new Set(employees.filter(e=>e.group!=='toko_device').map(e=>e.id)),assigned=new Set();
 for(const u of org.units)if(!u.name?.trim()||u.name.length>100)throw Error('Nama unit wajib diisi, maksimal 100 karakter.');
 for(const p of org.positions){if(!p.title?.trim()||p.title.length>100)throw Error('Nama posisi wajib diisi, maksimal 100 karakter.');if(!unitIds.has(p.unitId))throw Error('Unit kerja posisi tidak ditemukan.');if(p.employeeId){if(!employeeIds.has(p.employeeId))throw Error('Karyawan pada posisi tidak ditemukan.');if(assigned.has(p.employeeId))throw Error('Karyawan sudah ditempatkan pada posisi lain.');assigned.add(p.employeeId);}}
 return org;
}
export function changeOrganization(org,action,account,employees,stores=SEED_STORES){
 if(organizationAccess(account)!=='manage')throw Error('Hanya Direksi yang dapat mengelola struktur perusahaan.');
 let next=normalizeOrganization(org);
 if(action.kind==='structural_demo'){next=structuralDemo(next,employees,stores);}
 else if(action.kind==='ideal_demo'){next=idealOrganization(org,employees,stores);}
 else if(action.kind==='level'){
  const {id,name,code,index}=action.value;
  if(!id||typeof id!=='string')throw Error('ID level tidak valid.');
  const existing=next.levels.find(l=>l.id===id);
  const row={id,name:String(name||'').trim(),code:String(code||'').trim().toUpperCase()};
  if(existing)next.levels=next.levels.map(l=>l.id===id?row:l);
  else {const at=Number(index??next.levels.length);if(!Number.isInteger(at)||at<0||at>next.levels.length)throw Error('Urutan level tidak valid.');next.levels.splice(at,0,row);}
  next.draft=true;
 }
 else if(action.kind==='move_level'){
  const from=next.levels.findIndex(l=>l.id===action.id),to=from+action.direction;
  if(from<0||![-1,1].includes(action.direction)||to<0||to>=next.levels.length)throw Error('Urutan level tidak valid.');
  [next.levels[from],next.levels[to]]=[next.levels[to],next.levels[from]];next.draft=true;
 }
 else if(action.kind==='delete_level'){
  if(!next.levels.some(l=>l.id===action.id))throw Error('Level tidak ditemukan.');
  if(next.units.some(u=>u.levelId===action.id))throw Error('Level masih digunakan. Pindahkan seluruh simpul ke level lain sebelum menghapus.');
  next.levels=next.levels.filter(l=>l.id!==action.id);next.draft=true;
 }
 else if(action.kind==='company'){next.company={...next.company,...action.value};next.draft=action.draft!==false;}
 else if(action.kind==='unit'||action.kind==='position'){
  const key=action.kind==='unit'?'units':'positions';const current=next[key].find(i=>i.id===action.value.id);
  const row=action.kind==='unit'?{id:action.value.id,name:String(action.value.name||'').trim(),levelId:action.value.levelId||current?.levelId,parentId:action.value.parentId||null}:{id:action.value.id,title:String(action.value.title||'').trim(),unitId:action.value.unitId,parentId:action.value.parentId||null,employeeId:action.value.employeeId||null};
  if(!row.id||typeof row.id!=='string')throw Error('ID struktur tidak valid.');
  next[key]=current?next[key].map(i=>i.id===row.id?row:i):[...next[key],row];next.draft=true;
 }else throw Error('Perubahan struktur tidak dikenal.');
 validateOrganization(next,employees);next.revision=(org.revision||0)+1;next.updatedAt=new Date().toISOString();next.updatedBy=account.name;return next;
}
export function projectOrganization(source,account,employees){
 const org=normalizeOrganization(source);
 const access=organizationAccess(account);if(access==='none')return {access,company:null,units:[],positions:[],employees:[]};
 const own=org.positions.find(p=>p.employeeId===account.id),scope=new Set(account.stores||[account.store].filter(Boolean));
 let selected=org.positions.filter(p=>{
  if(access==='manage'||access==='company')return true;
  if(access==='personal')return p.employeeId===account.id;
  if(access==='department')return p.unitId===own?.unitId;
  const e=employees.find(e=>e.id===p.employeeId);return p.employeeId===account.id||(e?.stores||[e?.store]).some(id=>scope.has(id));
 });
 const positionIds=new Set(selected.flatMap(p=>ancestors(org.positions,p.id)));selected=org.positions.filter(p=>positionIds.has(p.id));
 const unitIds=new Set(selected.flatMap(p=>ancestors(org.units,p.unitId)));
 const ids=new Set(selected.map(p=>p.employeeId));
 return {access,levels:org.levels,structuralDemo:org.structuralDemo,company:org.company,draft:org.draft,demoTemplate:org.demoTemplate,revision:org.revision,updatedAt:org.updatedAt,updatedBy:org.updatedBy,units:org.units.filter(u=>unitIds.has(u.id)||(access==='manage'||access==='company')),positions:selected,employees:employees.filter(e=>ids.has(e.id)).map(e=>({id:e.id,name:e.name,jabatan:e.jabatan,store:e.store,stores:e.stores,status:e.status})),ownPositionId:own?.id};
}
