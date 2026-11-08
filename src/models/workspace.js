import { EMPLOYEES, STORES, allowedModuleMenu } from './referenceData';
import {organizationAccess} from './organization';
import { DASHBOARD_USERS, ACCESS_MAP, NAV_GROUPS, SEED_EMPLOYEES, seedAttendanceAndSchedule, seedIjinKerja, seedApprovalQueue } from './referenceData';

// NIK contoh hanya untuk evaluasi desain. Ganti dengan NIK master melalui API produksi.
export const accounts = EMPLOYEES.map((e, i) => ({ ...e, nik: `2026${String(i + 1).padStart(4, '0')}`, role: e.group === 'direksi' ? 'Direksi' : e.jabatan, admin: DASHBOARD_USERS.find(u => u.id === e.id) }));
export const demoPassword = 'Ais2026!';
export const demoAccounts = ['juhaeri', 'eri', 'nana', 'elin', 'jafar_sodik', 'hilman', 'galuh', 'hadi', 'rizky', 'toko_dtop_baros'].map(id => accounts.find(a => a.id === id)).filter(Boolean);
export const stores = STORES;
export const employees = SEED_EMPLOYEES;
export function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
export function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('ais:data')); }
export function installStorage() {
  if (!localStorage.getItem('ais-workspace-initialized')) {
    const seed = seedAttendanceAndSchedule();
    const defaults = { 'ais-employees': employees, 'ais-stores': stores, 'ais-schedule': seed.schedule, 'ais-attendance-summary': seed.attendance, 'ais-ijin-kerja': seedIjinKerja(), 'ais-approval-queue': seedApprovalQueue() };
    for (const [key,value] of Object.entries(defaults)) if(localStorage.getItem(key) === null) write(key,value);
    write('ais-workspace-initialized',true);
  }
  window.storage = {
    async get(key) { return { key, value: localStorage.getItem(key) }; },
    async set(key, value) { localStorage.setItem(key, value); window.dispatchEvent(new Event('ais:data')); return { key, value }; },
    async delete(key) { localStorage.removeItem(key); window.dispatchEvent(new Event('ais:data')); return { key }; },
    async list(prefix = '') { return { keys: Object.keys(localStorage).filter(k => k.startsWith(prefix)) }; }
  };
}
const mobileLabels = { profile: 'Profil & akun', absensi: 'Absensi saya', absensi_harian: 'Laporan kerja harian', laporan: 'Laporan toko', opname: 'Stok opname', ijin: 'Cuti & izin saya', jadwal: 'Jadwal saya', approval: 'Persetujuan', beban: 'Beban toko' };
export function navigation(account) {
  const groups = [{ label: 'WORKSPACE', items: [{ id: 'home', label: 'Home', icon: 'dashboard' }] }];
  if(account.group!=='toko_device')groups[0].items.push({id:'insights',label:account.admin?'Analisa':'Analisa saya',icon:'chart'});
  if(organizationAccess(account)!=='none')groups[0].items.push({id:'organization',label:'Organisasi',icon:'organization'});
  if(account.admin) {
    const access = ACCESS_MAP[account.admin.access] || {};
    const hr = NAV_GROUPS.filter(g => ['karyawan','absensi'].includes(g.key)).flatMap(g => g.pages.filter(p => access[p.key]).map(p => ({ id: `admin:${p.key}`, label: p.label.replace('Master Data Karyawan','Data karyawan').replace('Master Jadwal','Jadwal & shift').replace('Ijin Kerja','Cuti & izin').replace('Rekap Absensi','Rekap kehadiran'), icon: g.key === 'karyawan' ? 'users' : 'calendar' })));
    if(hr.length) groups.push({ label: 'PEOPLE & CULTURE', items: hr });
    groups.push(...NAV_GROUPS.filter(g => ['laporan','inventory','produksi'].includes(g.key)).map(g => ({ label: g.label === 'Laporan' ? 'OPERASIONAL' : g.label.toUpperCase(), items: g.pages.filter(p => access[p.key]).map(p => ({ id: `admin:${p.key}`, label: p.label, icon: g.key === 'laporan' ? 'chart' : 'store' })) })).filter(g=>g.items.length));
  }
  if(['spv','tl'].includes(account.group)) groups.push({label:'KOORDINASI TIM',items:[{id:'requests',label:'Pengajuan tim',icon:'calendar'}]});
  groups.push({ label: 'PERSONAL', items: allowedModuleMenu(account).map(key => ({ id: `mobile:${key}`, label: mobileLabels[key] || key, icon: key === 'profile' ? 'user' : key === 'absensi' ? 'clock' : 'calendar' })) });
  groups.push({ label: 'LAINNYA', items: [{ id: 'activity', label: 'Aktivitas workspace', icon: 'activity' }, { id: 'guide', label: 'Panduan & akses', icon: 'help' }] });
  return groups;
}
export function dateKey(date = new Date()) { return date.toLocaleDateString('en-CA', { timeZone:'Asia/Jakarta' }); }
export function audit(account, action, detail) {
  const log = read('ais-workspace-audit', []);
  write('ais-workspace-audit', [{ id: crypto.randomUUID(), actor: account.name, actorId: account.id, action, detail, at: new Date().toISOString() }, ...log].slice(0,500));
}
export function downloadCSV(rows, name) {
  const csv = '\uFEFF'+rows.map(row=>row.map(v=>`"${String(v ?? '').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
