"use client";

import FormSurface, { Field } from "../views/components/FormSurface";
import { canDecideLeave } from "../models/requestRules";
import { useState, useEffect, useMemo, Fragment, Component } from "react";
import { Users, Store, Package, CalendarDays, BarChart3, ClipboardCheck, ShieldCheck, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight, Search, MapPin, LayoutDashboard, FileBarChart2, CalendarClock, Boxes, Eye, Bell, Navigation, ArrowLeftRight, SlidersHorizontal, PenLine, RefreshCcw, Lock, AlertTriangle, Receipt, Download } from "lucide-react";

/* ---------------------------------------------------------
   TOKENS (konsisten dengan mobile app)
--------------------------------------------------------- */
const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";
const T = {
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceSunk: "#F7F9FC",
  sidebar: "#20242B",
  sidebarSoft: "#2B303A",
  ink: "#20242B",
  inkMuted: "#767C86",
  line: "#E7EDF4",
  accent: "#DD7A0F",
  accentDeep: "#8A4A08",
  accentSoft: "#F6E3C7",
  manajemen: "#1F3A5F",
  manajemenSoft: "#DCE4EE",
  good: "#2F7D5C",
  goodSoft: "#DDEEE5",
  warn: "#B9790E",
  warnSoft: "#F5E6C8",
  bad: "#B23A2E",
  badSoft: "#F5DFDB"
};

/* ---------------------------------------------------------
   MASTER / SEED DATA (storage instance terpisah dari mobile app)
--------------------------------------------------------- */
/* Token style bersama — memangkas pengulangan tanpa mengubah tampilan. */
const FI = {
  fontFamily: "DM Sans"
};
const THBG = {
  background: T.surfaceSunk,
  textAlign: "left"
}; // baris header tabel
const TD = {
  padding: "9px 12px"
}; // sel tabel standar
const TH = {
  padding: "9px 12px",
  fontSize: 11,
  color: T.inkMuted,
  textTransform: "uppercase"
};
const TDW = {
  padding: "10px 14px"
}; // sel tabel lebar
const FM = {
  fontFamily: "JetBrains Mono"
};
const FB = {
  fontFamily: "Manrope"
};
const GROUP_LABEL = {
  manajemen: "Manajemen",
  crew: "Crew Toko",
  spv: "SPV Toko",
  tl: "Team Leader",
  parttime: "Part Time",
  direksi: "Direksi / Manajemen Puncak",
  toko_device: "Akun Toko (Device)"
};
const SANKSI_TYPES = {
  teguran1: {
    label: "Teguran Lisan 1",
    durasiHari: null
  },
  teguran2: {
    label: "Teguran Lisan 2",
    durasiHari: null
  },
  sp1: {
    label: "SP 1",
    durasiHari: 90
  },
  sp2: {
    label: "SP 2",
    durasiHari: 90
  },
  sp3: {
    label: "SP 3",
    durasiHari: 90
  }
};
const SANKSI_ORDER = ["teguran1", "teguran2", "sp1", "sp2", "sp3"];
function sanksiExpiryDate(sanksi) {
  const meta = SANKSI_TYPES[sanksi.jenis];
  if (!meta.durasiHari) return null; // teguran permanen, tidak pernah expired
  const issued = new Date(sanksi.tanggal + "T00:00:00");
  const expiry = new Date(issued);
  expiry.setDate(expiry.getDate() + meta.durasiHari);
  return expiry;
}
function isSanksiActive(sanksi, today) {
  const meta = SANKSI_TYPES[sanksi.jenis];
  if (!meta.durasiHari) return true; // teguran permanen
  const expiry = sanksiExpiryDate(sanksi);
  return today <= expiry;
}
function sisaDurasiHari(sanksi, today) {
  const meta = SANKSI_TYPES[sanksi.jenis];
  if (!meta.durasiHari) return null;
  const expiry = sanksiExpiryDate(sanksi);
  return Math.max(Math.ceil((expiry - today) / 86400000), 0);
}
function activeSanksiForEmp(empId, sanksiList, today) {
  return sanksiList.filter(s => s.empId === empId && isSanksiActive(s, today)).sort((a, b) => SANKSI_ORDER.indexOf(b.jenis) - SANKSI_ORDER.indexOf(a.jenis));
}

// Jam kerja tiap shift — dipakai menghitung keterlambatan dari data absen mentah app.
const SHIFT_TIME_DASH = {
  "1": {
    start: "06:00",
    end: "14:00"
  },
  "2": {
    start: "14:00",
    end: "22:00"
  },
  L: {
    start: "06:00",
    end: "22:00"
  },
  B: {
    start: "06:00",
    end: "22:00"
  },
  M: {
    start: "06:00",
    end: "22:00"
  },
  S: null,
  // "1 Toko" (SPV/TL) berbasis durasi 8 jam, tanpa jam mulai tetap
  K: {
    start: "08:00",
    end: "17:00"
  } // kantor
};
const LATE_TOLERANCE_DASH = 5;
const menitDari = hhmm => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const menitDariTanggal = d => d.getHours() * 60 + d.getMinutes();

/* Mengubah absensi mentah dari mobile app (satu baris per clock in/out)
   menjadi bentuk ringkas per karyawan per hari yang dipakai dashboard. */
// Jam kantor manajemen berbeda antara Senin–Jumat dan Sabtu.
function jamKantorHari(tanggal, workHours) {
  const hari = new Date(tanggal + "T00:00:00").getDay(); // 0 = Minggu, 6 = Sabtu
  const wh = workHours || WORK_HOURS_DEFAULT;
  return hari === 6 ? wh.manajemenSabtu || WORK_HOURS_DEFAULT.manajemenSabtu : wh.manajemen || WORK_HOURS_DEFAULT.manajemen;
}
function deriveAttendanceSummary(rawLog, schedule, workHours) {
  const perHari = {};
  (rawLog || []).forEach(r => {
    const k = `${r.empId}_${r.date}`;
    if (!perHari[k]) perHari[k] = {
      empId: r.empId,
      date: r.date,
      shift: r.shift || null,
      masuk: null,
      pulang: null,
      audit: false
    };
    if (r.audit) perHari[k].audit = true;
    if (r.type === "clock_in" && (!perHari[k].masuk || r.timestamp < perHari[k].masuk)) perHari[k].masuk = r.timestamp;
    if (r.type === "clock_out" && (!perHari[k].pulang || r.timestamp > perHari[k].pulang)) perHari[k].pulang = r.timestamp;
    if (r.shift && !perHari[k].shift) perHari[k].shift = r.shift;
  });
  return Object.values(perHari).map(d => {
    // Kode shift dari Master Jadwal dipakai bila absen tidak mencatat shift.
    const kode = schedule?.[`${d.empId}_${d.date}`];
    const shiftKode = typeof kode === "string" ? kode : kode?.shift || null;
    // Kode "K" (kantor) memakai jam manajemen sesuai hari; sisanya pakai jam shift.
    const cfg = shiftKode === "K" || d.shift === "kantor" ? jamKantorHari(d.date, workHours) : SHIFT_TIME_DASH[shiftKode] || SHIFT_TIME_DASH[d.shift] || null;

    // Absen audit (Eri & Elin keliling toko) bebas jam kerja — selalu tepat waktu.
    let telatMenit = 0;
    if (d.masuk && cfg && !d.audit) {
      const selisih = menitDariTanggal(new Date(d.masuk)) - menitDari(cfg.start);
      telatMenit = Math.max(0, selisih - LATE_TOLERANCE_DASH);
    }
    const jamKerja = d.masuk && d.pulang ? Math.round((new Date(d.pulang) - new Date(d.masuk)) / 3600000 * 10) / 10 : 0;
    const pulangCepat = !!(d.pulang && cfg && !d.audit && menitDariTanggal(new Date(d.pulang)) < menitDari(cfg.end));
    return {
      empId: d.empId,
      date: d.date,
      shift: d.audit ? "audit" : shiftKode || d.shift,
      telat: telatMenit > 0,
      telatMenit,
      pulangCepat,
      jamKerja,
      audit: d.audit,
      sumber: "app"
    };
  });
}

// Absen keliling toko: namanya "Audit Toko" untuk Eri, "Stok Opname" untuk Elin. Aturannya sama (kode tetap "audit").
const labelShiftAbsen = (shift, empId) => shift === "audit" && empId === "elin" ? "Stok Opname" : SHIFT_CODES[shift] || (shift === "kantor" ? "Kantor" : shift || "-");
const SHIFT_CODES = {
  "-": "Belum Dijadwalkan",
  "1": "Shift 1",
  "2": "Shift 2",
  L: "Longshift",
  B: "Backup",
  M: "Mobile",
  S: "1 Toko",
  O: "Libur",
  audit: "Audit Toko",
  kantor: "Kantor"
};
const SHIFT_CYCLE = ["-", "1", "2", "S", "L", "B", "M", "O"];
// TL memegang satu toko, jadi tidak ada shift Mobile (perpindahan antar toko).
const TL_SHIFT_CYCLE = ["-", "S", "L", "B", "O"];
const SEED_STORES = [
// status: "holding" = toko penuh (semua modul) · "mitra" = hanya absen & transfer, tanpa inventory/laporan
// manage: "spv" | "tl" | "admin" — menentukan ke siapa approval, ijin, dan tukar shift diajukan
{
  id: "dtop_baros",
  name: "DTOP Baros",
  jenisToko: "resto",
  status: "holding",
  manage: "tl",
  pjId: "hilman",
  lat: -6.9200,
  lng: 107.6050,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Baros, Sukabumi",
  telepon: "0266-221001",
  activatedAt: "2026-01-05T07:00:00"
}, {
  id: "dtop_cipanengah",
  name: "DTOP Cipanengah",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "jafar_sodik",
  lat: -6.9300,
  lng: 107.6200,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Cipanengah, Sukabumi",
  telepon: "0266-221002",
  activatedAt: "2026-01-05T07:00:00"
}, {
  id: "dtop_lembursitu",
  name: "DTOP Lembursitu",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "jafar_sodik",
  lat: -6.9400,
  lng: 107.5900,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Lembursitu, Sukabumi",
  telepon: "0266-221003",
  activatedAt: "2026-01-05T07:00:00"
}, {
  id: "dtop_jubleg",
  name: "DTOP Jubleg",
  jenisToko: "express",
  status: "holding",
  manage: "admin",
  pjId: "eri",
  lat: -6.9150,
  lng: 107.6300,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Jubleg, Sukabumi",
  telepon: "0266-221005",
  activatedAt: "2026-02-01T07:00:00"
}, {
  id: "dtop_purabaya",
  name: "DTOP Purabaya",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "sahrul",
  lat: -6.9500,
  lng: 106.9800,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Purabaya, Sukabumi",
  telepon: "0266-221006",
  activatedAt: "2026-03-01T07:00:00"
}, {
  id: "dtop_sagaranten",
  name: "DTOP Sagaranten",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "sahrul",
  lat: -7.1200,
  lng: 106.7800,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Sagaranten, Sukabumi",
  telepon: "0266-221007",
  activatedAt: "2026-04-01T07:00:00"
}, {
  id: "dtop_mangkalaya",
  name: "DTOP Mangkalaya",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "endin",
  lat: -6.9600,
  lng: 106.9200,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Mangkalaya, Sukabumi",
  telepon: "0266-221008",
  activatedAt: "2026-04-15T07:00:00"
}, {
  id: "dtop_cikembar",
  name: "DTOP Cikembar",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "endin",
  lat: -6.9800,
  lng: 106.8600,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Cikembar, Sukabumi",
  telepon: "0266-221009",
  activatedAt: "2026-05-01T07:00:00"
}];
const STORE_STATUS = [{
  key: "holding",
  label: "Holding",
  desc: "Toko penuh — semua modul aktif"
}, {
  key: "mitra",
  label: "Mitra",
  desc: "Hanya absen & transfer stok — tanpa inventory & laporan"
}];
const STORE_STATUS_LABEL = {
  holding: "Holding",
  mitra: "Mitra"
};
const STORE_MANAGE = [{
  key: "spv",
  label: "SPV"
}, {
  key: "tl",
  label: "Team Leader"
}, {
  key: "admin",
  label: "Admin"
}];
const STORE_MANAGE_LABEL = {
  spv: "SPV",
  tl: "Team Leader",
  admin: "Admin"
};

// Toko mitra tidak punya inventory/laporan — dipakai untuk menyaring di seluruh modul.
const isMitra = s => s?.status === "mitra";
const holdingStores = stores => (stores || []).filter(s => s.status !== "mitra");
const KANTOR = {
  id: "kantor",
  name: "Kantor DTOP",
  lat: -6.9100,
  lng: 107.6100,
  radius: 10
};
const SEED_EMPLOYEES = [{
  id: "eri",
  name: "Eri",
  jabatan: "Admin Utama",
  group: "manajemen",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2022-03-01",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: 12
}, {
  id: "nana",
  name: "Nana",
  jabatan: "Finance",
  group: "manajemen",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2022-08-15",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: 12
}, {
  id: "elin",
  name: "Elin",
  jabatan: "Admin Inventory",
  group: "manajemen",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2023-01-10",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-12-31",
  cutiKuota: 12
}, {
  id: "rizky",
  name: "Rizky",
  jabatan: "Graphic Designer",
  group: "manajemen",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2024-02-01",
  statusKontrak: "kontrak",
  kontrakEnd: "2027-01-31",
  cutiKuota: 12
}, {
  id: "galuh",
  name: "Galuh",
  jabatan: "Crew",
  group: "crew",
  store: "dtop_baros",
  stores: null,
  status: "aktif",
  joinDate: "2023-05-02",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "hilman",
  name: "Hilman",
  jabatan: "Team Leader",
  group: "tl",
  store: "dtop_baros",
  stores: ["dtop_baros"],
  status: "aktif",
  joinDate: "2023-09-18",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-09-18",
  cutiKuota: null
}, {
  id: "revy",
  name: "Revy",
  jabatan: "Crew",
  group: "crew",
  store: "dtop_lembursitu",
  stores: null,
  status: "aktif",
  joinDate: "2024-06-10",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-12-10",
  cutiKuota: null
}, {
  id: "hadi",
  name: "Hadi",
  jabatan: "Part Time",
  group: "parttime",
  store: "dtop_baros",
  stores: null,
  status: "aktif",
  joinDate: "2025-01-20",
  statusKontrak: "parttime",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "jafar_sodik",
  name: "Jafar Sodik",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_cipanengah",
  stores: ["dtop_cipanengah", "dtop_lembursitu"],
  status: "aktif",
  joinDate: "2022-11-01",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "sahrul",
  name: "Sahrul",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_purabaya",
  stores: ["dtop_purabaya", "dtop_sagaranten"],
  status: "aktif",
  joinDate: "2023-03-14",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-09-14",
  cutiKuota: null
}, {
  id: "endin",
  name: "Endin",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_mangkalaya",
  stores: ["dtop_mangkalaya", "dtop_cikembar"],
  status: "aktif",
  joinDate: "2024-02-05",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "juhaeri",
  name: "Juhaeri",
  jabatan: "Direksi",
  group: "direksi",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2020-01-01",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "kurnia",
  name: "Kurnia",
  jabatan: "Manajer Operasional",
  group: "direksi",
  store: null,
  stores: null,
  status: "aktif",
  joinDate: "2020-01-01",
  statusKontrak: "tetap",
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_baros",
  name: "Akun Toko — DTOP Baros",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_baros",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_cipanengah",
  name: "Akun Toko — DTOP Cipanengah",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_cipanengah",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_lembursitu",
  name: "Akun Toko — DTOP Lembursitu",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_lembursitu",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_jubleg",
  name: "Akun Toko — DTOP Jubleg",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_jubleg",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_purabaya",
  name: "Akun Toko — DTOP Purabaya",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_purabaya",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_sagaranten",
  name: "Akun Toko — DTOP Sagaranten",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_sagaranten",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_mangkalaya",
  name: "Akun Toko — DTOP Mangkalaya",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_mangkalaya",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}, {
  id: "toko_dtop_cikembar",
  name: "Akun Toko — DTOP Cikembar",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_cikembar",
  stores: null,
  status: "aktif",
  joinDate: null,
  statusKontrak: null,
  kontrakEnd: null,
  cutiKuota: null
}];
const STATUS_KONTRAK_LABEL = {
  parttime: "Part Time",
  kontrak: "Kontrak",
  tetap: "Karyawan Tetap"
};
function formatMasaKerja(joinDate) {
  if (!joinDate) return "-";
  const start = new Date(joinDate + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return years > 0 ? `${years} thn ${remMonths} bln` : `${remMonths} bln`;
}
function daysBetweenInclusive(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000) + 1;
}
function sisaCutiFor(emp, ijinList) {
  if (emp.group !== "manajemen" || emp.cutiKuota == null) return null;
  const thisYear = new Date().getFullYear();
  const used = (ijinList || []).filter(i => i.empId === emp.id && i.jenis === "cuti" && i.status === "approved" && new Date(i.tanggalMulai).getFullYear() === thisYear).reduce((s, i) => s + daysBetweenInclusive(i.tanggalMulai, i.tanggalSelesai), 0);
  return Math.max(emp.cutiKuota - used, 0);
}

// [kode, nama, varian, harga, aktif, outlet(1=R,2=E,3=RE), [[skuBahan, qty, toleransi%], ...]]
const _PRD = [["AYM01ORI", "Dada Original", "Original", 12000, 1, 3, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-KA-01-001", 1, 0], ["PKG-PL-01-003", 1, 0]]], ["AYM02ORI", "Paha Atas Original", "Original", 12000, 1, 3, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-KA-01-001", 1, 0], ["PKG-PL-01-003", 1, 0]]], ["AYM03ORI", "Paha Bawah Original", "Original", 9000, 1, 3, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-KA-01-001", 1, 0], ["PKG-PL-01-003", 1, 0]]], ["AYM04ORI", "Sayap Original", "Original", 8000, 1, 3, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-KA-01-001", 1, 0], ["PKG-PL-01-003", 1, 0]]], ["AYM05ORI", "Kulit Original", "Original", 10000, 1, 3, [["AYM-KU-01-004", 1, 0], ["DRY-TE-01-001", 83, 5], ["OIL-MI-01-001", 42.8, 10], ["SAU-SA-01-003", 1, 10], ["PKG-ST-01-008", 1, 0], ["PKG-PL-01-003", 1, 0]]], ["KTP01ORI", "King Top Original", "Original", 70000, 1, 1, [["AYM-AY-01-001", 1, 0], ["DRY-TE-01-001", 396, 5], ["OIL-MI-01-001", 297, 10], ["SAU-SA-01-002", 5, 10], ["SAU-SA-01-003", 5, 10], ["PKG-DU-01-012", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["KTP02HOT", "King Top Sauce Hot", "Hot", 78000, 1, 1, [["AYM-AY-01-001", 1, 0], ["DRY-TE-01-001", 396, 5], ["OIL-MI-01-001", 297, 10], ["SAU-SA-01-006", 50, 10], ["SAU-SA-01-004", 50, 5], ["PKG-DU-01-012", 1, 10], ["PKG-CU-01-013", 2, 0], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["KTP03HOT", "King Top Spicy", "Hot", 78000, 1, 1, [["AYM-AY-01-001", 1, 0], ["DRY-TE-01-001", 396, 5], ["OIL-MI-01-001", 297, 10], ["SAU-SA-01-004", 50, 5], ["SAU-BU-01-008", 30, 5], ["PKG-DU-01-012", 1, 10], ["PKG-CU-01-013", 1, 0], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["AYM06HOT", "Hotwing", "Hot", 15000, 1, 3, [["AYM-HO-01-003", 1, 0], ["DRY-TE-01-001", 57.1, 5], ["OIL-MI-01-001", 42.8, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM07MOZ", "Moza Hot Dada", "Moza", 17500, 1, 1, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 65, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["DAI-KE-01-002", 20, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM08MOZ", "Moza Hot Paha Atas", "Moza", 17500, 1, 1, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["DAI-KE-01-002", 20, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM09MOZ", "Moza Hot Paha Bawah", "Moza", 0, 0, 1, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["DAI-KE-01-002", 20, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM10MOZ", "Moza Hot Sayap", "Moza", 0, 0, 1, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["DAI-KE-01-002", 20, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM11HOT", "Dada Pedas", "Hot", 15000, 1, 3, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM12HOT", "Paha Atas Pedas", "Hot", 15000, 1, 3, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM13HOT", "Paha Bawah Pedas", "Hot", 13000, 1, 3, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM14HOT", "Sayap Pedas", "Hot", 12000, 1, 3, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0]]], ["AYM15CIP", "Ciprek Dada", "Ciprek", 16000, 1, 3, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["AYM16CIP", "Ciprek Paha Atas", "Ciprek", 16000, 1, 3, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["AYM17CIP", "Ciprek Paha Bawah", "Ciprek", 13000, 1, 3, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["AYM18CIP", "Ciprek Sayap", "Ciprek", 12000, 1, 3, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["SDS01NAS", "Nasi", "Nasi", 5000, 1, 3, [["DRY-BE-01-003", 77, 10], ["PKG-KE-01-004", 1, 10]]], ["SDS02KEN", "Kentang", "Kentang", 7000, 1, 3, [["DRY-KE-01-002", 100, 0], ["OIL-MI-01-003", 18, 5], ["SAU-SA-01-003", 1, 10], ["PKG-KE-01-006", 1, 0], ["DRY-GA-01-006", 1, 0]]], ["SDS03SPA", "Spaghetti", "Spagetti", 10000, 1, 3, [["DRY-SP-01-004", 1, 0], ["PKG-PL-01-003", 1, 0], ["PKG-MI-01-018", 1, 0], ["PKG-PL-01-019", 1, 0], ["DSP-GA-01-001", 1, 0]]], ["BGR01ORI", "Top Burger", "Original", 11000, 1, 1, [["BAK-RO-01-001", 1, 0], ["PRC-DA-01-002", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 10, 0], ["OIL-ME-01-002", 2, 0], ["PKG-KE-01-005", 1, 10]]], ["BGR02CHE", "Top Cheese Burger", "Cheese", 14000, 1, 1, [["BAK-RO-01-001", 1, 0], ["PRC-DA-01-002", 1, 0], ["DAI-KE-01-001", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 10, 0], ["OIL-ME-01-002", 2, 0], ["PKG-DU-01-010", 1, 10], ["PKG-KE-01-005", 0.25, 40]]], ["BGR03BIG", "Top Big Burger", "Big", 16000, 1, 1, [["BAK-RO-01-001", 1, 0], ["PRC-DA-01-002", 2, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 10, 0], ["OIL-ME-01-002", 2, 0], ["PKG-DU-01-010", 1, 10], ["PKG-KE-01-005", 0.25, 40]]], ["BGR04BC", "Top Big Cheese Burger", "BC", 18000, 1, 1, [["BAK-RO-01-001", 1, 0], ["PRC-DA-01-002", 2, 0], ["DAI-KE-01-001", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 10, 0], ["OIL-ME-01-002", 2, 0], ["PKG-DU-01-010", 1, 10], ["PKG-KE-01-005", 0.25, 40]]], ["BGR05TIN", "Mini Burger", "Tiny", 10000, 1, 2, [["BAK-RO-01-004", 1, 0], ["PRC-DA-01-005", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-KE-01-005", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["OIL-ME-01-002", 2, 0]]], ["BGR06TS", "Topsiz", "TS", 9000, 1, 1, [["OIL-MI-01-001", 5, 10], ["BAK-RO-01-002", 1, 0], ["PRC-SO-01-003", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 5, 10], ["PKG-KE-01-005", 1, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 10, 0], ["OIL-ME-01-002", 2, 0]]], ["DRK01MIL", "Milo", "Milo", 6000, 1, 1, [["BEV-MI-01-001", 32, 10], ["PKG-PL-01-003", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["DRK02NES", "Nestle Orange", "Nestle", 5000, 1, 1, [["BEV-NE-01-002", 20, 10], ["PKG-PL-01-003", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["DRK03LEM", "Lemon Tea", "Lemontea", 5000, 1, 1, [["BEV-LE-01-003", 25, 10], ["PKG-PL-01-003", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["DRK04ICE", "Ice Cream", "Ice Cream", 5000, 1, 1, [["DES-IC-01-001", 100, 15], ["DES-CU-01-002", 1, 0]]], ["PKG01SW", "Top 1 (Sayap)", "SW", 12000, 1, 3, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["PKG02PB", "Top 2 (Paha Bawah)", "PB", 13000, 1, 3, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["PKG03DD", "Top 3 (Dada)", "DD", 16000, 1, 3, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["PKG04PA", "Top 3 (Paha Atas)", "PA", 16000, 1, 3, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0]]], ["PKG05SSW", "Super Top 1 (Sayap)", "SSW", 17000, 1, 1, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG06SPB", "Super Top 2 (Paha Bawah)", "SPB", 18000, 1, 1, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG07SDD", "Super Top 3 (Dada)", "SDD", 21000, 1, 1, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG08SPA", "Super Top 3 (Paha Atas)", "SPA", 21000, 1, 1, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG09SUP", "Super Top 4 (TopZis & Kentang)", "Super", 19000, 1, 1, [["OIL-MI-01-001", 33, 10], ["BAK-RO-01-002", 1, 0], ["PRC-SO-01-003", 1, 0], ["DRY-KE-01-002", 100, 0], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-003", 1, 10], ["SAU-SA-01-002", 1, 10], ["SAU-MA-01-001", 5, 10], ["PKG-KE-01-005", 1, 10], ["PKG-KE-01-006", 1, 0], ["PKG-PL-01-003", 2, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 5, 0], ["DRY-GA-01-006", 1, 0], ["OIL-ME-01-002", 2, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG10SUP", "Super Top 5 (BigBurger)", "Super", 21000, 1, 1, [["BAK-RO-01-001", 1, 0], ["PRC-DA-01-002", 2, 0], ["BEV-NE-01-002", 20, 10], ["DAI-KE-01-001", 1, 0], ["SAU-SA-01-002", 1, 10], ["SAU-SA-01-003", 1, 10], ["SAU-MA-01-001", 10, 10], ["PKG-DU-01-010", 1, 10], ["PKG-KE-01-005", 0.25, 10], ["PKG-PL-01-003", 1, 0], ["FRS-TO-01-002", 10, 0], ["FRS-TI-01-003", 10, 0], ["FRS-SE-01-004", 5, 0], ["OIL-ME-01-002", 2, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG11SUP", "Super Top 6 (HotWings)", "Super", 21000, 1, 1, [["AYM-HO-01-003", 1, 0], ["DRY-TE-01-001", 57.1, 5], ["OIL-MI-01-001", 42.8, 10], ["DRY-BE-01-003", 77, 10], ["BEV-NE-01-002", 20, 10], ["SAU-SA-01-006", 35, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["PKG-GE-01-015", 1, 0], ["PKG-SE-01-017", 1, 0], ["PKG-LI-01-014", 1, 0]]], ["PKG12DD", "Ciprek 1 (Dada)", "DD", 21500, 1, 3, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["PKG13PA", "Ciprek 2 (Paha Atas)", "PA", 21500, 1, 3, [["AYM-PA-01-005", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5]]], ["PKG14PB", "Ciprek 3 (Paha Bawah)", "PB", 18500, 1, 1, [["AYM-PB-01-006", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5], ["BEV-AI-01-004", 1, 0]]], ["PKG15SW", "Ciprek 4 (Sayap)", "SW", 17500, 1, 1, [["AYM-SW-01-007", 1, 0], ["DRY-TE-01-001", 40, 5], ["OIL-MI-01-001", 33, 10], ["DRY-BE-01-003", 77, 10], ["PKG-DU-01-009", 1, 10], ["PKG-KE-01-004", 1, 10], ["PKG-PL-01-002", 1, 0], ["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5], ["BEV-AI-01-004", 1, 0]]], ["STK01BS", "Beef Steak", "BS", 0, 0, 1, [["PRC-DA-01-002", 1, 0], ["DRY-KE-01-002", 25, 0], ["DRY-GA-01-006", 0.5, 0], ["OIL-MI-01-003", 5, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-019", 1, 0], ["PKG-PL-01-003", 1, 0], ["SAU-SA-01-007", 1, 5]]], ["STK02CS", "Chicken Steak", "CS", 0, 0, 1, [["AYM-DD-01-008", 1, 0], ["DRY-TE-01-001", 44, 5], ["OIL-MI-01-001", 33, 10], ["DRY-KE-01-002", 25, 0], ["DRY-GA-01-006", 0.5, 0], ["OIL-MI-01-003", 5, 5], ["PKG-DU-01-011", 1, 10], ["PKG-PL-01-019", 1, 0], ["PKG-PL-01-003", 1, 0], ["SAU-SA-01-008", 1, 5]]], ["SDS04HOT", "Sambal Ciprek", "Hot", 5000, 1, 3, [["FRS-CA-01-001", 20, 5], ["FRS-BA-01-005", 2.5, 0], ["DRY-GU-01-005", 5, 0], ["DRY-GA-01-006", 5, 0], ["DRY-SA-01-007", 2.5, 0], ["OIL-MI-01-003", 20, 5], ["PKG-CU-01-013", 1, 0]]], ["SDS05HOT", "Saos Hotwing", "Hot", 4000, 1, 3, [["SAU-SA-01-006", 35, 10], ["PKG-CU-01-013", 1, 0]]], ["DRK05MIN", "Air Mineral", "Drink", 4000, 1, 1, [["BEV-AI-01-004", 1, 0]]], ["DRK06PUC", "Teh Pucuk", "Drink", 4000, 1, 1, [["BEV-TE-01-005", 1, 0]]], ["EXT01TOM", "Extra Saus Tomat Sachet", "Saus", 1000, 1, 3, [["SAU-SA-01-002", 1, 10]]], ["EXT02CAB", "Extra Saus Cabe Sachet", "Saus", 1000, 1, 3, [["SAU-SA-01-003", 1, 10]]], ["EXT03DUS", "Extra Dus Nasi/Express", "Pack", 2000, 1, 3, [["PKG-DU-01-009", 1, 10]]]];
const OUTLET_MAP = {
  1: ["resto"],
  2: ["express"],
  3: ["resto", "express"]
};
const SEED_PRODUCTS = _PRD.map(([kode, name, varian, price, aktif, outlet, bom]) => ({
  id: kode.toLowerCase(),
  kode,
  name,
  varian,
  price,
  aktif: !!aktif,
  jenisToko: OUTLET_MAP[outlet],
  resep: bom.map(([sku, qty, toleransiPersen]) => ({
    bahanId: sku.toLowerCase().replace(/-/g, "_"),
    qty,
    toleransiPersen
  }))
}));
const SUMBER_BARANG = ["Stokis DTOP", "ACK"];

/* --- Jenis toko: menentukan produk yang dijual, dan (turunannya) bahan baku di inventory --- */
const JENIS_TOKO = [{
  key: "resto",
  label: "Resto",
  desc: "Menjual seluruh produk"
}, {
  key: "express",
  label: "Express",
  desc: "Hanya sebagian produk"
}];
const JENIS_TOKO_LABEL = {
  resto: "Resto",
  express: "Express"
};

// Produk yang dijual di sebuah jenis toko.
function produkUntukJenis(products, jenis) {
  return (products || []).filter(p => !p.jenisToko || p.jenisToko.includes(jenis));
}

// Bahan baku yang relevan untuk sebuah jenis toko — diturunkan dari BOM produk yang dijual di sana.
// Bahan tanpa BOM manapun tetap disertakan agar stok pendukung (mis. kemasan) tidak hilang.
function bahanUntukJenis(products, bahan, jenis) {
  const dipakai = new Set(produkUntukJenis(products, jenis).flatMap(p => (p.resep || []).map(r => r.bahanId)));
  const semuaBerBom = new Set((products || []).flatMap(p => (p.resep || []).map(r => r.bahanId)));
  return (bahan || []).filter(b => dipakai.has(b.id) || !semuaBerBom.has(b.id));
}

// Versi praktis: berdasarkan id toko.
function bahanUntukToko(storeId, stores, products, bahan) {
  const jenis = (stores || []).find(s => s.id === storeId)?.jenisToko || "resto";
  return bahanUntukJenis(products, bahan, jenis);
}

// [sku, nama, kategori, kelas, satuanToko, satuanOrder, konversi, moq, shelfLife, trigger, sumber(1=Stokis/0=ACK), waste%, harga]
const _BHN = [["AYM-AY-01-001", "Ayam Utuh", "AYM", "A", "ekor", "ekor", 1, 0, 30, null, 1, 0, 60000], ["AYM-AY-01-002", "Ayam Original", "AYM", "C", "pack", "karung", 25, 1, 30, null, 1, 0, 58000], ["AYM-HO-01-003", "Hotwings", "AYM", "A", "porsi", "pack", 7, 0, 30, null, 1, 0, 5000], ["AYM-KU-01-004", "Kulit Ayam", "AYM", "C", "porsi", "pack", 12, 0, 20, null, 1, 0, 4000], ["AYM-PA-01-005", "PA (Paha Atas)", "AYM", "A", "ptg", "pack", 2, 0, 3, null, 1, 0, 6445], ["AYM-PB-01-006", "PB (Paha Bawah)", "AYM", "A", "ptg", "pack", 2, 0, 3, null, 1, 0, 6445], ["AYM-SW-01-007", "SW (Sayap)", "AYM", "A", "ptg", "pack", 2, 0, 3, null, 1, 0, 6445], ["AYM-DD-01-008", "DD (Dada)", "AYM", "A", "ptg", "pack", 3, 0, 3, null, 1, 0, 6445], ["PRC-CH-01-001", "Chicken Patty", "PRC", "C", "pcs", "pack", 10, 0, 30, null, 1, 0, 6500], ["PRC-DA-01-002", "Daging Patty", "PRC", "C", "pcs", "pack", 10, 0, 7, null, 1, 0, 7000], ["PRC-SO-01-003", "Sosis Hotsis", "PRC", "C", "pcs", "pack", 15, 0, 30, null, 1, 0, 2500], ["PRC-DA-01-005", "Daging Patty Mini", "PRC", "C", "pcs", "pack", 10, 0, 7, null, 1, 0, 4500], ["DRY-TE-01-001", "Tepung Bumbu", "DRY", "C", "gr", "pack", 10000, 0, 30, null, 1, 5, 18], ["DRY-KE-01-002", "Kentang", "DRY", "C", "gr", "pack", 2500, 0, 14, null, 1, 0, 35], ["DRY-BE-01-003", "Beras", "DRY", "A", "gr", "pack", 2000, 0, 14, null, 1, 10, 13], ["DRY-SP-01-004", "Spaghetty", "DRY", "C", "pcs", "pack", 10, 0, 14, null, 1, 0, 14000], ["DRY-GU-01-005", "Gula Pasir", "DRY", "C", "gr", "Kg", 1000, 0, 30, null, 0, 0, 18], ["DRY-GA-01-006", "Garam", "DRY", "C", "gr", "pcs", 250, 0, 30, null, 0, 0, 8], ["DRY-SA-01-007", "Sasa", "DRY", "C", "gr", "pcs", 250, 0, 30, null, 0, 0, 30], ["OIL-MI-01-001", "Minyak Goreng", "OIL", "A", "gr", "pack", 15000, 0, 30, null, 1, 10, 16], ["OIL-ME-01-002", "Mentega", "OIL", "C", "gr", "Kg", 1000, 0, 30, null, 0, 0, 25], ["OIL-MI-01-003", "Minyak Goreng 1lt", "OIL", "C", "ml", "L", 1000, 0, 30, null, 0, 5, 20], ["BAK-RO-01-001", "Roti Burger", "BAK", "C", "pcs", "pcs", 1, 0, 7, null, 1, 0, 3000], ["BAK-RO-01-002", "Roti Hotsis", "BAK", "C", "pcs", "pcs", 1, 0, 7, null, 1, 0, 2000], ["BAK-RO-01-004", "Roti Mini", "BAK", "C", "pcs", "pcs", 1, 0, 7, null, 1, 0, 2200], ["DAI-KE-01-001", "Keju Slice", "DAI", "C", "pcs", "pack", 12, 0, 14, null, 0, 0, 1500], ["DAI-KE-01-002", "Keju Mozarella", "DAI", "C", "gr", "Kg", 1000, 2, 30, null, 1, 5, 90], ["BEV-MI-01-001", "Milo", "BEV", "C", "gr", "bks", 960, 0, 30, null, 1, 10, 90], ["BEV-NE-01-002", "Nestle Orange", "BEV", "C", "gr", "bks", 560, 0, 30, null, 1, 10, 70], ["BEV-LE-01-003", "Lemon Tea", "BEV", "C", "gr", "bks", 1000, 0, 30, null, 1, 10, 70], ["BEV-AI-01-004", "Air Mineral", "BEV", "C", "pcs", "box", 24, 0, 30, null, 1, 0, 2500], ["BEV-TE-01-005", "Teh Pucuk", "BEV", "C", "pcs", "box", 24, 0, 30, null, 1, 0, 4000], ["SAU-MA-01-001", "Mayonaise", "SAU", "C", "gr", "Kg", 10000, 0, 30, null, 1, 10, 35], ["SAU-SA-01-002", "Saus Tomat Sachet", "SAU", "C", "pcs", "box", 500, 0, 30, null, 1, 10, 250], ["SAU-SA-01-003", "Saus Cabe Sachet", "SAU", "B", "pcs", "box", 500, 0, 30, null, 1, 10, 250], ["SAU-SA-01-004", "Saus Keju", "SAU", "C", "gr", "bks", 1000, 0, 30, null, 1, 5, 55], ["SAU-SA-01-006", "Saus Hotwings", "SAU", "A", "gr", "Kg", 1000, 0, 30, null, 1, 10, 48], ["SAU-SA-01-007", "Saus Beef Steak", "SAU", "C", "pcs", "pack", 10, 0, 30, null, 1, 5, 3500], ["SAU-SA-01-008", "Saus Chicken Steak", "SAU", "C", "pcs", "pack", 10, 0, 30, null, 1, 5, 3500], ["SAU-BU-01-008", "Bubuk Cabe", "SAU", "C", "gr", "bks", 1000, 0, 30, null, 1, 5, 60], ["FRS-CA-01-001", "Cabe", "FRS", "C", "gr", "Kg", 1000, 0, 3, null, 0, 5, 45], ["FRS-TO-01-002", "Tomat", "FRS", "C", "gr", "gr", 1, 0, 3, null, 0, 0, 15], ["FRS-TI-01-003", "Timun", "FRS", "C", "gr", "gr", 1, 0, 3, null, 0, 0, 10], ["FRS-SE-01-004", "Selada", "FRS", "C", "gr", "gr", 1, 0, 3, null, 0, 0, 25], ["FRS-BA-01-005", "Bawang Putih", "FRS", "C", "gr", "gr", 1, 0, 7, null, 0, 0, 38], ["DES-IC-01-001", "Ice Cream", "DES", "C", "ml", "pack", 8000, 0, 30, null, 1, 15, 25], ["DES-CU-01-002", "Cup Cone", "DES", "C", "pcs", "pack", 10, 0, 14, null, 1, 0, 1200], ["PKG-KA-01-001", "Kantong Kertas", "PKG", "C", "pcs", "pack", 100, 0, null, null, 1, 0, 350], ["PKG-PL-01-002", "Plastik Besar", "PKG", "C", "pcs", "pack", 200, 0, null, null, 1, 0, 180], ["PKG-PL-01-003", "Plastik Kecil", "PKG", "B", "pcs", "pack", 350, 0, null, null, 1, 0, 120], ["PKG-KE-01-004", "Kertas Nasi", "PKG", "C", "pcs", "rim", 400, 0, null, null, 1, 10, 150], ["PKG-KE-01-005", "Kertas Burger", "PKG", "C", "pcs", "rim", 100, 0, null, null, 1, 10, 400], ["PKG-KE-01-006", "Kertas Kentang", "PKG", "C", "pcs", "pack", 100, 0, null, null, 1, 0, 300], ["PKG-KE-01-007", "Kertas Termal", "PKG", "C", "pcs", "pcs", 1, 0, null, null, 0, 0, 2500], ["PKG-ST-01-008", "Standing Pouch", "PKG", "C", "pcs", "pack", 100, 0, null, null, 1, 0, 500], ["PKG-DU-01-009", "Dus Nasi", "PKG", "C", "pcs", "pack", 300, 0, null, null, 1, 10, 900], ["PKG-DU-01-010", "Dus Burger", "PKG", "C", "pcs", "pack", 300, 0, null, null, 1, 10, 800], ["PKG-DU-01-011", "Dus Hotwing", "PKG", "C", "pcs", "pack", 300, 0, null, null, 1, 10, 800], ["PKG-DU-01-012", "Dus King", "PKG", "C", "pcs", "pack", 300, 0, null, null, 1, 10, 1500], ["PKG-CU-01-013", "Cup Saos", "PKG", "A", "pcs", "pack", 50, 0, null, null, 1, 0, 200], ["PKG-LI-01-014", "Lid Cup", "PKG", "C", "pcs", "Roll", 850, 0, null, 0.5, 0, 0, 180], ["PKG-GE-01-015", "Gelas Cup", "PKG", "C", "pcs", "pack", 50, 0, null, 0.5, 0, 0, 450], ["PKG-TU-01-016", "Tutup Gelas", "PKG", "C", "pcs", "pack", 50, 0, null, 0.5, 0, 0, 200], ["PKG-SE-01-017", "Sedotan", "PKG", "C", "pcs", "pack", 200, 0, null, 0.5, 0, 0, 80], ["PKG-MI-01-018", "Mika", "PKG", "C", "pcs", "pack", 100, 0, null, 0.5, 0, 0, 600], ["PKG-PL-01-019", "Plastik A. Panas", "PKG", "C", "pcs", "pack", 200, 0, null, 0.5, 0, 0, 150], ["PKG-PL-01-020", "Plastik Sampah", "PKG", "C", "pcs", "pack", 12, 0, null, 0.5, 0, 0, 2500], ["PKG-PL-01-021", "Plastik Jumbo", "PKG", "C", "pcs", "pack", 25, 0, null, 0.5, 0, 0, 1800], ["PKG-PL-01-022", "Plastik Clip", "PKG", "C", "pcs", "pack", 100, 0, null, 0.5, 0, 0, 300], ["CLN-PE-01-001", "Pencuci Piring", "CLN", "C", "pcs", "pcs", 1, 0, null, null, 0, 0, 18000], ["CLN-DE-01-002", "Deterjen", "CLN", "C", "pcs", "pcs", 1, 0, null, null, 0, 0, 22000], ["CLN-HA-01-003", "Hand Soap", "CLN", "C", "pack", "pack", 1, 0, null, 0.5, 0, 0, 25000], ["CLN-PE-01-004", "Pembersih Kaca", "CLN", "C", "pack", "pack", 1, 0, null, 0.5, 0, 0, 20000], ["CLN-PE-01-005", "Pembersih Lantai", "CLN", "C", "pack", "pack", 1, 0, null, 0.5, 0, 0, 23000], ["DSP-GA-01-001", "Garpu", "DSP", "C", "pcs", "pack", 25, 0, null, 0.5, 0, 0, 300], ["DSP-HA-01-002", "Hand Gloves", "DSP", "C", "pcs", "pack", 100, 0, null, 0.5, 0, 0, 250], ["DSP-TI-01-003", "Tissue", "DSP", "C", "pcs", "pcs", 1, 0, null, null, 0, 0, 12000]];
const SEED_BAHAN = _BHN.map(([sku, name, kategori, kelas, unitKecil, unitBesar, konversi, minOrder, shelfLifeDays, triggerPct, src, toleransiWaste, harga]) => ({
  id: sku.toLowerCase().replace(/-/g, "_"),
  sku,
  name,
  kategori,
  kelas,
  unitKecil,
  unitBesar,
  konversi,
  minOrder,
  shelfLifeDays,
  triggerPct,
  supplier: src ? "Stokis DTOP" : "ACK",
  toleransiWaste,
  harga
}));
function nextBahanSku(bahanList) {
  const nums = bahanList.map(b => {
    const m = /^BB-(\d+)$/.exec(b.sku || "");
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = nums.length ? Math.max(...nums) : 0;
  return `BB-${String(max + 1).padStart(4, "0")}`;
}
const APPROVAL_TYPE_LABEL = {
  stok: "Stok Bahan Baku",
  etalase_2000: "Etalase 20:00 — Instruksi Goreng"
};
function approvalApprover(type) {
  return type === "stok" ? "Elin (Admin Inventory)" : "Eri / Juhaeri / Kurnia";
}
const LEAVE_TYPE_LABEL = {
  sakit: "Sakit",
  tidak_hadir: "Tidak Hadir",
  cuti: "Cuti Tahunan",
  tukar_shift: "Tukar Shift"
};
const OFFICE_HOURS = {
  start: "08:00",
  end: "17:00"
};
const PERMISSION_ROLES = ["Crew", "Part Time", "SPV", "Akun Toko", "Admin Utama", "Finance", "Admin Inventory", "Graphic Designer", "Direksi"];
const PERMISSION_PAGES = ["Absensi", "Laporan Toko (Input)", "Laporan Toko (Approval)", "Master Jadwal", "Rekap Bulanan", "Laporan Manajemen"];
const DEFAULT_PERMISSION_MATRIX = {
  Absensi: {
    Crew: "input",
    SPV: "input",
    "Akun Toko": "none",
    "Admin Utama": "edit",
    Finance: "input",
    "Admin Inventory": "input",
    "Graphic Designer": "input",
    Direksi: "view"
  },
  "Laporan Toko (Input)": {
    Crew: "none",
    SPV: "none",
    "Akun Toko": "input",
    "Admin Utama": "view",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "view"
  },
  "Laporan Toko (Approval)": {
    Crew: "none",
    SPV: "view",
    "Akun Toko": "none",
    "Admin Utama": "edit",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "edit"
  },
  "Master Jadwal": {
    Crew: "none",
    SPV: "input",
    "Akun Toko": "none",
    "Admin Utama": "edit",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "edit"
  },
  "Rekap Bulanan": {
    Crew: "none",
    SPV: "none",
    "Akun Toko": "none",
    "Admin Utama": "view",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "view"
  },
  "Laporan Manajemen": {
    Crew: "none",
    SPV: "none",
    "Akun Toko": "none",
    "Admin Utama": "edit",
    Finance: "edit",
    "Admin Inventory": "edit",
    "Graphic Designer": "input",
    Direksi: "view"
  }
};
const PERMISSION_LEVELS = [{
  value: "none",
  label: "Tidak Ada",
  tone: "bad"
}, {
  value: "view",
  label: "Lihat",
  tone: "manajemen"
}, {
  value: "input",
  label: "Input",
  tone: "warn"
}, {
  value: "edit",
  label: "Lihat + Edit",
  tone: "good"
}];

/* ---------------------------------------------------------
   LOGIN & AKSES DASHBOARD
--------------------------------------------------------- */
const DASHBOARD_USERS = [{
  id: "eri",
  name: "Eri",
  jabatan: "Admin Utama",
  access: "admin_utama"
}, {
  id: "juhaeri",
  name: "Juhaeri",
  jabatan: "Direksi",
  access: "all"
}, {
  id: "kurnia",
  name: "Kurnia",
  jabatan: "Manajer Operasional",
  access: "all"
}, {
  id: "nana",
  name: "Nana",
  jabatan: "Finance",
  access: "nana"
}, {
  id: "elin",
  name: "Elin",
  jabatan: "Admin Inventory",
  access: "elin"
}, {
  id: "jafar_sodik",
  name: "Jafar Sodik",
  jabatan: "SPV Jr",
  access: "spv"
}, {
  id: "sahrul",
  name: "Sahrul",
  jabatan: "SPV Jr",
  access: "spv"
}, {
  id: "endin",
  name: "Endin",
  jabatan: "SPV Jr",
  access: "spv"
}, {
  id: "hilman",
  name: "Hilman",
  jabatan: "Team Leader",
  access: "spv"
}];

// value: "edit" | "view" — halaman yang tidak disebut berarti tersembunyi untuk akses tsb
const ACCESS_MAP = {
  all: {
    overview: "edit",
    karyawan_master: "edit",
    karyawan_sanksi: "edit",
    karyawan_role: "edit",
    produksi_toko: "edit",
    produksi_bahan: "edit",
    produksi_produk: "edit",
    produksi_resep: "edit",
    produksi_produksi: "edit",
    produksi_task: "edit",
    absensi_jadwal: "edit",
    absensi_rekap: "edit",
    absensi_ijin: "edit",
    laporan_sales: "edit",
    laporan_pengeluaran: "edit",
    laporan_beban: "edit",
    laporan_pengajuan: "view",
    laporan_produksi: "edit",
    laporan_pembelian: "edit",
    laporan_opname: "edit",
    laporan_transfer: "edit",
    laporan_kerja_harian: "view",
    laporan_waste: "edit",
    laporan_pnl: "edit",
    laporan_approval: "edit",
    inventory_ringkasan: "edit",
    inventory_rekap: "edit",
    roq: "edit",
    laporan_roq: "view"
  },
  admin_utama: {
    overview: "edit",
    karyawan_sanksi: "edit",
    produksi_toko: "edit",
    produksi_bahan: "edit",
    produksi_produk: "edit",
    produksi_resep: "edit",
    produksi_produksi: "edit",
    absensi_jadwal: "edit",
    absensi_rekap: "edit",
    absensi_ijin: "edit",
    laporan_sales: "edit",
    laporan_pengeluaran: "edit",
    laporan_beban: "edit",
    laporan_pengajuan: "edit",
    laporan_produksi: "edit",
    laporan_pembelian: "edit",
    laporan_opname: "edit",
    laporan_transfer: "edit",
    laporan_waste: "edit",
    laporan_pnl: "edit",
    laporan_approval: "edit",
    inventory_ringkasan: "edit",
    inventory_rekap: "edit",
    roq: "edit",
    laporan_roq: "view"
    // karyawan_master & karyawan_role sengaja tidak disebut — hak akses penuh Master Karyawan & Role hanya Direksi (Juhaeri & Kurnia)
    // absensi_jadwal "edit" untuk Eri = APPROVAL jadwal toko yang disubmit SPV (grid toko tidak bisa diubah Eri)
    // laporan_pembelian & laporan_opname sengaja "view" — input aslinya hanya lewat mobile app
    // laporan_kerja_harian sengaja tidak disebut — halaman ini khusus Direksi
  },
  nana: {
    overview: "view",
    absensi_jadwal: "view",
    absensi_rekap: "view",
    laporan_sales: "view",
    laporan_pengeluaran: "view",
    laporan_beban: "view",
    laporan_pengajuan: "edit",
    laporan_pembelian: "edit",
    laporan_opname: "edit",
    laporan_pnl: "view"
  },
  elin: {
    overview: "view",
    laporan_waste: "edit",
    produksi_bahan: "edit",
    inventory_ringkasan: "edit",
    inventory_rekap: "edit",
    roq: "edit",
    laporan_roq: "view",
    laporan_opname: "edit",
    laporan_approval: "edit"
  },
  // SPV/TL: jadwal toko yang dinaungi (input + submit ke Eri), sanksi & laporan hanya lihat, semuanya dibatasi ke toko sendiri.
  spv: {
    overview: "view",
    karyawan_sanksi: "view",
    absensi_jadwal: "edit",
    absensi_rekap: "view",
    laporan_produksi: "view",
    laporan_opname: "view",
    laporan_sales: "view",
    laporan_pengeluaran: "view",
    laporan_waste: "view"
  }
};
function getAccess(user, pageKey) {
  return ACCESS_MAP[user.access]?.[pageKey] || null; // null = tidak terlihat sama sekali
}

// Periode gajian: 21 bulan sebelumnya s.d. tanggal 20 bulan yang dipilih
function timeToHours(hhmm) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return h + m / 60;
}

// Durasi kerja per kode shift. "1"/"2"/Kantor ngikut Master Jam Kerja (bisa diubah); Longshift/Backup/Mobile
// pakai durasi standar (sama seperti acuan di mobile app) karena belum ada input jam kerja terpisah untuk itu.
function shiftDurationHours(code, workHours) {
  if (code === "1") return timeToHours(workHours["1"]?.end) - timeToHours(workHours["1"]?.start);
  if (code === "2") return timeToHours(workHours["2"]?.end) - timeToHours(workHours["2"]?.start);
  if (code === "K") return timeToHours(workHours.manajemen?.end) - timeToHours(workHours.manajemen?.start); // rata-rata Senin–Jumat
  if (code === "S") return workHours?.durasiSpvJam ?? 8; // "1 Toko" (SPV/TL) — durasi diatur di Master Jam Kerja
  if (code === "L") return 16; // Longshift 06:00–22:00
  if (code === "B") return 8; // Backup, setara Shift 1
  if (code === "M") return 16; // Mobile (SPV) 06:00–22:00
  return 0;
}
function scheduleSummaryFor(empId, dates, schedule, workHours) {
  const s = {
    libur: 0,
    shift1: 0,
    shift2: 0,
    longshift: 0,
    backup: 0,
    mobile: 0,
    kantor: 0,
    totalJam: 0
  };
  dates.forEach(ds => {
    const code = schedule[`${empId}_${ds}`] || "-";
    if (code === "O") {
      s.libur++;
      return;
    }
    if (code === "-") return;
    if (code === "1") s.shift1++;else if (code === "2") s.shift2++;else if (code === "L") s.longshift++;else if (code === "B") s.backup++;else if (code === "M") s.mobile++;else if (code === "K") s.kantor++;
    s.totalJam += shiftDurationHours(code, workHours);
  });
  return s;
}
function payrollPeriodForMonth(monthISO) {
  const [y, m] = monthISO.split("-").map(Number);
  const end = new Date(y, m - 1, 20);
  const start = new Date(y, m - 2, 21);
  return {
    start: dateStr(start),
    end: dateStr(end),
    label: `${dateStr(start)} s.d. ${dateStr(end)}`
  };
}
function dateRangeList(startISO, endISO) {
  const out = [];
  let cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  while (cur <= end) {
    out.push(dateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
const pad = n => String(n).padStart(2, "0");
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rupiah = n => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const uid = () => Math.random().toString(36).slice(2, 9);
const monthStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addDaysStr = (dateStr_, n) => {
  const d = new Date(dateStr_ + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateStr(d);
};
const addMonthsStr = (monthISO, n) => {
  const [y, m] = monthISO.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthStr(d);
};
const daysInMonth = monthISO => {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/* Penyimpanan dibatasi lajunya, sementara dashboard ini punya puluhan penampung data.
   Kalau semuanya meminta serentak saat dibuka, sebagian permintaan tertahan dan aplikasi
   menggantung di layar memuat. Antrean di bawah membatasi jumlah permintaan bersamaan
   dan mencoba ulang saat gagal, sehingga pemuatan tetap selesai meski agak bertahap. */
const ANTRE_MAKS = 4;
let _antreAktif = 0;
const _antreTunggu = [];
function _jalankanAntre() {
  while (_antreAktif < ANTRE_MAKS && _antreTunggu.length) {
    const tugas = _antreTunggu.shift();
    _antreAktif++;
    tugas().finally(() => {
      _antreAktif--;
      _jalankanAntre();
    });
  }
}
function antreStorage(fn) {
  return new Promise(resolve => {
    _antreTunggu.push(async () => {
      resolve(await fn().catch(() => null));
    });
    _jalankanAntre();
  });
}
const jeda = ms => new Promise(r => setTimeout(r, ms));

// Baca dengan percobaan ulang — kegagalan sesaat karena batas laju tidak boleh
// membuat penanda "selesai" tidak pernah menyala.
async function bacaStorage(key, percobaan = 3) {
  for (let i = 0; i < percobaan; i++) {
    const res = await antreStorage(() => window.storage.get(key, false));
    if (res && res.value !== undefined) return res;
    if (i < percobaan - 1) await jeda(150 * (i + 1));
  }
  return null;
}
function useStoredState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await bacaStorage(key);
        if (alive && res && res.value) setValue(JSON.parse(res.value));
      } catch (e) {/* belum ada isinya — pakai nilai awal */} finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);
  const persist = async next => {
    setValue(next);
    try {
      await antreStorage(() => window.storage.set(key, JSON.stringify(next), false));
    } catch (e) {
      console.error("gagal simpan", key, e);
    }
  };
  return [value, persist, loaded];
}
function seedAttendanceAndSchedule() {
  const schedule = {};
  const attendance = [];
  const today = new Date();
  const shiftWorkers = SEED_EMPLOYEES.filter(e => e.group === "crew" || e.group === "spv" || e.group === "tl" || e.group === "parttime");
  const officeWorkers = SEED_EMPLOYEES.filter(e => e.group === "manajemen");
  for (let back = 27; back >= 1; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const isSunday = d.getDay() === 0;
    shiftWorkers.forEach((w, idx) => {
      if (isSunday && idx % 4 === 0) return; // sebagian libur minggu
      const shiftPool = w.id === "sahrul" ? ["M", "1", "2"] : w.group === "parttime" ? ["1", "2"] : ["1", "2", "L"];
      const shift = shiftPool[(back + idx) % shiftPool.length];
      schedule[`${w.id}_${ds}`] = shift;
      const isAlpa = back % 9 === 0 && idx % 3 === 0;
      if (isAlpa) return;
      const late = back % 6 === 0 && idx % 2 === 0;
      const early = back % 7 === 0 && idx % 2 === 1;
      const telatMenit = late ? 16 + (back + idx) % 5 * 7 : 0;
      attendance.push({
        empId: w.id,
        date: ds,
        shift,
        telat: late,
        telatMenit,
        pulangCepat: early,
        jamKerja: 7.5 - (early ? 1.2 : 0)
      });
    });
    if (!isSunday) {
      officeWorkers.forEach((w, idx) => {
        const isAlpa = back % 11 === 0 && idx % 3 === 0;
        if (isAlpa) return;
        const late = back % 8 === 0 && idx % 2 === 0;
        const early = back % 10 === 0 && idx % 2 === 1;
        const telatMenit = late ? 18 + (back + idx) % 4 * 6 : 0;
        attendance.push({
          empId: w.id,
          date: ds,
          shift: "kantor",
          telat: late,
          telatMenit,
          pulangCepat: early,
          jamKerja: 9 - (early ? 1 : 0)
        });
      });
    }
  }
  return {
    schedule,
    attendance
  };
}
function seedApprovalQueue() {
  const today = new Date();
  const ds = back => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return [{
    id: uid(),
    storeId: "dtop_baros",
    date: ds(0),
    type: "etalase_2000",
    status: "pending",
    payload: {
      stok: 6,
      qtyGoreng: 20,
      inputOleh: "Galuh"
    },
    requestedAt: new Date().toISOString()
  }, {
    id: uid(),
    storeId: "dtop_cipanengah",
    date: ds(0),
    type: "stok",
    status: "pending",
    payload: {
      inputOleh: "Hilman"
    },
    requestedAt: new Date().toISOString()
  }, {
    id: uid(),
    storeId: "dtop_lembursitu",
    date: ds(1),
    type: "stok",
    status: "approved",
    payload: {
      inputOleh: "Revy"
    },
    requestedAt: ds(1),
    respondedAt: ds(1),
    decidedBy: "Elin"
  }, {
    id: uid(),
    storeId: "dtop_baros",
    date: ds(2),
    type: "etalase_2000",
    status: "rejected",
    payload: {
      stok: 3,
      qtyGoreng: 15,
      inputOleh: "Galuh"
    },
    requestedAt: ds(2),
    respondedAt: ds(2),
    decidedBy: "Eri"
  }];
}

// Qty terjual per produk untuk data simulasi — memakai id produk ASLI dari master (SEED_PRODUCTS),
// supaya omset dan Waste Calculation (sales x BOM) terhitung. Deterministik, bukan acak.
function seedQtyProduk(seed, shift, boost) {
  const q = {};
  SEED_PRODUCTS.forEach((p, i) => {
    if (!p.aktif) return;
    const utuh = (p.resep || []).some(r => r.bahanId === "aym_ay_01_001"); // produk 1 ekor utuh: porsi besar, lebih jarang terjual
    const base = utuh ? 1 : p.id.startsWith("aym") ? 5 : p.id.startsWith("sds") ? 4 : 2;
    const v = Math.round((base + (i * 5 + seed + shift * 3) % 6) * (boost || 1));
    if (v > 0) q[p.id] = v;
  });
  return q;
}
function seedLaporanToko() {
  const reportLog = {};
  const today = new Date();
  const stores = SEED_STORES.map(s => s.id);
  const crewByStore = storeId => SEED_EMPLOYEES.find(e => e.group === "crew" && e.store === storeId)?.name || "-";
  for (let back = 13; back >= 0; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (d.getDay() === 0 && back % 2 === 0) continue; // sebagian toko libur minggu tertentu

    stores.forEach((storeId, sIdx) => {
      const key = `${storeId}_${ds}`;
      const operator = crewByStore(storeId);
      const price = 12000;
      const qty1 = seedQtyProduk(back + sIdx, 1, 1);
      const qty2 = seedQtyProduk(back + sIdx, 2, 1);
      const sumQty = qty => SEED_PRODUCTS.reduce((s, p) => s + (qty[p.id] || 0) * p.price, 0);
      const omsetKotor1 = sumQty(qty1);
      const omsetKotor2 = sumQty(qty2);
      const pengeluaranItems2 = {
        "Sayur": 20000 + sIdx * 2000,
        "Es Batu": 8000,
        "Bensin": back % 3 === 0 ? 12000 : 0,
        "Ops. Karyawan": 20000,
        "Chemical": back % 4 === 0 ? 18000 : 0,
        "Sampah": 5000,
        "Parkir": 3000
      };
      const pengeluaran1 = 0;
      const pengeluaran2 = Object.values(pengeluaranItems2).reduce((s, v) => s + v, 0);
      const online1 = 60000 + back % 5 * 8000;
      const online2 = 50000 + back % 4 * 7000;
      const fryerCmMorning = 8 + back % 3;
      const fryerCmEvening = 7 + back % 3;
      const literFryerMorning = fryerCmMorning * 1.68 + 14.57;
      const literFryerEvening = fryerCmEvening * 1.68 + 14.57;
      const minyakBekuKg = 15 + sIdx % 3 * 2;
      const minyakDatangKg = back % 4 === 0 ? 18 : 0;
      const totalMinyakBekuKg = minyakBekuKg + minyakDatangKg;
      const topUp1Cm = 3 + back % 2;
      const topUp1Liter = Math.round(topUp1Cm * 1.68 * 100) / 100;
      const minyakBekuAkhir = Math.round(Math.max(totalMinyakBekuKg - topUp1Liter, 0) * 100) / 100;
      reportLog[key] = {
        opening: {
          submittedAt: `${ds}T06:55:00`,
          inputOleh: operator
        },
        base_prep: {
          sambelCiprek: {
            cup: 8 + sIdx % 3,
            foto: null
          },
          saosHotwing: {
            cup: 6 + sIdx % 2,
            foto: null
          },
          minyak: {
            minyakBekuKg,
            minyakDatangKg,
            totalMinyakBekuKg,
            minyakFryerCm: fryerCmMorning,
            literMinyakFryer: Math.round(literFryerMorning * 100) / 100,
            totalStokAwalMinyak: Math.round((totalMinyakBekuKg + literFryerMorning) * 100) / 100,
            topUp1Cm,
            topUp1Liter
          },
          inputOleh: operator,
          submittedAt: `${ds}T06:50:00`
        },
        etalase_0700: {
          stok: 18 + sIdx % 4,
          note: "Etalase pagi ready.",
          submittedAt: `${ds}T07:${back % 5 === 0 ? "18" : "05"}:00`,
          inputOleh: operator
        },
        ...(back === 3 && sIdx === 0 ? {} : {
          etalase_1100: {
            stok: 22 + sIdx % 3,
            note: "",
            submittedAt: `${ds}T11:03:00`,
            inputOleh: operator
          }
        }),
        sales_shift1: {
          qty: qty1,
          omsetKotor: omsetKotor1,
          pengeluaran: pengeluaran1,
          omsetOnline: online1,
          payment: {
            cash: Math.round((omsetKotor1 - online1) * 0.6),
            qris: Math.round((omsetKotor1 - online1) * 0.2),
            debit: Math.round((omsetKotor1 - online1) * 0.05),
            gopay: Math.round((omsetKotor1 - online1) * 0.1)
          },
          omsetBersih: omsetKotor1 - pengeluaran1 - online1,
          inputOleh: operator,
          submittedAt: `${ds}T15:10:00`
        },
        produksi_shift1: {
          batch: 6 + sIdx % 3,
          sisaAyamBreakdown: {
            dada: 1 + back % 2,
            pahaAtas: 1 + sIdx % 2,
            pahaBawah: back % 2,
            sayap: 1 + (back + sIdx) % 2
          },
          sisaAyam: 1 + back % 2 + (1 + sIdx % 2) + back % 2 + (1 + (back + sIdx) % 2),
          sisaHotwing: 2 + sIdx % 3,
          sisaKulit: 1 + back % 2,
          catatan: back % 5 === 0 ? "Ada 1 batch gosong, sudah dibuang." : "",
          inputOleh: operator,
          submittedAt: `${ds}T15:12:00`
        },
        etalase_1700: {
          stok: 15 + sIdx % 3,
          note: "",
          submittedAt: `${ds}T17:${back % 6 === 0 ? "20" : "04"}:00`,
          inputOleh: operator
        },
        etalase_2000: {
          stok: 5 + back % 4,
          ajukanGoreng: back % 3 === 0,
          qtyGoreng: back % 3 === 0 ? 15 + sIdx * 3 : 0,
          submittedAt: `${ds}T20:02:00`,
          inputOleh: operator
        },
        sales_shift2: {
          qty: qty2,
          omsetKotor: omsetKotor2,
          pengeluaran: pengeluaran2,
          pengeluaranItems: pengeluaranItems2,
          omsetOnline: online2,
          payment: {
            cash: Math.round((omsetKotor2 - online2) * 0.55),
            qris: Math.round((omsetKotor2 - online2) * 0.25),
            debit: Math.round((omsetKotor2 - online2) * 0.05),
            gopay: Math.round((omsetKotor2 - online2) * 0.15)
          },
          omsetBersih: omsetKotor2 - pengeluaran2 - online2,
          inputOleh: operator,
          submittedAt: `${ds}T21:15:00`
        },
        produksi_shift2: {
          batch: 5 + sIdx % 2,
          sisaAyamBreakdown: {
            dada: back % 2,
            pahaAtas: 1 + sIdx % 2,
            pahaBawah: back % 2,
            sayap: sIdx % 2
          },
          sisaAyam: back % 2 + (1 + sIdx % 2) + back % 2 + sIdx % 2,
          sisaHotwing: 1 + sIdx % 2,
          sisaKulit: back % 2,
          tangkaiCabeGr: 30 + back % 4 * 10,
          catatan: "",
          inputOleh: operator,
          submittedAt: `${ds}T21:17:00`,
          minyakClosing: {
            minyakBekuAkhir,
            minyakFryerAkhirCm: fryerCmEvening,
            literMinyakFryerAkhir: Math.round(literFryerEvening * 100) / 100,
            totalStokAkhirMinyak: Math.round((minyakBekuAkhir + literFryerEvening) * 100) / 100
          }
        },
        stok: {
          ayam_utuh: {
            awal: 40,
            masuk: 20,
            pakai: 35 - sIdx % 3,
            akhir: 25 + sIdx % 3
          },
          minyak: {
            awal: 15,
            masuk: 5,
            pakai: 8,
            akhir: 12
          },
          tepung_bumbu: {
            awal: 10,
            masuk: 4,
            pakai: 6,
            akhir: 8
          },
          kentang: {
            awal: 6,
            masuk: 2,
            pakai: 3,
            akhir: 5
          },
          inputOleh: operator,
          submittedAt: `${ds}T21:20:00`
        },
        closing: {
          submittedAt: `${ds}T21:30:00`,
          inputOleh: operator
        }
      };
    });
  }
  return reportLog;
}
function seedIjinKerja() {
  const today = new Date();
  const ds = offset => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return [{
    id: uid(),
    jenis: "sakit",
    empId: "hilman",
    empName: "Hilman",
    group: "crew",
    requestedById: "hilman",
    requestedByName: "Hilman",
    tanggalMulai: ds(-1),
    tanggalSelesai: ds(-1),
    status: "approved",
    submittedAt: ds(-1),
    decidedBy: "Eri",
    decidedAt: ds(-1)
  }, {
    id: uid(),
    jenis: "tidak_hadir",
    empId: "galuh",
    empName: "Galuh",
    group: "crew",
    requestedById: "galuh",
    requestedByName: "Galuh",
    tanggalMulai: ds(2),
    tanggalSelesai: ds(2),
    alasan: "Acara keluarga",
    crewPengganti: "Hadi",
    status: "pending",
    submittedAt: ds(0)
  }, {
    id: uid(),
    jenis: "cuti",
    empId: "nana",
    empName: "Nana",
    group: "manajemen",
    requestedById: "nana",
    requestedByName: "Nana",
    tanggalMulai: ds(35),
    tanggalSelesai: ds(38),
    status: "pending",
    submittedAt: ds(0)
  }, {
    id: uid(),
    jenis: "tukar_shift",
    empId: "revy",
    empName: "Revy",
    group: "crew",
    requestedById: "sahrul",
    requestedByName: "Sahrul",
    tanggalMulai: ds(3),
    tanggalSelesai: ds(3),
    shiftAsal: "1",
    tanggalTukar: ds(4),
    shiftTukar: "2",
    crewPenukar: "Hadi",
    status: "pending",
    submittedAt: ds(0)
  }];
}
function seedStockLedger() {
  const ledger = [];
  const today = new Date();
  const storeIds = SEED_STORES.map(s => s.id);

  // Catatan: "in" (barang masuk) & "out" (pemakaian) TIDAK diseed di sini —
  // keduanya bersumber dari Laporan Stok harian toko (reportLog), bukan dari stockLedger.
  // stockLedger hanya menyimpan Transfer Stok & Adjustment (Stok Opname).
  for (let back = 29; back >= 0; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (back % 7 === 3 && storeIds.length >= 2) {
      const bahanId = "oil_mi_01_001",
        qty = 5;
      ledger.push({
        id: uid(),
        storeId: storeIds[0],
        bahanId,
        tanggal: ds,
        jenis: "transfer_out",
        qty,
        keterangan: `Transfer ke ${SEED_STORES[1].name}`,
        relatedStore: storeIds[1],
        inputOleh: "SPV Jr"
      });
      ledger.push({
        id: uid(),
        storeId: storeIds[1],
        bahanId,
        tanggal: ds,
        jenis: "transfer_in",
        qty,
        keterangan: `Transfer dari ${SEED_STORES[0].name}`,
        relatedStore: storeIds[0],
        inputOleh: "SPV Jr"
      });
    }
    if (back % 10 === 5) {
      ledger.push({
        id: uid(),
        storeId: storeIds[back % storeIds.length],
        bahanId: "dry_te_01_001",
        tanggal: ds,
        jenis: "adjustment",
        qty: -1,
        keterangan: "Selisih stok opname",
        inputOleh: "Elin (Admin Inventory)"
      });
    }
  }
  return ledger;
}
function seedPurchaseReports() {
  const today = new Date();
  const ds = back => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const storeIds = SEED_STORES.map(s => s.id);
  const basePrice = {
    ayam_utuh: 32000,
    ayam_original: 18000,
    hotwings: 17000,
    kulit_ayam: 9000,
    chicken_patty: 6000,
    tepung_bumbu: 15000,
    minyak: 22000,
    roti_burger: 3500,
    roti_hotsis: 3200,
    daging_patty: 7500,
    sosis_hotsis: 4000,
    keju_slice: 1500,
    kentang: 12,
    beras: 13500,
    milo: 45,
    nestle_orange: 40,
    lemon_tea: 38,
    air_mineral: 3500,
    teh_pucuk: 4000,
    spaghetty: 8500
  };
  const qtyPerOrder = {
    ayam_utuh: 12,
    ayam_original: 20,
    hotwings: 20,
    kulit_ayam: 10,
    chicken_patty: 50,
    tepung_bumbu: 25,
    minyak: 18,
    roti_burger: 24,
    roti_hotsis: 24,
    daging_patty: 50,
    sosis_hotsis: 20,
    keju_slice: 24,
    kentang: 5000,
    beras: 25,
    milo: 1000,
    nestle_orange: 1000,
    lemon_tea: 1000,
    air_mineral: 24,
    teh_pucuk: 24,
    spaghetty: 10
  };
  const records = [];
  storeIds.forEach((storeId, sIdx) => {
    // 4 transaksi per toko (rentang ~38 s.d. 3 hari lalu — mencakup bulan lalu & bulan berjalan),
    // tiap transaksi cover ~5 bahan bergantian, jadi ke-20 bahan pernah "dibeli" di tiap toko.
    [38, 24, 10, 3].forEach((back, i) => {
      const subset = SEED_BAHAN.filter((_, idx) => idx % 4 === i);
      const items = subset.map(b => {
        const qty = qtyPerOrder[b.id];
        const harga = Math.round(basePrice[b.id] * (1 + ((sIdx + i) % 3 - 1) * 0.03));
        return {
          bahanId: b.id,
          bahanName: b.name,
          qty,
          harga,
          subtotal: qty * harga
        };
      });
      const total = items.reduce((s, it) => s + it.subtotal, 0);
      records.push({
        id: uid(),
        storeId,
        tanggal: ds(back),
        items,
        total,
        invoiceFoto: null,
        inputOleh: sIdx % 2 === 0 ? "Eri" : "Nana",
        inputOlehId: sIdx % 2 === 0 ? "eri" : "nana",
        submittedAt: `${ds(back)}T09:00:00`
      });
    });
  });
  return records;
}
function seedStockOpnameReports() {
  const today = new Date();
  const ds = back => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const storeIds = SEED_STORES.map(s => s.id);
  const contoh = [{
    back: 1,
    storeIdx: 0,
    submitter: "Eri",
    items: [{
      bahanId: "aym_ay_01_001",
      tercatat: 18,
      aktual: 17,
      keterangan: "1 ekor rusak saat penyimpanan"
    }, {
      bahanId: "oil_mi_01_001",
      tercatat: 22,
      aktual: 22,
      keterangan: ""
    }, {
      bahanId: "dry_te_01_001",
      tercatat: 15,
      aktual: 15,
      keterangan: ""
    }]
  }, {
    back: 6,
    storeIdx: 1,
    submitter: "Elin",
    items: [{
      bahanId: "dry_ke_01_002",
      tercatat: 4200,
      aktual: 4050,
      keterangan: "Selisih timbangan, sudah dikonfirmasi ke toko"
    }, {
      bahanId: "dry_be_01_003",
      tercatat: 20,
      aktual: 20,
      keterangan: ""
    }]
  }, {
    back: 12,
    storeIdx: 2,
    submitter: "Eri",
    items: [{
      bahanId: "bak_ro_01_001",
      tercatat: 30,
      aktual: 30,
      keterangan: ""
    }, {
      bahanId: "aym_ay_01_002",
      tercatat: 25,
      aktual: 23,
      keterangan: "2 pcs kadaluarsa, dibuang"
    }]
  }];
  return contoh.map(c => {
    const items = c.items.map(it => {
      const bahan = SEED_BAHAN.find(b => b.id === it.bahanId);
      return {
        bahanId: it.bahanId,
        bahanName: bahan?.name || it.bahanId,
        tercatat: it.tercatat,
        aktual: it.aktual,
        selisih: it.aktual - it.tercatat,
        keterangan: it.keterangan
      };
    });
    return {
      id: uid(),
      storeId: storeIds[c.storeIdx],
      tanggal: ds(c.back),
      items,
      inputOleh: c.submitter,
      inputOlehId: c.submitter.toLowerCase(),
      submittedAt: `${ds(c.back)}T20:30:00`
    };
  });
}
function seedStockTransfers() {
  const today = new Date();
  const ds = back => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const storeIds = SEED_STORES.map(s => s.id);
  const contoh = [{
    back: 2,
    asalIdx: 0,
    tujuanIdx: 1,
    spv: "Sodik",
    status: "confirmed",
    confirmedBy: "Sodik",
    items: [{
      bahanId: "oil_mi_01_001",
      qty: 10,
      hargaSatuan: 18000
    }, {
      bahanId: "dry_te_01_001",
      qty: 5,
      hargaSatuan: 12000
    }]
  }, {
    back: 5,
    asalIdx: 0,
    tujuanIdx: 2,
    spv: "Sahrul",
    status: "confirmed",
    confirmedBy: "Sahrul",
    items: [{
      bahanId: "aym_ay_01_001",
      qty: 8,
      hargaSatuan: null
    }]
  }, {
    back: 1,
    asalIdx: 1,
    tujuanIdx: 0,
    spv: "Sodik",
    status: "pending",
    confirmedBy: null,
    items: [{
      bahanId: "dry_ke_01_002",
      qty: 15,
      hargaSatuan: null
    }]
  }, {
    back: 8,
    asalIdx: 2,
    tujuanIdx: 0,
    spv: "Sahrul",
    status: "confirmed",
    confirmedBy: "Sodik",
    items: [{
      bahanId: "dry_be_01_003",
      qty: 20,
      hargaSatuan: 13000
    }, {
      bahanId: "oil_mi_01_001",
      qty: 6,
      hargaSatuan: null
    }]
  }];
  return contoh.map(c => {
    const items = c.items.map(it => {
      const bahan = SEED_BAHAN.find(b => b.id === it.bahanId);
      return {
        bahanId: it.bahanId,
        bahanName: bahan?.name || it.bahanId,
        qty: it.qty,
        hargaSatuan: it.hargaSatuan
      };
    });
    return {
      id: uid(),
      tanggal: ds(c.back),
      asalToko: storeIds[c.asalIdx],
      tujuanToko: storeIds[c.tujuanIdx],
      spvPenanggungJawab: c.spv,
      items,
      status: c.status,
      buktiTerimaFoto: c.status === "confirmed" ? "confirmed_placeholder" : null,
      confirmedBy: c.confirmedBy,
      submittedAt: `${ds(c.back)}T10:00:00`
    };
  });
}

/* ---------------------------------------------------------
   SMALL UI ATOMS
--------------------------------------------------------- */
function Badge({
  children,
  tone = "manajemen"
}) {
  const map = {
    manajemen: {
      bg: T.manajemenSoft,
      fg: T.manajemen
    },
    good: {
      bg: T.goodSoft,
      fg: T.good
    },
    warn: {
      bg: T.warnSoft,
      fg: T.warn
    },
    bad: {
      bg: T.badSoft,
      fg: T.bad
    }
  };
  const c = map[tone];
  return <span style={{
    background: c.bg,
    color: c.fg,
    ...FI,
    fontWeight: 600,
    fontSize: 11.5,
    padding: "3px 9px",
    borderRadius: 999,
    letterSpacing: 0.2,
    whiteSpace: "nowrap"
  }}>{children}</span>;
}
function SectionTitle({
  icon: Icon,
  children,
  action
}) {
  return <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  }}>
      <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8
    }} className="ais-flex-layout">
        {Icon && <Icon size={18} color={T.accentDeep} />}
        <h2 style={{
        ...FB,
        fontWeight: 700,
        fontSize: 20,
        color: T.ink,
        margin: 0
      }}>{children}</h2>
      </div>
      {action}
    </div>;
}
function StatCard({
  label,
  value,
  tone = "manajemen"
}) {
  const map = {
    manajemen: T.manajemen,
    good: T.good,
    warn: T.warn,
    bad: T.bad
  };
  return <div style={{
    flex: 1,
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: "16px 18px"
  }} className="ais-content-panel">
      <div style={{
      ...FM,
      fontWeight: 700,
      fontSize: 26,
      color: map[tone]
    }}>{value}</div>
      <div style={{
      ...FI,
      fontSize: 12,
      color: T.inkMuted,
      marginTop: 4
    }}>{label}</div>
    </div>;
}
function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}) {
  return <Field label={label}><input className="ais-control ais-control" type={type} value={value} placeholder={placeholder || label} onChange={e => onChange(e.target.value)} /></Field>;
}
function SelectField({
  label,
  value,
  onChange,
  options
}) {
  return <Field label={label}><span className="ais-select-wrap"><select className="ais-control ais-control" value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown size={16} /></span></Field>;
}
function IconButton({
  icon: Icon,
  onClick,
  tone = "manajemen",
  title
}) {
  const map = {
    manajemen: T.manajemen,
    bad: T.bad,
    good: T.good
  };
  return <button onClick={onClick} title={title} style={{
    border: `1px solid ${T.line}`,
    background: T.surface,
    borderRadius: 8,
    padding: "6px 7px",
    cursor: "pointer",
    color: map[tone],
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }} className="ais-button ais-button--default"><Icon size={14} /></button>;
}
function ReadOnlyWrap({
  access,
  children
}) {
  if (access === "edit") return children;
  return <div>
      <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: T.warnSoft,
      color: T.warn,
      padding: "9px 14px",
      borderRadius: 10,
      ...FI,
      fontWeight: 600,
      fontSize: 12.5,
      marginBottom: 16
    }} className="ais-flex-layout">
        <Eye size={14} /> Mode Lihat Saja — Anda bisa menjelajahi & memfilter data di halaman ini, tapi tidak bisa mengubah, menyetujui, atau menghapus data.
      </div>
      {children}
    </div>;
}
function AccessDenied() {
  return <div style={{
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: 40,
    textAlign: "center"
  }} className="ais-content-panel">
      <ShieldCheck size={28} color={T.inkMuted} style={{
      marginBottom: 10
    }} />
      <div style={{
      ...FI,
      fontWeight: 600,
      fontSize: 14,
      color: T.inkMuted
    }}>Anda tidak memiliki akses ke halaman ini.</div>
    </div>;
}

/* =========================================================
   NOTIFIKASI (kode sama persis di mobile app & dashboard)
   Notifikasi TIDAK disimpan sebagai pesan terpisah — dihitung langsung dari data yang ada, sehingga
   selalu sinkron: approval hilang sendiri begitu diputuskan. Yang disimpan hanya status "sudah dibaca"
   per user di "ais-notif-read" = { [userId]: { [notifId]: waktuBaca } }.
   jenis: "approval" (perlu tindakan Anda) · "reminder" (pengingat personal) · "info" (hasil keputusan, 14 hari terakhir)
   tujuan.dash = halaman dashboard · tujuan.app = modul mobile app
========================================================= */
const NOTIF_APPROVAL_LABEL = {
  stok: "Laporan Stok Bahan Baku",
  etalase_2000: "Etalase 20:00 — Instruksi Goreng"
};
const NOTIF_SHIFT_LABEL = {
  "1": "Shift 1",
  "2": "Shift 2",
  L: "Longshift",
  longshift: "Longshift",
  B: "Backup",
  backup: "Backup",
  M: "Mobile",
  mobile: "Mobile",
  S: "1 Toko",
  satu_toko: "1 Toko",
  K: "Kantor",
  kantor: "Kantor",
  O: "Libur",
  off: "Libur"
};
const NOTIF_SANKSI_LABEL = {
  teguran1: "Teguran Lisan 1",
  teguran2: "Teguran Lisan 2",
  sp1: "SP 1",
  sp2: "SP 2",
  sp3: "SP 3"
};
const NOTIF_BANDING_LABEL = {
  diterima: "diterima (minus di-clear)",
  sebagian: "diterima sebagian",
  ditolak: "ditolak"
};
const NOTIF_PENGAJUAN_LABEL = {
  ditolak: "Ditolak",
  ditunda: "Ditunda",
  progress: "Progress",
  selesai: "Selesai"
};
function notifTambahHari(ds, n) {
  const d = new Date(ds + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Periode gajian/jadwal bulan M = tanggal 21 bulan M-1 s.d. 20 bulan M. Batas submit = tanggal 20 bulan M-1 (H-1).
function notifPeriodeDari(ds) {
  const [y, m, dd] = ds.split("-").map(Number);
  const d = new Date(y, m - 1 + (dd >= 21 ? 1 : 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function notifPeriodeBerikut(pm) {
  const [y, m] = pm.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function notifBatasSubmit(pm) {
  const [y, m] = pm.split("-").map(Number);
  const d = new Date(y, m - 2, 20);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-20`;
}
function notifKodeShift(entry) {
  if (entry == null) return null;
  return typeof entry === "string" ? entry : entry.shift || null;
}
function notifSplitTanggal(key) {
  const m = /^(.*)_(\d{4}-\d{2}-\d{2})(?:_(.*))?$/.exec(key || "");
  return m ? {
    storeId: m[1],
    tanggal: m[2],
    sisa: m[3] || null
  } : {
    storeId: key,
    tanggal: "",
    sisa: null
  };
}

/* u = { id, name, peran: "direksi"|"eri"|"nana"|"elin"|"manajemen"|"spv"|"crew"|"toko", storeIds: [], emp }
   d = kumpulan data (field yang tidak dimiliki sebuah app cukup dibiarkan kosong) */
function hitungNotifikasi(u, d, nowIso) {
  const out = [];
  // Tanggal & jam LOKAL perangkat (bukan UTC), supaya batas harian seperti 14.00 tepat untuk WIB.
  const lokal = new Date(Date.parse(nowIso));
  const p2 = n => String(n).padStart(2, "0");
  const today = `${lokal.getFullYear()}-${p2(lokal.getMonth() + 1)}-${p2(lokal.getDate())}`;
  const jamKini = `${p2(lokal.getHours())}:${p2(lokal.getMinutes())}`;
  const kemarin = notifTambahHari(today, -1);
  const besok = notifTambahHari(today, 1);
  const isDir = u.peran === "direksi";
  const storeNm = id => (d.stores || []).find(s => s.id === id)?.name || id;
  const empNm = id => (d.employees || []).find(e => e.id === id)?.name || id;
  const baru = iso => !!iso && Date.parse(nowIso) - Date.parse(iso) <= 14 * 86400000 && Date.parse(iso) <= Date.parse(nowIso) + 60000;
  const tokoSaya = sid => (u.storeIds || []).includes(sid);
  const lapanganToko = u.peran === "spv" || u.peran === "toko";
  const add = n => out.push({
    waktu: nowIso,
    ...n
  });

  // 1. Laporan toko yang butuh approval (Stok → Elin; Etalase 20:00 → Eri / Direksi)
  (d.approvalQueue || []).forEach(a => {
    const label = NOTIF_APPROVAL_LABEL[a.type] || a.type;
    if (a.status === "pending") {
      const approver = a.type === "stok" ? u.id === "elin" : isDir || u.id === "eri";
      if (approver) add({
        id: `aq_${a.id}`,
        jenis: "approval",
        judul: `Approval ${label}`,
        detail: `${storeNm(a.storeId)} · ${a.date}`,
        waktu: a.requestedAt,
        tujuan: {
          dash: "laporan_approval",
          app: "laporan"
        }
      });
    } else if (lapanganToko && tokoSaya(a.storeId) && baru(a.respondedAt)) {
      add({
        id: `aq_${a.id}_${a.status}`,
        jenis: "info",
        judul: `${label} ${a.status === "approved" ? "disetujui" : "ditolak"}`,
        detail: `${storeNm(a.storeId)} · ${a.date}${a.decidedBy ? ` · oleh ${a.decidedBy}` : ""}${a.finalQty != null ? ` · qty goreng final ${a.finalQty}` : ""}`,
        waktu: a.respondedAt,
        tujuan: {
          app: "laporan"
        }
      });
    }
  });

  // 2. Permintaan edit laporan stok dari toko (Elin / Eri)
  (d.stokEditRequests || []).forEach(r => {
    if (r.status === "pending" && (u.id === "elin" || u.id === "eri")) {
      add({
        id: `ser_${r.id}`,
        jenis: "approval",
        judul: "Permintaan edit laporan stok",
        detail: `${storeNm(r.storeId)} · ${r.tanggal} — ${r.deskripsi || ""}`,
        waktu: r.requestedAt,
        tujuan: {
          dash: "laporan_opname",
          app: "laporan"
        }
      });
    } else if (r.status !== "pending" && r.requestedById === u.id && baru(r.decidedAt || r.approvedAt)) {
      add({
        id: `ser_${r.id}_${r.status}`,
        jenis: "info",
        judul: `Permintaan edit stok ${r.status === "approved" ? "disetujui" : "ditolak"}`,
        detail: `${storeNm(r.storeId)} · ${r.tanggal}${r.decidedNote ? ` — ${r.decidedNote}` : ""}`,
        waktu: r.decidedAt || r.approvedAt,
        tujuan: {
          app: "laporan"
        }
      });
    }
  });

  // 3–5. Edit ulang yang butuh persetujuan kedua Direksi (stok, stok opname, sales)
  const cekDireksi = (map, prefix, judul, dash, app, fmt) => Object.entries(map || {}).forEach(([k, v]) => {
    if (v?.direksiStatus === "pending" && isDir && !v.direksiApprovals?.[u.id]) add({
      id: `${prefix}_${k}`,
      jenis: "approval",
      judul,
      detail: fmt(k, v),
      waktu: v.requestedAt,
      tujuan: {
        dash,
        app
      }
    });
  });
  cekDireksi(d.stokEditLock, "sel", "Approval edit ulang laporan stok", "laporan_approval", "laporan", k => {
    const p = notifSplitTanggal(k);
    return `${storeNm(p.storeId)} · ${p.tanggal} · menunggu persetujuan Anda`;
  });
  cekDireksi(d.opnameEditLock, "oel", "Approval edit stok opname", "laporan_opname", "opname", k => {
    const o = (d.stockOpnameReports || []).find(x => x.id === k);
    return o ? `${storeNm(o.storeId)} · ${o.tanggal}` : k;
  });
  cekDireksi(d.salesEditLock, "sal", "Approval edit laporan sales", "laporan_sales", null, k => {
    const p = notifSplitTanggal(k);
    return `${storeNm(p.storeId)} · ${p.tanggal}${p.sisa ? ` · ${p.sisa.replace("sales_", "").replace("shift", "Shift ")}` : ""}`;
  });

  // 6. PnL: permintaan buka edit (Direksi) & pengingat submit ulang (Eri)
  Object.entries(d.pnlStatus || {}).forEach(([k, v]) => {
    const i = k.lastIndexOf("_");
    const sid = k.slice(0, i);
    const bulan = k.slice(i + 1);
    if (v?.status === "edit_requested" && isDir && !v.approvals?.[u.id]) add({
      id: `pnl_${k}_${v.editRequestedAt}`,
      jenis: "approval",
      judul: "Approval buka edit PnL",
      detail: `${storeNm(sid)} · ${bulan} · diajukan ${v.editRequestedBy || "-"}`,
      waktu: v.editRequestedAt,
      tujuan: {
        dash: "laporan_pnl"
      }
    });
    if (v?.status === "unlocked" && u.id === "eri") add({
      id: `pnlu_${k}_${v.editRequestedAt}`,
      jenis: "reminder",
      judul: "PnL sudah dibuka — submit & kunci kembali",
      detail: `${storeNm(sid)} · ${bulan}`,
      waktu: v.editRequestedAt,
      tujuan: {
        dash: "laporan_pnl"
      }
    });
  });

  // 7. Pembelian bahan baku: permintaan edit (approver = Eri/Nana yang bukan pengaju)
  Object.entries(d.purchaseStatus || {}).forEach(([k, v]) => {
    const p = notifSplitTanggal(k);
    const approverId = v?.editRequestedById === "eri" ? "nana" : "eri";
    if (v?.status === "edit_requested" && u.id === approverId) add({
      id: `pur_${k}_${v.editRequestedAt}`,
      jenis: "approval",
      judul: "Approval edit pembelian bahan baku",
      detail: `${storeNm(p.storeId)} · ${p.tanggal} · diajukan ${v.editRequestedBy || "-"}`,
      waktu: v.editRequestedAt,
      tujuan: {
        dash: "laporan_pembelian",
        app: "laporan"
      }
    });
    if (v?.status === "unlocked" && v.editRequestedById === u.id) add({
      id: `puru_${k}_${v.editRequestedAt}`,
      jenis: "reminder",
      judul: "Edit pembelian disetujui — silakan perbaiki & kunci",
      detail: `${storeNm(p.storeId)} · ${p.tanggal}`,
      waktu: v.editRequestedAt,
      tujuan: {
        dash: "laporan_pembelian",
        app: "laporan"
      }
    });
  });

  // 8. Ijin kerja (Manajemen → Kurnia/Direksi; lainnya → Eri) + hasil untuk pengaju
  (d.ijinList || []).forEach(i => {
    if (i.status === "pending") {
      const approver = i.group === "manajemen" ? isDir : u.id === "eri";
      if (approver) add({
        id: `ijin_${i.id}`,
        jenis: "approval",
        judul: "Approval ijin kerja",
        detail: `${i.empName || empNm(i.empId)} · ${i.jenis} · ${i.tanggalMulai}${i.tanggalSelesai && i.tanggalSelesai !== i.tanggalMulai ? ` s.d. ${i.tanggalSelesai}` : ""}`,
        waktu: i.submittedAt,
        tujuan: {
          dash: "absensi_ijin",
          app: "approval"
        }
      });
    } else if ((i.empId === u.id || i.requestedById === u.id) && baru(i.decidedAt)) {
      add({
        id: `ijin_${i.id}_${i.status}`,
        jenis: "info",
        judul: `Ijin ${i.status === "approved" ? "disetujui" : "ditolak"}`,
        detail: `${i.jenis} · ${i.tanggalMulai}${i.rejectReason ? ` — ${i.rejectReason}` : ""}`,
        waktu: i.decidedAt,
        tujuan: {
          app: "ijin"
        }
      });
    }
  });

  // 9. Pengajuan/pengadaan dari SPV (diproses Eri/Nana) + perkembangan untuk pengaju
  (d.pengajuan || []).forEach(p => {
    if (p.status === "pending" && (u.id === "eri" || u.id === "nana")) add({
      id: `pgj_${p.id}`,
      jenis: "approval",
      judul: "Pengajuan/pengadaan baru",
      detail: `${storeNm(p.storeId)} · ${p.kategori} — ${p.keterangan}`,
      waktu: p.submittedAt,
      tujuan: {
        dash: "laporan_pengajuan"
      }
    });
    const last = (p.riwayat || [])[(p.riwayat || []).length - 1];
    if (last && p.diajukanOlehId === u.id && baru(last.at)) add({
      id: `pgj_${p.id}_${last.at}`,
      jenis: "info",
      judul: `Pengajuan: ${NOTIF_PENGAJUAN_LABEL[last.status] || last.status}`,
      detail: `${p.kategori} · ${storeNm(p.storeId)}${last.catatan ? ` — ${last.catatan}` : ""} (${last.oleh})`,
      waktu: last.at,
      tujuan: {
        dash: "laporan_pengajuan",
        app: "laporan"
      }
    });
  });

  // 10. Transfer stok masuk yang menunggu konfirmasi SPV/akun toko tujuan
  (d.stockTransfers || []).forEach(t => {
    if (t.status === "pending" && lapanganToko && tokoSaya(t.tujuanToko)) add({
      id: `trf_${t.id}`,
      jenis: "approval",
      judul: "Konfirmasi transfer stok masuk",
      detail: `${storeNm(t.asalToko)} → ${storeNm(t.tujuanToko)} · ${t.tanggal} · ${(t.items || []).length} item`,
      waktu: t.submittedAt,
      tujuan: {
        app: "laporan"
      }
    });
  });

  // 11. Jadwal: SPV submit → Eri/Direksi approve; pengingat batas submit untuk SPV & Eri
  const pmIni = notifPeriodeDari(today);
  const pmNext = notifPeriodeBerikut(pmIni);
  Object.entries(d.jadwalStatus || {}).forEach(([pm, st]) => Object.entries(st?.toko || {}).forEach(([sid, t]) => {
    if (t.status === "submitted" && (isDir || u.id === "eri")) add({
      id: `jdw_${pm}_${sid}_${t.submittedAt}`,
      jenis: "approval",
      judul: "Approval jadwal toko",
      detail: `${storeNm(sid)} · periode ${pm} · disubmit ${t.submittedBy}`,
      waktu: t.submittedAt,
      tujuan: {
        dash: "absensi_jadwal"
      }
    });
    if (u.peran === "spv" && tokoSaya(sid) && t.status === "rejected") add({
      id: `jdw_${pm}_${sid}_rej_${t.rejectedAt}`,
      jenis: "reminder",
      judul: "Jadwal ditolak — perbaiki & submit ulang",
      detail: `${storeNm(sid)} · periode ${pm}${t.catatanTolak ? ` — ${t.catatanTolak}` : ""}`,
      waktu: t.rejectedAt,
      tujuan: {
        dash: "absensi_jadwal"
      }
    });
    if (u.peran === "spv" && tokoSaya(sid) && t.status === "approved" && baru(t.approvedAt)) add({
      id: `jdw_${pm}_${sid}_ok_${t.approvedAt}`,
      jenis: "info",
      judul: "Jadwal toko disetujui",
      detail: `${storeNm(sid)} · periode ${pm} · oleh ${t.approvedBy}`,
      waktu: t.approvedAt,
      tujuan: {
        dash: "absensi_jadwal"
      }
    });
  }));
  [pmIni, pmNext].forEach(pm => {
    const batas = notifBatasSubmit(pm);
    const sisa = Math.round((Date.parse(batas + "T00:00:00") - Date.parse(today + "T00:00:00")) / 86400000);
    if (sisa > 5) return;
    const st = (d.jadwalStatus || {})[pm] || {};
    if (u.peran === "spv" && d.jadwalStatus) (u.storeIds || []).forEach(sid => {
      const s = st.toko?.[sid]?.status || "draft";
      if (s === "draft") add({
        id: `jdwr_${pm}_${sid}`,
        jenis: "reminder",
        judul: sisa < 0 ? "Jadwal toko lewat batas submit" : "Segera submit jadwal toko",
        detail: `${storeNm(sid)} · periode ${pm} · batas ${batas}${sisa >= 0 ? ` (${sisa} hari lagi)` : ""}`,
        tujuan: {
          dash: "absensi_jadwal"
        }
      });
    });
    if (u.id === "eri" && d.jadwalStatus && st.status !== "locked") add({
      id: `jdwg_${pm}`,
      jenis: "reminder",
      judul: "Jadwal SPV, TL & Manajemen belum dikunci",
      detail: `Periode ${pm} · batas ${batas}`,
      tujuan: {
        dash: "absensi_jadwal"
      }
    });
  });

  // 12. Banding waste: Direksi memutuskan; pengaju mendapat hasilnya
  (d.wasteBanding || []).forEach(b => {
    if (b.status === "pending" && isDir) add({
      id: `bdg_${b.id}`,
      jenis: "approval",
      judul: "Banding waste daily",
      detail: `${storeNm(b.storeId)} · ${b.tanggal} · ${b.bahanName} — ${b.keterangan}`,
      waktu: b.diajukanAt,
      tujuan: {
        dash: "laporan_waste"
      }
    });else if (b.status !== "pending" && b.diajukanOlehId === u.id && baru(b.diputuskanAt)) add({
      id: `bdg_${b.id}_${b.status}`,
      jenis: "info",
      judul: `Banding ${NOTIF_BANDING_LABEL[b.status] || b.status}`,
      detail: `${storeNm(b.storeId)} · ${b.tanggal} · ${b.bahanName}${b.catatanDireksi ? ` — ${b.catatanDireksi}` : ""} (${b.diputuskanOleh})`,
      waktu: b.diputuskanAt,
      tujuan: {
        dash: "laporan_waste"
      }
    });
  });

  // 13–14. Daily task & tugas khusus (Manajemen, SPV/TL)
  if (["eri", "nana", "elin", "manajemen", "spv"].includes(u.peran) && u.emp) {
    (d.customTasks || []).filter(t => t.empId === u.id && !t.resolved && t.status !== "done").forEach(t => add({
      id: `ctask_${t.id}`,
      jenis: "reminder",
      judul: "Tugas khusus dari Direksi",
      detail: t.label || t.text,
      waktu: t.at,
      tujuan: {
        app: "absensi"
      }
    }));
    if (d.masterTask) {
      const tugas = d.masterTask.filter(t => t.aktif && ((t.untukJabatan || []).includes(u.emp.jabatan) || (t.untukKaryawan || []).includes(u.id)) && (t.frekuensi !== "sesional" || t.mulai && today >= t.mulai && today <= (t.selesai || t.mulai)));
      const lap = (d.laporanManajemen || {})[`${u.id}_${today}`];
      const kode = notifKodeShift((d.schedule || {})[`${u.id}_${today}`]);
      const libur = kode === "O" || kode === "off";
      if (tugas.length && !lap?.submittedAt && !libur) {
        const wajib = tugas.filter(t => t.mandatory).length;
        add({
          id: `dtask_${today}`,
          jenis: "reminder",
          judul: "Daily task hari ini",
          detail: `${tugas.length} task${wajib ? ` (${wajib} wajib Done)` : ""} — diisi sebelum clock out`,
          tujuan: {
            app: "absensi"
          }
        });
      }
    }
  }
  if (isDir && d.masterTask && d.employees) {
    const belum = d.employees.filter(e => ["manajemen", "spv", "tl"].includes(e.group) && e.status !== "nonaktif").filter(e => {
      const kode = notifKodeShift((d.schedule || {})[`${e.id}_${kemarin}`]);
      if (!kode || kode === "O" || kode === "off" || kode === "-") return false;
      const punyaTugas = d.masterTask.some(t => t.aktif && ((t.untukJabatan || []).includes(e.jabatan) || (t.untukKaryawan || []).includes(e.id)));
      return punyaTugas && !(d.laporanManajemen || {})[`${e.id}_${kemarin}`]?.submittedAt;
    });
    if (belum.length) add({
      id: `dtaskdir_${kemarin}`,
      jenis: "reminder",
      judul: "Daily task kemarin belum dilaporkan",
      detail: `${belum.length} orang: ${belum.slice(0, 4).map(e => e.name).join(", ")}${belum.length > 4 ? ", …" : ""}`,
      tujuan: {
        dash: "laporan_kerja_harian"
      }
    });
  }

  // 16. Sanksi: untuk karyawan ybs & SPV tokonya
  (d.sanksiList || []).forEach(s => {
    const tgl = s.inputAt || s.tanggal;
    if (!baru(tgl)) return;
    const e = (d.employees || []).find(x => x.id === s.empId);
    const label = NOTIF_SANKSI_LABEL[s.jenis] || s.jenis;
    if (s.empId === u.id) add({
      id: `snk_${s.id}`,
      jenis: "info",
      judul: `Anda menerima ${label}`,
      detail: `${s.tanggal}${s.alasan ? ` — ${s.alasan}` : ""}`,
      waktu: tgl,
      tujuan: {
        app: "profile"
      }
    });else if (u.peran === "spv" && e && (e.stores || [e.store]).some(sid => tokoSaya(sid))) add({
      id: `snk_${s.id}`,
      jenis: "info",
      judul: `${label} untuk ${e.name}`,
      detail: `${s.tanggal}${s.alasan ? ` — ${s.alasan}` : ""}`,
      waktu: tgl,
      tujuan: {
        dash: "karyawan_sanksi"
      }
    });
  });

  // 17. Laporan toko kemarin belum closing (akun toko & SPV/TL)
  if (lapanganToko && d.reportLog) (u.storeIds || []).forEach(sid => {
    const r = d.reportLog[`${sid}_${kemarin}`];
    if (!r?.closing) add({
      id: `lapk_${sid}_${kemarin}`,
      jenis: "reminder",
      judul: "Laporan kemarin belum closing",
      detail: `${storeNm(sid)} · ${kemarin}`,
      tujuan: {
        dash: "laporan_sales",
        app: "laporan"
      }
    });
  });

  // 18. Jadwal kerja besok (semua karyawan yang punya jadwal)
  const kodeBesok = notifKodeShift((d.schedule || {})[`${u.id}_${besok}`]);
  if (kodeBesok && kodeBesok !== "-" && u.peran !== "toko") add({
    id: `jbsk_${besok}_${kodeBesok}`,
    jenis: "reminder",
    judul: `Jadwal besok: ${NOTIF_SHIFT_LABEL[kodeBesok] || kodeBesok}`,
    detail: besok,
    tujuan: {
      app: "jadwal"
    }
  });

  // 19. ROQ per toko: parameter (tgl kirim → cutoff H-1) per toko holding, snapshoot SPV batas 14.00,
  //     tombol "Ingatkan" dari dashboard, & order Eri/Elin. ais-roq-param = { [storeId]: param } (format lama global tetap terbaca).
  if (d.roqParam) {
    const batas = "14:00";
    const legacy = d.roqParam.cycle != null ? d.roqParam : null;
    const paramToko = sid => d.roqParam[sid] && typeof d.roqParam[sid] === "object" ? d.roqParam[sid] : legacy;
    const holding = (d.stores || []).filter(s => s.status !== "mitra").map(s => s.id).filter(sid => paramToko(sid));
    const jadwalToko = sid => {
      const kirim = paramToko(sid).tglKirim || besok;
      return {
        kirim,
        cutoff: notifTambahHari(kirim, -1)
      };
    };
    const adaSnap = sid => (d.roqSnapshots || []).some(x => x.storeId === sid && x.tanggal === jadwalToko(sid).cutoff && x.status !== "batal");
    holding.forEach(sid => {
      const {
        kirim,
        cutoff
      } = jadwalToko(sid);
      if (today !== cutoff || adaSnap(sid)) return;
      if (u.peran === "spv" && (u.storeIds || []).includes(sid)) {
        if (jamKini < batas) {
          add({
            id: `snap_${sid}_${cutoff}`,
            jenis: "reminder",
            judul: "Isi snapshoot stok sebelum 14.00",
            detail: `${storeNm(sid)} · dasar ROQ pengiriman ${kirim}`,
            tujuan: {
              app: "laporan"
            }
          });
          const ingat = (d.roqIngatkan || []).filter(x => x.storeId === sid && x.cutoff === cutoff).sort((a, b) => (b.at || "").localeCompare(a.at || ""))[0];
          if (ingat) add({
            id: `snapingat_${ingat.id}`,
            jenis: "reminder",
            judul: `Diingatkan ${ingat.oleh}: segera isi snapshoot`,
            detail: `${storeNm(sid)} · batas pukul 14.00 hari ini`,
            tujuan: {
              app: "laporan"
            }
          });
        } else add({
          id: `snaplate_${sid}_${cutoff}`,
          jenis: "reminder",
          judul: "Anda terlambat mengisi snapshoot",
          detail: `${storeNm(sid)} · ROQ memakai sisa stok laporan H-1`,
          tujuan: {
            app: "laporan"
          }
        });
      }
      if (isDir && jamKini >= batas) {
        const spv = (d.employees || []).filter(e => (e.group === "spv" || e.group === "tl") && (e.stores || [e.store]).includes(sid)).map(e => e.name).join(", ");
        add({
          id: `snaplatedir_${sid}_${cutoff}`,
          jenis: "reminder",
          judul: "SPV terlambat mengisi snapshoot",
          detail: `${storeNm(sid)}${spv ? ` · ${spv}` : ""} · cutoff ${cutoff}`,
          tujuan: {
            dash: "laporan_roq"
          }
        });
      }
    });
    if (u.id === "eri" || u.id === "elin") {
      const perKirim = {};
      holding.forEach(sid => {
        const {
          kirim,
          cutoff
        } = jadwalToko(sid);
        if (today >= cutoff && today < kirim && !(d.roqOrders || []).some(o => o.storeId === sid && o.tglKirim === kirim)) (perKirim[kirim] = perKirim[kirim] || []).push(sid);
      });
      Object.entries(perKirim).forEach(([kirim, belum]) => add({
        id: `roqord_${kirim}_${belum.join("-")}`,
        jenis: "reminder",
        judul: "Order ROQ belum disubmit",
        detail: `${belum.length} toko · pengiriman ${kirim}: ${belum.slice(0, 3).map(storeNm).join(", ")}${belum.length > 3 ? ", …" : ""}`,
        tujuan: {
          dash: "roq"
        }
      }));
    }
  }
  const urut = {
    approval: 0,
    reminder: 1,
    info: 2
  };
  const seen = new Set();
  return out.filter(n => seen.has(n.id) ? false : (seen.add(n.id), true)).sort((a, b) => urut[a.jenis] - urut[b.jenis] || String(b.waktu || "").localeCompare(String(a.waktu || "")));
}
function notifWaktuRelatif(iso, nowIso) {
  if (!iso) return "";
  const m = Math.round((Date.parse(nowIso) - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m)) return "";
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  return `${Math.floor(m / 1440)} hari lalu`;
}
const NOTIF_JENIS = {
  approval: {
    label: "Perlu Approval Anda",
    warna: T.bad,
    soft: T.badSoft
  },
  reminder: {
    label: "Pengingat",
    warna: T.warn,
    soft: T.warnSoft
  },
  info: {
    label: "Info",
    warna: T.good,
    soft: T.goodSoft
  }
};
function NotifBell({
  items,
  readMap,
  onMarkRead,
  onOpen,
  nowIso,
  lebarPanel = 360,
  defaultOpen = false
}) {
  const [open, setOpen] = useState(defaultOpen);
  const belum = items.filter(n => !readMap?.[n.id]);
  const approvalCount = items.filter(n => n.jenis === "approval").length;
  const bukaItem = n => {
    onMarkRead([n.id]);
    if (onOpen) onOpen(n);
    setOpen(false);
  };
  return <div style={{
    position: "relative",
    display: "inline-block"
  }}>
      <button onClick={() => setOpen(!open)} title="Notifikasi" style={{
      position: "relative",
      border: `1px solid ${T.line}`,
      background: T.surface,
      borderRadius: 9,
      padding: "6px 8px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }} className="ais-button ais-button--default">
        <Bell size={17} color={T.ink} />
        {belum.length > 0 && <span style={{
        position: "absolute",
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 999,
        padding: "0 5px",
        background: T.bad,
        color: "#fff",
        ...FI,
        fontSize: 10.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
            {belum.length > 99 ? "99+" : belum.length}
          </span>}
      </button>
      {open && <>
          <div onClick={() => setOpen(false)} style={{
        position: "fixed",
        inset: 0,
        zIndex: 40
      }} />
          <div style={{
        position: "absolute",
        right: 0,
        top: "100%",
        marginTop: 8,
        zIndex: 41,
        width: lebarPanel,
        maxWidth: "92vw",
        maxHeight: 480,
        overflow: "auto",
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        textAlign: "left"
      }} className="ais-content-panel">
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          borderBottom: `1px solid ${T.line}`,
          position: "sticky",
          top: 0,
          background: T.surface,
          zIndex: 1
        }}>
              <div>
                <div style={{
              ...FI,
              fontWeight: 700,
              fontSize: 14
            }}>Notifikasi</div>
                <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted
            }}>{belum.length} belum dibaca · {approvalCount} menunggu approval Anda</div>
              </div>
              {belum.length > 0 && <button onClick={() => onMarkRead(belum.map(n => n.id))} style={{
            border: "none",
            background: "transparent",
            color: T.accentDeep,
            ...FI,
            fontWeight: 600,
            fontSize: 11.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">Tandai semua dibaca</button>}
            </div>
            {items.length === 0 && <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          padding: 24,
          textAlign: "center"
        }}>Tidak ada notifikasi.</div>}
            {["approval", "reminder", "info"].map(j => {
          const list = items.filter(n => n.jenis === j);
          if (!list.length) return null;
          return <div key={j}>
                  <div style={{
              ...FI,
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              color: NOTIF_JENIS[j].warna,
              padding: "10px 14px 4px"
            }}>{NOTIF_JENIS[j].label} ({list.length})</div>
                  {list.map(n => {
              const unread = !readMap?.[n.id];
              return <button key={n.id} onClick={() => bukaItem(n)} style={{
                display: "flex",
                gap: 10,
                width: "100%",
                textAlign: "left",
                border: "none",
                borderTop: `1px solid ${T.line}`,
                background: unread ? NOTIF_JENIS[j].soft : "transparent",
                padding: "10px 14px",
                cursor: "pointer"
              }} className="ais-button ais-button--default ais-flex-layout">
                        <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  marginTop: 5,
                  flexShrink: 0,
                  background: unread ? NOTIF_JENIS[j].warna : "transparent",
                  border: `1.5px solid ${NOTIF_JENIS[j].warna}`
                }} />
                        <span style={{
                  flex: 1,
                  minWidth: 0
                }}>
                          <span style={{
                    display: "block",
                    ...FI,
                    fontSize: 12.5,
                    fontWeight: unread ? 700 : 600,
                    color: T.ink
                  }}>{n.judul}</span>
                          <span style={{
                    display: "block",
                    ...FI,
                    fontSize: 11.5,
                    color: T.inkMuted,
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>{n.detail}</span>
                          <span style={{
                    display: "block",
                    ...FI,
                    fontSize: 10.5,
                    color: T.inkMuted,
                    marginTop: 2
                  }}>{notifWaktuRelatif(n.waktu, nowIso)}</span>
                        </span>
                      </button>;
            })}
                </div>;
        })}
          </div>
        </>}
    </div>;
}

/* ---------------------------------------------------------
   SIDEBAR
--------------------------------------------------------- */
const NAV_GROUPS = [{
  key: "overview",
  label: "Overview",
  icon: LayoutDashboard,
  single: true
}, {
  key: "karyawan",
  label: "Karyawan",
  icon: Users,
  pages: [{
    key: "karyawan_master",
    label: "Master Data Karyawan"
  }, {
    key: "karyawan_sanksi",
    label: "Data Sanksi"
  }, {
    key: "karyawan_role",
    label: "Role & Akses"
  }]
}, {
  key: "produksi",
  label: "Master Data",
  icon: Package,
  pages: [{
    key: "produksi_toko",
    label: "Master Toko"
  }, {
    key: "produksi_bahan",
    label: "Master Bahan Baku"
  }, {
    key: "produksi_produk",
    label: "Master Produk"
  }, {
    key: "produksi_resep",
    label: "Master Resep / BOM"
  }, {
    key: "produksi_produksi",
    label: "Master Produksi"
  }, {
    key: "produksi_task",
    label: "Master Task Karyawan"
  }]
}, {
  key: "absensi",
  label: "Absensi",
  icon: CalendarDays,
  pages: [{
    key: "absensi_jadwal",
    label: "Master Jadwal"
  }, {
    key: "absensi_rekap",
    label: "Rekap Absensi"
  }, {
    key: "absensi_ijin",
    label: "Ijin Kerja"
  }]
}, {
  key: "laporan",
  label: "Laporan",
  icon: FileBarChart2,
  pages: [{
    key: "laporan_approval",
    label: "Approval Laporan"
  }, {
    key: "laporan_produksi",
    label: "Rekap Produksi"
  }, {
    key: "laporan_pembelian",
    label: "Rekap Pembelian Bahan Baku"
  }, {
    key: "laporan_opname",
    label: "Rekap Stok Opname"
  }, {
    key: "laporan_transfer",
    label: "Rekap Transfer Stok"
  }, {
    key: "laporan_sales",
    label: "Rekap Sales"
  }, {
    key: "laporan_pengeluaran",
    label: "Rekap Pengeluaran"
  }, {
    key: "laporan_beban",
    label: "Rekap Beban Toko"
  }, {
    key: "laporan_pengajuan",
    label: "Rekap Pengajuan"
  }, {
    key: "laporan_kerja_harian",
    label: "Rekap Daily Task"
  }, {
    key: "laporan_waste",
    label: "Waste Calculation"
  }, {
    key: "laporan_roq",
    label: "Laporan ROQ"
  }, {
    key: "laporan_pnl",
    label: "PnL (Profit & Loss)"
  }]
}, {
  key: "inventory",
  label: "Inventory",
  icon: Boxes,
  pages: [{
    key: "inventory_ringkasan",
    label: "Ringkasan Stok"
  }, {
    key: "inventory_rekap",
    label: "Rekap per Variabel"
  }, {
    key: "roq",
    label: "ROQ"
  }]
}];
function Sidebar({
  page,
  setPage,
  user
}) {
  const [openGroup, setOpenGroup] = useState(() => {
    const g = NAV_GROUPS.find(grp => !grp.single && grp.pages.some(p => p.key === page));
    return g?.key || null;
  });
  const visibleGroups = NAV_GROUPS.map(grp => {
    if (grp.single) return getAccess(user, grp.key) ? grp : null;
    const pages = grp.pages.filter(p => getAccess(user, p.key));
    return pages.length ? {
      ...grp,
      pages
    } : null;
  }).filter(Boolean);
  return <div style={{
    width: 240,
    flexShrink: 0,
    background: T.sidebar,
    minHeight: "100vh",
    padding: "22px 14px",
    display: "flex",
    flexDirection: "column"
  }}>
      <div style={{
      padding: "0 8px",
      marginBottom: 24
    }}>
        <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 22,
        color: "#fff",
        letterSpacing: 0.3
      }}>AIS</div>
        <div style={{
        ...FI,
        fontSize: 11,
        color: "#9BA0AA"
      }}>Dashboard Admin & Manajemen</div>
      </div>

      {visibleGroups.map(grp => {
      if (grp.single) {
        return <button key={grp.key} onClick={() => setPage(grp.key)} style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          textAlign: "left",
          border: "none",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 3,
          cursor: "pointer",
          background: page === grp.key ? T.accent : "transparent",
          color: page === grp.key ? "#fff" : "#B7BBC3",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13
        }} className="ais-button ais-button--default ais-flex-layout" aria-pressed={page === grp.key}>
              <grp.icon size={16} />{grp.label}
            </button>;
      }
      const isOpen = openGroup === grp.key;
      const hasActive = grp.pages.some(p => p.key === page);
      return <div key={grp.key} style={{
        marginBottom: 3
      }}>
            <button onClick={() => setOpenGroup(isOpen ? null : grp.key)} style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          textAlign: "left",
          border: "none",
          borderRadius: 10,
          padding: "10px 12px",
          cursor: "pointer",
          background: hasActive && !isOpen ? T.sidebarSoft : "transparent",
          color: hasActive ? "#fff" : "#B7BBC3",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13
        }} className="ais-button ais-button--default ais-flex-layout">
              <grp.icon size={16} />
              <span style={{
            flex: 1
          }}>{grp.label}</span>
              <ChevronRight size={14} style={{
            transform: isOpen ? "rotate(90deg)" : "none",
            transition: "transform .15s"
          }} />
            </button>
            {isOpen && <div style={{
          marginTop: 2,
          marginLeft: 12,
          paddingLeft: 12,
          borderLeft: `1px solid ${T.sidebarSoft}`
        }}>
                {grp.pages.map(p => <button key={p.key} onClick={() => setPage(p.key)} style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 2,
            cursor: "pointer",
            background: page === p.key ? T.accent : "transparent",
            color: page === p.key ? "#fff" : "#9BA0AA",
            fontFamily: "DM Sans",
            fontWeight: 600,
            fontSize: 12.5
          }} className="ais-button ais-button--default" aria-pressed={page === p.key}>{p.label}</button>)}
              </div>}
          </div>;
    })}

      <div style={{
      marginTop: "auto",
      padding: "12px 10px",
      background: T.sidebarSoft,
      borderRadius: 10
    }}>
        <div style={{
        ...FI,
        fontSize: 11,
        color: "#9BA0AA",
        lineHeight: 1.5
      }}>
          Data pada dashboard ini tersimpan terpisah dari mobile app (prototype). Di working app keduanya akan memakai satu basis data yang sama.
        </div>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: OVERVIEW
--------------------------------------------------------- */
function DireksiOverviewSection({
  stores,
  reportLog,
  bahan,
  stockLedger,
  purchaseReports,
  pnlInputs
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const rows = stores.map(s => {
    const days = dayEntries(reportLog, s.id, month);
    const omset = days.reduce((sum, d) => sum + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);
    const pembelian = purchaseReports.filter(p => p.storeId === s.id && p.tanggal.startsWith(month)).reduce((sum, p) => sum + p.total, 0);
    const persediaanAwal = persediaanNilai(s.id, month, bahan, reportLog, stockLedger, purchaseReports, false);
    const persediaanAkhir = persediaanNilai(s.id, month, bahan, reportLog, stockLedger, purchaseReports, true);
    const ongkosKirim = pnlInputs[`${s.id}_${month}`]?.ongkosKirim || 0;
    const cogs = persediaanAwal + pembelian + ongkosKirim - persediaanAkhir;
    const pct = v => omset ? Math.round(v / omset * 100) : 0;
    return {
      store: s,
      omset,
      pembelian,
      persediaanAkhir,
      cogs,
      cogsPct: pct(cogs),
      stokAkhirPct: pct(persediaanAkhir),
      pembelianPct: pct(pembelian)
    };
  });
  const totalOmset = rows.reduce((s, r) => s + r.omset, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const totalStokAkhir = rows.reduce((s, r) => s + r.persediaanAkhir, 0);
  const totalPembelian = rows.reduce((s, r) => s + r.pembelian, 0);
  const totalPct = v => totalOmset ? Math.round(v / totalOmset * 100) : 0;
  return <div style={{
    marginBottom: 28
  }}>
      <div style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 10
    }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
      </div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 620
      }}>
          <thead>
            <tr style={THBG}>
              {["Toko", "Omset", "% COGS", "% Stok Akhir", "% Pembelian"].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r.store.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{r.store.name}</td>
                <td style={{
              ...TD,
              ...FM
            }}>{rupiah(r.omset)}</td>
                <td style={TD}><span style={{
                fontWeight: 700,
                color: r.cogsPct > 40 ? T.bad : r.cogsPct > 25 ? T.warn : T.good
              }}>{r.cogsPct}%</span></td>
                <td style={TD}>{r.stokAkhirPct}%</td>
                <td style={TD}><span style={{
                fontWeight: 700,
                color: r.pembelianPct > 40 ? T.bad : r.pembelianPct > 25 ? T.warn : T.good
              }}>{r.pembelianPct}%</span></td>
              </tr>)}
            <tr style={{
            borderTop: `2px solid ${T.line}`,
            background: T.surfaceSunk
          }}>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>Total</td>
              <td style={{
              ...TD,
              ...FM,
              fontWeight: 700
            }}>{rupiah(totalOmset)}</td>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>{totalPct(totalCogs)}%</td>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>{totalPct(totalStokAkhir)}%</td>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>{totalPct(totalPembelian)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 8
    }}>
        Omset & persentase COGS/Stok Akhir/Pembelian dihitung untuk bulan yang dipilih (sama seperti PnL & Rekap Pembelian). Ganti bulan lewat filter di atas.
      </div>
    </div>;
}
function OperasionalHarianSection({
  stores,
  reportLog,
  bahan,
  stockLedger,
  purchaseReports,
  stockTransfers,
  pnlInputs,
  attendance,
  employees
}) {
  const today = dateStr(new Date());
  // Omset yang ditampilkan adalah tanggal KEMARIN, karena laporan hari berjalan baru lengkap setelah closing.
  const kemarin = addDaysStr(today, -1);
  const month = monthStr(new Date());
  const rows = stores.map(s => {
    const td = reportLog[`${s.id}_${kemarin}`] || {};
    const omsetKemarin = (td.sales_shift1?.omsetKotor || 0) + (td.sales_shift2?.omsetKotor || 0);
    const days = dayEntries(reportLog, s.id, month);
    const omsetBulan = days.reduce((a, d) => a + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);
    const pembelian = purchaseReports.filter(p => p.storeId === s.id && p.tanggal.startsWith(month)).reduce((a, p) => a + p.total, 0);
    const tIn = nilaiTransferBulan(s.id, month, stockTransfers, "in");
    const tOut = nilaiTransferBulan(s.id, month, stockTransfers, "out");
    const awal = persediaanNilai(s.id, month, bahan, reportLog, stockLedger, purchaseReports, false);
    const akhir = persediaanNilai(s.id, month, bahan, reportLog, stockLedger, purchaseReports, true);
    const ongkir = pnlInputs[`${s.id}_${month}`]?.ongkosKirim || 0;
    const cogs = awal + (pembelian + tIn - tOut) + ongkir - akhir;
    const cogsPct = omsetBulan ? Math.round(cogs / omsetBulan * 100) : 0;
    return {
      store: s,
      omsetKemarin,
      omsetBulan,
      cogs,
      cogsPct,
      adaLaporan: !!(td.sales_shift1 || td.sales_shift2)
    };
  });
  const totalKemarin = rows.reduce((a, r) => a + r.omsetKemarin, 0);
  const totalBulan = rows.reduce((a, r) => a + r.omsetBulan, 0);

  // Live absen harian — dari data absensi hari ini
  const absenHariIni = (attendance || []).filter(a => a.date === today);
  const empById = id => employees.find(e => e.id === id);
  return <div style={{
    marginBottom: 28
  }}>
      <div style={{
      ...FB,
      fontWeight: 700,
      fontSize: 17,
      marginBottom: 2
    }}>Ringkasan Operasional</div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14
    }}>Omset ditampilkan untuk tanggal <b>{kemarin}</b> (kemarin) karena laporan hari berjalan baru lengkap setelah closing. Live absen tetap untuk hari ini ({today}).</div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Omset Kemarin (Semua Toko)" value={rupiah(totalKemarin)} tone="good" />
        <StatCard label={`Omset Bulan Berjalan (${month})`} value={rupiah(totalBulan)} />
        <StatCard label="Toko Sudah Lapor (Kemarin)" value={`${rows.filter(r => r.adaLaporan).length} / ${rows.length}`} tone={rows.every(r => r.adaLaporan) ? "good" : "warn"} />
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto",
      marginBottom: 20
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 560
      }}>
          <thead>
            <tr style={THBG}>
              {["Toko", "Omset Kemarin", "Omset Bulan Berjalan", "% COGS (Bulan)"].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r.store.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{r.store.name}</td>
                <td style={{
              ...TD,
              ...FM
            }}>
                  {r.adaLaporan ? rupiah(r.omsetKemarin) : <span style={{
                color: T.inkMuted,
                ...FI,
                fontStyle: "italic"
              }}>belum lapor</span>}
                </td>
                <td style={{
              ...TD,
              ...FM
            }}>{rupiah(r.omsetBulan)}</td>
                <td style={TD}>
                  <span style={{
                fontWeight: 700,
                color: r.cogsPct > 45 ? T.bad : r.cogsPct > 35 ? T.warn : T.good
              }}>{r.cogsPct}%</span>
                </td>
              </tr>)}
            <tr style={{
            borderTop: `2px solid ${T.line}`,
            background: T.surfaceSunk
          }}>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>Total</td>
              <td style={{
              ...TD,
              ...FM,
              fontWeight: 700
            }}>{rupiah(totalKemarin)}</td>
              <td style={{
              ...TD,
              ...FM,
              fontWeight: 700
            }}>{rupiah(totalBulan)}</td>
              <td style={{
              ...TD,
              fontWeight: 700
            }}>{totalBulan ? Math.round(rows.reduce((a, r) => a + r.cogs, 0) / totalBulan * 100) : 0}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{
      ...FI,
      fontWeight: 700,
      fontSize: 11,
      color: T.inkMuted,
      textTransform: "uppercase",
      marginBottom: 8
    }}>Live Absen Harian ({absenHariIni.length})</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 520
      }}>
          <thead>
            <tr style={THBG}>
              {["Karyawan", "Jabatan", "Toko", "Shift", "Status"].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {absenHariIni.length === 0 && <tr><td colSpan={5} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada absensi tercatat hari ini.</td></tr>}
            {absenHariIni.map((a, i) => {
            const emp = empById(a.empId);
            const storeName = stores.find(s => s.id === emp?.store)?.name || (a.shift === "kantor" ? "Kantor" : "-");
            return <tr key={i} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                ...TD,
                fontWeight: 600
              }}>{emp?.name || a.empId}</td>
                  <td style={{
                ...TD,
                color: T.inkMuted
              }}>{emp?.jabatan || "-"}</td>
                  <td style={{
                ...TD,
                color: T.inkMuted
              }}>{storeName}</td>
                  <td style={TD}>{labelShiftAbsen(a.shift, a.empId)}</td>
                  <td style={TD}>
                    <div style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "wrap"
                }} className="ais-flex-layout">
                      <Badge tone={a.telat ? "warn" : "good"}>{a.telat ? `Terlambat ${a.telatMenit}m` : "Ontime"}</Badge>
                      {a.pulangCepat && <Badge tone="bad">Pulang Cepat</Badge>}
                    </div>
                  </td>
                </tr>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* =========================================================
   MASTER TASK KARYAWAN (khusus Direksi) — sumber checklist Laporan Kerja Harian di mobile app
   (syarat clock out Manajemen & SPV/TL). Disimpan di "ais-master-task", dibaca juga oleh mobile app.
   frekuensi "daily" = muncul setiap hari; "sesional" = hanya pada rentang tanggal mulai–selesai.
========================================================= */
const _CHECKLIST_AWAL = {
  "Admin Utama": [["Rekap absensi & jadwal karyawan sudah dicek", true], ["Approval laporan toko hari ini sudah diproses", true], ["Koordinasi dengan SPV toko sudah dilakukan", false], ["Isu operasional (jika ada) sudah ditindaklanjuti", false]],
  Finance: [["Rekap omset harian semua toko sudah dicatat", true], ["Pengeluaran toko sudah diverifikasi", true], ["Kas/saldo harian sudah direkonsiliasi", false]],
  "Admin Inventory": [["Stok bahan baku semua toko sudah dicek", true], ["Kebutuhan pemesanan bahan sudah diproses", false], ["Data stok sudah sinkron dengan sistem", false]],
  "Graphic Designer": [["Brief/permintaan desain hari ini sudah diproses", true], ["Konten/asset hari ini sudah selesai atau di-review", false], ["File final sudah diupload ke folder terkait", false]],
  "SPV Jr": [["Monitoring toko dedicated hari ini sudah dilakukan", true], ["Laporan crew toko sudah dicek & sesuai", false], ["Isu operasional toko (jika ada) sudah ditindaklanjuti", false]]
};
// Id dibuat sama persis dengan DEFAULT_MASTER_TASK di mobile app.
const DEFAULT_MASTER_TASK = Object.entries(_CHECKLIST_AWAL).flatMap(([jab, list]) => list.map(([label, mandatory], i) => ({
  id: `mt_${jab.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${i + 1}`,
  label,
  untukJabatan: [jab],
  untukKaryawan: [],
  frekuensi: "daily",
  mulai: null,
  selesai: null,
  mandatory,
  aktif: true,
  createdBy: "Sistem (migrasi checklist lama)",
  createdAt: "2026-09-25T00:00:00"
})));
function taskBerlakuHari(t, emp, ds) {
  if (!t || !t.aktif || !emp) return false;
  const untuk = (t.untukJabatan || []).includes(emp.jabatan) || (t.untukKaryawan || []).includes(emp.id);
  if (!untuk) return false;
  if (t.frekuensi === "sesional") return !!t.mulai && ds >= t.mulai && ds <= (t.selesai || t.mulai);
  return true;
}
const TASK_KANDIDAT_GROUP = ["manajemen", "spv", "tl"];
function MasterTaskForm({
  initial,
  jabatanList,
  karyawanList,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(initial || {
    label: "",
    untukJabatan: [],
    untukKaryawan: [],
    frekuensi: "daily",
    mulai: "",
    selesai: "",
    mandatory: true,
    aktif: true
  });
  const set = (k, v) => setF({
    ...f,
    [k]: v
  });
  const toggle = (k, v) => set(k, (f[k] || []).includes(v) ? f[k].filter(x => x !== v) : [...(f[k] || []), v]);
  const sesionalOk = f.frekuensi !== "sesional" || f.mulai && (!f.selesai || f.selesai >= f.mulai);
  const valid = f.label.trim() && ((f.untukJabatan || []).length || (f.untukKaryawan || []).length) && sesionalOk;
  const Chip = ({
    on,
    onClick,
    children
  }) => <button type="button" onClick={onClick} style={{
    border: `1px solid ${on ? T.manajemen : T.line}`,
    background: on ? T.manajemenSoft : T.surface,
    color: on ? T.manajemen : T.inkMuted,
    borderRadius: 999,
    padding: "5px 11px",
    ...FI,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer"
  }} className="ais-button ais-button--default">{children}</button>;
  const Label = ({
    children
  }) => <div style={{
    ...FI,
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: "12px 0 6px"
  }}>{children}</div>;
  return <FormSurface title="Tugas & penanggung jawab." subtitle="Tentukan tanggung jawab, penugasan, dan frekuensi pekerjaan." code="TASK"><div>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 4
      }}>{initial?.id ? "Edit Task" : "Tambah Task"}</div>
      <Label>Uraian Task</Label>
      <input value={f.label} onChange={e => set("label", e.target.value)} placeholder="Contoh: Cek kebersihan area dapur semua toko" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "9px 12px",
        ...FI,
        fontSize: 13
      }} className="ais-control" />

      <Label>Untuk Jabatan</Label>
      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {jabatanList.map(j => <Chip key={j} on={(f.untukJabatan || []).includes(j)} onClick={() => toggle("untukJabatan", j)}>{j}</Chip>)}
      </div>
      <Label>Atau Karyawan Tertentu (opsional)</Label>
      <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {karyawanList.map(e => <Chip key={e.id} on={(f.untukKaryawan || []).includes(e.id)} onClick={() => toggle("untukKaryawan", e.id)}>{e.name}</Chip>)}
      </div>

      <div style={{
        display: "flex",
        gap: 24,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        <div>
          <Label>Frekuensi</Label>
          <div style={{
            display: "flex",
            gap: 6
          }} className="ais-flex-layout">
            <Chip on={f.frekuensi === "daily"} onClick={() => set("frekuensi", "daily")}>Daily (setiap hari)</Chip>
            <Chip on={f.frekuensi === "sesional"} onClick={() => set("frekuensi", "sesional")}>Sesional (periode tertentu)</Chip>
          </div>
        </div>
        <div>
          <Label>Sifat</Label>
          <div style={{
            display: "flex",
            gap: 6
          }} className="ais-flex-layout">
            <Chip on={f.mandatory} onClick={() => set("mandatory", true)}>Mandatory</Chip>
            <Chip on={!f.mandatory} onClick={() => set("mandatory", false)}>Non Mandatory</Chip>
          </div>
        </div>
      </div>
      {f.frekuensi === "sesional" && <div style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
          <div>
            <Label>Tanggal Mulai</Label>
            <input type="date" value={f.mulai || ""} onChange={e => set("mulai", e.target.value)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 10px",
            ...FI,
            fontSize: 13
          }} className="ais-control" />
          </div>
          <div>
            <Label>Tanggal Selesai</Label>
            <input type="date" value={f.selesai || ""} onChange={e => set("selesai", e.target.value)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 10px",
            ...FI,
            fontSize: 13
          }} className="ais-control" />
          </div>
          <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted,
          alignSelf: "flex-end",
          paddingBottom: 10,
          maxWidth: 300
        }}>Kosongkan tanggal selesai bila task hanya berlaku 1 hari.</div>
        </div>}
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginTop: 12
      }}>
        Mandatory = wajib berstatus <b>Done</b> sebelum clock out. Non Mandatory = cukup diberi status (bila bukan Done, wajib isi keterangan).
      </div>
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 14
      }} className="ais-flex-layout">
        <button disabled={!valid} onClick={() => onSave({
          ...f,
          label: f.label.trim(),
          mulai: f.frekuensi === "sesional" ? f.mulai : null,
          selesai: f.frekuensi === "sesional" ? f.selesai || f.mulai : null
        })} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: valid ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: valid ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan Task</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 16px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function MasterTaskPage({
  masterTask,
  setMasterTask,
  employees,
  currentUser,
  readOnly
}) {
  const [formFor, setFormFor] = useState(null); // null | "new" | task
  const [filterJab, setFilterJab] = useState("all");
  const [filterFrek, setFilterFrek] = useState("all");
  const kandidat = employees.filter(e => TASK_KANDIDAT_GROUP.includes(e.group) && e.status === "aktif");
  const jabatanList = [...new Set(kandidat.map(e => e.jabatan).filter(Boolean))];
  const today = dateStr(new Date());
  const simpan = data => {
    const now = new Date().toISOString();
    if (formFor && formFor !== "new") {
      setMasterTask(masterTask.map(t => t.id === formFor.id ? {
        ...t,
        ...data,
        updatedBy: currentUser.name,
        updatedAt: now
      } : t));
    } else {
      setMasterTask([...masterTask, {
        ...data,
        id: `mt_${Date.now()}`,
        createdBy: currentUser.name,
        createdAt: now
      }]);
    }
    setFormFor(null);
  };
  const toggleAktif = t => setMasterTask(masterTask.map(x => x.id === t.id ? {
    ...x,
    aktif: !x.aktif,
    updatedBy: currentUser.name,
    updatedAt: new Date().toISOString()
  } : x));
  const hapus = t => {
    if (window.confirm(`Hapus task "${t.label}"? Riwayat laporan lama tetap tersimpan.`)) setMasterTask(masterTask.filter(x => x.id !== t.id));
  };
  const rows = masterTask.filter(t => filterJab === "all" || (t.untukJabatan || []).includes(filterJab) || (t.untukKaryawan || []).some(id => employees.find(e => e.id === id)?.jabatan === filterJab)).filter(t => filterFrek === "all" || t.frekuensi === filterFrek);
  const untukLabel = t => [...(t.untukJabatan || []), ...(t.untukKaryawan || []).map(id => employees.find(e => e.id === id)?.name || id)].join(", ");
  const statusSesional = t => t.frekuensi !== "sesional" ? null : today < t.mulai ? "akan datang" : today > (t.selesai || t.mulai) ? "sudah lewat" : "berjalan";
  return <div>
      <SectionTitle icon={ClipboardCheck} action={!readOnly && !formFor && <button onClick={() => setFormFor("new")} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "9px 14px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout">
          <Plus size={14} /> Tambah Task
        </button>}>Master Task Karyawan</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10,
      lineHeight: 1.6
    }} className="ais-content-panel">
        Task di sini menjadi checklist <b>Laporan Kerja Harian</b> di mobile app Manajemen &amp; SPV/TL, yang menjadi syarat clock out.
        <b> Daily</b> muncul setiap hari; <b>Sesional</b> hanya muncul pada rentang tanggalnya. Task yang dinonaktifkan tidak muncul lagi mulai hari itu; laporan lama tidak berubah.
      </div>

      {formFor && <MasterTaskForm initial={formFor === "new" ? null : formFor} jabatanList={jabatanList} karyawanList={kandidat} onSave={simpan} onCancel={() => setFormFor(null)} />}

      <div style={{
      display: "flex",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <select value={filterJab} onChange={e => setFilterJab(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
          <option value="all">Semua Jabatan</option>
          {jabatanList.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <select value={filterFrek} onChange={e => setFilterFrek(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
          <option value="all">Semua Frekuensi</option>
          <option value="daily">Daily</option>
          <option value="sesional">Sesional</option>
        </select>
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 760
      }}>
          <thead><tr style={THBG}>{["Task", "Untuk", "Frekuensi", "Sifat", "Status", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{
              ...TD,
              color: T.inkMuted,
              padding: 18
            }}>Belum ada task.</td></tr>}
            {rows.map(t => <tr key={t.id} style={{
            borderTop: `1px solid ${T.line}`,
            opacity: t.aktif ? 1 : 0.55
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{t.label}</td>
                <td style={{
              ...TD,
              color: T.inkMuted
            }}>{untukLabel(t) || "-"}</td>
                <td style={TD}>
                  {t.frekuensi === "daily" ? <Badge tone="manajemen">Daily</Badge> : <><Badge tone="warn">Sesional</Badge><div style={{
                  ...FI,
                  fontSize: 11,
                  color: T.inkMuted,
                  marginTop: 3
                }}>{t.mulai}{t.selesai && t.selesai !== t.mulai ? ` s.d. ${t.selesai}` : ""} · {statusSesional(t)}</div></>}
                </td>
                <td style={TD}>{t.mandatory ? <Badge tone="bad">Mandatory</Badge> : <Badge tone="good">Non Mandatory</Badge>}</td>
                <td style={TD}>{t.aktif ? <Badge tone="good">Aktif</Badge> : <Badge tone="warn">Nonaktif</Badge>}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              whiteSpace: "nowrap"
            }}>
                  {!readOnly && <div style={{
                display: "inline-flex",
                gap: 6
              }}>
                      <button onClick={() => setFormFor(t)} title="Edit" style={{
                  border: `1px solid ${T.line}`,
                  borderRadius: 8,
                  padding: "5px 8px",
                  background: T.surface,
                  cursor: "pointer"
                }} className="ais-button ais-button--default"><Pencil size={13} color={T.inkMuted} /></button>
                      <button onClick={() => toggleAktif(t)} style={{
                  border: `1px solid ${T.line}`,
                  borderRadius: 8,
                  padding: "5px 9px",
                  background: T.surface,
                  cursor: "pointer",
                  ...FI,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: T.inkMuted
                }} className="ais-button ais-button--default">{t.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
                      <button onClick={() => hapus(t)} title="Hapus" style={{
                  border: `1px solid ${T.line}`,
                  borderRadius: 8,
                  padding: "5px 8px",
                  background: T.surface,
                  cursor: "pointer"
                }} className="ais-button ais-button--default"><Trash2 size={13} color={T.bad} /></button>
                    </div>}
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---- Rekap Daily Task: helper status per item ---- */
const TASK_STATUS_LABEL = {
  done: "Done",
  pending: "Pending",
  notyet: "Not Yet"
};
function taskItemStatus(v) {
  if (v && typeof v === "object") return v.status || "";
  return v ? "done" : ""; // format lama (boolean)
}
function RekapDailyTaskPerTask({
  rows,
  employees
}) {
  const agg = {};
  rows.forEach(r => {
    Object.entries(r.checklist || {}).forEach(([label, v]) => {
      const meta = (r.data.items || []).find(i => i.label === label);
      if (!agg[label]) agg[label] = {
        label,
        mandatory: meta?.mandatory,
        frekuensi: meta?.frekuensi,
        done: 0,
        pending: 0,
        notyet: 0,
        kosong: 0,
        orang: new Set()
      };
      const st = taskItemStatus(v);
      agg[label][st || "kosong"] += 1;
      agg[label].orang.add(r.empId);
    });
  });
  const list = Object.values(agg).sort((a, b) => a.done / Math.max(1, a.done + a.pending + a.notyet + a.kosong) - b.done / Math.max(1, b.done + b.pending + b.notyet + b.kosong));
  return <div style={{
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    overflow: "auto"
  }} className="ais-content-panel">
      <table style={{
      width: "100%",
      borderCollapse: "collapse",
      ...FI,
      fontSize: 12.5,
      minWidth: 720
    }}>
        <thead><tr style={THBG}>{["Task", "Sifat", "Karyawan", "Done", "Pending", "Not Yet", "% Done"].map((h, i) => <th key={h} style={{
            ...TH,
            textAlign: i >= 2 ? "right" : "left"
          }}>{h}</th>)}</tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={7} style={{
            ...TD,
            color: T.inkMuted,
            padding: 18
          }}>Belum ada laporan pada bulan ini.</td></tr>}
          {list.map(a => {
          const total = a.done + a.pending + a.notyet + a.kosong;
          const pct = total ? Math.round(a.done / total * 100) : 0;
          return <tr key={a.label} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{a.label}{a.frekuensi === "sesional" && <span style={{
                marginLeft: 6
              }}><Badge tone="warn">Sesional</Badge></span>}</td>
                <td style={TD}>{a.mandatory ? <Badge tone="bad">Mandatory</Badge> : a.mandatory === false ? <Badge tone="good">Non Mandatory</Badge> : <span style={{
                color: T.inkMuted
              }}>—</span>}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{a.orang.size}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: T.good
            }}>{a.done}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: T.warn
            }}>{a.pending}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: T.bad
            }}>{a.notyet + a.kosong}</td>
                <td style={{
              ...TD,
              textAlign: "right"
            }}><Badge tone={pct === 100 ? "good" : pct >= 60 ? "warn" : "bad"}>{pct}%</Badge></td>
              </tr>;
        })}
        </tbody>
      </table>
    </div>;
}

/* =========================================================
   OVERVIEW SPV — toko yang dinaungi saja
========================================================= */
function cogsBulanToko(storeId, month, {
  reportLog,
  bahan,
  stockLedger,
  purchaseReports,
  stockTransfers,
  pnlInputs
}) {
  const days = dayEntries(reportLog, storeId, month);
  const omsetBulan = days.reduce((a, d) => a + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);
  const pembelian = purchaseReports.filter(p => p.storeId === storeId && p.tanggal.startsWith(month)).reduce((a, p) => a + p.total, 0);
  const tIn = nilaiTransferBulan(storeId, month, stockTransfers, "in");
  const tOut = nilaiTransferBulan(storeId, month, stockTransfers, "out");
  const awal = persediaanNilai(storeId, month, bahan, reportLog, stockLedger, purchaseReports, false);
  const akhir = persediaanNilai(storeId, month, bahan, reportLog, stockLedger, purchaseReports, true);
  const ongkir = pnlInputs?.[`${storeId}_${month}`]?.ongkosKirim || 0;
  const cogs = awal + (pembelian + tIn - tOut) + ongkir - akhir;
  return {
    omsetBulan,
    cogs,
    cogsPct: omsetBulan ? cogs / omsetBulan * 100 : null
  };
}
function SpvOverviewSection({
  stores,
  allStores,
  reportLog,
  bahan,
  products,
  stockLedger,
  purchaseReports,
  stockTransfers,
  pnlInputs,
  minyakConfig,
  banding
}) {
  const today = dateStr(new Date());
  const kemarin = addDaysStr(today, -1);
  const month = monthStr(new Date());
  const rows = useMemo(() => stores.map(s => {
    const td = reportLog[`${s.id}_${kemarin}`] || {};
    const omsetHarian = (td.sales_shift1?.omsetKotor || 0) + (td.sales_shift2?.omsetKotor || 0);
    const c = cogsBulanToko(s.id, month, {
      reportLog,
      bahan,
      stockLedger,
      purchaseReports,
      stockTransfers,
      pnlInputs
    });
    const w = hitungWasteBulan({
      storeId: s.id,
      stores: allStores,
      month,
      reportLog,
      products,
      bahan,
      purchaseReports,
      minyakConfig,
      pakaiToleransi: true,
      banding
    });
    return {
      store: s,
      omsetHarian,
      adaLaporan: !!(td.sales_shift1 || td.sales_shift2),
      ...c,
      wasteNilai: w.totals.nilaiMinus,
      wastePct: w.totals.pctOmset
    };
  }), [stores, allStores, reportLog, bahan, products, stockLedger, purchaseReports, stockTransfers, pnlInputs, minyakConfig, banding, kemarin, month]);
  const pctTxt = v => v == null ? "—" : `${v.toFixed(1)}%`;
  return <div style={{
    marginBottom: 28
  }}>
      <div style={{
      ...FB,
      fontWeight: 700,
      fontSize: 17,
      marginBottom: 2
    }}>Ringkasan Toko Anda</div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Omset harian = tanggal <b>{kemarin}</b> (kemarin), karena laporan hari berjalan baru lengkap setelah closing. Omset, waste, dan COGS berjalan = bulan {month} s.d. laporan terakhir.
      </div>
      {rows.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>Belum ada toko yang Anda naungi.</div>}
      <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: 16
    }} className="ais-responsive-grid">
        {rows.map(r => <div key={r.store.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 18
      }} className="ais-content-panel">
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12
        }}>
              <div style={{
            ...FB,
            fontSize: 20,
            fontWeight: 700
          }}>{r.store.name}</div>
              {r.adaLaporan ? <Badge tone="good">Lapor kemarin</Badge> : <Badge tone="bad">Belum lapor kemarin</Badge>}
            </div>
            {[{
          l: "Omset Harian (kemarin)",
          v: rupiah(r.omsetHarian)
        }, {
          l: "Total Omset Berjalan",
          v: rupiah(r.omsetBulan)
        }, {
          l: "Nilai Total Waste",
          v: r.wasteNilai < 0 ? `−${rupiah(-r.wasteNilai)}` : rupiah(0),
          c: r.wasteNilai < 0 ? T.bad : T.good
        }, {
          l: "% Waste terhadap Omset",
          v: pctTxt(r.wastePct == null ? null : r.wastePct * 100),
          c: T.warn
        }, {
          l: "% COGS Berjalan",
          v: pctTxt(r.cogsPct),
          c: r.cogsPct == null ? T.ink : r.cogsPct > 45 ? T.bad : r.cogsPct > 35 ? T.warn : T.good
        }].map(x => <div key={x.l} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "7px 0",
          borderTop: `1px solid ${T.line}`,
          ...FI,
          fontSize: 13
        }}>
                <span style={{
            color: T.inkMuted
          }}>{x.l}</span>
                <span style={{
            ...FM,
            fontWeight: 700,
            color: x.c || T.ink
          }}>{x.v}</span>
              </div>)}
          </div>)}
      </div>
    </div>;
}
function OverviewPage({
  employees,
  stores,
  approvalQueue,
  reportLog,
  bahan,
  stockLedger,
  purchaseReports,
  stockTransfers,
  pnlInputs,
  attendance,
  currentUser,
  products,
  allStores,
  minyakConfig,
  banding
}) {
  const activeEmp = employees.filter(e => e.status === "aktif");
  const pending = approvalQueue.filter(a => a.status === "pending");
  const byGroup = g => activeEmp.filter(e => e.group === g).length;
  const showOperasional = currentUser.access === "admin_utama" || currentUser.access === "all";
  if (currentUser.access === "spv") {
    return <div>
        <SectionTitle icon={LayoutDashboard}>Overview</SectionTitle>
        <SpvOverviewSection stores={stores} allStores={allStores || stores} reportLog={reportLog} bahan={bahan} products={products} stockLedger={stockLedger} purchaseReports={purchaseReports} stockTransfers={stockTransfers} pnlInputs={pnlInputs} minyakConfig={minyakConfig} banding={banding} />
      </div>;
  }
  return <div>
      <SectionTitle icon={LayoutDashboard}>Overview</SectionTitle>
      {showOperasional && <OperasionalHarianSection stores={stores} reportLog={reportLog} bahan={bahan} stockLedger={stockLedger} purchaseReports={purchaseReports} stockTransfers={stockTransfers} pnlInputs={pnlInputs} attendance={attendance} employees={employees} />}
      {currentUser.access === "all" && <DireksiOverviewSection stores={stores} reportLog={reportLog} bahan={bahan} stockLedger={stockLedger} purchaseReports={purchaseReports} pnlInputs={pnlInputs} />}
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 24,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Karyawan Aktif" value={activeEmp.length} />
        <StatCard label="Jumlah Toko" value={stores.length} />
        <StatCard label="Laporan Menunggu Approval" value={pending.length} tone="warn" />
        <StatCard label="Akun Toko Terdaftar" value={byGroup("toko_device")} tone="good" />
      </div>

      <div style={{
      display: "grid",
      gridTemplateColumns: "1.3fr 1fr",
      gap: 16
    }} className="ais-responsive-grid">
        <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 18
      }} className="ais-content-panel">
          <SectionTitle>Distribusi Karyawan per Grup</SectionTitle>
          {["manajemen", "crew", "parttime", "spv", "tl", "direksi"].map(g => {
          const count = byGroup(g);
          const max = activeEmp.length || 1;
          return <div key={g} style={{
            marginBottom: 10
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              ...FI,
              fontSize: 12.5,
              marginBottom: 4
            }}>
                  <span>{GROUP_LABEL[g]}</span><span style={{
                fontWeight: 700
              }}>{count}</span>
                </div>
                <div style={{
              height: 8,
              borderRadius: 6,
              background: T.surfaceSunk,
              overflow: "hidden"
            }} className="ais-content-panel">
                  <div style={{
                height: "100%",
                width: `${count / max * 100}%`,
                background: T.accent,
                borderRadius: 6
              }} />
                </div>
              </div>;
        })}
        </div>

        <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 18
      }} className="ais-content-panel">
          <SectionTitle>Menunggu Approval</SectionTitle>
          {pending.length === 0 && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>Tidak ada laporan pending.</div>}
          {pending.map(p => <div key={p.id} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 0",
          borderBottom: `1px solid ${T.line}`
        }}>
              <div style={{
            ...FI,
            fontSize: 12.5
          }}>{stores.find(s => s.id === p.storeId)?.name} · {APPROVAL_TYPE_LABEL[p.type]}</div>
              <Badge tone="warn">Pending</Badge>
            </div>)}
        </div>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: MASTER KARYAWAN
--------------------------------------------------------- */
function EmployeeFormPanel({
  initial,
  stores,
  onSave,
  onCancel
}) {
  const [form, setForm] = useState(initial || {
    name: "",
    jabatan: "",
    group: "crew",
    store: stores[0]?.id || "",
    stores: null,
    status: "aktif",
    joinDate: "",
    statusKontrak: "kontrak",
    kontrakEnd: "",
    cutiKuota: 12
  });
  const set = (k, v) => setForm({
    ...form,
    [k]: v
  });
  const needsSingleStore = form.group === "crew" || form.group === "parttime" || form.group === "toko_device";
  // SPV bisa menaungi beberapa toko; TL hanya satu.
  const needsDualStore = form.group === "spv";
  const spvStores = form.stores || [stores[0]?.id, stores[1]?.id];
  const isKepegawaian = form.group !== "toko_device";
  const setSpvStore = (idx, val) => {
    const next = [...spvStores];
    next[idx] = val;
    set("stores", next);
  };
  return <FormSurface title="Identitas & penugasan." subtitle="Lengkapi identitas, penugasan, dan status kepegawaian." code="PEOPLE"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.3fr 1fr 1fr",
        gap: 12,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <TextField label="Nama" value={form.name} onChange={v => set("name", v)} placeholder="Nama lengkap" />
        <SelectField label="Grup" value={form.group} onChange={v => set("group", v)} options={Object.entries(GROUP_LABEL).map(([k, v]) => ({
          value: k,
          label: v
        }))} />
        <TextField label="Jabatan" value={form.jabatan} onChange={v => set("jabatan", v)} placeholder="mis. Finance / Crew / SPV Jr" />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: needsDualStore ? "1fr 1fr 1fr" : "1fr 1fr",
        gap: 12,
        marginBottom: 12
      }} className="ais-responsive-grid">
        {needsSingleStore && <SelectField label={form.group === "parttime" ? "Toko Default" : "Toko"} value={form.store || ""} onChange={v => set("store", v)} options={stores.map(s => ({
          value: s.id,
          label: s.name
        }))} />}
        {needsDualStore && <>
            <SelectField label="Toko Dedicated 1" value={spvStores[0] || ""} onChange={v => setSpvStore(0, v)} options={stores.map(s => ({
            value: s.id,
            label: s.name
          }))} />
            <SelectField label="Toko Dedicated 2" value={spvStores[1] || ""} onChange={v => setSpvStore(1, v)} options={stores.map(s => ({
            value: s.id,
            label: s.name
          }))} />
          </>}
        <SelectField label="Status" value={form.status} onChange={v => set("status", v)} options={[{
          value: "aktif",
          label: "Aktif"
        }, {
          value: "nonaktif",
          label: "Nonaktif"
        }]} />
      </div>

      {isKepegawaian && <>
          <div style={{
          display: "grid",
          gridTemplateColumns: form.statusKontrak === "kontrak" ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: 12,
          marginBottom: form.group === "manajemen" ? 12 : 14
        }} className="ais-responsive-grid">
            <TextField label="Join Date" type="date" value={form.joinDate || ""} onChange={v => set("joinDate", v)} />
            <SelectField label="Status Kontrak" value={form.statusKontrak || "kontrak"} onChange={v => set("statusKontrak", v)} options={Object.entries(STATUS_KONTRAK_LABEL).map(([k, v]) => ({
            value: k,
            label: v
          }))} />
            {form.statusKontrak === "kontrak" && <TextField label="Tanggal Habis Kontrak" type="date" value={form.kontrakEnd || ""} onChange={v => set("kontrakEnd", v)} />}
          </div>
          {form.joinDate && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 14
        }}>Masa kerja saat ini: <b>{formatMasaKerja(form.joinDate)}</b></div>}
          {form.group === "manajemen" && <div style={{
          marginBottom: 14,
          maxWidth: 220
        }}>
              <TextField label="Kuota Cuti Tahunan (hari)" type="number" value={form.cutiKuota ?? 12} onChange={v => set("cutiKuota", Number(v))} />
            </div>}
        </>}

      {form.group === "parttime" && <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 14
      }}>Part Time bebas pilih toko absen setiap hari di mobile app — toko di sini hanya default awal.</div>}
      <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
        <button onClick={() => onSave({
          ...form,
          store: needsSingleStore ? form.store : needsDualStore ? spvStores[0] : null,
          stores: needsDualStore ? spvStores : null,
          kontrakEnd: form.statusKontrak === "kontrak" ? form.kontrakEnd : null,
          cutiKuota: form.group === "manajemen" ? form.cutiKuota ?? 12 : null
        })} disabled={!form.name} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: form.name ? T.manajemen : T.line,
          color: "#fff",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13,
          cursor: form.name ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 16px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
const GRUP_DIKUNCI_DASH = new Set(["crew", "parttime", "spv", "tl", "toko_device"]);
function PenguncianPerangkatPanel({
  employees,
  deviceBinding,
  setDeviceBinding,
  currentUser
}) {
  const [konfirmasi, setKonfirmasi] = useState(null);
  const bisaReset = currentUser?.access === "admin_utama" || currentUser?.access === "all";
  const daftar = employees.filter(e => GRUP_DIKUNCI_DASH.has(e.group) && e.status === "aktif");
  const terdaftar = daftar.filter(e => deviceBinding?.[e.id]).length;
  const reset = empId => {
    const baru = {
      ...(deviceBinding || {})
    };
    delete baru[empId];
    setDeviceBinding(baru);
    setKonfirmasi(null);
  };
  return <div style={{
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20
  }} className="ais-content-panel">
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 10
    }} className="ais-flex-layout">
        <div>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          gap: 7
        }} className="ais-flex-layout">
            <Lock size={15} /> Penguncian Perangkat
          </div>
          <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginTop: 3,
          maxWidth: 620
        }}>
            Simulasi penguncian perangkat pada browser ini. Verifikasi perangkat lintas HP memerlukan backend produksi.
            HP pertama yang berhasil login otomatis terdaftar. Crew, Part Time, SPV, TL, dan Akun Toko dikunci; Manajemen &amp; Direksi tidak.
          </div>
        </div>
        <Badge tone="manajemen">{terdaftar} / {daftar.length} terdaftar</Badge>
      </div>

      <div style={{
      overflowX: "auto",
      maxHeight: 300
    }}>
        <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        width: "100%",
        minWidth: 560
      }}>
          <thead>
            <tr style={THBG}>
              {["Nama", "Grup", "Perangkat Terdaftar", "Sejak", ""].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              position: "sticky",
              top: 0,
              background: T.surfaceSunk
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {daftar.map(e => {
            const b = deviceBinding?.[e.id];
            return <tr key={e.id} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                ...TD,
                fontWeight: 600
              }}>{e.name}</td>
                  <td style={TD}><Badge tone="manajemen">{GROUP_LABEL[e.group]}</Badge></td>
                  <td style={TD}>
                    {b ? <span><b>{b.label}</b> <span style={{
                    ...FM,
                    fontSize: 11,
                    color: T.inkMuted
                  }}>{b.deviceId}</span></span> : <span style={{
                  color: T.inkMuted,
                  fontStyle: "italic"
                }}>belum pernah login</span>}
                  </td>
                  <td style={{
                ...TD,
                color: T.inkMuted,
                fontSize: 12
              }}>{b ? new Date(b.boundAt).toLocaleDateString("id-ID") : "-"}</td>
                  <td style={{
                ...TD,
                textAlign: "right"
              }}>
                    {b && bisaReset && (konfirmasi === e.id ? <span style={{
                  display: "inline-flex",
                  gap: 6
                }}>
                        <button onClick={() => reset(e.id)} style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "5px 10px",
                    background: T.bad,
                    color: "#fff",
                    ...FI,
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: "pointer"
                  }} className="ais-button ais-button--danger">Ya, Reset</button>
                        <button onClick={() => setKonfirmasi(null)} style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "5px 10px",
                    background: "transparent",
                    color: T.inkMuted,
                    ...FI,
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: "pointer"
                  }} className="ais-button ais-button--default">Batal</button>
                      </span> : <button onClick={() => setKonfirmasi(e.id)} style={{
                  border: `1px solid ${T.line}`,
                  borderRadius: 7,
                  padding: "5px 10px",
                  background: "transparent",
                  color: T.accentDeep,
                  ...FI,
                  fontWeight: 600,
                  fontSize: 11.5,
                  cursor: "pointer"
                }} className="ais-button ais-button--default">Reset Perangkat</button>)}
                  </td>
                </tr>;
          })}
          </tbody>
        </table>
      </div>
      {bisaReset && <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      marginTop: 8
    }}>
          Reset dipakai saat karyawan ganti HP, HP hilang, atau rusak. Setelah direset, HP berikutnya yang berhasil login akan otomatis terdaftar.
        </div>}
    </div>;
}
function MasterKaryawanPage({
  employees,
  setEmployees,
  stores,
  ijinList,
  sanksiList,
  deviceBinding,
  setDeviceBinding,
  currentUser
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const today = new Date();
  const filtered = employees.filter(e => (filterGroup === "all" || e.group === filterGroup) && (e.name.toLowerCase().includes(search.toLowerCase()) || (e.jabatan || "").toLowerCase().includes(search.toLowerCase())));
  const save = form => {
    if (editingId) {
      setEmployees(employees.map(e => e.id === editingId ? {
        ...e,
        ...form
      } : e));
    } else {
      setEmployees([...employees, {
        id: uid(),
        ...form
      }]);
    }
    setFormOpen(false);
    setEditingId(null);
  };
  const [warningId, setWarningId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const clickDelete = id => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    setConfirmDeleteId(null);
    if (emp.status !== "nonaktif") {
      setWarningId(id);
      return;
    }
    setWarningId(null);
    setConfirmDeleteId(id);
  };
  const doDeletePermanent = id => {
    setEmployees(employees.filter(e => e.id !== id));
    setConfirmDeleteId(null);
  };
  if (formOpen) return <EmployeeFormPanel initial={editingId ? employees.find(e => e.id === editingId) : null} stores={stores} onSave={save} onCancel={() => {
    setFormOpen(false);
    setEditingId(null);
  }} />;
  return <div>
      <SectionTitle icon={Users} action={<button onClick={() => {
      setFormOpen(true);
      setEditingId(null);
    }} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "9px 14px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={14} /> Tambah Karyawan</button>}>Master Data Karyawan ({employees.length})</SectionTitle>

      <details className="ais-disclosure"><summary>Perangkat & pengaturan akses <ChevronDown size={15} /></summary><PenguncianPerangkatPanel employees={employees} deviceBinding={deviceBinding} setDeviceBinding={setDeviceBinding} currentUser={currentUser} /></details>

      {warningId && <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      background: T.warnSoft,
      color: T.warn,
      padding: "10px 14px",
      borderRadius: 10,
      marginBottom: 14,
      ...FI,
      fontWeight: 600,
      fontSize: 13
    }} className="ais-flex-layout">
          <span>Pastikan status karyawan "{employees.find(e => e.id === warningId)?.name}" dirubah ke <b>Nonaktif</b> terlebih dahulu sebelum bisa dihapus.</span>
          <button onClick={() => setWarningId(null)} style={{
        border: "none",
        background: "transparent",
        color: T.warn,
        cursor: "pointer",
        flexShrink: 0
      }} className="ais-button ais-button--default"><X size={16} /></button>
        </div>}

      {formOpen && <EmployeeFormPanel initial={editingId ? employees.find(e => e.id === editingId) : null} stores={stores} onSave={save} onCancel={() => {
      setFormOpen(false);
      setEditingId(null);
    }} />}

      <div style={{
      display: "flex",
      gap: 10,
      marginBottom: 14
    }} className="ais-flex-layout">
        <div style={{
        flex: 1,
        position: "relative"
      }}>
          <Search size={14} color={T.inkMuted} style={{
          position: "absolute",
          left: 10,
          top: 11
        }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau jabatan…" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 11px 9px 30px",
          ...FI,
          fontSize: 13
        }} className="ais-control" />
        </div>
        <div style={{
        width: 220
      }}>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 11px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
            <option value="all">Semua Grup</option>
            {Object.entries(GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13,
        minWidth: 1280
      }}>
          <thead>
            <tr style={THBG}>
              {["Nama", "Jabatan", "Grup", "Toko", "Join Date", "Status Kontrak", "Masa Kerja", "Habis Kontrak", "Status Sanksi", "Sisa Cuti", "Status", ""].map(h => <th key={h} style={{
              ...TDW,
              fontSize: 11.5,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
            const sisaCuti = sisaCutiFor(e, ijinList);
            const activeSanksi = activeSanksiForEmp(e.id, sanksiList, today);
            return <tr key={e.id} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                ...TDW,
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}>{e.name}</td>
                  <td style={{
                ...TDW,
                color: T.inkMuted,
                whiteSpace: "nowrap"
              }}>{e.jabatan || "-"}</td>
                  <td style={TDW}><Badge tone="manajemen">{GROUP_LABEL[e.group]}</Badge></td>
                  <td style={{
                ...TDW,
                color: T.inkMuted,
                whiteSpace: "nowrap"
              }}>{e.stores ? e.stores.map(id => stores.find(s => s.id === id)?.name).filter(Boolean).join(" & ") : stores.find(s => s.id === e.store)?.name || "-"}</td>
                  <td style={{
                ...TDW,
                ...FM,
                fontSize: 12,
                color: T.inkMuted
              }}>{e.joinDate || "-"}</td>
                  <td style={TDW}>{e.statusKontrak ? <Badge tone={e.statusKontrak === "tetap" ? "good" : e.statusKontrak === "kontrak" ? "warn" : "manajemen"}>{STATUS_KONTRAK_LABEL[e.statusKontrak]}</Badge> : "-"}</td>
                  <td style={{
                ...TDW,
                color: T.inkMuted,
                whiteSpace: "nowrap"
              }}>{formatMasaKerja(e.joinDate)}</td>
                  <td style={{
                ...TDW,
                ...FM,
                fontSize: 12,
                color: T.inkMuted
              }}>{e.statusKontrak === "kontrak" ? e.kontrakEnd || "-" : "-"}</td>
                  <td style={TDW}>
                    {activeSanksi.length === 0 ? <span style={{
                  color: T.inkMuted
                }}>-</span> : <div style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap"
                }} className="ais-flex-layout">
                        {activeSanksi.map(s => <Badge key={s.id} tone={s.jenis.startsWith("sp") ? "bad" : "warn"}>{SANKSI_TYPES[s.jenis].label}</Badge>)}
                      </div>}
                  </td>
                  <td style={TDW}>{sisaCuti != null ? <span style={{
                  fontWeight: 700,
                  color: sisaCuti <= 2 ? T.bad : sisaCuti <= 5 ? T.warn : T.good
                }}>{sisaCuti} hari</span> : <span style={{
                  color: T.inkMuted
                }}>-</span>}</td>
                  <td style={TDW}><Badge tone={e.status === "aktif" ? "good" : "bad"}>{e.status === "aktif" ? "Aktif" : "Nonaktif"}</Badge></td>
                  <td style={TDW}>
                    {confirmDeleteId === e.id ? <div style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end",
                  alignItems: "center"
                }} className="ais-flex-layout">
                        <span style={{
                    ...FI,
                    fontSize: 11.5,
                    color: T.bad,
                    fontWeight: 600,
                    whiteSpace: "nowrap"
                  }}>Hapus permanen?</span>
                        <button onClick={() => doDeletePermanent(e.id)} style={{
                    border: "none",
                    borderRadius: 7,
                    padding: "5px 10px",
                    background: T.bad,
                    color: "#fff",
                    ...FI,
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: "pointer"
                  }} className="ais-button ais-button--danger">Ya, Hapus</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "5px 10px",
                    background: "transparent",
                    color: T.inkMuted,
                    ...FI,
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: "pointer"
                  }} className="ais-button ais-button--default">Batal</button>
                      </div> : <div style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end"
                }} className="ais-flex-layout">
                        <IconButton icon={Pencil} onClick={() => {
                    setEditingId(e.id);
                    setFormOpen(true);
                  }} title="Edit" />
                        <IconButton icon={Trash2} tone="bad" onClick={() => clickDelete(e.id)} title={e.status === "nonaktif" ? "Hapus Permanen" : "Nonaktifkan dulu sebelum bisa dihapus"} />
                      </div>}
                  </td>
                </tr>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: DATA SANKSI
--------------------------------------------------------- */
function SanksiFormPanel({
  employees,
  onSave,
  onCancel
}) {
  const [empId, setEmpId] = useState(employees[0]?.id || "");
  const [jenis, setJenis] = useState("teguran1");
  const [tanggal, setTanggal] = useState(dateStr(new Date()));
  const [keterangan, setKeterangan] = useState("");
  const complete = empId && jenis && tanggal;
  return <FormSurface title="Catatan yang bisa ditelusuri." subtitle="Masukkan jenis, tanggal, dan alasan sesuai proses yang berlaku." code="REVIEW"><div>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 12
      }}>Tambah Sanksi</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>Karyawan</div>
          <select value={empId} onChange={e => setEmpId(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 11px",
            ...FI,
            fontSize: 13,
            background: T.surface
          }} className="ais-control">
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.jabatan || GROUP_LABEL[e.group]}</option>)}
          </select>
        </div>
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>Jenis Sanksi</div>
          <select value={jenis} onChange={e => setJenis(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 11px",
            ...FI,
            fontSize: 13,
            background: T.surface
          }} className="ais-control">
            {SANKSI_ORDER.map(k => <option key={k} value={k}>{SANKSI_TYPES[k].label}{SANKSI_TYPES[k].durasiHari ? ` (berlaku ${SANKSI_TYPES[k].durasiHari / 30} bulan)` : " (permanen)"}</option>)}
          </select>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 12,
        marginBottom: 14
      }} className="ais-responsive-grid">
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>Tanggal Terbit</div>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 11px",
            ...FI,
            fontSize: 13
          }} className="ais-control" />
        </div>
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>Keterangan / Alasan</div>
          <input value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Alasan pemberian sanksi" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 11px",
            ...FI,
            fontSize: 13
          }} className="ais-control" />
        </div>
      </div>
      <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
        <button onClick={() => complete && onSave({
          empId,
          jenis,
          tanggal,
          keterangan
        })} disabled={!complete} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: complete ? T.accent : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: complete ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan Sanksi</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 16px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function DataSanksiPage({
  employees,
  sanksiList,
  setSanksiList,
  currentUser,
  readOnly,
  scopeNote
}) {
  const [formOpen, setFormOpen] = useState(false);
  const today = new Date();
  const empIdsWithSanksi = [...new Set(sanksiList.map(s => s.empId))];
  const empsWithSanksi = employees.filter(e => empIdsWithSanksi.includes(e.id));
  const save = form => {
    setSanksiList([...sanksiList, {
      id: uid(),
      ...form,
      inputBy: currentUser.name,
      inputAt: new Date().toISOString()
    }]);
    setFormOpen(false);
  };
  return <div>
      <SectionTitle icon={ShieldCheck} action={!readOnly && <button onClick={() => setFormOpen(true)} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "9px 14px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={14} /> Tambah Sanksi</button>}>Data Sanksi</SectionTitle>

      {scopeNote && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.manajemen,
      marginBottom: 12,
      background: T.manajemenSoft,
      padding: "9px 12px",
      borderRadius: 10
    }}>{scopeNote}</div>}
      {!readOnly && formOpen && <SanksiFormPanel employees={employees.filter(e => e.status === "aktif")} onSave={save} onCancel={() => setFormOpen(false)} />}

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "9px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Menampilkan karyawan yang pernah mendapat sanksi saja. <b>SP berlaku 3 bulan</b> sejak tanggal terbit — otomatis clearance (hilang dari checklist) setelah lewat. <b>Teguran bersifat permanen</b>, sekali kena akan terus tercatat.
      </div>

      {empsWithSanksi.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>Belum ada karyawan yang mendapat sanksi.</div>}

      {empsWithSanksi.map(e => {
      const empSanksi = sanksiList.filter(s => s.empId === e.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      return <div key={e.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12
      }} className="ais-content-panel">
            <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 10
        }}>
              {e.name} <span style={{
            fontWeight: 400,
            color: T.inkMuted,
            fontSize: 12
          }}>· {e.jabatan || GROUP_LABEL[e.group]}</span>
            </div>

            <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14
        }} className="ais-flex-layout">
              {SANKSI_ORDER.map(k => {
            const record = empSanksi.find(s => s.jenis === k);
            const active = record && isSanksiActive(record, today);
            const sisa = active && record ? sisaDurasiHari(record, today) : null;
            return <div key={k} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${T.line}`,
              borderRadius: 10,
              padding: "6px 10px",
              background: active ? k.startsWith("sp") ? T.badSoft : T.warnSoft : T.surfaceSunk
            }} className="ais-flex-layout">
                    {active ? <Check size={13} color={k.startsWith("sp") ? T.bad : T.warn} /> : <span style={{
                width: 13,
                height: 13,
                border: `1.5px solid ${T.inkMuted}`,
                borderRadius: 3,
                display: "inline-block"
              }} />}
                    <span style={{
                ...FI,
                fontSize: 12,
                fontWeight: 600,
                color: active ? T.ink : T.inkMuted
              }}>{SANKSI_TYPES[k].label}</span>
                    {sisa != null && <span style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted
              }}>· sisa {sisa} hari</span>}
                  </div>;
          })}
            </div>

            <div style={{
          ...FI,
          fontSize: 11,
          fontWeight: 700,
          color: T.inkMuted,
          marginBottom: 4,
          textTransform: "uppercase"
        }}>Riwayat</div>
            {empSanksi.map(s => <div key={s.id} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 0",
          borderTop: `1px solid ${T.line}`,
          ...FI,
          fontSize: 12.5,
          flexWrap: "wrap",
          gap: 4
        }} className="ais-flex-layout">
                <div>
                  <span style={{
              fontWeight: 600
            }}>{SANKSI_TYPES[s.jenis].label}</span>
                  {s.keterangan && <span style={{
              color: T.inkMuted
            }}> — "{s.keterangan}"</span>}
                </div>
                <div style={{
            color: T.inkMuted,
            ...FM,
            fontSize: 11.5,
            whiteSpace: "nowrap"
          }}>{s.tanggal} · {s.inputBy}</div>
              </div>)}
          </div>;
    })}
    </div>;
}
function CrudTable({
  title,
  columns,
  rows,
  onAdd,
  onEdit,
  onDelete,
  renderForm,
  renderDetail
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const editing = editingId ? rows.find(r => r.id === editingId) : null;
  const bisaBuka = typeof renderDetail === "function";
  return <div style={{
    marginBottom: 28
  }}>
      <SectionTitle action={<button onClick={() => {
      setFormOpen(true);
      setEditingId(null);
    }} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "8px 13px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={13} /> Tambah</button>}>{title} ({rows.length})</SectionTitle>

      {formOpen && renderForm({
      initial: editing,
      onSave: data => {
        editingId ? onEdit(editingId, data) : onAdd(data);
        setFormOpen(false);
        setEditingId(null);
      },
      onCancel: () => {
        setFormOpen(false);
        setEditingId(null);
      }
    })}

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13
      }}>
          <thead>
            <tr style={THBG}>
              {columns.map(c => <th key={c.key} style={{
              ...TDW,
              fontSize: 11.5,
              color: T.inkMuted,
              textTransform: "uppercase"
            }}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
            const terbuka = bisaBuka && openId === r.id;
            return <Fragment key={r.id}>
                  <tr onClick={bisaBuka ? () => setOpenId(terbuka ? null : r.id) : undefined} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: bisaBuka ? "pointer" : "default",
                background: terbuka ? T.surfaceSunk : "transparent"
              }}>
                    {columns.map((c, i) => <td key={c.key} style={TDW}>
                        {i === 0 && bisaBuka ? <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                            <ChevronDown size={13} color={T.inkMuted} style={{
                      transform: terbuka ? "rotate(180deg)" : "none",
                      flexShrink: 0
                    }} />
                            {c.render ? c.render(r) : r[c.key]}
                          </span> : c.render ? c.render(r) : r[c.key]}
                      </td>)}
                    <td style={TDW} onClick={e => e.stopPropagation()}>
                      <div style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-end"
                  }} className="ais-flex-layout">
                        <IconButton icon={Pencil} onClick={() => {
                      setEditingId(r.id);
                      setFormOpen(true);
                    }} title="Edit" />
                        <IconButton icon={Trash2} tone="bad" onClick={() => onDelete(r.id)} title="Hapus" />
                      </div>
                    </td>
                  </tr>
                  {terbuka && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={columns.length + 1} style={{
                  padding: "14px 18px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        {renderDetail(r)}
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function StoreBasicForm({
  initial,
  products,
  bahan,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(initial ? {
    name: initial.name,
    radius: initial.radius,
    transitLimitMinutes: initial.transitLimitMinutes ?? 30,
    jenisToko: initial.jenisToko || "resto",
    status: initial.status || "holding",
    manage: initial.manage || "spv",
    alamat: initial.alamat || "",
    telepon: initial.telepon || ""
  } : {
    name: "",
    radius: 10,
    transitLimitMinutes: 30,
    jenisToko: "resto",
    status: "holding",
    manage: "spv",
    alamat: "",
    telepon: ""
  });
  const mitra = f.status === "mitra";
  const produkTerjual = produkUntukJenis(products, f.jenisToko);
  const bahanTerpakai = bahanUntukJenis(products, bahan, f.jenisToko);
  return <FormSurface title="Profil operasional toko." subtitle="Kelola identitas, jenis, dan pengaturan operasional toko." code="STORE"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr 1fr",
        gap: 10,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <TextField label="Nama Toko" value={f.name} onChange={v => setF({
          ...f,
          name: v
        })} />
        <TextField label="Radius Absen (m)" type="number" value={f.radius} onChange={v => setF({
          ...f,
          radius: Number(v)
        })} />
        <TextField label="Batas Transit (menit)" type="number" value={f.transitLimitMinutes} onChange={v => setF({
          ...f,
          transitLimitMinutes: Number(v)
        })} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 10,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <TextField label="Alamat" value={f.alamat} onChange={v => setF({
          ...f,
          alamat: v
        })} />
        <TextField label="Nomor Telepon" value={f.telepon} onChange={v => setF({
          ...f,
          telepon: v
        })} />
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Status Toko</div>
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 12,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {STORE_STATUS.map(s => <button key={s.key} onClick={() => setF({
          ...f,
          status: s.key
        })} style={{
          flex: 1,
          minWidth: 210,
          textAlign: "left",
          padding: "11px 14px",
          borderRadius: 11,
          cursor: "pointer",
          border: f.status === s.key ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
          background: f.status === s.key ? T.accentSoft : T.surface
        }} className="ais-button ais-button--default" aria-pressed={f.status === s.key}>
            <div style={{
            ...FI,
            fontWeight: 700,
            fontSize: 13,
            color: f.status === s.key ? T.accentDeep : T.ink
          }}>{s.label}</div>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 2
          }}>{s.desc}</div>
          </button>)}
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Dikelola Oleh</div>
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 12,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {STORE_MANAGE.map(m => <button key={m.key} onClick={() => setF({
          ...f,
          manage: m.key
        })} style={{
          padding: "9px 16px",
          borderRadius: 10,
          cursor: "pointer",
          border: f.manage === m.key ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
          background: f.manage === m.key ? T.accentSoft : T.surface,
          color: f.manage === m.key ? T.accentDeep : T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5
        }} className="ais-button ais-button--default" aria-pressed={f.manage === m.key}>{m.label}</button>)}
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 14
      }}>
        {f.manage === "admin" ? "Tanpa SPV/TL — approval laporan, ijin kerja, dan tukar shift diajukan ke Admin." : `Approval laporan, ijin kerja, dan tukar shift diajukan ke ${f.manage === "tl" ? "Team Leader" : "SPV"} toko ini.`}
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Jenis Toko</div>
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 10,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {JENIS_TOKO.map(j => <button key={j.key} onClick={() => setF({
          ...f,
          jenisToko: j.key
        })} style={{
          flex: 1,
          minWidth: 180,
          textAlign: "left",
          padding: "11px 14px",
          borderRadius: 11,
          cursor: "pointer",
          border: f.jenisToko === j.key ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
          background: f.jenisToko === j.key ? T.accentSoft : T.surface
        }} className="ais-button ais-button--default" aria-pressed={f.jenisToko === j.key}>
            <div style={{
            ...FI,
            fontWeight: 700,
            fontSize: 13,
            color: f.jenisToko === j.key ? T.accentDeep : T.ink
          }}>{j.label}</div>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 2
          }}>{j.desc}</div>
          </button>)}
      </div>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 12
      }} className="ais-content-panel">
        {mitra ? <div style={{
          ...FI,
          fontSize: 11,
          color: T.warn
        }}>
            Toko <b>Mitra</b> tidak memiliki inventory maupun laporan — hanya titik koordinat absen dan jalur transfer stok.
            Pilihan jenis toko di bawah tidak berpengaruh selama status masih Mitra.
          </div> : <>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
              Dengan jenis <b>{JENIS_TOKO_LABEL[f.jenisToko]}</b>, toko ini menjual <b>{produkTerjual.length} produk</b> dan inventory-nya berisi <b>{bahanTerpakai.length} bahan baku</b> (diturunkan otomatis dari BOM produk).
            </div>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted
          }}>{produkTerjual.map(p => p.name).join(" · ")}</div>
          </>}
      </div>
      <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
        <button onClick={() => onSave(f)} disabled={!f.name} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: f.name ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: f.name ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function MasterTokoPage({
  stores,
  setStores,
  products,
  bahan
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const editing = editingId ? stores.find(s => s.id === editingId) : null;
  const add = data => setStores([...stores, {
    id: uid(),
    jenisToko: "resto",
    status: "holding",
    manage: "spv",
    ...data,
    lat: null,
    lng: null,
    activatedAt: null
  }]);
  const edit = (id, data) => setStores(stores.map(s => s.id === id ? {
    ...s,
    ...data
  } : s));
  const remove = id => confirm("Hapus toko ini?") && setStores(stores.filter(s => s.id !== id));
  const activateDevice = id => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak tersedia di browser ini.");
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => setStores(stores.map(s => s.id === id ? {
      ...s,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      activatedAt: new Date().toISOString()
    } : s)), () => alert("Gagal mengambil lokasi. Pastikan izin lokasi browser diaktifkan."));
  };
  return <div>
      <SectionTitle icon={Store} action={<button onClick={() => {
      setFormOpen(true);
      setEditingId(null);
    }} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "8px 13px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={13} /> Tambah Toko</button>}>Master Toko ({stores.length})</SectionTitle>

      <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-flex-layout ais-content-panel">
        <Navigation size={14} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
        Latitude & Longitude toko <b>tidak diisi manual</b> — otomatis terisi dari titik GPS Akun Toko saat pertama kali device diaktifkan/login di lapangan. Toko baru berstatus "Menunggu Aktivasi" sampai itu terjadi.
      </div>

      {formOpen && <StoreBasicForm initial={editing} products={products} bahan={bahan} onSave={d => {
      editingId ? edit(editingId, d) : add(d);
      setFormOpen(false);
      setEditingId(null);
    }} onCancel={() => {
      setFormOpen(false);
      setEditingId(null);
    }} />}

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13
      }}>
          <thead>
            <tr style={THBG}>
              {["Nama Toko", "Jenis", "Status", "Dikelola", "Radius", "Batas Transit", "Status Lokasi", ""].map(h => <th key={h} style={{
              ...TDW,
              fontSize: 11.5,
              color: T.inkMuted,
              textTransform: "uppercase"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {stores.map(s => <tr key={s.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TDW,
              fontWeight: 600
            }}>{s.name}</td>
                <td style={TDW}><Badge tone={s.jenisToko === "express" ? "warn" : "good"}>{JENIS_TOKO_LABEL[s.jenisToko] || "Resto"}</Badge></td>
                <td style={TDW}><Badge tone={s.status === "mitra" ? "manajemen" : "good"}>{STORE_STATUS_LABEL[s.status] || "Holding"}</Badge></td>
                <td style={{
              ...TDW,
              color: T.inkMuted
            }}>{STORE_MANAGE_LABEL[s.manage] || "SPV"}</td>
                <td style={{
              ...TDW,
              color: T.inkMuted
            }}>{s.radius}m</td>
                <td style={{
              ...TDW,
              color: T.inkMuted
            }}>{s.transitLimitMinutes ?? 30} menit</td>
                <td style={TDW}>
                  {s.activatedAt ? <Badge tone="good">Aktif · {s.lat?.toFixed(5)}, {s.lng?.toFixed(5)}</Badge> : <Badge tone="warn">Menunggu Aktivasi</Badge>}
                </td>
                <td style={TDW}>
                  <div style={{
                display: "flex",
                gap: 6,
                justifyContent: "flex-end"
              }} className="ais-flex-layout">
                    {!s.activatedAt && <button onClick={() => activateDevice(s.id)} title="Simulasikan aktivasi device toko (ambil lokasi browser saat ini)" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  border: `1px solid ${T.accent}`,
                  borderRadius: 8,
                  padding: "6px 9px",
                  background: T.accentSoft,
                  color: T.accentDeep,
                  ...FI,
                  fontWeight: 600,
                  fontSize: 11.5,
                  cursor: "pointer"
                }} className="ais-button ais-button--default ais-flex-layout"><Navigation size={12} /> Simulasi Aktivasi</button>}
                    <IconButton icon={Pencil} onClick={() => {
                  setEditingId(s.id);
                  setFormOpen(true);
                }} title="Edit" />
                    <IconButton icon={Trash2} tone="bad" onClick={() => remove(s.id)} title="Hapus" />
                  </div>
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}
function RecipeItemsEditor({
  items,
  setItems,
  bahan
}) {
  const addItem = () => setItems([...(items || []), {
    bahanId: bahan[0]?.id || "",
    qty: "",
    toleransiPersen: 0
  }]);
  const updateItem = (idx, field, val) => setItems(items.map((it, i) => i === idx ? {
    ...it,
    [field]: val
  } : it));
  const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
  const totalHpp = (items || []).reduce((sum, it) => {
    const b = bahan.find(x => x.id === it.bahanId);
    return sum + (Number(it.qty) || 0) * (b?.harga || 0);
  }, 0);
  return <div>
      <div style={{
      display: "grid",
      gridTemplateColumns: "1.8fr 0.7fr 0.9fr 1.1fr 0.9fr 1fr auto",
      gap: 8,
      marginBottom: 6
    }} className="ais-responsive-grid">
        {["Bahan Baku", "Satuan", "Qty", "Toleransi Waste (%)", "Total Qty", "Harga", ""].map(h => <div key={h} style={{
        ...FI,
        fontSize: 10,
        color: T.inkMuted,
        textTransform: "uppercase",
        fontWeight: 700
      }}>{h}</div>)}
      </div>
      {(items || []).length === 0 && <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted,
      marginBottom: 8
    }}>Belum ada bahan baku di resep ini.</div>}
      {(items || []).map((it, idx) => {
      const b = bahan.find(x => x.id === it.bahanId);
      const qty = Number(it.qty) || 0;
      const tol = Number(it.toleransiPersen) || 0;
      const totalQty = qty * (1 + tol / 100);
      const hargaLine = qty * (b?.harga || 0);
      return <div key={idx} style={{
        display: "grid",
        gridTemplateColumns: "1.8fr 0.7fr 0.9fr 1.1fr 0.9fr 1fr auto",
        gap: 8,
        marginBottom: 6,
        alignItems: "center"
      }} className="ais-responsive-grid">
            <select value={it.bahanId} onChange={e => updateItem(idx, "bahanId", e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 9px",
          ...FI,
          fontSize: 12.5,
          background: T.surface
        }} className="ais-control">
              {bahan.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted
        }}>{b?.unitKecil || "-"}</div>
            <input type="number" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="Qty" style={{
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 9px",
          ...FM,
          fontSize: 12.5,
          width: "100%"
        }} className="ais-control" />
            <input type="number" value={it.toleransiPersen} onChange={e => updateItem(idx, "toleransiPersen", e.target.value)} placeholder="%" style={{
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 9px",
          ...FM,
          fontSize: 12.5,
          width: "100%"
        }} className="ais-control" />
            <div style={{
          ...FM,
          fontSize: 12.5,
          fontWeight: 700
        }}>{totalQty.toFixed(2)} {b?.unitKecil || ""}</div>
            <div style={{
          ...FM,
          fontSize: 12,
          color: T.ink
        }}>{rupiah(hargaLine)}</div>
            <button onClick={() => removeItem(idx)} style={{
          border: "none",
          background: "transparent",
          color: T.bad,
          cursor: "pointer",
          padding: 4
        }} className="ais-button ais-button--danger"><Trash2 size={14} /></button>
          </div>;
    })}
      <button onClick={addItem} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: `1px dashed ${T.line}`,
      borderRadius: 9,
      padding: "7px 12px",
      background: "transparent",
      color: T.accentDeep,
      ...FI,
      fontWeight: 600,
      fontSize: 12,
      cursor: "pointer",
      marginTop: 4
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={13} /> Tambah Bahan Baku</button>

      {(items || []).length > 0 && <div style={{
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTop: `1px solid ${T.line}`
    }} className="ais-flex-layout">
          <span style={{
        ...FI,
        fontSize: 12.5,
        fontWeight: 700,
        color: T.inkMuted
      }}>Total HPP:</span>
          <span style={{
        ...FM,
        fontSize: 15,
        fontWeight: 700,
        color: T.accentDeep
      }}>{rupiah(totalHpp)}</span>
        </div>}
    </div>;
}
function MasterProdukPage({
  products,
  setProducts,
  bahan
}) {
  return <CrudTable title="Master Produk (untuk Laporan Sales)" rows={products} columns={[{
    key: "name",
    label: "Nama Produk"
  }, {
    key: "price",
    label: "Harga",
    render: r => rupiah(r.price)
  }, {
    key: "jenisToko",
    label: "Dijual Di",
    render: r => <div style={{
      display: "flex",
      gap: 4
    }} className="ais-flex-layout">{(r.jenisToko || ["resto", "express"]).map(j => <Badge key={j} tone={j === "express" ? "warn" : "good"}>{JENIS_TOKO_LABEL[j]}</Badge>)}</div>
  }, {
    key: "resep",
    label: "Resep / BOM",
    render: r => r.resep && r.resep.length > 0 ? <Badge tone="good">{r.resep.length} bahan</Badge> : <Badge tone="manajemen">Belum ada</Badge>
  }]} onAdd={d => setProducts([...products, {
    id: uid(),
    ...d
  }])} onEdit={(id, d) => setProducts(products.map(p => p.id === id ? {
    ...p,
    ...d
  } : p))} onDelete={id => confirm("Hapus produk ini?") && setProducts(products.filter(p => p.id !== id))} renderForm={({
    initial,
    onSave,
    onCancel
  }) => <ProductForm initial={initial} bahan={bahan} onSave={onSave} onCancel={onCancel} />} renderDetail={r => {
    const items = (r.resep || []).map(x => {
      const b = bahan.find(y => y.id === x.bahanId);
      const total = Math.round((Number(x.qty) || 0) * (1 + (Number(x.toleransiPersen) || 0) / 100) * 1000) / 1000;
      return {
        ...x,
        b,
        total,
        biaya: Math.round(total * (b?.harga || 0))
      };
    });
    const hpp = items.reduce((a, x) => a + x.biaya, 0);
    return <div>
            <div style={{
        display: "flex",
        gap: 18,
        flexWrap: "wrap",
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        marginBottom: 10
      }} className="ais-flex-layout">
              <span>Kode: <b style={{
            color: T.ink,
            ...FM
          }}>{r.kode || "-"}</b></span>
              <span>Varian: <b style={{
            color: T.ink
          }}>{r.varian || "-"}</b></span>
              <span>Status: <Badge tone={r.aktif === false ? "bad" : "good"}>{r.aktif === false ? "Nonaktif" : "Aktif"}</Badge></span>
              <span>HPP Bahan: <b style={{
            color: T.ink,
            ...FM
          }}>{rupiah(hpp)}</b></span>
              {r.price > 0 && <span>% HPP: <b style={{
            color: hpp / r.price > 0.4 ? T.warn : T.good
          }}>{Math.round(hpp / r.price * 100)}%</b></span>}
            </div>
            {items.length === 0 ? <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>Belum ada resep / BOM untuk produk ini.</div> : <div style={{
        overflowX: "auto"
      }}>
                <table style={{
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12,
          minWidth: 620
        }}>
                  <thead>
                    <tr style={{
              textAlign: "left",
              color: T.inkMuted
            }}>
                      {["SKU", "Bahan Baku", "Qty/Porsi", "Satuan", "Toleransi Waste", "Total/Porsi", "Biaya"].map(h => <th key={h} style={{
                padding: "3px 10px 6px 0",
                fontSize: 10.5,
                textTransform: "uppercase",
                whiteSpace: "nowrap"
              }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((x, i) => <tr key={i} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                        <td style={{
                padding: "4px 10px 4px 0",
                ...FM,
                fontSize: 11,
                color: T.inkMuted
              }}>{x.b?.sku || "-"}</td>
                        <td style={{
                padding: "4px 10px"
              }}>{x.b?.name || x.bahanId}</td>
                        <td style={{
                padding: "4px 10px",
                ...FM
              }}>{x.qty}</td>
                        <td style={{
                padding: "4px 10px",
                color: T.inkMuted
              }}>{x.b?.unitKecil || "-"}</td>
                        <td style={{
                padding: "4px 10px",
                color: x.toleransiPersen ? T.warn : T.inkMuted
              }}>{x.toleransiPersen || 0}%</td>
                        <td style={{
                padding: "4px 10px",
                ...FM,
                fontWeight: 700
              }}>{x.total}</td>
                        <td style={{
                padding: "4px 10px",
                ...FM
              }}>{rupiah(x.biaya)}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>}
          </div>;
  }} />;
}
function MasterBahanPage({
  bahan,
  setBahan,
  products
}) {
  return <CrudTable title="Master Bahan Baku (untuk Laporan Stok & Inventory)" rows={bahan} columns={[{
    key: "sku",
    label: "SKU"
  }, {
    key: "name",
    label: "Nama Bahan"
  }, {
    key: "unitKecil",
    label: "Satuan Kecil"
  }, {
    key: "unitBesar",
    label: "Satuan Besar"
  }, {
    key: "harga",
    label: "Harga / Satuan Kecil",
    render: r => `${rupiah(r.harga || 0)} / ${r.unitKecil}`
  }, {
    key: "konversi",
    label: "Konversi",
    render: r => `1 ${r.unitBesar} = ${r.konversi} ${r.unitKecil}`
  }, {
    key: "minOrder",
    label: "Min. Order",
    render: r => `${r.minOrder} ${r.unitBesar}`
  }, {
    key: "shelfLifeDays",
    label: "Shelf Life",
    render: r => `${r.shelfLifeDays} hari`
  }, {
    key: "supplier",
    label: "Sumber Barang"
  }]} onAdd={d => setBahan([...bahan, {
    id: uid(),
    sku: nextBahanSku(bahan),
    ...d
  }])} onEdit={(id, d) => setBahan(bahan.map(b => b.id === id ? {
    ...b,
    ...d
  } : b))} onDelete={id => confirm("Hapus bahan ini?") && setBahan(bahan.filter(b => b.id !== id))} renderForm={({
    initial,
    onSave,
    onCancel
  }) => <BahanForm initial={initial} existingList={bahan} onSave={onSave} onCancel={onCancel} />} />;
}
function BahanForm({
  initial,
  existingList,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(initial || {
    name: "",
    unitKecil: "pcs",
    unitBesar: "dus",
    konversi: 12,
    minOrder: 1,
    shelfLifeDays: 30,
    supplier: "",
    harga: 0
  });
  const previewSku = initial?.sku || nextBahanSku(existingList || []);
  return <FormSurface title="Detail bahan baku." subtitle="Lengkapi identitas bahan, satuan, dan parameter persediaan." code="MATERIAL"><div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12
      }} className="ais-flex-layout">
        <Badge tone="manajemen">SKU: {previewSku}</Badge>
        <span style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted
        }}>{initial ? "SKU tetap, tidak berubah saat edit." : "SKU digenerate otomatis saat disimpan."}</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr",
        gap: 10,
        marginBottom: 10
      }} className="ais-responsive-grid">
        <TextField label="Nama Bahan" value={f.name} onChange={v => setF({
          ...f,
          name: v
        })} />
        <TextField label="Satuan Kecil" value={f.unitKecil} onChange={v => setF({
          ...f,
          unitKecil: v
        })} placeholder="pcs / kg / liter" />
        <TextField label="Satuan Besar (Order)" value={f.unitBesar} onChange={v => setF({
          ...f,
          unitBesar: v
        })} placeholder="dus / krat / karung" />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 10,
        marginBottom: 10
      }} className="ais-responsive-grid">
        <TextField label={`Harga per ${f.unitKecil || "satuan kecil"} (Rp)`} type="number" value={f.harga} onChange={v => setF({
          ...f,
          harga: Number(v)
        })} />
        <TextField label={`Konversi (1 ${f.unitBesar || "satuan besar"} = ? ${f.unitKecil || "satuan kecil"})`} type="number" value={f.konversi} onChange={v => setF({
          ...f,
          konversi: Number(v)
        })} />
        <TextField label={`Minimal Order (${f.unitBesar || "satuan besar"})`} type="number" value={f.minOrder} onChange={v => setF({
          ...f,
          minOrder: Number(v)
        })} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 10,
        marginBottom: 14
      }} className="ais-responsive-grid">
        <TextField label="Shelf Life (hari)" type="number" value={f.shelfLifeDays} onChange={v => setF({
          ...f,
          shelfLifeDays: Number(v)
        })} />
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 5
          }}>Sumber Barang</div>
          <select value={f.supplier} onChange={e => setF({
            ...f,
            supplier: e.target.value
          })} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 11px",
            ...FI,
            fontSize: 13,
            background: T.surface
          }} className="ais-control">
            <option value="">— Pilih Sumber Barang —</option>
            {SUMBER_BARANG.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
        <button onClick={() => onSave(f)} disabled={!f.name} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: f.name ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: f.name ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function ProductForm({
  initial,
  bahan,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(initial || {
    name: "",
    price: 0,
    resep: [],
    jenisToko: ["resto", "express"]
  });
  const setResepItems = items => setF({
    ...f,
    resep: items
  });
  const jenisAktif = f.jenisToko || ["resto", "express"];
  const toggleJenis = k => {
    const next = jenisAktif.includes(k) ? jenisAktif.filter(x => x !== k) : [...jenisAktif, k];
    setF({
      ...f,
      jenisToko: next
    });
  };
  return <FormSurface title="Detail produk." subtitle="Kelola informasi produk dan pengaturan ketersediaannya." code="PRODUCT"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 10,
        marginBottom: 16
      }} className="ais-responsive-grid">
        <TextField label="Nama Produk" value={f.name} onChange={v => setF({
          ...f,
          name: v
        })} />
        <TextField label="Harga (Rp)" type="number" value={f.price} onChange={v => setF({
          ...f,
          price: Number(v)
        })} />
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 5
      }}>Dijual di Jenis Toko</div>
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 6,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        {JENIS_TOKO.map(j => {
          const aktif = jenisAktif.includes(j.key);
          return <button key={j.key} onClick={() => toggleJenis(j.key)} style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 14px",
            borderRadius: 10,
            cursor: "pointer",
            border: aktif ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
            background: aktif ? T.accentSoft : T.surface,
            color: aktif ? T.accentDeep : T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5
          }} className="ais-button ais-button--default ais-flex-layout">
              {aktif ? <Check size={14} /> : <span style={{
              width: 14,
              height: 14,
              border: `1.5px solid ${T.line}`,
              borderRadius: 4,
              display: "inline-block"
            }} />}
              {j.label}
            </button>;
        })}
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: jenisAktif.length ? T.inkMuted : T.bad,
        marginBottom: 16
      }}>
        {jenisAktif.length ? "Bahan baku pada resep di bawah otomatis masuk ke inventory toko dengan jenis yang dicentang." : "Pilih minimal satu jenis toko — produk tanpa jenis tidak akan muncul di toko manapun."}
      </div>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 2
      }}>Resep / BOM (opsional)</div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 10
      }}>Dipakai untuk validasi pemakaian bahan baku vs penjualan (deteksi waste). Bisa dilewati dulu dan diisi belakangan lewat Master Resep.</div>
      <RecipeItemsEditor items={f.resep || []} setItems={setResepItems} bahan={bahan || []} />
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 16
      }} className="ais-flex-layout">
        <button onClick={() => onSave(f)} disabled={!f.name || !jenisAktif.length} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: f.name && jenisAktif.length ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: f.name && jenisAktif.length ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Simpan</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function RecipeItemsEditorStateful({
  product,
  bahan,
  onSave,
  onCancel
}) {
  const [items, setItems] = useState(product.resep || []);
  return <FormSurface title="Resep yang konsisten." subtitle="Atur komposisi bahan untuk setiap produk." code="RECIPE"><div>
      <RecipeItemsEditor items={items} setItems={setItems} bahan={bahan} />
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 14
      }} className="ais-flex-layout">
        <button onClick={() => onSave(items)} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: T.manajemen,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Simpan Resep</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}

/* ---------------------------------------------------------
   KALKULATOR SAMBAL CIPREK
   Anchor hasil tester (20/120/400/1000 gr cabe) per toko. Qty Final dihitung
   dengan interpolasi linier antar anchor terdekat — bukan perkalian lurus dari SOP,
   karena rasa tidak berskala linier saat produksi diperbesar.
--------------------------------------------------------- */
const CIPREK_PRODUK_ID = "sambal_ciprek";

// Anchor hasil tester. Cipanengah mengikuti sheet kalkulator yang sudah berjalan;
// toko lain diberi variasi kecil karena selera pasar tiap daerah berbeda.
// Toko baru (mis. Garuda) sengaja dibiarkan kosong — harus tester dulu.
const SEED_CIPREK_CONFIG = {
  dtop_cipanengah: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 15, 20, 50],
      gula: [5, 12, 30, 73.5],
      garam: [5, 7, 15, 35.6],
      sasa: [2.5, 4, 15, 35.6],
      minyak_1l: [20, 60, 200, 500]
    },
    status: "locked",
    approvals: {},
    log: [{
      oleh: "Eri",
      at: "2026-07-15T10:00:00",
      alasan: "Penetapan hasil tester awal",
      jenis: "penetapan"
    }]
  },
  dtop_baros: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 16, 22, 54],
      gula: [5, 11, 28, 68],
      garam: [5, 7, 16, 37],
      sasa: [2.5, 4, 14, 34],
      minyak_1l: [20, 60, 200, 500]
    },
    status: "locked",
    approvals: {},
    log: [{
      oleh: "Eri",
      at: "2026-07-18T10:00:00",
      alasan: "Tester Baros — market lebih suka gurih",
      jenis: "penetapan"
    }]
  },
  dtop_lembursitu: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 14, 19, 47],
      gula: [5, 13, 33, 80],
      garam: [5, 6, 14, 33],
      sasa: [2.5, 4, 15, 36],
      minyak_1l: [20, 60, 200, 500]
    },
    status: "locked",
    approvals: {},
    log: [{
      oleh: "Kurnia",
      at: "2026-07-20T10:00:00",
      alasan: "Tester Lembur Situ — market lebih suka manis",
      jenis: "penetapan"
    }]
  }
};
const CIPREK_ANCHORS = [20, 120, 400, 1000]; // gram cabe pada tiap titik tester
const CIPREK_MAX_BATCH = 1000; // di atas ini rasa & kualitas tidak terjaga
const CIPREK_MIN_REKOMENDASI = 100; // di bawah ini hanya peringatan, tidak memblokir
const CIPREK_CABE_PER_CUP = 20; // target cabe bersih per cup

// SOP per porsi diambil dari Master Resep produk Sambal Ciprek.
function ciprekSopItems(products, bahan) {
  const produk = (products || []).find(p => p.id === CIPREK_PRODUK_ID);
  return (produk?.resep || []).map(r => ({
    bahanId: r.bahanId,
    bahanName: bahan.find(b => b.id === r.bahanId)?.name || r.bahanId,
    sop: Number(r.qty) || 0
  }));
}

// Interpolasi linier antar anchor. Di bawah anchor terkecil dihitung proporsional.
function interpolasiAnchor(inputCabe, anchorVals) {
  const [a20, a120, a400, a1000] = anchorVals;
  if (inputCabe <= 20) return a20 * (inputCabe / 20);
  if (inputCabe <= 120) return a20 + (inputCabe - 20) * (a120 - a20) / (120 - 20);
  if (inputCabe <= 400) return a120 + (inputCabe - 120) * (a400 - a120) / (400 - 120);
  return a400 + (inputCabe - 400) * (a1000 - a400) / (1000 - 400);
}

// Menghitung seluruh baris kalkulator untuk satu nilai input cabe.
function hitungCiprek(inputCabe, sopItems, anchorMap) {
  const cabe = Number(inputCabe) || 0;
  const sopCabe = sopItems.find(s => s.bahanId === "frs_ca_01_001")?.sop || CIPREK_CABE_PER_CUP;
  const rows = sopItems.map(s => {
    const anchorVals = (anchorMap?.[s.bahanId] || [0, 0, 0, 0]).map(v => Number(v) || 0);
    const qtySop = sopCabe ? Math.round(cabe / sopCabe * s.sop * 10) / 10 : 0;
    const belumDiisi = anchorVals.every(v => v === 0);
    const qtyFinal = !cabe || cabe > CIPREK_MAX_BATCH || belumDiisi ? null : Math.round(interpolasiAnchor(cabe, anchorVals) * 10) / 10;
    const pctPakai = qtyFinal != null && qtySop ? qtyFinal / qtySop : null;
    const susut = pctPakai != null ? 1 - pctPakai : null;
    return {
      ...s,
      anchorVals,
      qtySop,
      qtyFinal,
      pctPakai,
      susut
    };
  });
  const totalSambalJadi = rows.reduce((a, r) => a + (r.qtyFinal || 0), 0);
  const targetCup = cabe ? Math.floor(cabe / CIPREK_CABE_PER_CUP) : 0;
  const gramPerCup = targetCup ? Math.round(totalSambalJadi / targetCup * 10) / 10 : 0;
  return {
    rows,
    totalSambalJadi: Math.round(totalSambalJadi * 10) / 10,
    targetCup,
    gramPerCup,
    melebihiBatch: cabe > CIPREK_MAX_BATCH,
    saranBatch: cabe > CIPREK_MAX_BATCH ? Math.ceil(cabe / CIPREK_MAX_BATCH) : 0,
    dibawahRekomendasi: cabe > 0 && cabe < CIPREK_MIN_REKOMENDASI,
    anchorBelumLengkap: rows.some(r => r.anchorVals.every(v => v === 0))
  };
}
function MasterMinyakTab({
  minyakConfig,
  setMinyakConfig,
  readOnly
}) {
  const cfgForm = c => ({
    literPerCm: String(c.literPerCm),
    konstanta: String(c.konstanta),
    koefMinyak: String(c.koefMinyak ?? 0.1),
    allowanceMinyak: String(c.allowanceMinyak ?? 0.15),
    ekorPerBatch: String(c.ekorPerBatch ?? 3)
  });
  const [form, setForm] = useState(cfgForm(minyakConfig));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setForm(cfgForm(minyakConfig));
  }, [minyakConfig]);
  const lpc = Number(form.literPerCm) || 0;
  const konst = Number(form.konstanta) || 0;
  const koef = Number(form.koefMinyak) || 0;
  const allow = Number(form.allowanceMinyak) || 0;
  const ekor = Number(form.ekorPerBatch) || 0;
  const berubah = lpc !== minyakConfig.literPerCm || konst !== minyakConfig.konstanta || koef !== (minyakConfig.koefMinyak ?? 0.1) || allow !== (minyakConfig.allowanceMinyak ?? 0.15) || ekor !== (minyakConfig.ekorPerBatch ?? 3);
  const simpan = () => {
    setMinyakConfig({
      literPerCm: lpc,
      konstanta: konst,
      koefMinyak: koef,
      allowanceMinyak: allow,
      ekorPerBatch: ekor,
      updatedAt: new Date().toISOString()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const Field = ({
    label,
    value,
    onChange,
    hint
  }) => <div style={{
    marginBottom: 14
  }}>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      fontWeight: 700,
      textTransform: "uppercase",
      marginBottom: 5
    }}>{label}</div>
      <input type="number" step="0.01" value={value} disabled={readOnly} onChange={e => onChange(e.target.value)} style={{
      width: 180,
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      padding: "9px 12px",
      ...FM,
      fontSize: 14,
      background: readOnly ? T.surfaceSunk : T.surface
    }} className="ais-control" />
      {hint && <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 4
    }}>{hint}</div>}
    </div>;
  return <FormSurface title="Parameter minyak." subtitle="Sesuaikan konversi dan allowance untuk perhitungan produksi." code="OIL"><div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 16,
        background: T.surfaceSunk,
        padding: "10px 12px",
        borderRadius: 10
      }} className="ais-content-panel">
        Angka konversi di sini dipakai langsung oleh <b>Laporan Minyak</b> di mobile app (Base Preparation, Top Up, dan Stok Akhir Minyak). Mengubahnya akan mengubah perhitungan liter di semua form tersebut.
      </div>

      <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16
      }} className="ais-content-panel">
        <Field label="Liter per 1 cm" value={form.literPerCm} onChange={v => setForm({
          ...form,
          literPerCm: v
        })} hint="Berapa liter minyak untuk setiap 1 cm ketinggian di fryer." />
        <Field label="Konstanta Dasar Fryer (Liter)" value={form.konstanta} onChange={v => setForm({
          ...form,
          konstanta: v
        })} hint="Volume dasar fryer yang selalu ditambahkan saat menghitung isi fryer." />
        <div style={{
          borderTop: `1px solid ${T.line}`,
          margin: "4px 0 14px",
          paddingTop: 14,
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted
        }}>
          Dipakai <b>Waste Calculation</b> untuk TheoWide Minyak Goreng: (Ayam Utuh + Ayam Original + Hotwings ÷ isi × ekor + Kulit ÷ isi × ekor) × koefisien × (1 + allowance).
        </div>
        <Field label="Koefisien Minyak per Ekor (Kg)" value={form.koefMinyak} onChange={v => setForm({
          ...form,
          koefMinyak: v
        })} hint="Angka pengali 0,1 pada rumus TheoWide minyak." />
        <Field label="Allowance / Susut Minyak (desimal)" value={form.allowanceMinyak} onChange={v => setForm({
          ...form,
          allowanceMinyak: v
        })} hint="0,15 = tambahan 15%." />
        <Field label="Ekor Ayam per Batch Hotwings/Kulit" value={form.ekorPerBatch} onChange={v => setForm({
          ...form,
          ekorPerBatch: v
        })} hint="Angka ×3 pada rumus: 1 batch (isi Hotwings 7 porsi / Kulit 12 porsi) setara 3 ekor ayam." />

        <div style={{
          background: T.surfaceSunk,
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 14
        }} className="ais-content-panel">
          <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 6
          }}>Rumus yang Berlaku</div>
          <div style={{
            ...FM,
            fontSize: 12.5,
            lineHeight: 1.9
          }}>
            Minyak Fryer = (cm × {lpc}) + {konst} L<br />
            Top Up = cm × {lpc} L
          </div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 8
          }}>
            Contoh: fryer 8 cm = ({8} × {lpc}) + {konst} = <b>{(8 * lpc + konst).toFixed(2)} L</b> · Top Up 3 cm = <b>{(3 * lpc).toFixed(2)} L</b>
          </div>
        </div>

        {!readOnly && <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center"
        }} className="ais-flex-layout">
            <button onClick={simpan} disabled={!berubah} style={{
            border: "none",
            borderRadius: 10,
            padding: "9px 18px",
            background: berubah ? T.manajemen : T.line,
            color: "#fff",
            fontFamily: "DM Sans",
            fontWeight: 600,
            fontSize: 13,
            cursor: berubah ? "pointer" : "not-allowed"
          }} className="ais-button ais-button--primary">Simpan Perubahan</button>
            {saved && <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            ...FI,
            fontSize: 12.5,
            color: T.good,
            fontWeight: 600
          }}><Check size={14} /> Tersimpan</span>}
            {berubah && <span style={{
            ...FI,
            fontSize: 11.5,
            color: T.warn
          }}>Ada perubahan belum disimpan</span>}
          </div>}
        {minyakConfig.updatedAt && <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted,
          marginTop: 10
        }}>Terakhir diubah: {new Date(minyakConfig.updatedAt).toLocaleString("id-ID")}</div>}
      </div>
    </div></FormSurface>;
}
function MasterCiprekTab({
  stores,
  products,
  bahan,
  ciprekConfig,
  setCiprekConfig,
  currentUser,
  readOnly
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [simCabe, setSimCabe] = useState("600");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [alasan, setAlasan] = useState("");
  const sopItems = ciprekSopItems(products, bahan);
  const cfg = ciprekConfig[store] || {
    anchors: {},
    status: "draft",
    log: [],
    approvals: {}
  };
  const anchorMap = cfg.anchors || {};
  const hasil = hitungCiprek(simCabe, sopItems, anchorMap);

  // Perubahan anchor perlu persetujuan Eri + kedua Direksi (mereka bertiga yang melakukan tester).
  const APPROVER_IDS = ["eri", "kurnia", "juhaeri"];
  const isApprover = APPROVER_IDS.includes(currentUser.id);
  const pendingApprovals = cfg.approvals || {};
  const semuaSetuju = APPROVER_IDS.every(id => pendingApprovals[id]);
  const terkunci = cfg.status === "locked";
  const mulaiEdit = () => {
    const d = {};
    sopItems.forEach(s => {
      d[s.bahanId] = (anchorMap[s.bahanId] || [0, 0, 0, 0]).map(v => String(v || ""));
    });
    setDraft(d);
    setAlasan("");
    setEditing(true);
  };
  const simpanDraft = () => {
    const anchors = {};
    sopItems.forEach(s => {
      anchors[s.bahanId] = (draft[s.bahanId] || []).map(v => Number(v) || 0);
    });
    const sudahAda = cfg.status === "locked";
    setCiprekConfig({
      ...ciprekConfig,
      [store]: {
        ...cfg,
        anchors,
        // Anchor baru (toko baru) langsung terkunci; perubahan atas anchor terkunci butuh approval ulang.
        status: sudahAda ? "menunggu_approval" : "locked",
        approvals: {},
        log: [...(cfg.log || []), {
          oleh: currentUser.name,
          at: new Date().toISOString(),
          alasan: alasan.trim(),
          jenis: sudahAda ? "perubahan" : "penetapan"
        }]
      }
    });
    setEditing(false);
  };
  const setujui = () => {
    const next = {
      ...pendingApprovals,
      [currentUser.id]: true
    };
    const lengkap = APPROVER_IDS.every(id => next[id]);
    setCiprekConfig({
      ...ciprekConfig,
      [store]: {
        ...cfg,
        approvals: next,
        status: lengkap ? "locked" : "menunggu_approval"
      }
    });
  };
  const th = {
    padding: "8px 10px",
    fontSize: 10.5,
    color: T.inkMuted,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    background: T.surfaceSunk
  };
  const td = {
    padding: "6px 10px",
    ...FM,
    fontSize: 12
  };
  const numIn = (val, onChange) => <input type="number" value={val} onChange={e => onChange(e.target.value)} placeholder="0" style={{
    width: 74,
    border: `1px solid ${T.line}`,
    borderRadius: 7,
    padding: "5px 7px",
    ...FM,
    fontSize: 12,
    textAlign: "right"
  }} className="ais-control" />;
  return <FormSurface title="Standar yang konsisten." subtitle="Atur komposisi dan acuan kebutuhan produksi." code="STANDARD"><div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 16,
        background: T.surfaceSunk,
        padding: "10px 12px",
        borderRadius: 10
      }} className="ais-content-panel">
        <b>SOP</b> diambil dari Master Resep produk Sambal Ciprek. <b>Anchor</b> adalah hasil tester pada 20/120/400/1000 gr cabe — dikunci setelah ditetapkan, dan perubahannya butuh persetujuan Eri, Kurnia, &amp; Juhaeri. Anchor dibuat <b>terpisah per toko</b> karena selera pasar tiap daerah berbeda.
      </div>

      <div style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 16,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        <select value={store} onChange={e => {
          setStore(e.target.value);
          setEditing(false);
        }} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Badge tone={terkunci ? "good" : cfg.status === "menunggu_approval" ? "warn" : "manajemen"}>
          {terkunci ? "Terkunci" : cfg.status === "menunggu_approval" ? "Menunggu Approval" : "Belum Ditetapkan"}
        </Badge>
        {hasil.anchorBelumLengkap && <span style={{
          ...FI,
          fontSize: 11.5,
          color: T.warn
        }}>Anchor toko ini belum diisi — perlu tester dulu.</span>}
      </div>

      {cfg.status === "menunggu_approval" && <div style={{
        background: T.warnSoft,
        color: T.warn,
        borderRadius: 10,
        padding: "11px 13px",
        marginBottom: 16,
        ...FI,
        fontSize: 12.5
      }}>
          <div style={{
          fontWeight: 700
        }}>Perubahan anchor menunggu persetujuan</div>
          <div style={{
          fontSize: 11.5,
          marginTop: 3
        }}>
            {APPROVER_IDS.map(id => `${id === "eri" ? "Eri" : id === "kurnia" ? "Kurnia" : "Juhaeri"}: ${pendingApprovals[id] ? "Setuju" : "Menunggu"}`).join(" · ")}
          </div>
          {isApprover && !pendingApprovals[currentUser.id] && <button onClick={setujui} style={{
          marginTop: 8,
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.warn,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Setujui Perubahan</button>}
        </div>}

      {/* --- Simulasi (tidak mengubah data apa pun) --- */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16
      }} className="ais-content-panel">
        <div style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
          marginBottom: 12
        }} className="ais-flex-layout">
          <div>
            <div style={{
              ...FI,
              fontSize: 11.5,
              color: T.inkMuted,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 5
            }}>Simulasi — Input Cabe Bersih (gr)</div>
            <input type="number" value={simCabe} onChange={e => setSimCabe(e.target.value)} style={{
              width: 160,
              border: `1px solid ${T.accent}`,
              borderRadius: 9,
              padding: "9px 12px",
              ...FM,
              fontSize: 14,
              background: T.accentSoft
            }} className="ais-control" />
          </div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            paddingBottom: 10
          }}>
            Hanya untuk mengecek hasil hitungan — tidak tersimpan &amp; tidak memengaruhi data operasional.
          </div>
        </div>

        {hasil.melebihiBatch && <div style={{
          background: T.badSoft,
          color: T.bad,
          borderRadius: 10,
          padding: "10px 12px",
          ...FI,
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 12
        }}>
            Melebihi batas 1 batch ({CIPREK_MAX_BATCH} gr). Rasa &amp; kualitas tidak terjaga — pecah menjadi <b>{hasil.saranBatch} batch</b>.
          </div>}
        {hasil.dibawahRekomendasi && <div style={{
          background: T.warnSoft,
          color: T.warn,
          borderRadius: 10,
          padding: "10px 12px",
          ...FI,
          fontSize: 12.5,
          marginBottom: 12
        }}>
            Di bawah rekomendasi minimal {CIPREK_MIN_REKOMENDASI} gr — hasil tetap dihitung, tapi kurang efisien.
          </div>}

        <div style={{
          overflowX: "auto"
        }}>
          <table style={{
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12,
            minWidth: 900
          }}>
            <thead>
              <tr style={{
                textAlign: "left"
              }}>
                <th style={{
                  ...th,
                  position: "sticky",
                  left: 0,
                  minWidth: 130
                }}>Bahan</th>
                <th style={th}>SOP /Porsi</th>
                <th style={th}>Qty SOP</th>
                {CIPREK_ANCHORS.map(a => <th key={a} style={th}>Anchor {a}gr</th>)}
                <th style={{
                  ...th,
                  background: T.accentSoft,
                  color: T.accentDeep
                }}>Qty Final Produksi</th>
                <th style={th}>% Pakai dari SOP</th>
                <th style={th}>Susut Dinamis</th>
              </tr>
            </thead>
            <tbody>
              {sopItems.length === 0 && <tr><td colSpan={10} style={{
                  padding: 16,
                  color: T.inkMuted,
                  ...FI
                }}>Resep Sambal Ciprek belum diisi di Master Resep.</td></tr>}
              {hasil.rows.map((r, i) => <tr key={r.bahanId} style={{
                borderTop: `1px solid ${T.line}`
              }}>
                  <td style={{
                  padding: "6px 10px",
                  fontWeight: 600,
                  position: "sticky",
                  left: 0,
                  background: T.surface,
                  minWidth: 130
                }}>{r.bahanName}</td>
                  <td style={td}>{r.sop}</td>
                  <td style={td}>{r.qtySop || "-"}</td>
                  {CIPREK_ANCHORS.map((a, idx) => <td key={a} style={{
                  padding: "4px 10px"
                }}>
                      {editing ? numIn(draft[r.bahanId]?.[idx] ?? "", v => {
                    const arr = [...(draft[r.bahanId] || ["", "", "", ""])];
                    arr[idx] = v;
                    setDraft({
                      ...draft,
                      [r.bahanId]: arr
                    });
                  }) : <span style={{
                    ...FM,
                    fontSize: 12
                  }}>{r.anchorVals[idx] || "-"}</span>}
                    </td>)}
                  <td style={{
                  ...td,
                  background: T.accentSoft,
                  fontWeight: 700,
                  color: T.accentDeep
                }}>{r.qtyFinal ?? "-"}</td>
                  <td style={td}>{r.pctPakai != null ? `${Math.round(r.pctPakai * 100)}%` : "-"}</td>
                  <td style={{
                  ...td,
                  color: r.susut != null && r.susut > 0.5 ? T.warn : T.ink
                }}>{r.susut != null ? `${Math.round(r.susut * 100)}%` : "-"}</td>
                </tr>)}
            </tbody>
          </table>
        </div>

        {!editing && !hasil.melebihiBatch && hasil.targetCup > 0 && <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${T.line}`
        }}>
            <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 6
          }}>Ringkasan Produksi Teoritis</div>
            <div style={{
            display: "flex",
            gap: 22,
            flexWrap: "wrap",
            ...FI,
            fontSize: 12.5
          }} className="ais-flex-layout">
              <div>Total Sambal Jadi: <b style={{
                fontFamily: "JetBrains Mono"
              }}>{hasil.totalSambalJadi}</b> gr</div>
              <div>Target Cup: <b style={{
                fontFamily: "JetBrains Mono"
              }}>{hasil.targetCup}</b> cup</div>
              <div style={{
              color: T.inkMuted
            }}>Rata² per cup: {hasil.gramPerCup} gr</div>
            </div>
            <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            marginTop: 5
          }}>
              Target cup = input cabe ÷ {CIPREK_CABE_PER_CUP} gr. Gram per cup mengikuti hasil, tidak dipatok.
            </div>
          </div>}
      </div>

      {/* --- Aksi edit anchor --- */}
      {!readOnly && <div style={{
        marginBottom: 16
      }}>
          {!editing ? isApprover && <button onClick={mulaiEdit} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">
                <PenLine size={13} /> {terkunci ? "Ajukan Perubahan Anchor" : "Tetapkan Anchor (hasil tester)"}
              </button> : <div style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: 14
        }} className="ais-content-panel">
              <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 6
          }}>Alasan {terkunci ? "perubahan" : "penetapan"} (tercatat di log)</div>
              <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Contoh: hasil tester ulang Agustus, market minta lebih manis" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            ...FI,
            fontSize: 12.5,
            marginBottom: 10
          }} className="ais-control" />
              {terkunci && <div style={{
            ...FI,
            fontSize: 11,
            color: T.warn,
            marginBottom: 10
          }}>Perubahan ini baru berlaku setelah disetujui Eri, Kurnia, dan Juhaeri.</div>}
              <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                <button onClick={simpanDraft} style={{
              border: "none",
              borderRadius: 9,
              padding: "8px 14px",
              background: T.manajemen,
              color: "#fff",
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">
                  {terkunci ? "Ajukan Perubahan" : "Kunci Anchor"}
                </button>
                <button onClick={() => setEditing(false)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 9,
              padding: "8px 14px",
              background: "transparent",
              color: T.inkMuted,
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">Batal</button>
              </div>
            </div>}
        </div>}

      {(cfg.log || []).length > 0 && <div>
          <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase",
          marginBottom: 6
        }}>Log Perubahan Anchor</div>
          <div style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "8px 14px"
        }} className="ais-content-panel">
            {cfg.log.slice().reverse().map((l, i) => <div key={i} style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            padding: "4px 0",
            borderTop: i ? `1px solid ${T.line}` : "none"
          }}>
                <b style={{
              color: T.ink
            }}>{l.jenis === "penetapan" ? "Penetapan awal" : "Perubahan"}</b> · {l.oleh} · {new Date(l.at).toLocaleString("id-ID")}{l.alasan ? ` — "${l.alasan}"` : ""}
              </div>)}
          </div>
        </div>}
    </div></FormSurface>;
}
function MasterProduksiPage({
  minyakConfig,
  setMinyakConfig,
  stores,
  products,
  bahan,
  ciprekConfig,
  setCiprekConfig,
  currentUser,
  readOnly
}) {
  const [tab, setTab] = useState("oil_mi_01_001");
  const tabs = [{
    key: "oil_mi_01_001",
    label: "Master Minyak"
  }, {
    key: "ciprek",
    label: "Master Ciprek"
  }];
  return <div>
      <SectionTitle icon={Package}>Master Produksi</SectionTitle>
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 320
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>
      {tab === "oil_mi_01_001" && <MasterMinyakTab minyakConfig={minyakConfig} setMinyakConfig={setMinyakConfig} readOnly={readOnly} />}
      {tab === "ciprek" && <MasterCiprekTab stores={stores} products={products} bahan={bahan} ciprekConfig={ciprekConfig} setCiprekConfig={setCiprekConfig} currentUser={currentUser} readOnly={readOnly} />}
    </div>;
}
function MasterResepPage({
  products,
  setProducts,
  bahan
}) {
  const [editingProductId, setEditingProductId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [openId, setOpenId] = useState(null);
  const editingProduct = editingProductId ? products.find(p => p.id === editingProductId) : null;
  const belumAdaResep = products.filter(p => !p.resep || p.resep.length === 0).length;
  const saveResep = (productId, items) => {
    setProducts(products.map(p => p.id === productId ? {
      ...p,
      resep: items
    } : p));
    setEditingProductId(null);
  };
  const saveNewProduct = data => {
    setProducts([...products, {
      id: uid(),
      ...data
    }]);
    setAddingNew(false);
  };
  return <div>
      <SectionTitle icon={ClipboardCheck} action={<button onClick={() => {
      setAddingNew(true);
      setEditingProductId(null);
    }} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      border: "none",
      borderRadius: 9,
      padding: "9px 14px",
      background: T.accent,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 13,
      cursor: "pointer"
    }} className="ais-button ais-button--default ais-flex-layout"><Plus size={14} /> Tambah Produk Baru</button>}>Master Resep / BOM ({products.length})</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
Resep/BOM dipakai untuk validasi pemakaian bahan baku terhadap penjualan (deteksi selisih/waste per produk). <b>Klik baris produk</b> untuk melihat rincian bahannya.
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20
    }} className="ais-flex-layout">
        <StatCard label="Total Produk" value={products.length} />
        <StatCard label="Sudah Ada Resep" value={products.length - belumAdaResep} tone="good" />
        <StatCard label="Belum Ada Resep" value={belumAdaResep} tone={belumAdaResep > 0 ? "warn" : "good"} />
      </div>

      {addingNew && <div style={{
      marginBottom: 20
    }}>
          <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 8
      }}>Produk Baru + Resep</div>
          <ProductForm bahan={bahan} onSave={saveNewProduct} onCancel={() => setAddingNew(false)} />
        </div>}

      {editingProduct && <div style={{
      background: T.surfaceSunk,
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20
    }} className="ais-content-panel">
          <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 10
      }}>Resep: {editingProduct.name} <span style={{
          ...FI,
          fontWeight: 400,
          fontSize: 12,
          color: T.inkMuted
        }}>({rupiah(editingProduct.price)})</span></div>
          <RecipeItemsEditorStateful product={editingProduct} bahan={bahan} onSave={items => saveResep(editingProduct.id, items)} onCancel={() => setEditingProductId(null)} />
        </div>}

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13
      }}>
          <thead>
            <tr style={THBG}>
              {["Produk", "Harga Jual", "Jumlah Bahan", "Total HPP", "% HPP", "Status Resep", ""].map(h => <th key={h} style={{
              ...TDW,
              fontSize: 11.5,
              color: T.inkMuted,
              textTransform: "uppercase"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={7} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada produk. Tambah produk baru dulu di atas.</td></tr>}
            {products.map(p => {
            const hpp = (p.resep || []).reduce((sum, it) => {
              const b = bahan.find(x => x.id === it.bahanId);
              return sum + (Number(it.qty) || 0) * (b?.harga || 0);
            }, 0);
            const pctHpp = p.price ? Math.round(hpp / p.price * 100) : 0;
            const terbuka = openId === p.id;
            return <Fragment key={p.id}>
                <tr onClick={() => setOpenId(terbuka ? null : p.id)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: terbuka ? T.surfaceSunk : "transparent"
              }}>
                  <td style={{
                  ...TDW,
                  fontWeight: 600
                }}>
                    <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                      <ChevronDown size={13} color={T.inkMuted} style={{
                      transform: terbuka ? "rotate(180deg)" : "none",
                      flexShrink: 0
                    }} />
                      {p.name}
                    </span>
                  </td>
                  <td style={TDW}>{rupiah(p.price)}</td>
                  <td style={TDW}>{p.resep?.length || 0}</td>
                  <td style={{
                  ...TDW,
                  ...FM
                }}>{p.resep?.length > 0 ? rupiah(hpp) : "-"}</td>
                  <td style={TDW}>{p.resep?.length > 0 ? <span style={{
                    fontWeight: 700,
                    color: pctHpp > 45 ? T.bad : pctHpp > 30 ? T.warn : T.good
                  }}>{pctHpp}%</span> : "-"}</td>
                  <td style={TDW}>{p.resep?.length > 0 ? <Badge tone="good">Ada</Badge> : <Badge tone="warn">Belum Ada</Badge>}</td>
                  <td style={{
                  ...TDW,
                  textAlign: "right"
                }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => {
                    setEditingProductId(p.id);
                    setAddingNew(false);
                  }} style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    background: "transparent",
                    color: T.accentDeep,
                    ...FI,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer"
                  }} className="ais-button ais-button--default">{p.resep?.length > 0 ? "Edit Resep" : "Tambah Resep"}</button>
                  </td>
                </tr>
                {terbuka && <tr style={{
                background: T.surfaceSunk
              }}>
                    <td colSpan={7} style={{
                  padding: "14px 18px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                      <div style={{
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    ...FI,
                    fontSize: 12,
                    color: T.inkMuted,
                    marginBottom: 10
                  }} className="ais-flex-layout">
                        <span>Kode: <b style={{
                        color: T.ink,
                        ...FM
                      }}>{p.kode || "-"}</b></span>
                        <span>Varian: <b style={{
                        color: T.ink
                      }}>{p.varian || "-"}</b></span>
                        <span>Status: <Badge tone={p.aktif === false ? "bad" : "good"}>{p.aktif === false ? "Nonaktif" : "Aktif"}</Badge></span>
                        <span>Dijual di: {(p.jenisToko || ["resto", "express"]).map(j => JENIS_TOKO_LABEL[j]).join(" & ")}</span>
                      </div>
                      {(p.resep || []).length === 0 ? <div style={{
                    ...FI,
                    fontSize: 12.5,
                    color: T.inkMuted
                  }}>Belum ada resep untuk produk ini.</div> : <div style={{
                    overflowX: "auto"
                  }}>
                          <table style={{
                      borderCollapse: "collapse",
                      ...FI,
                      fontSize: 12,
                      minWidth: 660
                    }}>
                            <thead>
                              <tr style={{
                          textAlign: "left",
                          color: T.inkMuted
                        }}>
                                {["SKU", "Bahan Baku", "Qty/Porsi", "Satuan", "Toleransi Waste", "Total/Porsi", "Biaya"].map(h => <th key={h} style={{
                            padding: "3px 10px 6px 0",
                            fontSize: 10.5,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap"
                          }}>{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {p.resep.map((it, i) => {
                          const b = bahan.find(x => x.id === it.bahanId);
                          const tot = Math.round((Number(it.qty) || 0) * (1 + (Number(it.toleransiPersen) || 0) / 100) * 1000) / 1000;
                          return <tr key={i} style={{
                            borderTop: `1px solid ${T.line}`
                          }}>
                                    <td style={{
                              padding: "4px 10px 4px 0",
                              ...FM,
                              fontSize: 11,
                              color: T.inkMuted
                            }}>{b?.sku || "-"}</td>
                                    <td style={{
                              padding: "4px 10px"
                            }}>{b?.name || it.bahanId}</td>
                                    <td style={{
                              padding: "4px 10px",
                              ...FM
                            }}>{it.qty}</td>
                                    <td style={{
                              padding: "4px 10px",
                              color: T.inkMuted
                            }}>{b?.unitKecil || "-"}</td>
                                    <td style={{
                              padding: "4px 10px",
                              color: it.toleransiPersen ? T.warn : T.inkMuted
                            }}>{it.toleransiPersen || 0}%</td>
                                    <td style={{
                              padding: "4px 10px",
                              ...FM,
                              fontWeight: 700
                            }}>{tot}</td>
                                    <td style={{
                              padding: "4px 10px",
                              ...FM
                            }}>{rupiah(Math.round(tot * (b?.harga || 0)))}</td>
                                  </tr>;
                        })}
                            </tbody>
                          </table>
                        </div>}
                    </td>
                  </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
/* ---------------------------------------------------------
   PAGE: MASTER JADWAL (grid spreadsheet-style)
--------------------------------------------------------- */
const OFFICE_SHIFT_CYCLE = ["-", "K", "O"];
const OFFICE_SHIFT_CODES = {
  "-": "Belum Dijadwalkan",
  K: "Kantor",
  O: "Libur"
};
const SCHEDULE_TONE = {
  "-": null,
  "1": "good",
  "2": "manajemen",
  S: "good",
  L: "accent",
  B: "warn",
  M: "bad",
  O: "inkMuted",
  K: "manajemen"
};
function ScheduleGrid({
  title,
  subtitle,
  workers,
  dates,
  schedule,
  setSchedule,
  shiftCycle,
  shiftCodes,
  workHours,
  isOffice,
  readOnly
}) {
  const cycle = (empId, ds) => {
    if (readOnly) return;
    const cur = schedule[`${empId}_${ds}`] || "-";
    const next = shiftCycle[(shiftCycle.indexOf(cur) + 1) % shiftCycle.length];
    setSchedule({
      ...schedule,
      [`${empId}_${ds}`]: next
    });
  };
  const toneColor = code => ({
    good: T.good,
    manajemen: T.manajemen,
    accent: T.accent,
    warn: T.warn,
    bad: T.bad,
    inkMuted: T.inkMuted
  })[SCHEDULE_TONE[code]] || T.line;
  return <div style={{
    marginBottom: 26
  }}>
      <div style={{
      ...FB,
      fontWeight: 700,
      fontSize: 16,
      color: T.ink
    }}>{title}</div>
      {subtitle && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 8
    }}>{subtitle}</div>}
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto",
      maxHeight: 420,
      marginTop: subtitle ? 0 : 8
    }} className="ais-content-panel">
        <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 11
      }}>
          <thead>
            <tr>
              <th style={{
              position: "sticky",
              left: 0,
              top: 0,
              zIndex: 3,
              background: T.surfaceSunk,
              padding: "8px 12px",
              textAlign: "left",
              minWidth: 190
            }}>Karyawan</th>
              {dates.map(ds => <th key={ds} style={{
              position: "sticky",
              top: 0,
              background: T.surfaceSunk,
              padding: "6px 3px",
              minWidth: 32,
              fontSize: 9.5
            }}>{ds.slice(8, 10)}/{ds.slice(5, 7)}</th>)}
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && <tr><td colSpan={dates.length + 1} style={{
              padding: 14,
              color: T.inkMuted,
              ...FI,
              fontSize: 12.5
            }}>Tidak ada karyawan aktif di kategori ini.</td></tr>}
            {workers.map(w => {
            const sum = workHours ? scheduleSummaryFor(w.id, dates, schedule, workHours) : null;
            return <tr key={w.id} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                position: "sticky",
                left: 0,
                background: T.surface,
                padding: "6px 12px",
                whiteSpace: "nowrap"
              }}>
                    <div style={{
                  fontWeight: 600
                }}>{w.name}</div>
                    {sum && <div style={{
                  ...FI,
                  fontSize: 9.5,
                  color: T.inkMuted,
                  marginTop: 2,
                  lineHeight: 1.5
                }}>
                        {isOffice ? <>Libur: {sum.libur} · Kantor: {sum.kantor}</> : <>Libur: {sum.libur} · S1: {sum.shift1} · S2: {sum.shift2} · Long: {sum.longshift} · Mobile: {sum.mobile}</>}
                        <br />Total Jam Kerja: <b style={{
                    color: T.ink
                  }}>{sum.totalJam.toFixed(0)} jam</b>
                      </div>}
                  </td>
                  {dates.map(ds => {
                const code = schedule[`${w.id}_${ds}`] || "-";
                return <td key={ds} style={{
                  padding: 2,
                  textAlign: "center"
                }}>
                        <button onClick={() => cycle(w.id, ds)} title={shiftCodes[code]} disabled={readOnly} style={{
                    width: 26,
                    height: 26,
                    border: "none",
                    borderRadius: 6,
                    cursor: readOnly ? "default" : "pointer",
                    background: code === "-" ? T.surfaceSunk : toneColor(code),
                    color: code === "-" ? T.inkMuted : "#fff",
                    fontFamily: "JetBrains Mono",
                    fontWeight: 700,
                    fontSize: 10.5,
                    opacity: readOnly ? 0.85 : 1
                  }} className="ais-button ais-button--default">{code}</button>
                      </td>;
              })}
                </tr>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
const WORK_HOURS_DEFAULT = {
  // Manajemen punya dua jadwal: Senin–Jumat dan Sabtu. Minggu libur.
  manajemen: {
    start: "08:00",
    end: "17:00"
  },
  // Senin–Jumat
  manajemenSabtu: {
    start: "08:00",
    end: "14:00"
  },
  // Sabtu
  "1": {
    start: "06:00",
    end: "14:00"
  },
  "2": {
    start: "14:00",
    end: "22:00"
  },
  toleransi: 15,
  // SPV & TL memakai shift "1 Toko" yang tidak terikat jam mulai — hanya durasi kerja.
  durasiSpvJam: 8
};
function MasterJamKerjaPanel({
  workHours,
  setWorkHours
}) {
  const data = {
    ...WORK_HOURS_DEFAULT,
    ...workHours,
    manajemen: {
      ...WORK_HOURS_DEFAULT.manajemen,
      ...workHours.manajemen
    },
    manajemenSabtu: {
      ...WORK_HOURS_DEFAULT.manajemenSabtu,
      ...workHours.manajemenSabtu
    },
    "1": {
      ...WORK_HOURS_DEFAULT["1"],
      ...workHours["1"]
    },
    "2": {
      ...WORK_HOURS_DEFAULT["2"],
      ...workHours["2"]
    }
  };
  const setField = (posisi, field, val) => setWorkHours({
    ...data,
    [posisi]: {
      ...data[posisi],
      [field]: val
    }
  });
  const rows = [{
    key: "manajemen",
    label: "Manajemen — Senin s/d Jumat"
  }, {
    key: "manajemenSabtu",
    label: "Manajemen — Sabtu"
  }, {
    key: "1",
    label: "Crew / Part Time — Shift 1"
  }, {
    key: "2",
    label: "Crew / Part Time — Shift 2"
  }];
  return <FormSurface title="Waktu kerja, lebih terarah." subtitle="Tentukan jam kerja, durasi shift, dan toleransi yang berlaku." code="WORK HOURS"><div className="ais-content-panel">
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 4
      }}>Master Jam Kerja</div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 14
      }}>
        Jam kerja ini dipakai mobile app untuk validasi keterlambatan absen masuk. <b>Manajemen</b> punya jam berbeda untuk Senin–Jumat dan Sabtu; app otomatis memilih sesuai hari absen. <b>SPV &amp; Team Leader</b> tidak terikat jam mulai — absen pulangnya mengikuti durasi kerja di bawah.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr 1fr",
        gap: 10,
        marginBottom: 6
      }} className="ais-responsive-grid">
        <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase"
        }}>Posisi</div>
        <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase"
        }}>Jam Masuk</div>
        <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase"
        }}>Jam Keluar</div>
      </div>
      {rows.map(r => <div key={r.key} style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr 1fr",
        gap: 10,
        marginBottom: 8,
        alignItems: "center"
      }} className="ais-responsive-grid">
          <span style={{
          ...FI,
          fontSize: 13
        }}>{r.label}</span>
          <input type="time" value={data[r.key].start} onChange={e => setField(r.key, "start", e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 9px",
          ...FM,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
          <input type="time" value={data[r.key].end} onChange={e => setField(r.key, "end", e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 9px",
          ...FM,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
        </div>)}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        paddingTop: 12,
        borderTop: `1px solid ${T.line}`
      }} className="ais-flex-layout">
        <span style={{
          ...FI,
          fontSize: 13
        }}>Durasi Kerja SPV / Team Leader (shift "1 Toko")</span>
        <input type="number" min="1" max="24" step="0.5" value={data.durasiSpvJam} onChange={e => setWorkHours({
          ...data,
          durasiSpvJam: Number(e.target.value)
        })} style={{
          width: 66,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          ...FM,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
        <span style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>jam</span>
      </div>
      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginTop: 4
      }}>
        Absen pulang SPV/TL baru terbuka setelah durasi ini terpenuhi, dihitung dari jam clock in — tidak terikat jam tertentu.
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 10
      }} className="ais-flex-layout">
        <span style={{
          ...FI,
          fontSize: 13
        }}>Toleransi Keterlambatan</span>
        <input type="number" value={data.toleransi} onChange={e => setWorkHours({
          ...data,
          toleransi: Number(e.target.value)
        })} style={{
          width: 60,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          ...FM,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
        <span style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>menit</span>
      </div>
    </div></FormSurface>;
}
function getJadwalLock(jadwalStatus, periodMonth) {
  return jadwalStatus[periodMonth] || {
    status: "draft",
    editCount: 0,
    editLog: []
  };
}

/* Satu toko di Input Jadwal: SPV mengisi & submit, Eri (atau Direksi) menyetujui / menolak.
   Status per toko per periode: draft → submitted → approved; rejected kembali bisa diedit SPV.
   Setelah approved, SPV punya jatah 1x mengajukan perubahan (kembali ke draft, lalu submit ulang). */
const JADWAL_TOKO_STATUS = {
  draft: {
    label: "Draft — belum disubmit SPV",
    tone: "warn"
  },
  submitted: {
    label: "Menunggu approval Eri",
    tone: "manajemen"
  },
  approved: {
    label: "Disetujui",
    tone: "good"
  },
  rejected: {
    label: "Ditolak — perlu diperbaiki SPV",
    tone: "bad"
  }
};
function JadwalTokoBlock({
  store,
  workers,
  dates,
  schedule,
  setSchedule,
  workHours,
  tokoLock,
  mode,
  onUpdate,
  currentUser,
  deadline,
  today
}) {
  const [tolakOpen, setTolakOpen] = useState(false);
  const [catatan, setCatatan] = useState("");
  const st = tokoLock.status || "draft";
  const meta = JADWAL_TOKO_STATUS[st] || JADWAL_TOKO_STATUS.draft;
  const editable = mode === "spv" && (st === "draft" || st === "rejected");
  const telat = mode === "spv" && editable && today > deadline;
  const log = (aksi, extra) => ({
    log: [...(tokoLock.log || []), {
      aksi,
      oleh: currentUser.name,
      at: new Date().toISOString(),
      ...(extra || {})
    }]
  });
  const submit = () => onUpdate({
    status: "submitted",
    submittedBy: currentUser.name,
    submittedAt: new Date().toISOString(),
    catatanTolak: null,
    ...log("submit")
  });
  const setujui = () => onUpdate({
    status: "approved",
    approvedBy: currentUser.name,
    approvedAt: new Date().toISOString(),
    ...log("approve")
  });
  const tolak = () => {
    onUpdate({
      status: "rejected",
      catatanTolak: catatan.trim(),
      rejectedBy: currentUser.name,
      rejectedAt: new Date().toISOString(),
      ...log("reject", {
        catatan: catatan.trim()
      })
    });
    setTolakOpen(false);
    setCatatan("");
  };
  const ajukanUbah = () => {
    if (!window.confirm("Ini jatah perubahan satu-satunya setelah jadwal disetujui. Jadwal akan kembali ke draft dan perlu disubmit ulang untuk approval Eri. Lanjutkan?")) return;
    onUpdate({
      status: "draft",
      editCount: (tokoLock.editCount || 0) + 1,
      ...log("ajukan_perubahan")
    });
  };
  const btn = (bg, fg, border) => ({
    border: border || "none",
    borderRadius: 9,
    padding: "8px 14px",
    background: bg,
    color: fg,
    ...FI,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap"
  });
  return <div style={{
    marginBottom: 8
  }}>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: "10px 14px",
      marginBottom: 8
    }} className="ais-flex-layout ais-content-panel">
        <div>
          <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 13.5,
          display: "flex",
          alignItems: "center",
          gap: 8
        }} className="ais-flex-layout">
            {store.name} <Badge tone={meta.tone}>{meta.label}</Badge>
            {telat && <Badge tone="bad">Lewat batas submit {deadline}</Badge>}
          </div>
          <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginTop: 3
        }}>
            {st === "submitted" && `Disubmit ${tokoLock.submittedBy} · ${new Date(tokoLock.submittedAt).toLocaleString("id-ID")}`}
            {st === "approved" && `Disetujui ${tokoLock.approvedBy} · ${new Date(tokoLock.approvedAt).toLocaleString("id-ID")}${tokoLock.editCount ? " · jatah perubahan sudah dipakai" : ""}`}
            {st === "rejected" && <>Ditolak {tokoLock.rejectedBy}{tokoLock.catatanTolak ? <> — <i>"{tokoLock.catatanTolak}"</i></> : ""}</>}
            {st === "draft" && (mode === "spv" ? `Isi jadwal lalu submit ke Eri. Batas submit ${deadline} (H-1 sebelum periode dimulai).` : "SPV belum submit jadwal toko ini.")}
          </div>
        </div>
        <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
          {mode === "spv" && editable && <button onClick={submit} style={btn(T.manajemen, "#fff")} className="ais-button ais-button--primary">Submit ke Eri</button>}
          {mode === "spv" && st === "approved" && !(tokoLock.editCount >= 1) && <button onClick={ajukanUbah} style={btn("transparent", T.good, `1px solid ${T.good}`)} className="ais-button ais-button--primary"><PenLine size={13} /> Ajukan Perubahan (1x)</button>}
          {mode === "approver" && st === "submitted" && !tolakOpen && <>
              <button onClick={setujui} style={btn(T.good, "#fff")} className="ais-button ais-button--primary">Setujui</button>
              <button onClick={() => setTolakOpen(true)} style={btn("transparent", T.bad, `1px solid ${T.bad}`)} className="ais-button ais-button--danger">Tolak</button>
            </>}
        </div>
      </div>
      {tolakOpen && <div style={{
      background: T.badSoft,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8
    }}>
          <div style={{
        ...FI,
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6
      }}>Alasan penolakan (dikirim ke SPV)</div>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Contoh: Shift 2 tanggal 25 kekurangan crew" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 10px",
        ...FI,
        fontSize: 13,
        resize: "none",
        marginBottom: 8
      }} className="ais-control" />
          <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
            <button disabled={!catatan.trim()} onClick={tolak} style={{
          ...btn(catatan.trim() ? T.bad : T.line, "#fff"),
          cursor: catatan.trim() ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--danger">Kirim Penolakan</button>
            <button onClick={() => {
          setTolakOpen(false);
          setCatatan("");
        }} style={btn("transparent", T.inkMuted, `1px solid ${T.line}`)} className="ais-button ais-button--default">Batal</button>
          </div>
        </div>}
      <ScheduleGrid title={`Toko: ${store.name}`} workers={workers} dates={dates} schedule={schedule} setSchedule={setSchedule} shiftCycle={SHIFT_CYCLE} shiftCodes={SHIFT_CODES} workHours={workHours} readOnly={!editable} />
    </div>;
}
function InputJadwalTab({
  employees,
  stores,
  schedule,
  setSchedule,
  workHours,
  jadwalStatus,
  setJadwalStatus,
  currentUser,
  mode = "approver"
}) {
  const [periodMonth, setPeriodMonth] = useState(monthStr(new Date()));
  const period = payrollPeriodForMonth(periodMonth);
  const dates = dateRangeList(period.start, period.end);
  const activeEmp = employees.filter(e => e.status === "aktif");
  const crewByStore = storeId => activeEmp.filter(e => (e.group === "crew" || e.group === "parttime") && e.store === storeId);
  const spvList = activeEmp.filter(e => e.group === "spv" || e.group === "tl");
  const manajemenList = activeEmp.filter(e => e.group === "manajemen");
  const lock = getJadwalLock(jadwalStatus, periodMonth);
  const isLocked = lock.status === "locked";
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const readOnly = mode !== "approver" || isLocked && !editing;
  const tokoLock = id => lock.toko?.[id] || {
    status: "draft",
    editCount: 0,
    log: []
  };
  const updateToko = (id, patch) => setJadwalStatus({
    ...jadwalStatus,
    [periodMonth]: {
      ...lock,
      toko: {
        ...(lock.toko || {}),
        [id]: {
          ...tokoLock(id),
          ...patch
        }
      }
    }
  });
  const menunggu = stores.filter(s => tokoLock(s.id).status === "submitted").length;
  const deadline = addDaysStr(period.start, -1); // H-1 sebelum tanggal 21 periode berjalan
  const today = dateStr(new Date());
  const isOverdue = !isLocked && today > deadline;
  const daysToDeadline = Math.ceil((new Date(deadline + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
  const submitLock = () => {
    setJadwalStatus({
      ...jadwalStatus,
      [periodMonth]: {
        ...lock,
        status: "locked",
        submittedAt: new Date().toISOString(),
        submittedBy: currentUser.name
      }
    });
  };
  const startEdit = () => {
    setEditing(true);
    setShowEditForm(false);
    setEditNote("");
  };
  const saveEdit = () => {
    const nextLog = [...(lock.editLog || []), {
      editedBy: currentUser.name,
      editedAt: new Date().toISOString(),
      catatan: editNote
    }];
    setJadwalStatus({
      ...jadwalStatus,
      [periodMonth]: {
        ...lock,
        status: "locked",
        editCount: (lock.editCount || 0) + 1,
        editLog: nextLog
      }
    });
    setEditing(false);
    setShowEditForm(false);
    setEditNote("");
  };
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 14
    }}>
        <input type="month" value={periodMonth} onChange={e => {
        setPeriodMonth(e.target.value);
        setEditing(false);
      }} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
      </div>

      <div style={{
      ...FI,
      fontSize: 12,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Periode gajian: <b>{period.label}</b> (tanggal 21 s.d. 20 setiap periode). Klik sel untuk mengganti shift — Toko/SPV: {SHIFT_CYCLE.map(c => SHIFT_CODES[c]).join(" → ")}; Manajemen: {OFFICE_SHIFT_CYCLE.map(c => OFFICE_SHIFT_CODES[c]).join(" → ")}.
      </div>

      {mode !== "spv" && <div style={{
      ...FI,
      fontSize: 12.5,
      marginBottom: 14,
      padding: "10px 14px",
      borderRadius: 12,
      background: menunggu ? T.manajemenSoft : T.surfaceSunk,
      color: menunggu ? T.manajemen : T.inkMuted,
      fontWeight: 600
    }}>
          Jadwal crew per toko diinput & disubmit oleh SPV/TL masing-masing. {mode === "approver" ? "Tugas Anda di sini: menyetujui atau menolak." : ""} Menunggu approval: <b>{menunggu}</b> toko.
        </div>}
      {stores.map(s => <JadwalTokoBlock key={s.id} store={s} workers={crewByStore(s.id)} dates={dates} schedule={schedule} setSchedule={setSchedule} workHours={workHours} tokoLock={tokoLock(s.id)} mode={mode} onUpdate={patch => updateToko(s.id, patch)} currentUser={currentUser} deadline={deadline} today={today} />)}
      {mode !== "spv" && <>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16,
        margin: "24px 0 8px"
      }}>Jadwal SPV, TL & Manajemen</div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        background: isLocked ? T.goodSoft : isOverdue ? T.badSoft : T.warnSoft,
        color: isLocked ? T.good : isOverdue ? T.bad : T.warn,
        padding: "12px 14px",
        borderRadius: 12,
        marginBottom: 20,
        fontFamily: "DM Sans"
      }} className="ais-flex-layout">
        <div>
          <div style={{
            fontWeight: 700,
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 6
          }} className="ais-flex-layout">
            {isLocked ? <><Lock size={14} /> Jadwal SPV, TL & Manajemen Terkunci</> : isOverdue ? <><AlertTriangle size={14} /> Lewat Deadline</> : <>Batas Submit: {deadline} (H-1 sebelum periode dimulai)</>}
          </div>
          <div style={{
            fontSize: 11.5,
            marginTop: 2
          }}>
            {isLocked ? `Disubmit oleh ${lock.submittedBy} pada ${new Date(lock.submittedAt).toLocaleString("id-ID")}${lock.editCount > 0 ? ` · sudah diedit ${lock.editCount}x` : ""}` : isOverdue ? `Sudah lewat ${Math.abs(daysToDeadline)} hari dari batas submit — segera submit & kunci jadwal ini.` : `Sisa ${daysToDeadline} hari lagi sebelum batas submit.`}
          </div>
        </div>
        {mode === "approver" && !isLocked && <button onClick={submitLock} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: T.manajemen,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer",
          whiteSpace: "nowrap"
        }} className="ais-button ais-button--primary">
            Submit & Kunci Jadwal
          </button>}
        {mode === "approver" && isLocked && !editing && lock.editCount < 1 && <button onClick={() => setShowEditForm(true)} style={{
          border: `1px solid ${T.good}`,
          borderRadius: 9,
          padding: "9px 16px",
          background: "transparent",
          color: T.good,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 6
        }} className="ais-button ais-button--default ais-flex-layout">
            <PenLine size={13} /> Edit (jatah 1x)
          </button>}
        {isLocked && editing && <button onClick={saveEdit} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: T.manajemen,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer",
          whiteSpace: "nowrap"
        }} className="ais-button ais-button--primary">
            Simpan Perubahan & Kunci Kembali
          </button>}
      </div>

      {showEditForm && !editing && <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 20
      }} className="ais-content-panel">
          <div style={{
          ...FI,
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 6
        }}>Alasan Edit (opsional, tercatat di log)</div>
          <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2} placeholder="Contoh: Ada perubahan jadwal mendadak karena izin karyawan" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 10px",
          ...FI,
          fontSize: 13,
          resize: "none",
          marginBottom: 10
        }} className="ais-control" />
          <div style={{
          ...FI,
          fontSize: 11,
          color: T.warn,
          marginBottom: 10
        }}>Ini jatah edit satu-satunya untuk periode ini — pastikan semua perubahan sudah benar sebelum disimpan.</div>
          <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
            <button onClick={startEdit} style={{
            border: "none",
            borderRadius: 9,
            padding: "8px 14px",
            background: T.good,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">Lanjut Edit Jadwal</button>
            <button onClick={() => setShowEditForm(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 14px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">Batal</button>
          </div>
        </div>}

      {(lock.editLog || []).length > 0 && <div style={{
        marginBottom: 20
      }}>
          <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 11,
          color: T.inkMuted,
          textTransform: "uppercase",
          marginBottom: 6
        }}>Log Edit</div>
          {lock.editLog.map((l, i) => <div key={i} style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          padding: "5px 0",
          borderTop: `1px solid ${T.line}`
        }}>
              Diedit oleh <b style={{
            color: T.ink
          }}>{l.editedBy}</b> pada {new Date(l.editedAt).toLocaleString("id-ID")}{l.catatan ? ` — "${l.catatan}"` : ""}
            </div>)}
        </div>}

      {isLocked && !editing && <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 14,
        fontStyle: "italic"
      }}>Grid di bawah dalam mode lihat saja karena jadwal sudah terkunci.</div>}

      <ScheduleGrid title="SPV" subtitle="SPV menaungi lebih dari satu toko — jadwal dikelola terpisah dari grid per toko." workers={spvList.filter(e => e.group === "spv")} dates={dates} schedule={schedule} setSchedule={setSchedule} shiftCycle={SHIFT_CYCLE} shiftCodes={SHIFT_CODES} workHours={workHours} readOnly={readOnly} />
      {spvList.some(e => e.group === "tl") && <ScheduleGrid title="Team Leader" subtitle="TL memegang satu toko — tidak ada shift Mobile." workers={spvList.filter(e => e.group === "tl")} dates={dates} schedule={schedule} setSchedule={setSchedule} shiftCycle={TL_SHIFT_CYCLE} shiftCodes={SHIFT_CODES} workHours={workHours} readOnly={readOnly} />}
      <ScheduleGrid title="Manajemen" subtitle="Kantor (K) / Libur (O)." workers={manajemenList} dates={dates} schedule={schedule} setSchedule={setSchedule} shiftCycle={OFFICE_SHIFT_CYCLE} shiftCodes={OFFICE_SHIFT_CODES} workHours={workHours} isOffice readOnly={readOnly} />
      </>}

      <div style={{
      display: "flex",
      gap: 14,
      marginTop: 4,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        {[...SHIFT_CYCLE.filter(c => c !== "-"), ...OFFICE_SHIFT_CYCLE.filter(c => c !== "-" && c !== "O")].map(c => <div key={c} style={{
        display: "flex",
        alignItems: "center",
        gap: 6
      }} className="ais-flex-layout">
            <span style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          background: {
            good: T.good,
            manajemen: T.manajemen,
            accent: T.accent,
            warn: T.warn,
            bad: T.bad,
            inkMuted: T.inkMuted
          }[SCHEDULE_TONE[c]] || T.line,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...FM,
          fontSize: 9.5,
          fontWeight: 700
        }}>{c}</span>
            <span style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted
        }}>{SHIFT_CODES[c] || OFFICE_SHIFT_CODES[c]}</span>
          </div>)}
      </div>
    </div>;
}
function MasterJadwalPage({
  employees,
  stores,
  schedule,
  setSchedule,
  workHours,
  setWorkHours,
  jadwalStatus,
  setJadwalStatus,
  currentUser,
  mode = "approver"
}) {
  const [tab, setTab] = useState("input");
  return <div>
      <SectionTitle icon={CalendarDays}>Master Jadwal</SectionTitle>

      {mode === "approver" && <MasterJamKerjaPanel workHours={workHours} setWorkHours={setWorkHours} />}

      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 280
    }} className="ais-flex-layout ais-content-panel">
        {[{
        key: "input",
        label: "Input Jadwal"
      }, {
        key: "rekap",
        label: "Rekap Jadwal"
      }].map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>

      {tab === "input" && <InputJadwalTab employees={employees} stores={stores} schedule={schedule} setSchedule={setSchedule} workHours={workHours} jadwalStatus={jadwalStatus} setJadwalStatus={setJadwalStatus} currentUser={currentUser} mode={mode} />}
      {tab === "rekap" && <RekapJadwalTab employees={employees} stores={stores} schedule={schedule} workHours={workHours} jadwalStatus={jadwalStatus} mode={mode} />}
    </div>;
}

/* ---------------------------------------------------------
   PAGE: REKAP JADWAL (browse periode sebelumnya, read-only)
--------------------------------------------------------- */
function RekapJadwalTab({
  employees,
  stores,
  schedule,
  workHours,
  jadwalStatus,
  mode
}) {
  const lastPeriodMonth = monthStr(new Date());
  const [periodMonth, setPeriodMonth] = useState(addMonthsStr(lastPeriodMonth, -1));
  const period = payrollPeriodForMonth(periodMonth);
  const dates = dateRangeList(period.start, period.end);
  const activeEmp = employees.filter(e => e.status === "aktif");
  const crewByStore = storeId => activeEmp.filter(e => (e.group === "crew" || e.group === "parttime") && e.store === storeId);
  const spvList = activeEmp.filter(e => e.group === "spv" || e.group === "tl");
  const manajemenList = activeEmp.filter(e => e.group === "manajemen");
  const lock = getJadwalLock(jadwalStatus, periodMonth);
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 14
    }}>
        <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
      </div>

      <div style={{
      ...FI,
      fontSize: 12,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Menelusuri Master Jadwal periode-periode sebelumnya. Periode: <b>{period.label}</b>. Tab ini khusus tampilan (lihat saja) — perubahan jadwal hanya lewat tab Input Jadwal.
      </div>

      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
      background: lock.status === "locked" ? T.goodSoft : T.warnSoft,
      color: lock.status === "locked" ? T.good : T.warn,
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 20,
      fontFamily: "DM Sans"
    }} className="ais-flex-layout">
        <div style={{
        fontWeight: 700,
        fontSize: 13.5,
        display: "flex",
        alignItems: "center",
        gap: 6
      }} className="ais-flex-layout">
          {lock.status === "locked" ? <><Lock size={14} /> Sudah Dikunci</> : <>Belum Disubmit</>}
        </div>
        {lock.status === "locked" && <div style={{
        fontSize: 11.5
      }}>Disubmit oleh {lock.submittedBy} pada {new Date(lock.submittedAt).toLocaleString("id-ID")}{lock.editCount > 0 ? ` · sudah diedit ${lock.editCount}x` : ""}</div>}
      </div>

      {(lock.editLog || []).length > 0 && <div style={{
      marginBottom: 20
    }}>
          <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 11,
        color: T.inkMuted,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Log Edit</div>
          {lock.editLog.map((l, i) => <div key={i} style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        padding: "5px 0",
        borderTop: `1px solid ${T.line}`
      }}>
              Diedit oleh <b style={{
          color: T.ink
        }}>{l.editedBy}</b> pada {new Date(l.editedAt).toLocaleString("id-ID")}{l.catatan ? ` — "${l.catatan}"` : ""}
            </div>)}
        </div>}

      {stores.map(s => <ScheduleGrid key={s.id} title={`Toko: ${s.name}`} subtitle={`Status: ${(JADWAL_TOKO_STATUS[lock.toko?.[s.id]?.status || "draft"] || JADWAL_TOKO_STATUS.draft).label}`} workers={crewByStore(s.id)} dates={dates} schedule={schedule} setSchedule={() => {}} shiftCycle={SHIFT_CYCLE} shiftCodes={SHIFT_CODES} workHours={workHours} readOnly />)}
      {mode !== "spv" && <>
      <ScheduleGrid title="SPV" subtitle="SPV Jr dedicated ke 2 toko." workers={spvList} dates={dates} schedule={schedule} setSchedule={() => {}} shiftCycle={SHIFT_CYCLE} shiftCodes={SHIFT_CODES} workHours={workHours} readOnly />
      <ScheduleGrid title="Manajemen" subtitle="Kantor (K) / Libur (O)." workers={manajemenList} dates={dates} schedule={schedule} setSchedule={() => {}} shiftCycle={OFFICE_SHIFT_CYCLE} shiftCodes={OFFICE_SHIFT_CODES} workHours={workHours} isOffice readOnly />
      </>}
    </div>;
}

/* ---------------------------------------------------------
   PAGE: REKAP BULANAN
--------------------------------------------------------- */
function RekapBulananPage({
  employees,
  stores,
  attendance,
  currentUser
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const [filterStore, setFilterStore] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const isSpvUser = currentUser?.access === "spv";
  const spvSelf = isSpvUser ? employees.find(e => e.id === currentUser.id) : null;
  const spvStores = spvSelf ? (spvSelf.stores || [spvSelf.store]).filter(Boolean) : [];
  const visibleStores = isSpvUser ? stores.filter(s => spvStores.includes(s.id)) : stores;
  const workers = employees.filter(e => e.group !== "direksi" && e.group !== "toko_device" && e.status === "aktif" && (!isSpvUser || e.group !== "manajemen" && (e.stores || [e.store]).some(s => spvStores.includes(s))) && (filterStore === "all" || e.store === filterStore || (e.stores || []).includes(filterStore)) && (filterGroup === "all" || e.group === filterGroup));
  const [openId, setOpenId] = useState(null);

  // Rekap mengikuti periode gajian (21 s.d. 20), sama dengan Master Jadwal —
  // bukan bulan kalender, supaya angka absensi dan jadwal selalu sebanding.
  const period = payrollPeriodForMonth(month);
  const rows = useMemo(() => workers.map(w => {
    const recs = attendance.filter(a => a.empId === w.id && a.date >= period.start && a.date <= period.end);
    const terjadwal = recs.length;
    const hadir = recs.length;
    const telat = recs.filter(r => r.telat).length;
    const totalTelatMenit = recs.reduce((s, r) => s + (r.telatMenit || 0), 0);
    const totalTelatJam = (totalTelatMenit / 60).toFixed(1);
    const cepat = recs.filter(r => r.pulangCepat).length;
    const avgJam = hadir ? (recs.reduce((s, r) => s + r.jamKerja, 0) / hadir).toFixed(1) : "0.0";
    const pct = terjadwal ? Math.round(hadir / terjadwal * 100) : 0;
    const toko = w.group === "manajemen" ? "Kantor" : w.group === "parttime" ? `Fleksibel (${stores.find(s => s.id === w.store)?.name || "-"})` : w.stores ? w.stores.map(id => stores.find(s => s.id === id)?.name).filter(Boolean).join(" & ") : stores.find(s => s.id === w.store)?.name;
    const harian = [...recs].sort((a, b) => a.date.localeCompare(b.date));
    return {
      id: w.id,
      name: w.name,
      jabatan: w.jabatan,
      group: w.group,
      toko,
      terjadwal,
      hadir,
      pct,
      avgJam,
      telat,
      totalTelatJam,
      cepat,
      harian
    };
  }), [workers, attendance, month, period.start, period.end]);
  return <div>
      <SectionTitle icon={BarChart3} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Absensi — Periode ${period.label}`} meta={[`Grup: ${filterGroup === "all" ? "Semua Grup" : GROUP_LABEL[filterGroup]}`, `Toko: ${filterStore === "all" ? "Semua Toko" : stores.find(s => s.id === filterStore)?.name}`, `Periode gajian: ${period.label}`]} filename={`rekap-absensi_${filterStore}_${period.start}_sd_${period.end}`} columns={[{
        key: "name",
        label: "Nama"
      }, {
        key: "jabatan",
        label: "Jabatan"
      }, {
        key: "toko",
        label: "Toko"
      }, {
        key: "terjadwal",
        label: "Terjadwal"
      }, {
        key: "hadir",
        label: "Hadir"
      }, {
        key: "pct",
        label: "% Kehadiran"
      }, {
        key: "avgJam",
        label: "Rata2 Jam Kerja"
      }, {
        key: "telat",
        label: "Terlambat (kali)"
      }, {
        key: "totalTelatJam",
        label: "Jam Terlambat"
      }, {
        key: "cepat",
        label: "Pulang Cepat"
      }]} rows={rows.map(({
        harian,
        id,
        ...sisa
      }) => sisa)} />
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Grup</option>
            {Object.entries(GROUP_LABEL).filter(([k]) => k !== "direksi" && k !== "toko_device" && (!isSpvUser || k !== "manajemen")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">{isSpvUser ? "Toko Saya" : "Semua Toko"}</option>
            {visibleStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap Absensi</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Periode gajian: <b>{period.label}</b> (tanggal 21 s.d. 20, sama dengan Master Jadwal). Klik baris nama untuk melihat riwayat absen hariannya.
      </div>
      {isSpvUser && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "9px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
          Sebagai SPV, Anda hanya bisa melihat rekap Crew/Part Time/SPV di toko yang Anda naungi ({spvStores.map(id => stores.find(s => s.id === id)?.name).filter(Boolean).join(" & ") || "-"}).
        </div>}
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Mencakup seluruh karyawan (Manajemen, Crew, Part Time, SPV) selain Direksi & Akun Toko. Untuk Manajemen, jam kerja dihitung dari jam kantor {OFFICE_HOURS.start}–{OFFICE_HOURS.end}.
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13,
        minWidth: 760
      }}>
          <thead>
            <tr style={THBG}>
              {["Nama", "Posisi", "Grup", "Toko", "Hari Kerja", "% Absensi", "Rata² Jam/Hari", "Terlambat", "Jam Terlambat", "Pulang Cepat"].map(h => <th key={h} style={{
              ...TDW,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
            const buka = openId === r.id;
            return <Fragment key={r.id}>
              <tr onClick={() => setOpenId(buka ? null : r.id)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: buka ? T.surfaceSunk : "transparent"
              }}>
                <td style={{
                  ...TDW,
                  fontWeight: 600
                }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <ChevronDown size={13} color={T.inkMuted} style={{
                      transform: buka ? "rotate(180deg)" : "none",
                      flexShrink: 0
                    }} />
                    {r.name}
                  </span>
                </td>
                <td style={{
                  ...TDW,
                  color: T.inkMuted
                }}>{r.jabatan}</td>
                <td style={TDW}><Badge tone="manajemen">{GROUP_LABEL[r.group]}</Badge></td>
                <td style={{
                  ...TDW,
                  color: T.inkMuted
                }}>{r.toko}</td>
                <td style={TDW}>{r.hadir} / {r.terjadwal}</td>
                <td style={TDW}><span style={{
                    fontWeight: 700,
                    color: r.pct >= 90 ? T.good : r.pct >= 75 ? T.warn : T.bad
                  }}>{r.pct}%</span></td>
                <td style={{
                  ...TDW,
                  ...FM
                }}>{r.avgJam} jam</td>
                <td style={{
                  ...TDW,
                  color: r.telat ? T.warn : T.inkMuted
                }}>{r.telat}</td>
                <td style={{
                  ...TDW,
                  ...FM,
                  color: r.telat ? T.warn : T.inkMuted
                }}>{r.totalTelatJam} jam</td>
                <td style={{
                  ...TDW,
                  color: r.cepat ? T.warn : T.inkMuted
                }}>{r.cepat}</td>
              </tr>
              {buka && <tr style={{
                background: T.surfaceSunk
              }}>
                  <td colSpan={10} style={{
                  padding: "14px 18px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                    <div style={{
                    ...FI,
                    fontSize: 10.5,
                    color: T.inkMuted,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6
                  }}>
                      Riwayat Absen Harian — {r.name} · {r.harian.length} hari dalam periode {period.label}
                    </div>
                    {r.harian.length === 0 ? <div style={{
                    ...FI,
                    fontSize: 12.5,
                    color: T.inkMuted
                  }}>Belum ada absensi tercatat pada periode ini.</div> : <div style={{
                    overflowX: "auto",
                    maxHeight: 320
                  }}>
                        <table style={{
                      borderCollapse: "collapse",
                      ...FI,
                      fontSize: 12,
                      minWidth: 560
                    }}>
                          <thead>
                            <tr style={{
                          textAlign: "left",
                          color: T.inkMuted
                        }}>
                              {["Tanggal", "Hari", "Shift", "Jam Kerja", "Keterlambatan", "Pulang Cepat", "Sumber"].map(h => <th key={h} style={{
                            padding: "3px 12px 6px 0",
                            fontSize: 10.5,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            top: 0,
                            background: T.surfaceSunk
                          }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {r.harian.map((d, i) => {
                          const hariNama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][new Date(d.date + "T00:00:00").getDay()];
                          return <tr key={i} style={{
                            borderTop: `1px solid ${T.line}`
                          }}>
                                  <td style={{
                              padding: "4px 12px 4px 0",
                              ...FM,
                              fontWeight: 600
                            }}>{d.date}</td>
                                  <td style={{
                              padding: "4px 12px",
                              color: hariNama === "Minggu" ? T.bad : T.inkMuted
                            }}>{hariNama}</td>
                                  <td style={{
                              padding: "4px 12px"
                            }}>{labelShiftAbsen(d.shift, d.empId || r.id || r.empId)}</td>
                                  <td style={{
                              padding: "4px 12px",
                              ...FM
                            }}>{d.jamKerja} jam</td>
                                  <td style={{
                              padding: "4px 12px",
                              color: d.telat ? T.warn : T.good,
                              fontWeight: d.telat ? 700 : 400
                            }}>
                                    {d.telat ? `${d.telatMenit} menit` : "Ontime"}
                                  </td>
                                  <td style={{
                              padding: "4px 12px",
                              color: d.pulangCepat ? T.bad : T.inkMuted
                            }}>{d.pulangCepat ? "Ya" : "-"}</td>
                                  <td style={{
                              padding: "4px 12px",
                              color: T.inkMuted,
                              fontSize: 11
                            }}>{d.sumber === "app" ? "Mobile App" : "Dashboard"}</td>
                                </tr>;
                        })}
                          </tbody>
                        </table>
                      </div>}
                  </td>
                </tr>}
              </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: APPROVAL DASHBOARD
--------------------------------------------------------- */
/* ---------------------------------------------------------
   PAGE: REKAP LAPORAN TOKO
--------------------------------------------------------- */
const REPORT_STAGES = ["opening", "etalase_0700", "etalase_1100", "sales_shift1", "produksi_shift1", "etalase_1700", "etalase_2000", "sales_shift2", "produksi_shift2", "stok", "closing"];
function dayEntries(reportLog, store, month) {
  return Object.keys(reportLog).filter(k => k.startsWith(store + "_") && k.slice(store.length + 1).startsWith(month)).map(k => ({
    date: k.slice(store.length + 1),
    data: reportLog[k]
  })).sort((a, b) => b.date.localeCompare(a.date));
}
function RekapFilterBar({
  store,
  setStore,
  stores,
  month,
  setMonth
}) {
  return <div style={{
    display: "flex",
    gap: 8
  }} className="ais-flex-layout">
      <select value={store} onChange={e => setStore(e.target.value)} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      padding: "8px 12px",
      ...FI,
      fontSize: 13,
      background: T.surface
    }} className="ais-control">
        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      padding: "8px 12px",
      ...FI,
      fontSize: 13,
      background: T.surface
    }} className="ais-control" />
    </div>;
}

/* ---- Rekap Sales (drill-down qty produk, payment, dll) ---- */
const PENGELUARAN_ITEMS_DASH = ["Gas 3 Kg", "Gas 12 Kg", "Air Galon", "Es Batu", "Alat Dapur", "Chemical", "Sayur", "Bumbu Dapur", "Sampah", "Amal", "Parkir", "Bensin", "ATK", "Foto Copy", "Ops. Karyawan"];
const PAYMENT_FEE_RATE = 0.007; // 0,7% untuk pembayaran non-tunai
const ONLINE_FEE_RATE = 0.20; // GrabFood: 20% dari gross
const SHOPEE_FEE_RATE = 0.02; // ShopeeFood: 2% dari (gross - diskon)
const ONLINE_PLATFORMS = [{
  key: "gofood",
  label: "GoFood",
  feeMode: "manual"
}, {
  key: "grabfood",
  label: "GrabFood",
  feeMode: "gross20"
}, {
  key: "shopeefood",
  label: "ShopeeFood",
  feeMode: "nett2"
}];

// Fee tiap platform dihitung berbeda sesuai skema masing-masing.
function feePlatform(platKey, gross, diskon, feeManual) {
  if (platKey === "gofood") return Number(feeManual) || 0;
  if (platKey === "shopeefood") return Math.round(Math.max(gross - diskon, 0) * SHOPEE_FEE_RATE);
  return Math.round(gross * ONLINE_FEE_RATE); // grabfood
}

// Kalkulasi fee & nett dari satu laporan sales harian.
function salesFeeBreakdown(s) {
  const p = s?.payment || {};
  const rows = [{
    key: "cash",
    label: "Cash",
    gross: Number(p.cash) || 0,
    kenaFee: false
  }, {
    key: "qris",
    label: "QRIS",
    gross: Number(p.qris) || 0,
    kenaFee: true
  }, {
    key: "debit",
    label: "Debit",
    gross: Number(p.debit) || 0,
    kenaFee: true
  }, {
    key: "gopay",
    label: "Gopay",
    gross: Number(p.gopay) || 0,
    kenaFee: true
  }].map(r => {
    const fee = r.kenaFee ? Math.round(r.gross * PAYMENT_FEE_RATE) : 0;
    return {
      ...r,
      fee,
      nett: r.gross - fee
    };
  });
  return {
    rows,
    totalFee: rows.reduce((a, r) => a + r.fee, 0)
  };
}

// Kalkulasi penjualan online (per platform) + offline dari data salesOnline yang diinput Eri.
function onlineSalesBreakdown(salesOnline, omsetKotorHarian) {
  const platforms = ONLINE_PLATFORMS.map(pl => {
    const d = salesOnline?.[pl.key] || {};
    const gross = Number(d.gross) || 0;
    const diskon = Number(d.diskon) || 0;
    const fee = feePlatform(pl.key, gross, diskon, d.fee);
    return {
      ...pl,
      gross,
      diskon,
      fee,
      nett: gross - diskon - fee
    };
  });
  const grossOnline = platforms.reduce((a, p) => a + p.gross, 0);
  const offlineGross = Math.max(omsetKotorHarian - grossOnline, 0);
  const offlineDiskon = Number(salesOnline?.offlineDiskon) || 0;
  return {
    platforms,
    totalFeeOnline: platforms.reduce((a, p) => a + p.fee, 0),
    totalDiskonOnline: platforms.reduce((a, p) => a + p.diskon, 0),
    offline: {
      gross: offlineGross,
      diskon: offlineDiskon,
      nett: offlineGross - offlineDiskon
    }
  };
}
function SalesOnlineForm({
  initial,
  omsetKotorHarian,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(initial || {
    gofood: {},
    grabfood: {},
    shopeefood: {},
    offlineDiskon: ""
  });
  const upd = (plat, field, v) => setF({
    ...f,
    [plat]: {
      ...(f[plat] || {}),
      [field]: v
    }
  });
  const bd = onlineSalesBreakdown(f, omsetKotorHarian);
  return <FormSurface title="Penjualan online." subtitle="Lengkapi nominal dan komponen transaksi sesuai laporan." code="ONLINE"><div>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 4
      }}>Laporan Sales Penjualan Online</div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 12
      }}>Diinput oleh Eri. GoFood: fee diinput manual · GrabFood: 20% dari gross · ShopeeFood: 2% dari (gross − diskon).</div>

      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Penjualan Offline</div>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12,
        marginBottom: 14
      }}>
        <tbody>
          <tr><td style={{
              padding: "3px 0",
              color: T.inkMuted
            }}>Gross (auto: omset kotor − gross online)</td><td style={{
              textAlign: "right",
              ...FM,
              fontWeight: 600
            }}>{rupiah(bd.offline.gross)}</td></tr>
          <tr>
            <td style={{
              padding: "3px 0",
              color: T.inkMuted
            }}>Diskon Offline</td>
            <td style={{
              textAlign: "right"
            }}>
              <input type="number" value={f.offlineDiskon} onChange={e => setF({
                ...f,
                offlineDiskon: e.target.value
              })} placeholder="0" style={{
                width: 110,
                border: `1px solid ${T.line}`,
                borderRadius: 7,
                padding: "5px 8px",
                ...FM,
                fontSize: 12,
                textAlign: "right"
              }} className="ais-control" />
            </td>
          </tr>
          <tr><td style={{
              padding: "3px 0",
              fontWeight: 700
            }}>Nett Offline</td><td style={{
              textAlign: "right",
              ...FM,
              fontWeight: 700
            }}>{rupiah(bd.offline.nett)}</td></tr>
        </tbody>
      </table>

      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Penjualan Online</div>
      <div style={{
        overflowX: "auto"
      }}>
        <table style={{
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12,
          minWidth: 480
        }}>
          <thead>
            <tr style={THBG}>
              {["Platform", "Gross", "Diskon", "Fee", "Nett"].map(h => <th key={h} style={{
                padding: "6px 8px",
                fontSize: 10.5,
                color: T.inkMuted,
                whiteSpace: "nowrap"
              }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {bd.platforms.map(p => <tr key={p.key} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                <td style={{
                padding: "5px 8px",
                fontWeight: 600
              }}>
                  {p.label}
                  <div style={{
                  ...FI,
                  fontWeight: 400,
                  fontSize: 9.5,
                  color: T.inkMuted
                }}>
                    {p.feeMode === "manual" ? "fee manual" : p.feeMode === "nett2" ? "fee 2% × (gross−diskon)" : "fee 20% × gross"}
                  </div>
                </td>
                <td style={{
                padding: "4px 8px"
              }}>
                  <input type="number" value={f[p.key]?.gross ?? ""} onChange={e => upd(p.key, "gross", e.target.value)} placeholder="0" style={{
                  width: 95,
                  border: `1px solid ${T.line}`,
                  borderRadius: 7,
                  padding: "5px 8px",
                  ...FM,
                  fontSize: 12,
                  textAlign: "right"
                }} className="ais-control" />
                </td>
                <td style={{
                padding: "4px 8px"
              }}>
                  <input type="number" value={f[p.key]?.diskon ?? ""} onChange={e => upd(p.key, "diskon", e.target.value)} placeholder="0" style={{
                  width: 95,
                  border: `1px solid ${T.line}`,
                  borderRadius: 7,
                  padding: "5px 8px",
                  ...FM,
                  fontSize: 12,
                  textAlign: "right"
                }} className="ais-control" />
                </td>
                <td style={{
                padding: "4px 8px"
              }}>
                  {p.feeMode === "manual" ? <input type="number" value={f[p.key]?.fee ?? ""} onChange={e => upd(p.key, "fee", e.target.value)} placeholder="0" style={{
                  width: 95,
                  border: `1px solid ${T.line}`,
                  borderRadius: 7,
                  padding: "5px 8px",
                  ...FM,
                  fontSize: 12,
                  textAlign: "right"
                }} className="ais-control" /> : <span style={{
                  ...FM,
                  color: T.warn
                }}>{rupiah(p.fee)}</span>}
                </td>
                <td style={{
                padding: "5px 8px",
                ...FM,
                fontWeight: 700
              }}>{rupiah(p.nett)}</td>
              </tr>)}
          </tbody>
        </table>
      </div>

      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 12
      }} className="ais-flex-layout">
        <button onClick={() => onSave(f)} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: T.manajemen,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Simpan Laporan Online</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function SalesFullEditForm({
  data,
  shiftIndex,
  onSave,
  onCancel
}) {
  const [qty, setQty] = useState({
    ...(data.qty || {})
  });
  const [payment, setPayment] = useState({
    cash: "",
    qris: "",
    debit: "",
    gopay: "",
    ...(data.payment || {})
  });
  const [omsetOnline, setOmsetOnline] = useState(data.omsetOnline ?? "");
  const [pengeluaranItems, setPengeluaranItems] = useState({
    ...(data.pengeluaranItems || {})
  });
  const [alasan, setAlasan] = useState("");
  const isShift2 = shiftIndex === 1;
  const omsetKotor = SEED_PRODUCTS.reduce((s, p) => s + (Number(qty[p.id]) || 0) * p.price, 0);
  const pengeluaran = isShift2 ? PENGELUARAN_ITEMS_DASH.reduce((s, it) => s + (Number(pengeluaranItems[it]) || 0), 0) : 0;
  const omsetBersih = Math.max(0, omsetKotor - (Number(omsetOnline) || 0) - pengeluaran);
  const numInput = (value, onChange, w = 100) => <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0" style={{
    width: w,
    border: `1px solid ${T.line}`,
    borderRadius: 7,
    padding: "5px 8px",
    ...FM,
    fontSize: 12,
    textAlign: "right"
  }} className="ais-control" />;
  return <FormSurface title="Tinjau angka penjualan." subtitle="Perbarui detail transaksi sebelum menyimpan revisi." code="SALES"><div>
      <div style={{
        ...FI,
        fontSize: 12.5,
        fontWeight: 700,
        marginBottom: 10
      }}>Edit Laporan Sales — Shift {shiftIndex + 1}</div>

      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 5
      }}>Produk Terjual</div>
      {SEED_PRODUCTS.map(p => <div key={p.id} style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0"
      }}>
          <span style={{
          ...FI,
          fontSize: 12
        }}>{p.name} <span style={{
            color: T.inkMuted,
            fontSize: 11
          }}>({rupiah(p.price)})</span></span>
          {numInput(qty[p.id] ?? "", v => setQty({
          ...qty,
          [p.id]: v
        }), 70)}
        </div>)}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        ...FI,
        fontWeight: 700,
        fontSize: 12.5,
        borderTop: `1px solid ${T.line}`,
        marginTop: 5,
        marginBottom: 12
      }}>
        <span>Omset Kotor (auto)</span><span style={{
          fontFamily: "JetBrains Mono"
        }}>{rupiah(omsetKotor)}</span>
      </div>

      {isShift2 && <>
          <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 5
        }}>Pengeluaran Harian</div>
          {PENGELUARAN_ITEMS_DASH.map(it => <div key={it} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "3px 0"
        }}>
              <span style={{
            ...FI,
            fontSize: 12
          }}>{it}</span>
              {numInput(pengeluaranItems[it] ?? "", v => setPengeluaranItems({
            ...pengeluaranItems,
            [it]: v
          }))}
            </div>)}
          <div style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "7px 0",
          ...FI,
          fontWeight: 700,
          fontSize: 12.5,
          borderTop: `1px solid ${T.line}`,
          marginTop: 5,
          marginBottom: 12
        }}>
            <span>Total Pengeluaran (auto)</span><span style={{
            fontFamily: "JetBrains Mono"
          }}>{rupiah(pengeluaran)}</span>
          </div>
        </>}

      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 5
      }}>Pembayaran</div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0"
      }}>
        <span style={{
          ...FI,
          fontSize: 12
        }}>Omset Penjualan Online</span>
        {numInput(omsetOnline, setOmsetOnline)}
      </div>
      {["cash", "qris", "debit", "gopay"].map(k => <div key={k} style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0"
      }}>
          <span style={{
          ...FI,
          fontSize: 12,
          textTransform: "capitalize"
        }}>{k}</span>
          {numInput(payment[k] ?? "", v => setPayment({
          ...payment,
          [k]: v
        }))}
        </div>)}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        ...FI,
        fontWeight: 700,
        fontSize: 12.5,
        color: T.good,
        borderTop: `1px solid ${T.line}`,
        marginTop: 5,
        marginBottom: 12
      }}>
        <span>Omset Bersih (auto)</span><span style={{
          fontFamily: "JetBrains Mono"
        }}>{rupiah(omsetBersih)}</span>
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 4
      }}>Alasan Edit (tercatat di log)</div>
      <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Contoh: salah input qty & nominal QRIS" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "7px 10px",
        ...FI,
        fontSize: 12.5,
        marginBottom: 10
      }} className="ais-control" />
      <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
        <button onClick={() => onSave({
          qty,
          payment,
          pengeluaranItems,
          pengeluaran,
          omsetOnline: Number(omsetOnline) || 0,
          omsetKotor,
          omsetBersih,
          alasan
        })} style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          background: T.manajemen,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Simpan Penyesuaian</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 14px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function SalesDetailPanel({
  data,
  dateKey,
  reportLog,
  setReportLog,
  salesEditLock,
  setSalesEditLock,
  currentUser
}) {
  const [editingShift, setEditingShift] = useState(null);
  const [showOnlineForm, setShowOnlineForm] = useState(false);
  const canEditSales = currentUser?.access === "admin_utama" || currentUser?.access === "all";
  const omsetKotorHarian = (data.sales_shift1?.omsetKotor || 0) + (data.sales_shift2?.omsetKotor || 0);
  const lockFor = shiftKey => salesEditLock?.[`${dateKey}_${shiftKey}`] || {
    editCount: 0,
    direksiStatus: "none",
    direksiApprovals: {},
    log: []
  };
  const saveQtyEdit = (shiftKey, payload) => {
    const {
      qty,
      payment,
      pengeluaranItems,
      pengeluaran,
      omsetOnline,
      omsetKotor,
      omsetBersih,
      alasan
    } = payload;
    const lock = lockFor(shiftKey);
    const prev = data[shiftKey];
    const cleanQty = {};
    Object.entries(qty).forEach(([k, v]) => {
      if (Number(v) > 0) cleanQty[k] = Number(v);
    });
    const cleanPengeluaran = {};
    Object.entries(pengeluaranItems || {}).forEach(([k, v]) => {
      if (Number(v) > 0) cleanPengeluaran[k] = Number(v);
    });
    const cleanPayment = {};
    Object.entries(payment || {}).forEach(([k, v]) => {
      cleanPayment[k] = Number(v) || 0;
    });
    setReportLog({
      ...reportLog,
      [dateKey]: {
        ...reportLog[dateKey],
        [shiftKey]: {
          ...prev,
          qty: cleanQty,
          payment: cleanPayment,
          omsetOnline,
          ...(shiftKey === "sales_shift2" ? {
            pengeluaranItems: cleanPengeluaran,
            pengeluaran
          } : {}),
          omsetKotor,
          omsetBersih,
          editedBy: currentUser.name,
          editedAt: new Date().toISOString(),
          editReason: alasan
        }
      }
    });
    setSalesEditLock({
      ...salesEditLock,
      [`${dateKey}_${shiftKey}`]: {
        editCount: lock.editCount + 1,
        direksiStatus: "none",
        direksiApprovals: {},
        log: [...(lock.log || []), {
          by: currentUser.name,
          at: new Date().toISOString(),
          alasan
        }]
      }
    });
    setEditingShift(null);
  };
  const requestDireksi = shiftKey => {
    const lock = lockFor(shiftKey);
    setSalesEditLock({
      ...salesEditLock,
      [`${dateKey}_${shiftKey}`]: {
        ...lock,
        direksiStatus: "pending",
        direksiApprovals: {}
      }
    });
  };
  const approveDireksi = shiftKey => {
    const lock = lockFor(shiftKey);
    const next = {
      ...lock.direksiApprovals,
      [currentUser.id]: true
    };
    setSalesEditLock({
      ...salesEditLock,
      [`${dateKey}_${shiftKey}`]: {
        ...lock,
        direksiApprovals: next,
        direksiStatus: next.kurnia && next.juhaeri ? "approved" : "pending"
      }
    });
  };
  const saveOnline = payload => {
    setReportLog({
      ...reportLog,
      [dateKey]: {
        ...reportLog[dateKey],
        salesOnline: {
          ...payload,
          inputBy: currentUser.name,
          inputAt: new Date().toISOString()
        }
      }
    });
    setShowOnlineForm(false);
  };
  const onlineBd = onlineSalesBreakdown(data.salesOnline, omsetKotorHarian);
  return <div>
      <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }} className="ais-responsive-grid">
        {["sales_shift1", "sales_shift2"].map((key, i) => {
        const s = data[key];
        if (!s) return <div key={key} style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted
        }}>Shift {i + 1}: belum ada laporan.</div>;
        const fb = salesFeeBreakdown(s);
        const lock = lockFor(key);
        const canEditFreely = lock.editCount === 0 || lock.direksiStatus === "approved";
        return <div key={key}>
              <div style={{
            ...FB,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8
          }}>Shift {i + 1} · {s.inputOleh}</div>

              <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 3
          }}>Produk Terjual</div>
              <table style={{
            width: "100%",
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12,
            marginBottom: 8
          }}>
                <thead><tr style={{
                textAlign: "left",
                color: T.inkMuted
              }}><th style={{
                  padding: "2px 6px 6px 0"
                }}>Produk</th><th style={{
                  padding: "2px 6px"
                }}>Qty</th><th style={{
                  padding: "2px 0 6px"
                }}>Subtotal</th></tr></thead>
                <tbody>
                  {SEED_PRODUCTS.map(p => s.qty?.[p.id] ? <tr key={p.id}><td style={{
                  padding: "2px 6px 2px 0"
                }}>{p.name}</td><td style={{
                  padding: "2px 6px"
                }}>{s.qty[p.id]}</td><td style={{
                  padding: "2px 0"
                }}>{rupiah(s.qty[p.id] * p.price)}</td></tr> : null)}
                </tbody>
              </table>
              <div style={{
            ...FI,
            fontSize: 12,
            color: T.ink,
            fontWeight: 700,
            marginBottom: 10
          }}>Omset Kotor: {rupiah(s.omsetKotor)}</div>

              <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 3
          }}>Pembayaran</div>
              <div style={{
            overflowX: "auto",
            marginBottom: 6
          }}>
                <table style={{
              borderCollapse: "collapse",
              ...FI,
              fontSize: 11.5,
              minWidth: 300
            }}>
                  <thead><tr style={{
                  textAlign: "left",
                  color: T.inkMuted
                }}><th style={{
                    padding: "2px 8px 5px 0"
                  }}>Jenis</th><th style={{
                    padding: "2px 8px"
                  }}>Gross</th><th style={{
                    padding: "2px 8px"
                  }}>Fee 0,7%</th><th style={{
                    padding: "2px 0"
                  }}>Nett</th></tr></thead>
                  <tbody>
                    {fb.rows.map(r => <tr key={r.key}>
                        <td style={{
                    padding: "2px 8px 2px 0"
                  }}>{r.label}</td>
                        <td style={{
                    padding: "2px 8px",
                    ...FM
                  }}>{rupiah(r.gross)}</td>
                        <td style={{
                    padding: "2px 8px",
                    ...FM,
                    color: r.fee ? T.warn : T.inkMuted
                  }}>{r.kenaFee ? rupiah(r.fee) : "-"}</td>
                        <td style={{
                    padding: "2px 0",
                    ...FM,
                    fontWeight: 600
                  }}>{rupiah(r.nett)}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
              <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            lineHeight: 1.7
          }}>
                Total Fee Pembayaran: <b style={{
              color: T.warn
            }}>{rupiah(fb.totalFee)}</b><br />
                <span style={{
              color: T.good,
              fontWeight: 700
            }}>Omset Bersih: {rupiah(s.omsetBersih)}</span>
              </div>

              {s.editedBy && <div style={{
            marginTop: 8,
            ...FI,
            fontSize: 11,
            color: T.accentDeep
          }}>
                  Diedit oleh {s.editedBy}{s.editReason ? ` — "${s.editReason}"` : ""}
                </div>}
              {(lock.log || []).length > 0 && <div style={{
            marginTop: 6
          }}>
                  <div style={{
              ...FI,
              fontSize: 10,
              color: T.inkMuted,
              fontWeight: 700,
              textTransform: "uppercase"
            }}>Log Edit</div>
                  {lock.log.map((l, idx) => <div key={idx} style={{
              ...FI,
              fontSize: 10.5,
              color: T.inkMuted
            }}>{l.by} · {new Date(l.at).toLocaleString("id-ID")}{l.alasan ? ` — "${l.alasan}"` : ""}</div>)}
                </div>}

              {canEditSales && editingShift !== key && <div style={{
            marginTop: 10
          }}>
                  {canEditFreely ? <button onClick={() => setEditingShift(key)} style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "6px 12px",
              background: "transparent",
              color: T.accentDeep,
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--default ais-flex-layout"><PenLine size={12} /> Edit Laporan</button> : lock.direksiStatus === "pending" ? <div style={{
              background: T.warnSoft,
              borderRadius: 8,
              padding: "8px 10px",
              ...FI,
              fontSize: 11.5,
              color: T.warn
            }}>
                      Menunggu approval Direksi — Kurnia: <b>{lock.direksiApprovals?.kurnia ? "Setuju" : "Menunggu"}</b> · Juhaeri: <b>{lock.direksiApprovals?.juhaeri ? "Setuju" : "Menunggu"}</b>
                      {currentUser.access === "all" && !lock.direksiApprovals?.[currentUser.id] && <button onClick={() => approveDireksi(key)} style={{
                display: "block",
                marginTop: 6,
                border: "none",
                borderRadius: 7,
                padding: "5px 10px",
                background: T.warn,
                color: "#fff",
                ...FI,
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer"
              }} className="ais-button ais-button--primary">Setujui Edit</button>}
                    </div> : <button onClick={() => requestDireksi(key)} style={{
              border: `1px solid ${T.warn}`,
              borderRadius: 8,
              padding: "6px 12px",
              background: "transparent",
              color: T.warn,
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--primary">Ajukan Approval Direksi (sudah 1x edit)</button>}
                </div>}
              {editingShift === key && <SalesFullEditForm data={s} shiftIndex={i} onSave={p => saveQtyEdit(key, p)} onCancel={() => setEditingShift(null)} />}

              {/* Form penjualan online hanya di kolom Shift 2 */}
              {i === 1 && canEditSales && <div style={{
            marginTop: 12
          }}>
                  {!showOnlineForm ? <button onClick={() => setShowOnlineForm(true)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "6px 12px",
              background: "transparent",
              color: T.accentDeep,
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--default">
                      {data.salesOnline ? "Edit Laporan Sales Online" : "Input Laporan Sales Online"}
                    </button> : <SalesOnlineForm initial={data.salesOnline} omsetKotorHarian={omsetKotorHarian} onSave={saveOnline} onCancel={() => setShowOnlineForm(false)} />}
                </div>}
            </div>;
      })}
      </div>

      {data.salesOnline && !showOnlineForm && <div style={{
      marginTop: 16,
      paddingTop: 12,
      borderTop: `1px dashed ${T.line}`
    }}>
          <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Rekap Penjualan Offline & Online · diinput {data.salesOnline.inputBy}</div>
          <div style={{
        overflowX: "auto"
      }}>
            <table style={{
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12,
          minWidth: 520
        }}>
              <thead>
                <tr style={THBG}>
                  {["Kanal", "Gross", "Diskon", "Fee", "Nett"].map(h => <th key={h} style={{
                padding: "6px 10px",
                fontSize: 10.5,
                color: T.inkMuted
              }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                padding: "5px 10px",
                fontWeight: 600
              }}>Offline</td>
                  <td style={{
                padding: "5px 10px",
                ...FM
              }}>{rupiah(onlineBd.offline.gross)}</td>
                  <td style={{
                padding: "5px 10px",
                ...FM
              }}>{rupiah(onlineBd.offline.diskon)}</td>
                  <td style={{
                padding: "5px 10px",
                color: T.inkMuted
              }}>-</td>
                  <td style={{
                padding: "5px 10px",
                ...FM,
                fontWeight: 700
              }}>{rupiah(onlineBd.offline.nett)}</td>
                </tr>
                {onlineBd.platforms.map(p => <tr key={p.key} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                    <td style={{
                padding: "5px 10px",
                fontWeight: 600
              }}>{p.label}</td>
                    <td style={{
                padding: "5px 10px",
                ...FM
              }}>{rupiah(p.gross)}</td>
                    <td style={{
                padding: "5px 10px",
                ...FM
              }}>{rupiah(p.diskon)}</td>
                    <td style={{
                padding: "5px 10px",
                ...FM,
                color: T.warn
              }}>{rupiah(p.fee)}</td>
                    <td style={{
                padding: "5px 10px",
                ...FM,
                fontWeight: 700
              }}>{rupiah(p.nett)}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>}
    </div>;
}
const BEBAN_JENIS = [{
  key: "token_listrik",
  label: "Token Listrik"
}, {
  key: "pdam",
  label: "PDAM"
}, {
  key: "pulsa_internet",
  label: "Pulsa & Internet"
}];
function RekapBebanTokoPage({
  stores,
  bebanToko
}) {
  const [tab, setTab] = useState("token_listrik");
  const [storeFilter, setStoreFilter] = useState("all");
  const [month, setMonth] = useState(monthStr(new Date()));
  const rows = (bebanToko || []).filter(b => b.jenis === tab).filter(b => storeFilter === "all" || b.storeId === storeFilter).filter(b => (b.tanggal || "").startsWith(month)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const total = rows.reduce((s, r) => s + (r.jumlah || 0), 0);
  const isPulsa = tab === "pulsa_internet";
  const labelTanggal = tab === "pdam" ? "Tanggal Bayar" : "Tanggal Beli";
  const labelOleh = tab === "pdam" ? "Dibayar Oleh" : "Dibeli Oleh";
  const labelJumlah = tab === "pdam" ? "Jumlah Bayar" : "Jumlah Beli";
  return <div>
      <SectionTitle icon={Receipt} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Beban Toko (${BEBAN_JENIS.find(b => b.key === tab)?.label}) — ${month}`} meta={[`Jenis: ${BEBAN_JENIS.find(b => b.key === tab)?.label}`, `Toko: ${storeFilter === "all" ? "Semua Toko" : stores.find(s => s.id === storeFilter)?.name}`, `Periode: ${month}`, `Total: ${rupiah(total)}`]} filename={`rekap-beban_${tab}_${storeFilter}_${month}`} columns={[{
        key: "tanggal",
        label: labelTanggal
      }, {
        key: "toko",
        label: "Toko"
      }, ...(isPulsa ? [{
        key: "subJenis",
        label: "Jenis"
      }, {
        key: "nomorHp",
        label: "Nomor HP"
      }] : []), {
        key: "jumlah",
        label: labelJumlah
      }, {
        key: "oleh",
        label: labelOleh
      }]} rows={rows.map(r => ({
        tanggal: r.tanggal,
        toko: stores.find(s => s.id === r.storeId)?.name || r.storeId,
        subJenis: r.subJenis === "pulsa" ? "Pulsa" : r.subJenis === "internet" ? "Internet" : "",
        nomorHp: r.nomorHp || "",
        jumlah: r.jumlah,
        oleh: r.olehNama
      }))} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Toko</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap Beban Toko</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Bersumber dari fitur <b>Beban Toko</b> di Akun Toko (mobile app). Laporan ini bersifat insidental — bukan laporan wajib harian.
      </div>

      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 420
    }} className="ais-flex-layout ais-content-panel">
        {BEBAN_JENIS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label={`Total ${BEBAN_JENIS.find(b => b.key === tab)?.label} Bulan Ini`} value={rupiah(total)} tone="warn" />
        <StatCard label="Jumlah Transaksi" value={rows.length} />
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {[labelTanggal, "Toko", ...(isPulsa ? ["Jenis", "Nomor HP"] : []), labelJumlah, labelOleh].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={isPulsa ? 6 : 4} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada laporan untuk filter ini.</td></tr>}
            {rows.map(r => <tr key={r.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              ...FM,
              fontWeight: 600
            }}>{r.tanggal}</td>
                <td style={TD}>{stores.find(s => s.id === r.storeId)?.name || r.storeId}</td>
                {isPulsa && <td style={TD}><Badge tone={r.subJenis === "pulsa" ? "manajemen" : "good"}>{r.subJenis === "pulsa" ? "Pulsa" : "Internet"}</Badge></td>}
                {isPulsa && <td style={{
              ...TD,
              ...FM
            }}>{r.nomorHp || "-"}</td>}
                <td style={{
              ...TD,
              fontWeight: 700
            }}>{rupiah(r.jumlah)}</td>
                <td style={{
              ...TD,
              color: T.inkMuted
            }}>{r.olehNama}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}
const PENGAJUAN_KATEGORI = ["Peralatan & Perlengkapan", "Bangunan", "Fasilitas Pendukung"];
const PENGAJUAN_STATUS = {
  pending: {
    label: "Menunggu",
    tone: "warn"
  },
  ditolak: {
    label: "Ditolak",
    tone: "bad"
  },
  ditunda: {
    label: "Ditunda",
    tone: "manajemen"
  },
  progress: {
    label: "Progress",
    tone: "lapangan"
  },
  selesai: {
    label: "Selesai",
    tone: "good"
  }
};
function RekapPengajuanPage({
  stores,
  pengajuan,
  setPengajuan,
  currentUser
}) {
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [respStatus, setRespStatus] = useState("progress");
  const [catatan, setCatatan] = useState("");
  const canProcess = currentUser.id === "eri" || currentUser.id === "nana";
  const rows = (pengajuan || []).filter(p => storeFilter === "all" || p.storeId === storeFilter).filter(p => statusFilter === "all" || p.status === statusFilter).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const proses = item => {
    const entry = {
      status: respStatus,
      catatan: catatan.trim(),
      oleh: currentUser.name,
      at: new Date().toISOString()
    };
    setPengajuan((pengajuan || []).map(p => p.id === item.id ? {
      ...p,
      status: respStatus,
      riwayat: [...(p.riwayat || []), entry]
    } : p));
    setOpenId(null);
    setCatatan("");
    setRespStatus("progress");
  };
  const countBy = s => (pengajuan || []).filter(p => p.status === s).length;
  return <div>
      <SectionTitle icon={ClipboardCheck} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title="Rekap Pengajuan / Pengadaan" meta={[`Toko: ${storeFilter === "all" ? "Semua Toko" : stores.find(s => s.id === storeFilter)?.name}`, `Status: ${statusFilter === "all" ? "Semua" : PENGAJUAN_STATUS[statusFilter]?.label}`, `Jumlah: ${rows.length}`]} filename={`rekap-pengajuan_${storeFilter}_${statusFilter}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "toko",
        label: "Toko"
      }, {
        key: "kategori",
        label: "Kategori"
      }, {
        key: "keterangan",
        label: "Keterangan"
      }, {
        key: "diajukanOleh",
        label: "Diajukan Oleh"
      }, {
        key: "status",
        label: "Status"
      }, {
        key: "responTerakhir",
        label: "Respon Terakhir"
      }]} rows={rows.map(p => {
        const last = (p.riwayat || [])[p.riwayat.length - 1];
        return {
          tanggal: p.tanggal,
          toko: stores.find(s => s.id === p.storeId)?.name || p.storeId,
          kategori: p.kategori,
          keterangan: p.keterangan,
          diajukanOleh: p.diajukanOleh,
          status: PENGAJUAN_STATUS[p.status]?.label || p.status,
          responTerakhir: last ? `${PENGAJUAN_STATUS[last.status]?.label} — ${last.catatan || "-"} (${last.oleh})` : ""
        };
      })} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Toko</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Status</option>
            {Object.entries(PENGAJUAN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>}>Rekap Pengajuan / Pengadaan</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Aduan &amp; pengajuan dari SPV lewat mobile app. {canProcess ? "Anda dapat memproses dan mengubah status — hasilnya langsung terlihat oleh SPV pengaju." : "Direksi hanya melihat detail; pemrosesan dilakukan oleh Eri atau Nana."}
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Menunggu Diproses" value={countBy("pending")} tone={countBy("pending") > 0 ? "warn" : "good"} />
        <StatCard label="Progress" value={countBy("progress")} />
        <StatCard label="Ditunda" value={countBy("ditunda")} />
        <StatCard label="Selesai" value={countBy("selesai")} tone="good" />
        <StatCard label="Ditolak" value={countBy("ditolak")} tone="bad" />
      </div>

      {rows.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>Tidak ada pengajuan untuk filter ini.</div>}
      {rows.map(p => {
      const st = PENGAJUAN_STATUS[p.status] || PENGAJUAN_STATUS.pending;
      return <div key={p.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12
      }} className="ais-content-panel">
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 6
        }} className="ais-flex-layout">
              <div>
                <div style={{
              ...FI,
              fontWeight: 700,
              fontSize: 14
            }}>{p.kategori}</div>
                <div style={{
              ...FI,
              fontSize: 12,
              color: T.inkMuted
            }}>
                  {stores.find(s => s.id === p.storeId)?.name || p.storeId} · {p.tanggal} · diajukan {p.diajukanOleh}
                </div>
              </div>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <div style={{
          ...FI,
          fontSize: 13,
          marginTop: 6
        }}>{p.keterangan}</div>
            {p.foto && <img src={p.foto} alt="temuan" style={{
          width: 110,
          height: 110,
          borderRadius: 10,
          objectFit: "cover",
          border: `1px solid ${T.line}`,
          marginTop: 10
        }} />}

            {(p.riwayat || []).length > 0 && <div style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${T.line}`
        }}>
                <div style={{
            ...FI,
            fontSize: 10,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 4
          }}>Riwayat Proses</div>
                {p.riwayat.map((r, i) => <div key={i} style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            padding: "2px 0"
          }}>
                    <b style={{
              color: T.ink
            }}>{PENGAJUAN_STATUS[r.status]?.label || r.status}</b> · {r.oleh} · {new Date(r.at).toLocaleString("id-ID")}
                    {r.catatan ? ` — "${r.catatan}"` : ""}
                  </div>)}
              </div>}

            {canProcess && (openId !== p.id ? <button onClick={() => {
          setOpenId(p.id);
          setRespStatus("progress");
          setCatatan("");
        }} style={{
          marginTop: 12,
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "7px 13px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Proses Pengajuan</button> : <div style={{
          marginTop: 12,
          background: T.surfaceSunk,
          borderRadius: 10,
          padding: 12
        }} className="ais-content-panel">
                <div style={{
            display: "flex",
            gap: 10,
            marginBottom: 8,
            flexWrap: "wrap"
          }} className="ais-flex-layout">
                  <select value={respStatus} onChange={e => setRespStatus(e.target.value)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "7px 10px",
              ...FI,
              fontSize: 12.5,
              background: T.surface
            }} className="ais-control">
                    {["progress", "ditunda", "selesai", "ditolak"].map(k => <option key={k} value={k}>{PENGAJUAN_STATUS[k].label}</option>)}
                  </select>
                  <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder={respStatus === "progress" ? "Keterangan progress (wajib)" : "Catatan (opsional)"} style={{
              flex: 1,
              minWidth: 200,
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "7px 10px",
              ...FI,
              fontSize: 12.5
            }} className="ais-control" />
                </div>
                <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                  <button onClick={() => proses(p)} disabled={respStatus === "progress" && !catatan.trim()} style={{
              border: "none",
              borderRadius: 9,
              padding: "8px 14px",
              background: respStatus === "progress" && !catatan.trim() ? T.line : T.manajemen,
              color: "#fff",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: respStatus === "progress" && !catatan.trim() ? "not-allowed" : "pointer"
            }} className="ais-button ais-button--primary">Kirim Respon</button>
                  <button onClick={() => setOpenId(null)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 9,
              padding: "8px 14px",
              background: "transparent",
              color: T.inkMuted,
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">Batal</button>
                </div>
              </div>)}
          </div>;
    })}
    </div>;
}
function RekapPengeluaranPage({
  stores,
  reportLog
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);
  const totalPengeluaran = days.reduce((s, d) => s + (d.data.sales_shift2?.pengeluaran || 0), 0);
  const avgHarian = days.length ? totalPengeluaran / days.length : 0;
  const perItemTotal = {};
  days.forEach(d => {
    const items = d.data.sales_shift2?.pengeluaranItems || {};
    Object.entries(items).forEach(([item, v]) => {
      perItemTotal[item] = (perItemTotal[item] || 0) + (Number(v) || 0);
    });
  });
  const topItems = Object.entries(perItemTotal).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return <div>
      <SectionTitle icon={FileBarChart2} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Pengeluaran — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total: ${rupiah(totalPengeluaran)}`]} filename={`rekap-pengeluaran_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "item",
        label: "Item"
      }, {
        key: "jumlah",
        label: "Jumlah"
      }, {
        key: "oleh",
        label: "Diinput Oleh"
      }]} rows={days.flatMap(d => Object.entries(d.data.sales_shift2?.pengeluaranItems || {}).filter(([, v]) => Number(v) > 0).map(([item, v]) => ({
        tanggal: d.date,
        item,
        jumlah: Number(v),
        oleh: d.data.sales_shift2?.inputOleh || ""
      })))} />
          <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
        </div>}>Rekap Pengeluaran</SectionTitle>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16
    }}>Bersumber dari section "Pengeluaran Harian" di Laporan Sales <b>Shift 2</b> mobile app (mencakup pengeluaran sepanjang hari) — rincian per item seperti formulir pengeluaran toko.</div>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Pengeluaran Bulan Ini" value={rupiah(totalPengeluaran)} tone="warn" />
        <StatCard label="Rata² Pengeluaran/Hari" value={rupiah(avgHarian)} />
        <StatCard label="Item Terbesar" value={topItems[0] ? `${topItems[0][0]}` : "-"} />
      </div>

      <div style={{
      ...FI,
      fontWeight: 700,
      fontSize: 11,
      color: T.inkMuted,
      textTransform: "uppercase",
      marginBottom: 8
    }}>Rekap per Item (Bulan Ini)</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 20
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Item", "Total"].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {topItems.length === 0 && <tr><td colSpan={2} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada pengeluaran tercatat untuk toko & bulan ini.</td></tr>}
            {topItems.map(([item, v]) => <tr key={item} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              padding: "8px 12px"
            }}>{item}</td>
                <td style={{
              padding: "8px 12px",
              ...FM,
              fontWeight: 600
            }}>{rupiah(v)}</td>
              </tr>)}
          </tbody>
        </table>
      </div>

      <div style={{
      ...FI,
      fontWeight: 700,
      fontSize: 11,
      color: T.inkMuted,
      textTransform: "uppercase",
      marginBottom: 8
    }}>Rekap Harian</div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik tanggal untuk melihat rincian item.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Pengeluaran Harian", "Diinput Oleh", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={4} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada data untuk toko & bulan ini.</td></tr>}
            {days.map(d => {
            const s2 = d.data.sales_shift2;
            const isOpen = openDate === d.date;
            const entries = Object.entries(s2?.pengeluaranItems || {}).filter(([, v]) => Number(v) > 0);
            return <Fragment key={d.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : d.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{d.date}</td>
                    <td style={{
                  ...TD,
                  fontWeight: 700,
                  color: T.warn
                }}>{s2 ? rupiah(s2.pengeluaran) : "-"}</td>
                    <td style={{
                  ...TD,
                  color: T.inkMuted
                }}>{s2?.inputOleh || "-"}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={4} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        {entries.length === 0 && <div style={{
                    ...FI,
                    fontSize: 12.5,
                    color: T.inkMuted
                  }}>Tidak ada rincian item.</div>}
                        {entries.map(([item, v]) => <div key={item} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    ...FI,
                    fontSize: 12.5,
                    color: T.inkMuted,
                    padding: "3px 0"
                  }}>
                            <span>{item}</span><span>{rupiah(v)}</span>
                          </div>)}
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function RekapSalesPage({
  stores,
  reportLog,
  setReportLog,
  salesEditLock,
  setSalesEditLock,
  currentUser
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);
  const totalOmsetKotor = days.reduce((s, d) => s + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);
  const totalOmsetBersih = days.reduce((s, d) => s + (d.data.sales_shift1?.omsetBersih || 0) + (d.data.sales_shift2?.omsetBersih || 0), 0);
  const totalPengeluaran = days.reduce((s, d) => s + (d.data.sales_shift1?.pengeluaran || 0) + (d.data.sales_shift2?.pengeluaran || 0), 0);
  const avgOmsetHarian = days.length ? totalOmsetBersih / days.length : 0;
  return <div>
      <SectionTitle icon={FileBarChart2} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Sales — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total Omset Kotor: ${rupiah(totalOmsetKotor)}`]} filename={`rekap-sales_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "omsetKotor1",
        label: "Omset Kotor S1"
      }, {
        key: "omsetKotor2",
        label: "Omset Kotor S2"
      }, {
        key: "omsetKotor",
        label: "Omset Kotor Total"
      }, {
        key: "pengeluaran",
        label: "Pengeluaran"
      }, {
        key: "cash",
        label: "Cash"
      }, {
        key: "qris",
        label: "QRIS"
      }, {
        key: "debit",
        label: "Debit"
      }, {
        key: "gopay",
        label: "Gopay"
      }, {
        key: "feePembayaran",
        label: "Fee Pembayaran"
      }, {
        key: "diskon",
        label: "Diskon"
      }, {
        key: "feeOnline",
        label: "Fee Online"
      }, {
        key: "omsetBersih",
        label: "Omset Bersih"
      }]} rows={days.map(d => {
        const s1 = d.data.sales_shift1,
          s2 = d.data.sales_shift2,
          so = d.data.salesOnline;
        const sumPay = k => (Number(s1?.payment?.[k]) || 0) + (Number(s2?.payment?.[k]) || 0);
        const feeP = (s1 ? salesFeeBreakdown(s1).totalFee : 0) + (s2 ? salesFeeBreakdown(s2).totalFee : 0);
        const feeO = so ? ONLINE_PLATFORMS.reduce((a, pl) => a + feePlatform(pl.key, Number(so[pl.key]?.gross) || 0, Number(so[pl.key]?.diskon) || 0, so[pl.key]?.fee), 0) : 0;
        const disk = so ? (Number(so.offlineDiskon) || 0) + ONLINE_PLATFORMS.reduce((a, pl) => a + (Number(so[pl.key]?.diskon) || 0), 0) : 0;
        return {
          tanggal: d.date,
          omsetKotor1: s1?.omsetKotor || 0,
          omsetKotor2: s2?.omsetKotor || 0,
          omsetKotor: (s1?.omsetKotor || 0) + (s2?.omsetKotor || 0),
          pengeluaran: s2?.pengeluaran || 0,
          cash: sumPay("cash"),
          qris: sumPay("qris"),
          debit: sumPay("debit"),
          gopay: sumPay("gopay"),
          feePembayaran: feeP,
          diskon: disk,
          feeOnline: feeO,
          omsetBersih: (s1?.omsetBersih || 0) + (s2?.omsetBersih || 0)
        };
      })} />
          <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
        </div>}>Rekap Sales</SectionTitle>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Omset Kotor Bulan Ini" value={rupiah(totalOmsetKotor)} />
        <StatCard label="Omset Bersih Bulan Ini" value={rupiah(totalOmsetBersih)} tone="good" />
        <StatCard label="Total Pengeluaran" value={rupiah(totalPengeluaran)} tone="warn" />
        <StatCard label="Rata² Omset Bersih/Hari" value={rupiah(avgOmsetHarian)} />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik tanggal untuk melihat rincian qty produk terjual per shift.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Omset Shift 1", "Omset Shift 2", "Omset Bersih Harian", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={5} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada data untuk toko & bulan ini.</td></tr>}
            {days.map(d => {
            const s1 = d.data.sales_shift1,
              s2 = d.data.sales_shift2;
            const omsetBersihHarian = (s1?.omsetBersih || 0) + (s2?.omsetBersih || 0);
            const isOpen = openDate === d.date;
            return <Fragment key={d.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : d.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{d.date}</td>
                    <td style={TD}>{s1 ? rupiah(s1.omsetKotor) : "-"}</td>
                    <td style={TD}>{s2 ? rupiah(s2.omsetKotor) : "-"}</td>
                    <td style={{
                  ...TD,
                  fontWeight: 700,
                  color: T.good
                }}>{rupiah(omsetBersihHarian)}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}><td colSpan={5} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}><SalesDetailPanel data={d.data} dateKey={`${store}_${d.date}`} reportLog={reportLog} setReportLog={setReportLog} salesEditLock={salesEditLock} setSalesEditLock={setSalesEditLock} currentUser={currentUser} /></td></tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---- Rekap Produksi (drill-down batch/sisa/catatan) ---- */
function RekapProduksiTab({
  stores,
  reportLog
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);

  // Sisa matang yang dihitung hanya dari Shift 2 (closing) — sisa Shift 1 masih terpakai di Shift 2.
  const totalBatch = days.reduce((s, d) => s + (d.data.produksi_shift1?.batch || 0) + (d.data.produksi_shift2?.batch || 0), 0);
  const sisaAyamS2 = days.reduce((s, d) => s + (d.data.produksi_shift2?.sisaAyam || 0), 0);
  const sisaHotwingS2 = days.reduce((s, d) => s + (d.data.produksi_shift2?.sisaHotwing || 0), 0);
  const sisaKulitS2 = days.reduce((s, d) => s + (d.data.produksi_shift2?.sisaKulit || 0), 0);
  const avgBatchHarian = days.length ? (totalBatch / days.length).toFixed(1) : "0.0";
  const hariAdaCatatan = days.filter(d => d.data.produksi_shift1?.catatan || d.data.produksi_shift2?.catatan).length;
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title={`Rekap Produksi — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total Batch: ${totalBatch}`]} filename={`rekap-produksi_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "shift",
        label: "Shift"
      }, {
        key: "batch",
        label: "Batch"
      }, {
        key: "dada",
        label: "Sisa Dada"
      }, {
        key: "pahaAtas",
        label: "Sisa Paha Atas"
      }, {
        key: "pahaBawah",
        label: "Sisa Paha Bawah"
      }, {
        key: "sayap",
        label: "Sisa Sayap"
      }, {
        key: "sisaAyam",
        label: "Total Sisa Ayam"
      }, {
        key: "sisaHotwing",
        label: "Sisa Hotwing"
      }, {
        key: "sisaKulit",
        label: "Sisa Kulit"
      }, {
        key: "catatan",
        label: "Catatan"
      }]} rows={days.flatMap(d => ["produksi_shift1", "produksi_shift2"].map((k, si) => {
        const p = d.data[k];
        if (!p) return null;
        const b = p.sisaAyamBreakdown || {};
        return {
          tanggal: d.date,
          shift: si + 1,
          batch: p.batch,
          dada: b.dada ?? "",
          pahaAtas: b.pahaAtas ?? "",
          pahaBawah: b.pahaBawah ?? "",
          sayap: b.sayap ?? "",
          sisaAyam: p.sisaAyam ?? "",
          sisaHotwing: p.sisaHotwing ?? "",
          sisaKulit: p.sisaKulit ?? "",
          catatan: p.catatan || ""
        };
      }).filter(Boolean))} />
        <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
      </div>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Batch Bulan Ini" value={totalBatch} />
        <StatCard label="Sisa Ayam (Shift 2)" value={`${sisaAyamS2} ptg`} tone="warn" />
        <StatCard label="Sisa Hotwing (Shift 2)" value={`${sisaHotwingS2} porsi`} tone="warn" />
        <StatCard label="Sisa Kulit (Shift 2)" value={`${sisaKulitS2} porsi`} tone="warn" />
        <StatCard label="Rata² Batch/Hari" value={avgBatchHarian} />
        <StatCard label="Hari Ada Catatan Kejadian" value={hariAdaCatatan} tone={hariAdaCatatan > 0 ? "bad" : "good"} />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Kolom Batch = total Shift 1 + Shift 2. Sisa matang diambil dari Shift 2 (closing). Klik tanggal untuk melihat rincian kedua shift & catatan kejadian.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Total Batch", "Sisa Ayam", "Sisa Hotwing", "Sisa Kulit", "Catatan", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={7} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada data untuk toko & bulan ini.</td></tr>}
            {days.map(d => {
            const p1 = d.data.produksi_shift1,
              p2 = d.data.produksi_shift2;
            const isOpen = openDate === d.date;
            const adaCatatan = p1?.catatan || p2?.catatan;
            return <Fragment key={d.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : d.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{d.date}</td>
                    <td style={TD}>{p1 || p2 ? (p1?.batch || 0) + (p2?.batch || 0) : "-"}</td>
                    <td style={TD}>{p2?.sisaAyam ?? "-"}</td>
                    <td style={TD}>{p2?.sisaHotwing ?? "-"}</td>
                    <td style={TD}>{p2?.sisaKulit ?? "-"}</td>
                    <td style={TD}>{adaCatatan ? <Badge tone="bad">Ada</Badge> : <span style={{
                    color: T.inkMuted
                  }}>-</span>}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={7} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    ...FI,
                    fontSize: 12.5
                  }} className="ais-responsive-grid">
                          {[p1, p2].map((p, i) => p ? <div key={i}>
                              <div style={{
                        fontWeight: 700,
                        marginBottom: 4
                      }}>Shift {i + 1} · {p.inputOleh}</div>
                              <div style={{
                        color: T.inkMuted
                      }}>Batch: {p.batch}</div>
                              <div style={{
                        color: T.inkMuted
                      }}>Sisa Ayam Total (auto): <b style={{
                          color: T.ink
                        }}>{p.sisaAyam ?? 0}</b> ptg</div>
                              {p.sisaAyamBreakdown && <div style={{
                        color: T.inkMuted,
                        fontSize: 11.5
                      }}>
                                  Dada {p.sisaAyamBreakdown.dada} · Paha Atas {p.sisaAyamBreakdown.pahaAtas} · Paha Bawah {p.sisaAyamBreakdown.pahaBawah} · Sayap {p.sisaAyamBreakdown.sayap}
                                </div>}
                              <div style={{
                        color: T.inkMuted
                      }}>Hotwing: {p.sisaHotwing ?? 0} porsi · Kulit: {p.sisaKulit ?? 0} porsi</div>
                              {p.catatan && <div style={{
                        color: T.bad,
                        marginTop: 4,
                        fontStyle: "italic"
                      }}>"{p.catatan}"</div>}
                            </div> : <div key={i} style={{
                      color: T.inkMuted
                    }}>Shift {i + 1}: belum ada laporan.</div>)}
                        </div>
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---- Rekap Etalase (drill-down per checkpoint jam) ---- */
const CHECKPOINT_TIME = {
  etalase_0700: "07:00",
  etalase_1100: "11:00",
  etalase_1700: "17:00",
  etalase_2000: "20:00"
};
const CHECKPOINT_ORDER = ["etalase_0700", "etalase_1100", "etalase_1700", "etalase_2000"];
function etalaseCheckpointStatus(cd, checkpointKey, dateStr_) {
  if (cd) {
    const [sh, sm] = CHECKPOINT_TIME[checkpointKey].split(":").map(Number);
    const sub = new Date(cd.submittedAt);
    const subMin = sub.getHours() * 60 + sub.getMinutes();
    return subMin > sh * 60 + sm + 10 ? "late" : "ontime";
  }
  const idx = CHECKPOINT_ORDER.indexOf(checkpointKey);
  const nextTime = CHECKPOINT_ORDER[idx + 1] ? CHECKPOINT_TIME[CHECKPOINT_ORDER[idx + 1]] : "23:59";
  const today = new Date();
  const todayStr = dateStr(today);
  if (dateStr_ < todayStr) return "missing";
  if (dateStr_ === todayStr) {
    const [nh, nm] = nextTime.split(":").map(Number);
    if (today.getHours() * 60 + today.getMinutes() >= nh * 60 + nm) return "missing";
  }
  return null; // belum waktunya / hari mendatang
}
function RekapEtalaseTab({
  stores,
  reportLog
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);
  const checkpoints = [{
    key: "etalase_0700",
    label: "07:00"
  }, {
    key: "etalase_1100",
    label: "11:00"
  }, {
    key: "etalase_1700",
    label: "17:00"
  }, {
    key: "etalase_2000",
    label: "20:00"
  }];
  const hariGoreng = days.filter(d => d.data.etalase_2000?.ajukanGoreng).length;
  const totalTerlambat = days.reduce((s, d) => s + checkpoints.filter(c => etalaseCheckpointStatus(d.data[c.key], c.key, d.date) === "late").length, 0);
  const totalTidakMengerjakan = days.reduce((s, d) => s + checkpoints.filter(c => etalaseCheckpointStatus(d.data[c.key], c.key, d.date) === "missing").length, 0);
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title={`Rekap Etalase — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Terlambat: ${totalTerlambat} · Tidak Mengerjakan: ${totalTidakMengerjakan}`]} filename={`rekap-etalase_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "jam",
        label: "Checkpoint"
      }, {
        key: "stok",
        label: "Stok (pcs)"
      }, {
        key: "status",
        label: "Status"
      }, {
        key: "goreng",
        label: "Instruksi Goreng"
      }, {
        key: "oleh",
        label: "Diinput Oleh"
      }]} rows={days.flatMap(d => checkpoints.map(cp => {
        const cd = d.data[cp.key];
        const cs = etalaseCheckpointStatus(cd, cp.key, d.date);
        return {
          tanggal: d.date,
          jam: cp.label,
          stok: cd?.stok ?? "",
          status: cs === "late" ? "Terlambat" : cs === "missing" ? "Tidak Mengerjakan" : cd ? "Ontime" : "Belum Lapor",
          goreng: cp.key === "etalase_2000" && cd?.ajukanGoreng ? `${cd.qtyGoreng} pcs` : "",
          oleh: cd?.inputOleh || ""
        };
      }))} />
        <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
      </div>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Hari Terpantau" value={days.length} />
        <StatCard label="Checkpoint Terlambat" value={totalTerlambat} tone={totalTerlambat > 0 ? "warn" : "good"} />
        <StatCard label="Checkpoint Tidak Mengerjakan" value={totalTidakMengerjakan} tone={totalTidakMengerjakan > 0 ? "bad" : "good"} />
        <StatCard label="Hari Ada Instruksi Goreng Tambahan" value={hariGoreng} tone="warn" />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik tanggal untuk melihat catatan & status instruksi goreng tambahan. Badge merah "Tidak Mengerjakan" berarti laporan tidak diisi sampai lewat jam checkpoint berikutnya (dianggap 0, sesuai aturan penguncian di mobile app).</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "07:00", "11:00", "17:00", "20:00", "Instruksi Goreng", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={7} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada data untuk toko & bulan ini.</td></tr>}
            {days.map(d => {
            const isOpen = openDate === d.date;
            const e20 = d.data.etalase_2000;
            return <Fragment key={d.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : d.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{d.date}</td>
                    {checkpoints.map(c => {
                  const cd = d.data[c.key];
                  const cs = etalaseCheckpointStatus(cd, c.key, d.date);
                  return <td key={c.key} style={TD}>
                          {cd ? `${cd.stok} pcs` : "-"}
                          {cs === "late" && <div><Badge tone="warn">Terlambat</Badge></div>}
                          {cs === "missing" && <div><Badge tone="bad">Tidak Mengerjakan</Badge></div>}
                        </td>;
                })}
                    <td style={TD}>{e20?.ajukanGoreng ? <Badge tone="warn">{e20.qtyGoreng} pcs</Badge> : <span style={{
                    color: T.inkMuted
                  }}>-</span>}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={7} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    ...FI,
                    fontSize: 12.5
                  }} className="ais-responsive-grid">
                          {checkpoints.map(c => {
                      const cd = d.data[c.key];
                      const cs = etalaseCheckpointStatus(cd, c.key, d.date);
                      return <div key={c.key}>
                                <div style={{
                          fontWeight: 700,
                          marginBottom: 3,
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }} className="ais-flex-layout">
                                  {c.label}
                                  {cs === "late" && <Badge tone="warn">Terlambat</Badge>}
                                  {cs === "missing" && <Badge tone="bad">Tidak Mengerjakan</Badge>}
                                </div>
                                {cd ? <div style={{
                          color: T.inkMuted
                        }}>
                                    Stok: {cd.stok} pcs · {cd.inputOleh}<br />
                                    {cd.note && <span style={{
                            fontStyle: "italic"
                          }}>"{cd.note}"</span>}
                                    {c.key === "etalase_2000" && cd.ajukanGoreng && <div style={{
                            color: T.warn,
                            marginTop: 3,
                            fontWeight: 600
                          }}>Ajukan goreng {cd.qtyGoreng} pcs</div>}
                                  </div> : <span style={{
                          color: T.inkMuted
                        }}>{cs === "missing" ? "Tidak ada laporan (dianggap 0)." : "Belum lapor."}</span>}
                              </div>;
                    })}
                        </div>
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 10
    }}>
        Data laporan toko pada dashboard ini tersimpan terpisah dari mobile app (prototype) — di working app keduanya akan memakai satu basis data yang sama secara real-time.
      </div>
    </div>;
}

/* ---- Rekap Minyak (Stok Awal, Top Up, Stok Akhir, Waste/Ampas — hitungan dashboard) ---- */
function RekapMinyakTab({
  stores,
  reportLog
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);
  const rows = days.map(d => {
    const bp = d.data.base_prep?.minyak;
    const tu2 = d.data.base_prep_2?.topUpMinyak2;
    const totalTopUp = tu2?.totalTopUp ?? (bp?.topUp1Liter || 0);
    const closing = d.data.produksi_shift2?.minyakClosing;
    const tomorrowKey = `${store}_${addDaysStr(d.date, 1)}`;
    const bpTomorrow = reportLog[tomorrowKey]?.base_prep?.minyak;
    const waste = closing && bpTomorrow ? Math.max(closing.literMinyakFryerAkhir - bpTomorrow.literMinyakFryer, 0) : null;
    return {
      date: d.date,
      bp,
      tu2,
      totalTopUp,
      closing,
      waste
    };
  });
  const totalWaste = rows.reduce((s, r) => s + (r.waste || 0), 0);
  const hariAdaWaste = rows.filter(r => r.waste != null).length;
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title={`Rekap Minyak — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total Waste: ${totalWaste.toFixed(2)} L`]} filename={`rekap-minyak_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "stokAwal",
        label: "Stok Awal (Kg)"
      }, {
        key: "topUp",
        label: "Total Top Up (L)"
      }, {
        key: "stokAkhir",
        label: "Stok Akhir (Kg)"
      }, {
        key: "waste",
        label: "Waste/Ampas (L)"
      }]} rows={rows.map(r => ({
        tanggal: r.date,
        stokAwal: r.bp?.totalStokAwalMinyak ?? "",
        topUp: r.bp ? r.totalTopUp : "",
        stokAkhir: r.closing?.totalStokAkhirMinyak ?? "",
        waste: r.waste != null ? r.waste.toFixed(2) : ""
      }))} />
        <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Waste Minyak/Ampas Goreng dihitung otomatis dari Minyak Fryer saja: <b>Minyak Fryer malam (closing hari ini) − Minyak Fryer pagi (Base Preparation hari berikutnya)</b>. Contoh: Fryer malam tgl 1 = 30L, Fryer pagi tgl 2 = 25L → Waste tgl 1 otomatis terisi 5L begitu laporan minyak pagi tgl 2 diinput.
      </div>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Hari Bisa Dihitung Waste" value={hariAdaWaste} />
        <StatCard label="Total Waste/Ampas Bulan Ini" value={`${totalWaste.toFixed(2)} L`} tone={totalWaste > 0 ? "warn" : "good"} />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik tanggal untuk melihat rincian breakdown Minyak Beku & Minyak Fryer.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Stok Awal Minyak", "Total Top Up", "Stok Akhir (Malam)", "Waste/Ampas", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada data untuk toko & bulan ini.</td></tr>}
            {rows.map(r => {
            const isOpen = openDate === r.date;
            return <Fragment key={r.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : r.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{r.date}</td>
                    <td style={TD}>{r.bp ? `${r.bp.totalStokAwalMinyak} Kg` : "-"}</td>
                    <td style={TD}>{r.bp ? `${r.totalTopUp} L` : "-"}</td>
                    <td style={TD}>{r.closing ? `${r.closing.totalStokAkhirMinyak} Kg` : "-"}</td>
                    <td style={TD}>{r.waste != null ? <span style={{
                    fontWeight: 700,
                    color: r.waste > 0 ? T.warn : T.good
                  }}>{r.waste.toFixed(2)} L</span> : <span style={{
                    color: T.inkMuted,
                    fontStyle: "italic"
                  }}>menunggu laporan besok</span>}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={6} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 20,
                    ...FI,
                    fontSize: 12.5
                  }} className="ais-responsive-grid">
                          <div>
                            <div style={{
                        fontWeight: 700,
                        marginBottom: 6
                      }}>Stok Awal Minyak (Pagi)</div>
                            {r.bp ? <div style={{
                        color: T.inkMuted,
                        lineHeight: 1.9
                      }}>
                                Minyak Beku: {r.bp.minyakBekuKg} Kg + Minyak Datang: {r.bp.minyakDatangKg} Kg = <b style={{
                          color: T.ink
                        }}>{r.bp.totalMinyakBekuKg} Kg</b><br />
                                Minyak Fryer: {r.bp.minyakFryerCm} cm → <b style={{
                          color: T.ink
                        }}>{r.bp.literMinyakFryer} L</b><br />
                                <span style={{
                          fontWeight: 700,
                          color: T.ink
                        }}>Total Stok Awal: {r.bp.totalStokAwalMinyak} Kg</span><br />
                                Top Up Sesi 1: {r.bp.topUp1Cm} cm → <b style={{
                          color: T.ink
                        }}>{r.bp.topUp1Liter} L</b>
                                {r.tu2 && <><br /><br /><b style={{
                            color: T.ink
                          }}>Top Up Minyak 2 (Base Prep 2)</b><br />
                                {r.tu2.ada ? <>Fryer sebelum: {r.tu2.sebelumCm} cm → {r.tu2.sebelumLiter} L<br />
                                Top Up 2: {r.tu2.topUpCm} cm → <b style={{
                              color: T.ink
                            }}>{r.tu2.topUp2Liter} L</b><br />
                                Fryer setelah: {r.tu2.sesudahLiter} L<br /></> : <>Tidak ada top up kedua.<br /></>}
                                <span style={{
                            fontWeight: 700,
                            color: T.ink
                          }}>Total Top Up: {r.totalTopUp} L</span></>}
                              </div> : <span style={{
                        color: T.inkMuted
                      }}>Belum ada laporan Base Preparation.</span>}
                          </div>
                          <div>
                            <div style={{
                        fontWeight: 700,
                        marginBottom: 6
                      }}>Stok Akhir Minyak (Malam)</div>
                            {r.closing ? <div style={{
                        color: T.inkMuted,
                        lineHeight: 1.9
                      }}>
                                Minyak Beku Akhir: <b style={{
                          color: T.ink
                        }}>{r.closing.minyakBekuAkhir} Kg</b><br />
                                Minyak Fryer Akhir: {r.closing.minyakFryerAkhirCm} cm → <b style={{
                          color: T.ink
                        }}>{r.closing.literMinyakFryerAkhir} L</b><br />
                                <span style={{
                          fontWeight: 700,
                          color: T.ink
                        }}>Total Stok Akhir: {r.closing.totalStokAkhirMinyak} Kg</span><br />
                                {r.waste != null ? <span>Waste: {r.closing.literMinyakFryerAkhir} L − {(r.closing.literMinyakFryerAkhir - r.waste).toFixed(2)} L = <b style={{
                            color: r.waste > 0 ? T.warn : T.good
                          }}>{r.waste.toFixed(2)} L</b></span> : <span style={{
                          fontStyle: "italic"
                        }}>Waste menunggu laporan minyak pagi hari berikutnya.</span>}
                              </div> : <span style={{
                        color: T.inkMuted
                      }}>Belum ada laporan Produksi Shift 2.</span>}
                          </div>
                        </div>
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* =========================================================
   WASTE CALCULATION
   Alur: Sales Daily (qty produk) x BOM -> [TheoLines Ayam: konversi potongan -> pack terbuka]
         -> TheoWide -> dibanding Out Toko (input crew) -> Selisih -> Nilai Selisih (harga rata-rata bulan).
   Aturan sudah disepakati (lihat HANDOFF.md bagian 5). Bagian "logika murni" di bawah tidak memakai React
   supaya bisa diuji terpisah.
========================================================= */
// >>> WASTE-LOGIC-START
const WASTE_ID = {
  oil: "oil_mi_01_001",
  ayamUtuh: "aym_ay_01_001",
  ayamOriginal: "aym_ay_01_002",
  hotwing: "aym_ho_01_003",
  kulit: "aym_ku_01_004",
  cabe: "frs_ca_01_001"
};
// Potongan ayam yang dikonversi ke pack (urutan sama dengan sheet TheoLines Ayam: PA, PB, SW, DD).
const WASTE_CUTS = [{
  id: "aym_pa_01_005",
  label: "PA",
  perPackDefault: 2
}, {
  id: "aym_pb_01_006",
  label: "PB",
  perPackDefault: 2
}, {
  id: "aym_sw_01_007",
  label: "SW",
  perPackDefault: 2
}, {
  id: "aym_dd_01_008",
  label: "DD",
  perPackDefault: 3
}];
// Bahan yang TheoWide-nya di-mirror dari input Out Toko crew (selisih otomatis nol, tidak dihitung waste).
const WASTE_MIRROR_NAMA = ["Kertas Termal", "Pencuci Piring", "Deterjen", "Handsoap", "Pembersih Kaca", "Pembersih Lantai", "Minyak Goreng 1lt", "Tutup Gelas", "Plastik Sampah", "Plastik Jumbo", "Plastik Clip", "Handglove", "Tissue"];
// Bahan yang di Waste Calculation dikonversi langsung ke Kg (stok & input crew tetap dalam gr).
const WASTE_KG_IDS = ["dry_te_01_001", "dry_be_01_003"]; // Tepung Bumbu, Beras
function wasteFaktorKg(b) {
  return WASTE_KG_IDS.includes(b.id) && b.unitKecil === "gr" ? 1000 : 1;
}
function wasteUnitLabel(b) {
  return b.id === WASTE_ID.oil || wasteFaktorKg(b) === 1000 ? "Kg" : b.unitKecil;
}
const wasteNorm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function wasteMirrorIds(bahan) {
  const ids = new Set();
  const tidakKetemu = [];
  WASTE_MIRROR_NAMA.forEach(nama => {
    const n = wasteNorm(nama);
    // cocokkan persis dulu; "minyakgoreng1lt" tidak boleh tertukar dengan "Minyak Goreng"
    const b = (bahan || []).find(x => wasteNorm(x.name) === n) || (bahan || []).find(x => wasteNorm(x.name).startsWith(n) && wasteNorm(x.name) !== wasteNorm("Minyak Goreng"));
    if (b) ids.add(b.id);else tidakKetemu.push(nama);
  });
  return {
    ids,
    tidakKetemu
  };
}
function wasteMinyakCfg(minyakConfig) {
  return {
    koef: Number(minyakConfig?.koefMinyak ?? 0.1),
    allowance: Number(minyakConfig?.allowanceMinyak ?? 0.15),
    ekorPerBatch: Number(minyakConfig?.ekorPerBatch ?? 3),
    literPerCm: Number(minyakConfig?.literPerCm ?? 1.68)
  };
}

// Qty produk terjual satu hari = Shift 1 + Shift 2.
function wasteQtyHari(entry) {
  const out = {};
  [entry?.sales_shift1?.qty, entry?.sales_shift2?.qty].forEach(q => {
    Object.entries(q || {}).forEach(([k, v]) => {
      out[k] = (out[k] || 0) + (Number(v) || 0);
    });
  });
  return out;
}

// --- TheoLines Ayam: potongan terjual -> pack terbuka -> sisa potongan (aturan sheet: MAX(CEILING(potongan / isi per pack))) ---
function hitungTheoLinesHari(qtyMap, products, bahan) {
  const potongan = {};
  const perPack = {};
  WASTE_CUTS.forEach(c => {
    potongan[c.id] = 0;
    perPack[c.id] = (bahan || []).find(b => b.id === c.id)?.konversi || c.perPackDefault;
  });
  (products || []).forEach(p => {
    const q = Number(qtyMap[p.id]) || 0;
    if (!q) return;
    (p.resep || []).forEach(r => {
      if (potongan[r.bahanId] != null) potongan[r.bahanId] += q * (Number(r.qty) || 0);
    });
  });
  const packTerbuka = Math.max(0, ...WASTE_CUTS.map(c => Math.ceil(potongan[c.id] / perPack[c.id])));
  const sisa = {};
  WASTE_CUTS.forEach(c => {
    sisa[c.id] = packTerbuka * perPack[c.id] - potongan[c.id];
  });
  return {
    potongan,
    perPack,
    packTerbuka,
    sisa
  };
}

// --- TheoWide: sales x BOM. Ayam Original = pack terbuka; Minyak = rumus khusus; bahan mirror = Out Toko crew ---
function hitungTheoWideHari({
  qtyMap,
  products,
  bahan,
  minyakCfg,
  pakaiToleransi,
  mirrorIds,
  outToko
}) {
  const theo = {};
  (products || []).forEach(p => {
    const q = Number(qtyMap[p.id]) || 0;
    if (!q) return;
    (p.resep || []).forEach(r => {
      const faktor = pakaiToleransi ? 1 + (Number(r.toleransiPersen) || 0) / 100 : 1;
      theo[r.bahanId] = (theo[r.bahanId] || 0) + q * (Number(r.qty) || 0) * faktor;
    });
  });
  const lines = hitungTheoLinesHari(qtyMap, products, bahan);
  WASTE_CUTS.forEach(c => {
    delete theo[c.id];
  }); // potongan hanya perantara, tidak jadi baris TheoWide
  theo[WASTE_ID.ayamOriginal] = lines.packTerbuka;

  // Minyak: (Ayam Utuh + Ayam Original + Hotwings/isi*ekor + Kulit/isi*ekor) x koef x (1 + allowance). Komponen DV24 dihapus.
  const konv = (id, fb) => (bahan || []).find(b => b.id === id)?.konversi || fb;
  const hot = theo[WASTE_ID.hotwing] || 0;
  const kul = theo[WASTE_ID.kulit] || 0;
  const bebanGoreng = (theo[WASTE_ID.ayamUtuh] || 0) + lines.packTerbuka + hot / konv(WASTE_ID.hotwing, 7) * minyakCfg.ekorPerBatch + kul / konv(WASTE_ID.kulit, 12) * minyakCfg.ekorPerBatch;
  theo[WASTE_ID.oil] = bebanGoreng * minyakCfg.koef * (1 + minyakCfg.allowance);
  if (mirrorIds && outToko) {
    mirrorIds.forEach(id => {
      if (outToko[id] != null) theo[id] = Number(outToko[id]) || 0;
    });
  }
  return {
    theo,
    lines,
    bebanGoreng
  };
}

// --- Susut minyak fryer 1 hari (Kg = L). (setelah top-up pagi - sebelum top-up 2) + (setelah top-up 2 - closing).
// Tanpa top-up 2: (setelah top-up pagi - closing). Top-up 2 hanya titik ukur, bukan nilai yang dijumlah. ---
function hitungSusutMinyakHari(entry, minyakCfg) {
  const bp = entry?.base_prep?.minyak;
  const closing = entry?.produksi_shift2?.minyakClosing;
  if (!bp || !closing || bp.minyakFryerCm == null || closing.minyakFryerAkhirCm == null) return null;
  const k = minyakCfg.literPerCm;
  const setelahPagiCm = (Number(bp.minyakFryerCm) || 0) + (Number(bp.topUp1Cm) || 0);
  const closingCm = Number(closing.minyakFryerAkhirCm) || 0;
  const tu2 = entry?.base_prep_2?.topUpMinyak2;
  let seg1Cm, seg2Cm;
  if (tu2?.ada) {
    seg1Cm = setelahPagiCm - (Number(tu2.sebelumCm) || 0);
    seg2Cm = (Number(tu2.sebelumCm) || 0) + (Number(tu2.topUpCm) || 0) - closingCm;
  } else {
    seg1Cm = setelahPagiCm - closingCm;
    seg2Cm = 0;
  }
  return {
    kg: (seg1Cm + seg2Cm) * k,
    seg1Kg: seg1Cm * k,
    seg2Kg: seg2Cm * k,
    adaTopUp2: !!tu2?.ada
  };
}

// Total top-up 1 + 2 (L) dari laporan — dipakai DemandWide minyak.
function totalTopUpHari(entry) {
  const tu2 = entry?.base_prep_2?.topUpMinyak2?.totalTopUp;
  if (tu2 != null) return Number(tu2);
  const t1 = entry?.base_prep?.minyak?.topUp1Liter;
  return t1 != null ? Number(t1) : null;
}

// Harga per satuan stok untuk menilai selisih: harga rata-rata pembelian bulan itu (sama dengan PnL);
// bahan minyak fryer dihitung dalam Kg sedangkan harga master per gr, jadi dikali 1000.
function wasteHargaBahan(storeId, b, month, purchaseReports) {
  let harga = hargaBeliUntukBulan(storeId, b.id, month, purchaseReports);
  let sumber = "pembelian";
  if (!harga) {
    harga = Number(b.harga) || 0;
    sumber = "master";
  }
  const faktor = b.id === WASTE_ID.oil && b.unitKecil === "gr" ? 1000 : wasteFaktorKg(b);
  return {
    harga: harga * faktor,
    sumber
  };
}
function hitungWasteBulan({
  storeId,
  stores,
  month,
  reportLog,
  products,
  bahan,
  purchaseReports,
  minyakConfig,
  pakaiToleransi,
  banding
}) {
  const cfg = wasteMinyakCfg(minyakConfig);
  const daftarBahan = bahanUntukToko(storeId, stores, products, bahan).filter(b => !WASTE_CUTS.some(c => c.id === b.id));
  const {
    ids: mirrorIds,
    tidakKetemu
  } = wasteMirrorIds(bahan);
  const days = [];
  const perBahan = {};
  daftarBahan.forEach(b => {
    const h = wasteHargaBahan(storeId, b, month, purchaseReports);
    perBahan[b.id] = {
      bahan: b,
      unit: wasteUnitLabel(b),
      faktor: wasteFaktorKg(b),
      harga: h.harga,
      hargaSumber: h.sumber,
      mirror: mirrorIds.has(b.id),
      totalTheo: 0,
      totalOut: 0,
      totalDemand: 0,
      minusQty: 0,
      plusQty: 0,
      nilaiMinus: 0,
      nilaiPlus: 0,
      hariData: 0
    };
  });
  [...dayEntries(reportLog, storeId, month)].sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
    const entry = d.data;
    const qtyMap = wasteQtyHari(entry);
    if (!Object.keys(qtyMap).some(k => qtyMap[k] > 0)) return; // hari tanpa data penjualan tidak dihitung
    const out = {};
    daftarBahan.forEach(b => {
      const v = entry.stok?.[b.id]?.pakai;
      if (v != null) out[b.id] = Number(v) || 0;
    });
    const {
      theo,
      lines,
      bebanGoreng
    } = hitungTheoWideHari({
      qtyMap,
      products,
      bahan,
      minyakCfg: cfg,
      pakaiToleransi,
      mirrorIds,
      outToko: out
    });
    const susut = hitungSusutMinyakHari(entry, cfg);
    const tangkai = entry.produksi_shift2?.tangkaiCabeGr;
    const sisaHot = entry.produksi_shift2?.sisaHotwing;
    const omset = (Number(entry.sales_shift1?.omsetKotor) || 0) + (Number(entry.sales_shift2?.omsetKotor) || 0);
    const rows = {};
    daftarBahan.forEach(b => {
      const fk = wasteFaktorKg(b); // gr -> Kg untuk Tepung Bumbu & Beras
      const t = (theo[b.id] != null ? theo[b.id] : 0) / fk;
      let o = out[b.id] != null ? out[b.id] / fk : null;
      let catatan = null;
      if (b.id === WASTE_ID.oil) {
        o = susut ? susut.kg : null;
        catatan = "susut fryer";
      }
      let mentah = o == null ? null : t - o;
      let koreksi = 0;
      if (mentah != null && b.id === WASTE_ID.cabe && tangkai != null) {
        koreksi = Number(tangkai) || 0;
        catatan = "tangkai cabe";
      }
      if (mentah != null && b.id === WASTE_ID.hotwing && sisaHot != null) {
        koreksi = Number(sisaHot) || 0;
        catatan = "sisa matang";
      }
      const selisihAwal = mentah == null ? null : mentah + koreksi; // selisih minus = kerugian; koreksi menggeser ke arah nol
      // Banding yang diterima Direksi mengurangi minus (clear ke 0 atau sebagian). Riwayatnya ikut disimpan di baris.
      const bandList = bandingUntukSel(banding, storeId, d.date, b.id);
      const ampunBanding = qtyAmpunSel(bandList, selisihAwal);
      const selisih = selisihAwal == null ? null : selisihAwal + ampunBanding;
      let demand = null;
      if (b.id === WASTE_ID.oil) demand = totalTopUpHari(entry);else if (o != null) demand = Math.min(t, o);
      rows[b.id] = {
        theo: t,
        out: o,
        mentah,
        koreksi,
        selisih,
        selisihAwal,
        ampunBanding,
        banding: bandList,
        demand,
        catatan
      };
      const pb = perBahan[b.id];
      if (bandList.length) {
        pb.adaBanding = true;
        pb.ampunQty = (pb.ampunQty || 0) + ampunBanding;
      }
      pb.totalTheo += t;
      if (o != null) pb.totalOut += o;
      if (demand != null) pb.totalDemand += demand;
      if (selisih != null) {
        pb.hariData += 1;
        if (selisih < 0) {
          pb.minusQty += selisih;
          pb.nilaiMinus += selisih * pb.harga;
        } else if (selisih > 0) {
          pb.plusQty += selisih;
          pb.nilaiPlus += selisih * pb.harga;
        }
      }
    });
    days.push({
      date: d.date,
      lines,
      bebanGoreng,
      susut,
      omset,
      rows
    });
  });
  const list = Object.values(perBahan);
  const nilaiMinus = list.reduce((s, x) => s + x.nilaiMinus, 0); // negatif
  const nilaiTheo = list.reduce((s, x) => s + x.totalTheo * x.harga, 0);
  const omset = days.reduce((s, d) => s + d.omset, 0);
  const pct = (a, b) => b ? a / b : null; // null = tampil "—" (bukan #DIV/0!)
  return {
    days,
    perBahan,
    list,
    daftarBahan,
    mirrorIds,
    mirrorTidakKetemu: tidakKetemu,
    totals: {
      nilaiMinus,
      nilaiTheo,
      omset,
      pctTheo: pct(-nilaiMinus, nilaiTheo),
      pctOmset: pct(-nilaiMinus, omset)
    }
  };
}
// <<< WASTE-LOGIC-END

const wasteFmtQty = (v, d = 2) => v == null ? "—" : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString("id-ID", {
  maximumFractionDigits: d
});
const wastePct = v => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const wasteRp = v => v == null ? "—" : (v < 0 ? "−" : "") + rupiah(Math.abs(v));

/* =========================================================
   BANDING / KOMPLAIN WASTE DAILY
   SPV mengajukan banding atas selisih minus satu bahan pada satu tanggal. Direksi (Kurnia / Juhaeri) memutuskan:
   - diterima  : minus bahan tsb di tanggal tsb di-clear menjadi 0
   - sebagian  : minus dikurangi sejumlah qty yang diampuni (maks. sebesar minus)
   - ditolak   : tidak ada perubahan
   Disimpan di "ais-waste-banding". Semua perhitungan (Waste Daily, Waste Price, Home, Overview SPV) memakai hasil setelah banding.
========================================================= */
const BANDING_STATUS = {
  pending: {
    label: "Menunggu Direksi",
    tone: "warn"
  },
  diterima: {
    label: "Diterima (clear 0)",
    tone: "good"
  },
  sebagian: {
    label: "Diterima Sebagian",
    tone: "manajemen"
  },
  ditolak: {
    label: "Ditolak",
    tone: "bad"
  }
};
const BANDING_APPROVER_IDS = ["kurnia", "juhaeri"];
function bandingUntukSel(banding, storeId, tanggal, bahanId) {
  return (banding || []).filter(b => b.storeId === storeId && b.tanggal === tanggal && b.bahanId === bahanId).sort((a, b) => a.diajukanAt.localeCompare(b.diajukanAt));
}

// Qty yang diampuni untuk satu sel, dari banding yang sudah diputuskan (diterima / sebagian). Tidak melebihi besar minus.
function qtyAmpunSel(list, selisihSebelum) {
  if (selisihSebelum == null || selisihSebelum >= 0) return 0;
  const minus = -selisihSebelum;
  let ampun = 0;
  list.forEach(b => {
    if (b.status === "diterima") ampun = minus;else if (b.status === "sebagian") ampun += Number(b.qtyAmpun) || 0;
  });
  return Math.min(ampun, minus);
}
function BandingForm({
  calc,
  store,
  stores,
  banding,
  onSubmit,
  onCancel
}) {
  const [tanggal, setTanggal] = useState("");
  const [bahanId, setBahanId] = useState("");
  const [ket, setKet] = useState("");
  const day = calc.days.find(d => d.date === tanggal);
  // hanya bahan yang masih minus di tanggal itu & belum punya banding pending
  const opsiBahan = day ? calc.list.filter(x => {
    const r = day.rows[x.bahan.id];
    if (!r || r.selisih == null || r.selisih >= 0 || x.mirror) return false;
    return !bandingUntukSel(banding, store, tanggal, x.bahan.id).some(b => b.status === "pending");
  }) : [];
  const pilih = opsiBahan.find(x => x.bahan.id === bahanId);
  const r = pilih && day.rows[bahanId];
  const valid = tanggal && pilih && ket.trim().length >= 5;
  const Label = ({
    children
  }) => <div style={{
    ...FI,
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: "10px 0 5px"
  }}>{children}</div>;
  const inp = {
    border: `1px solid ${T.line}`,
    borderRadius: 9,
    padding: "8px 10px",
    ...FI,
    fontSize: 13,
    background: T.surface
  };
  return <FormSurface title="Jelaskan selisihnya." subtitle="Sertakan penjelasan dan bukti untuk proses peninjauan." code="APPEAL"><div>
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16
      }}>Ajukan Banding / Komplain — {stores.find(s => s.id === store)?.name}</div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginTop: 2
      }}>Banding diputuskan oleh Direksi (Kurnia / Juhaeri). Hanya selisih minus yang bisa dibanding.</div>
      <div style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        <div>
          <Label>Tanggal</Label>
          <select value={tanggal} onChange={e => {
            setTanggal(e.target.value);
            setBahanId("");
          }} style={inp} className="ais-control">
            <option value="">Pilih tanggal…</option>
            {calc.days.map(d => <option key={d.date} value={d.date}>{d.date}</option>)}
          </select>
        </div>
        <div style={{
          minWidth: 260
        }}>
          <Label>Bahan Baku</Label>
          <select value={bahanId} onChange={e => setBahanId(e.target.value)} disabled={!tanggal} style={{
            ...inp,
            width: "100%"
          }} className="ais-control">
            <option value="">{tanggal ? opsiBahan.length ? "Pilih bahan yang minus…" : "Tidak ada bahan minus yang bisa dibanding" : "Pilih tanggal dulu"}</option>
            {opsiBahan.map(x => <option key={x.bahan.id} value={x.bahan.id}>{x.bahan.name} ({wasteFmtQty(day.rows[x.bahan.id].selisih)} {x.unit})</option>)}
          </select>
        </div>
      </div>
      {r && <div style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        marginTop: 8
      }}>
          Selisih saat ini: <b style={{
          color: T.bad
        }}>{wasteFmtQty(r.selisih)} {pilih.unit}</b> ≈ <b style={{
          color: T.bad
        }}>{wasteRp(r.selisih * pilih.harga)}</b> (TheoWide {wasteFmtQty(r.theo)} · Out Toko {wasteFmtQty(r.out)})
        </div>}
      <Label>Keterangan Banding</Label>
      <textarea value={ket} onChange={e => setKet(e.target.value)} rows={3} placeholder="Jelaskan alasan banding, mis. salah input pakai, bahan dipakai untuk trial menu, dll." style={{
        ...inp,
        width: "100%",
        resize: "none"
      }} className="ais-control" />
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 12
      }} className="ais-flex-layout">
        <button disabled={!valid} onClick={() => onSubmit({
          tanggal,
          bahanId,
          bahanName: pilih.bahan.name,
          unit: pilih.unit,
          keterangan: ket.trim(),
          selisihSaatAjukan: r.selisih,
          hargaSatuan: pilih.harga
        })} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: valid ? T.accent : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: valid ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--primary">Kirim Banding</button>
        <button onClick={onCancel} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 16px",
          background: "transparent",
          color: T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Batal</button>
      </div>
    </div></FormSurface>;
}
function BandingKeputusan({
  b,
  onDecide
}) {
  const [mode, setMode] = useState(null); // "sebagian" | "ditolak"
  const [qty, setQty] = useState("");
  const [catatan, setCatatan] = useState("");
  const maks = Math.abs(b.selisihSaatAjukan || 0);
  const q = Number(qty) || 0;
  const qtyValid = q > 0 && q <= maks;
  const btn = (bg, fg, border) => ({
    border: border || "none",
    borderRadius: 8,
    padding: "6px 12px",
    background: bg,
    color: fg,
    ...FI,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap"
  });
  if (!mode) {
    return <FormSurface title="Tinjau sebelum memutuskan." subtitle="Periksa detail banding dan berikan catatan keputusan." code="DECISION"><div className="ais-flex-layout">
        <button onClick={() => onDecide({
          status: "diterima",
          qtyAmpun: maks
        })} style={btn(T.good, "#fff")} className="ais-button ais-button--default">Terima (clear 0)</button>
        <button onClick={() => setMode("sebagian")} style={btn("transparent", T.manajemen, `1px solid ${T.manajemen}`)} className="ais-button ais-button--default">Terima Sebagian</button>
        <button onClick={() => setMode("ditolak")} style={btn("transparent", T.bad, `1px solid ${T.bad}`)} className="ais-button ais-button--danger">Tolak</button>
      </div></FormSurface>;
  }
  return <FormSurface title="Tinjau sebelum memutuskan." subtitle="Periksa detail banding dan berikan catatan keputusan." code="DECISION"><div className="ais-flex-layout">
      {mode === "sebagian" && <>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder={`Qty diampuni (maks ${wasteFmtQty(maks)})`} style={{
          width: 170,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          ...FM,
          fontSize: 12
        }} className="ais-control" />
          <span style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted
        }}>{b.unit} ≈ {rupiah(q * (b.hargaSatuan || 0))}</span>
        </>}
      <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder={mode === "ditolak" ? "Alasan penolakan (wajib)" : "Catatan (opsional)"} style={{
        minWidth: 200,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "6px 8px",
        ...FI,
        fontSize: 12
      }} className="ais-control" />
      <button disabled={mode === "sebagian" ? !qtyValid : !catatan.trim()} onClick={() => onDecide(mode === "sebagian" ? {
        status: "sebagian",
        qtyAmpun: q,
        catatanDireksi: catatan.trim()
      } : {
        status: "ditolak",
        qtyAmpun: 0,
        catatanDireksi: catatan.trim()
      })} style={{
        ...btn(T.manajemen, "#fff"),
        opacity: (mode === "sebagian" ? qtyValid : catatan.trim()) ? 1 : 0.4
      }} className="ais-button ais-button--primary">Simpan</button>
      <button onClick={() => {
        setMode(null);
        setQty("");
        setCatatan("");
      }} style={btn("transparent", T.inkMuted, `1px solid ${T.line}`)} className="ais-button ais-button--default">Batal</button>
    </div></FormSurface>;
}
function WasteBandingTab({
  banding,
  setBanding,
  store,
  stores,
  month,
  currentUser
}) {
  const [filter, setFilter] = useState("pending");
  const bisaPutus = BANDING_APPROVER_IDS.includes(currentUser?.id);
  const storeIds = stores.map(s => s.id);
  const list = (banding || []).filter(b => storeIds.includes(b.storeId) && b.tanggal.startsWith(month)).filter(b => filter === "all" || (filter === "pending" ? b.status === "pending" : b.status !== "pending")).sort((a, b) => b.diajukanAt.localeCompare(a.diajukanAt));
  const putuskan = (b, hasil) => setBanding((banding || []).map(x => x.id !== b.id ? x : {
    ...x,
    ...hasil,
    diputuskanOleh: currentUser.name,
    diputuskanAt: new Date().toISOString(),
    log: [...(x.log || []), {
      aksi: hasil.status,
      oleh: currentUser.name,
      at: new Date().toISOString(),
      qtyAmpun: hasil.qtyAmpun,
      catatan: hasil.catatanDireksi || null
    }]
  }));
  return <div>
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 12
    }} className="ais-flex-layout">
        {[{
        k: "pending",
        l: "Menunggu"
      }, {
        k: "selesai",
        l: "Sudah Diputuskan"
      }, {
        k: "all",
        l: "Semua"
      }].map(f => <button key={f.k} onClick={() => setFilter(f.k)} style={{
        border: `1px solid ${filter === f.k ? T.manajemen : T.line}`,
        background: filter === f.k ? T.manajemenSoft : T.surface,
        color: filter === f.k ? T.manajemen : T.inkMuted,
        borderRadius: 999,
        padding: "5px 12px",
        ...FI,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer"
      }} className="ais-button ais-button--default" aria-pressed={filter === f.k}>{f.l}</button>)}
      </div>
      {!bisaPutus && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Keputusan banding hanya bisa diberikan oleh Direksi (Kurnia / Juhaeri).</div>}
      {list.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted,
      padding: 24,
      textAlign: "center",
      background: T.surfaceSunk,
      borderRadius: 14
    }} className="ais-content-panel">Tidak ada banding pada filter ini.</div>}
      {list.map(b => {
      const st = BANDING_STATUS[b.status] || BANDING_STATUS.pending;
      return <div key={b.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 10
      }} className="ais-content-panel">
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap"
        }} className="ais-flex-layout">
              <div>
                <div style={{
              ...FI,
              fontWeight: 700,
              fontSize: 13.5
            }}>
                  {stores.find(s => s.id === b.storeId)?.name} · {b.tanggal} · {b.bahanName} <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div style={{
              ...FI,
              fontSize: 12,
              color: T.inkMuted,
              marginTop: 3
            }}>
                  Selisih saat diajukan: <b style={{
                color: T.bad
              }}>{wasteFmtQty(b.selisihSaatAjukan)} {b.unit}</b> ≈ {wasteRp((b.selisihSaatAjukan || 0) * (b.hargaSatuan || 0))}
                  {(b.status === "diterima" || b.status === "sebagian") && <> · diampuni <b style={{
                  color: T.good
                }}>{wasteFmtQty(b.qtyAmpun)} {b.unit}</b> ≈ {rupiah((b.qtyAmpun || 0) * (b.hargaSatuan || 0))}</>}
                </div>
                <div style={{
              ...FI,
              fontSize: 12.5,
              marginTop: 5
            }}>"{b.keterangan}"</div>
                <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginTop: 4
            }}>
                  Diajukan {b.diajukanOleh} · {new Date(b.diajukanAt).toLocaleString("id-ID")}
                  {b.diputuskanOleh && <> · diputuskan {b.diputuskanOleh} · {new Date(b.diputuskanAt).toLocaleString("id-ID")}{b.catatanDireksi ? <> — <i>"{b.catatanDireksi}"</i></> : null}</>}
                </div>
              </div>
              {bisaPutus && b.status === "pending" && <BandingKeputusan b={b} onDecide={hasil => putuskan(b, hasil)} />}
            </div>
          </div>;
    })}
    </div>;
}
function WasteMatrixTab({
  calc,
  valueOf,
  judul,
  catatan,
  filename,
  totalLabel,
  colorize,
  store,
  month,
  stores,
  markBanding,
  headerAction
}) {
  const days = calc.days;
  const rowsBahan = calc.list.filter(x => days.some(d => valueOf(d.rows[x.bahan.id], x) != null));
  const tot = x => days.reduce((s, d) => {
    const v = valueOf(d.rows[x.bahan.id], x);
    return v == null ? s : s + v;
  }, 0);
  const warna = v => !colorize || v == null || v === 0 ? T.ink : v < 0 ? T.bad : T.good;
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title={`${judul} — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`]} filename={`${filename}_${store}_${month}`} columns={[{
        key: "bahan",
        label: "Bahan Baku"
      }, ...days.map(d => ({
        key: d.date,
        label: d.date.slice(8)
      })), {
        key: "total",
        label: totalLabel
      }]} rows={rowsBahan.map(x => ({
        bahan: x.bahan.name,
        ...Object.fromEntries(days.map(d => [d.date, valueOf(d.rows[x.bahan.id], x) == null ? "" : wasteFmtQty(valueOf(d.rows[x.bahan.id], x))])),
        total: wasteFmtQty(tot(x))
      }))} />
        {headerAction}
      </div>
      {catatan && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 12,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10,
      lineHeight: 1.6
    }} className="ais-content-panel">{catatan}</div>}
      {days.length === 0 ? <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted,
      padding: 28,
      textAlign: "center",
      background: T.surfaceSunk,
      borderRadius: 14
    }} className="ais-content-panel">Belum ada laporan sales pada periode ini.</div> : <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto",
      maxHeight: 560
    }} className="ais-content-panel">
          <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 11.5
      }}>
            <thead>
              <tr style={THBG}>
                <th style={{
              ...TH,
              position: "sticky",
              left: 0,
              top: 0,
              background: T.surfaceSunk,
              zIndex: 2,
              minWidth: 190
            }}>Bahan Baku</th>
                {days.map(d => <th key={d.date} style={{
              ...TH,
              position: "sticky",
              top: 0,
              background: T.surfaceSunk,
              textAlign: "right",
              padding: "9px 8px"
            }}>{d.date.slice(8)}</th>)}
                <th style={{
              ...TH,
              position: "sticky",
              top: 0,
              background: T.surfaceSunk,
              textAlign: "right"
            }}>{totalLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rowsBahan.map(x => <tr key={x.bahan.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                  <td style={{
              ...TD,
              position: "sticky",
              left: 0,
              background: T.surface,
              fontWeight: 600
            }}>
                    {x.bahan.name} <span style={{
                color: T.inkMuted,
                fontWeight: 400
              }}>({x.unit})</span>
                    {x.mirror && <span style={{
                marginLeft: 6
              }}><Badge tone="warn">mirror</Badge></span>}
                    {markBanding && x.adaBanding && <span style={{
                marginLeft: 6
              }}><Badge tone="manajemen">ada banding</Badge></span>}
                  </td>
                  {days.map(d => {
              const r = d.rows[x.bahan.id];
              const v = valueOf(r, x);
              const bl = markBanding ? r?.banding || [] : [];
              if (!bl.length) return <td key={d.date} style={{
                padding: "7px 8px",
                textAlign: "right",
                ...FM,
                color: warna(v)
              }}>{v == null ? "—" : wasteFmtQty(v)}</td>;
              const pending = bl.some(b => b.status === "pending");
              const berubah = (r.ampunBanding || 0) > 0;
              const riwayat = bl.map(b => `${BANDING_STATUS[b.status]?.label || b.status} — diajukan ${b.diajukanOleh}${b.diputuskanOleh ? `, diputuskan ${b.diputuskanOleh}` : ""}${b.qtyAmpun ? `, diampuni ${wasteFmtQty(b.qtyAmpun)}` : ""}`).join("\n");
              return <td key={d.date} title={`Awal: ${wasteFmtQty(r.selisihAwal)} → Sekarang: ${wasteFmtQty(v)}\n${riwayat}`} style={{
                padding: "7px 8px",
                textAlign: "right",
                ...FM,
                color: warna(v),
                background: berubah ? T.goodSoft : pending ? T.warnSoft : "transparent",
                cursor: "help"
              }}>
                        {berubah && <div style={{
                  fontSize: 9.5,
                  color: T.inkMuted,
                  textDecoration: "line-through"
                }}>{wasteFmtQty(r.selisihAwal)}</div>}
                        {v == null ? "—" : wasteFmtQty(v)}<span style={{
                  fontSize: 9,
                  marginLeft: 2,
                  color: pending ? T.warn : T.manajemen,
                  fontWeight: 700
                }}>{pending ? "●" : "✎"}</span>
                      </td>;
            })}
                  <td style={{
              padding: "7px 12px",
              textAlign: "right",
              ...FM,
              fontWeight: 700,
              color: warna(tot(x))
            }}>{wasteFmtQty(tot(x))}</td>
                </tr>)}
            </tbody>
          </table>
        </div>}
      {markBanding && days.length > 0 && <WasteBandingLog calc={calc} />}
    </div>;
}

// Log perubahan sel Waste Daily akibat banding: nilai awal → nilai sekarang, siapa & kapan.
function WasteBandingLog({
  calc
}) {
  const log = [];
  calc.days.forEach(d => calc.list.forEach(x => {
    const r = d.rows[x.bahan.id];
    (r?.banding || []).forEach(b => log.push({
      d,
      x,
      r,
      b
    }));
  }));
  log.sort((a, b) => (b.b.diputuskanAt || b.b.diajukanAt).localeCompare(a.b.diputuskanAt || a.b.diajukanAt));
  return <div style={{
    marginTop: 16
  }}>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 8,
      display: "flex",
      gap: 14,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <span><span style={{
          color: T.warn,
          fontWeight: 700
        }}>●</span> banding menunggu Direksi</span>
        <span><span style={{
          color: T.manajemen,
          fontWeight: 700
        }}>✎</span> ada riwayat banding (arahkan kursor ke sel untuk detail)</span>
        <span><span style={{
          display: "inline-block",
          width: 10,
          height: 10,
          background: T.goodSoft,
          borderRadius: 2,
          verticalAlign: "middle"
        }} /> nilai berubah karena banding diterima; angka dicoret = nilai awal</span>
      </div>
      <div style={{
      ...FB,
      fontWeight: 700,
      fontSize: 15,
      marginBottom: 6
    }}>Log Perubahan karena Banding</div>
      {log.length === 0 ? <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted
    }}>Belum ada banding di periode ini.</div> : <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      overflow: "auto"
    }} className="ais-content-panel">
          <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12,
        minWidth: 720
      }}>
            <thead><tr style={THBG}>{["Tanggal", "Bahan", "Status", "Awal", "Sekarang", "Diajukan", "Diputuskan"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {log.map(({
            d,
            x,
            r,
            b
          }) => <tr key={b.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                  <td style={{
              ...TD,
              ...FM
            }}>{d.date}</td>
                  <td style={{
              ...TD,
              fontWeight: 600
            }}>{x.bahan.name}</td>
                  <td style={TD}><Badge tone={BANDING_STATUS[b.status]?.tone}>{BANDING_STATUS[b.status]?.label}</Badge></td>
                  <td style={{
              ...TD,
              ...FM,
              color: T.bad
            }}>{wasteFmtQty(r.selisihAwal)} {x.unit}</td>
                  <td style={{
              ...TD,
              ...FM,
              color: (r.selisih || 0) < 0 ? T.bad : T.good
            }}>{wasteFmtQty(r.selisih)} {x.unit}</td>
                  <td style={{
              ...TD,
              color: T.inkMuted
            }}>{b.diajukanOleh} · {new Date(b.diajukanAt).toLocaleString("id-ID")}</td>
                  <td style={{
              ...TD,
              color: T.inkMuted
            }}>{b.diputuskanOleh ? `${b.diputuskanOleh} · ${new Date(b.diputuskanAt).toLocaleString("id-ID")}` : "—"}</td>
                </tr>)}
            </tbody>
          </table>
        </div>}
    </div>;
}
function WasteTheoLinesTab({
  calc,
  store,
  month,
  stores
}) {
  const days = calc.days;
  const kolom = WASTE_CUTS;
  const tot = fn => days.reduce((s, d) => s + fn(d), 0);
  return <div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 12,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10,
      lineHeight: 1.6
    }} className="ais-content-panel">
        Ayam Original dijual per potongan, tapi dibeli per pack (1 pack = 2 PA + 2 PB + 2 SW + 3 DD). <b>Pack Terbuka</b> = jumlah pack terkecil yang harus dibuka agar semua potongan terjual tercukupi:
        <b> MAX( CEILING(DD/3), CEILING(SW/2), CEILING(PB/2), CEILING(PA/2) )</b>. <b>Sisa Potongan</b> = pack terbuka × isi per pack − potongan terjual. Pack Terbuka inilah yang menjadi TheoWide Ayam Original.
      </div>
      <div style={{
      marginBottom: 12
    }}>
        <ExportButtons title={`TheoLines Ayam — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`]} filename={`theolines-ayam_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, ...kolom.map(c => ({
        key: `p${c.label}`,
        label: `Terjual ${c.label}`
      })), {
        key: "pack",
        label: "Pack Terbuka"
      }, ...kolom.map(c => ({
        key: `s${c.label}`,
        label: `Sisa ${c.label}`
      }))]} rows={days.map(d => ({
        tanggal: d.date,
        ...Object.fromEntries(kolom.map(c => [`p${c.label}`, d.lines.potongan[c.id]])),
        pack: d.lines.packTerbuka,
        ...Object.fromEntries(kolom.map(c => [`s${c.label}`, d.lines.sisa[c.id]]))
      }))} />
      </div>
      {days.length === 0 ? <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted,
      padding: 28,
      textAlign: "center",
      background: T.surfaceSunk,
      borderRadius: 14
    }} className="ais-content-panel">Belum ada laporan sales pada periode ini.</div> : <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
          <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
            <thead>
              <tr style={THBG}>
                <th style={TH}>Tanggal</th>
                {kolom.map(c => <th key={c.id} style={{
              ...TH,
              textAlign: "right"
            }}>Terjual {c.label}</th>)}
                <th style={{
              ...TH,
              textAlign: "right"
            }}>Pack Terbuka</th>
                {kolom.map(c => <th key={`s${c.id}`} style={{
              ...TH,
              textAlign: "right"
            }}>Sisa {c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(d => <tr key={d.date} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                  <td style={TD}>{d.date}</td>
                  {kolom.map(c => <td key={c.id} style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{d.lines.potongan[c.id]}</td>)}
                  <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              fontWeight: 700
            }}>{d.lines.packTerbuka}</td>
                  {kolom.map(c => <td key={`s${c.id}`} style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: d.lines.sisa[c.id] > 0 ? T.warn : T.inkMuted
            }}>{d.lines.sisa[c.id]}</td>)}
                </tr>)}
              <tr style={{
            borderTop: `2px solid ${T.line}`,
            background: T.surfaceSunk
          }}>
                <td style={{
              ...TD,
              fontWeight: 700
            }}>Total</td>
                {kolom.map(c => <td key={c.id} style={{
              ...TD,
              textAlign: "right",
              ...FM,
              fontWeight: 700
            }}>{tot(d => d.lines.potongan[c.id])}</td>)}
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              fontWeight: 700
            }}>{tot(d => d.lines.packTerbuka)}</td>
                {kolom.map(c => <td key={`s${c.id}`} style={{
              ...TD,
              textAlign: "right",
              ...FM,
              fontWeight: 700
            }}>{tot(d => d.lines.sisa[c.id])}</td>)}
              </tr>
            </tbody>
          </table>
        </div>}
    </div>;
}
function WastePriceTab({
  calc,
  store,
  month,
  stores,
  allStoresSummary
}) {
  const t = calc.totals;
  const rows = calc.list.filter(x => x.hariData > 0).sort((a, b) => a.nilaiMinus - b.nilaiMinus);
  return <div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 12,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10,
      lineHeight: 1.6
    }} className="ais-content-panel">
        Nilai waste = total selisih <b>minus</b> tiap bahan × harga rata-rata pembelian bulan ini (sama seperti harga stok akhir di PnL). Selisih plus (surplus) tidak mengurangi total kerugian.
        Harga bertanda <b>°</b> memakai harga master karena belum ada pembelian bahan itu.
      </div>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Nilai Waste (minus)" value={wasteRp(t.nilaiMinus)} tone={t.nilaiMinus < 0 ? "bad" : "good"} />
        <StatCard label="% terhadap TheoWide Sebulan" value={wastePct(t.pctTheo)} tone="warn" />
        <StatCard label="% terhadap Omset" value={wastePct(t.pctOmset)} tone="warn" />
      </div>
      <div style={{
      ...FI,
      fontSize: 12,
      fontWeight: 700,
      marginBottom: 8
    }}>Ringkasan per toko — {month}</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 22
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead><tr style={THBG}>{["Toko", "Nilai Waste", "% TheoWide", "% Omset"].map((h, i) => <th key={h} style={{
              ...TH,
              textAlign: i ? "right" : "left"
            }}>{h}</th>)}</tr></thead>
          <tbody>
            {allStoresSummary.map(r => <tr key={r.storeId} style={{
            borderTop: `1px solid ${T.line}`,
            background: r.storeId === store ? T.accentSoft : "transparent"
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{r.name}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: r.totals.nilaiMinus < 0 ? T.bad : T.good
            }}>{wasteRp(r.totals.nilaiMinus)}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{wastePct(r.totals.pctTheo)}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{wastePct(r.totals.pctOmset)}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
      <div style={{
      marginBottom: 12
    }}>
        <ExportButtons title={`Waste Price — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total Nilai Waste: ${wasteRp(t.nilaiMinus)}`]} filename={`waste-price_${store}_${month}`} columns={[{
        key: "bahan",
        label: "Bahan Baku"
      }, {
        key: "harga",
        label: "Harga Rata-rata"
      }, {
        key: "minus",
        label: "Total Selisih Minus"
      }, {
        key: "nilai",
        label: "Nilai Minus (Rp)"
      }, {
        key: "pct",
        label: "% Minus vs TheoWide"
      }]} rows={rows.map(x => ({
        bahan: x.bahan.name,
        harga: Math.round(x.harga),
        minus: wasteFmtQty(x.minusQty),
        nilai: Math.round(x.nilaiMinus),
        pct: x.totalTheo ? wastePct(-x.minusQty / x.totalTheo) : "—"
      }))} />
      </div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto",
      maxHeight: 520
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead><tr style={THBG}>{["Bahan Baku", "Harga Rata-rata", "Total TheoWide", "Selisih Minus", "Nilai Minus", "% Minus vs TheoWide"].map((h, i) => <th key={h} style={{
              ...TH,
              textAlign: i ? "right" : "left",
              position: "sticky",
              top: 0,
              background: T.surfaceSunk
            }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(x => <tr key={x.bahan.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{x.bahan.name} <span style={{
                color: T.inkMuted,
                fontWeight: 400
              }}>({x.unit})</span>{x.mirror && <span style={{
                marginLeft: 6
              }}><Badge tone="warn">mirror</Badge></span>}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{rupiah(x.harga)}{x.hargaSumber === "master" ? "°" : ""}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{wasteFmtQty(x.totalTheo)}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: x.minusQty < 0 ? T.bad : T.inkMuted
            }}>{wasteFmtQty(x.minusQty)}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM,
              color: x.nilaiMinus < 0 ? T.bad : T.inkMuted
            }}>{wasteRp(x.nilaiMinus)}</td>
                <td style={{
              ...TD,
              textAlign: "right",
              ...FM
            }}>{x.totalTheo ? wastePct(-x.minusQty / x.totalTheo) : "—"}</td>
              </tr>)}
            {rows.length === 0 && <tr><td colSpan={6} style={{
              ...TD,
              textAlign: "center",
              color: T.inkMuted,
              padding: 24
            }}>Belum ada data selisih pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>;
}
function WasteHomeTab({
  summaries
}) {
  return <div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10,
      lineHeight: 1.6
    }} className="ais-content-panel">
        Ringkasan waste berjalan per toko untuk bulan yang dipilih. Yang dihitung hanya selisih minus; 3 bahan minus terbesar dan 3 bahan plus terbesar diurutkan berdasarkan nilai rupiah.
      </div>
      <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
      gap: 16
    }} className="ais-responsive-grid">
        {summaries.map(s => {
        const aktif = s.calc.list.filter(x => x.hariData > 0);
        const minus = aktif.filter(x => x.nilaiMinus < 0).sort((a, b) => a.nilaiMinus - b.nilaiMinus).slice(0, 3);
        const plus = aktif.filter(x => x.nilaiPlus > 0).sort((a, b) => b.nilaiPlus - a.nilaiPlus).slice(0, 3);
        const t = s.calc.totals;
        return <div key={s.storeId} style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 18
        }} className="ais-content-panel">
              <div style={{
            ...FB,
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 2
          }}>{s.name}</div>
              <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 12
          }}>{s.calc.days.length} hari terhitung</div>
              <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            fontWeight: 700,
            textTransform: "uppercase"
          }}>Nilai minus berjalan</div>
              <div style={{
            ...FM,
            fontSize: 22,
            fontWeight: 700,
            color: t.nilaiMinus < 0 ? T.bad : T.good,
            marginBottom: 2
          }}>{wasteRp(t.nilaiMinus)}</div>
              <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            marginBottom: 14
          }}>{wastePct(t.pctOmset)} dari omset berjalan ({rupiah(t.omset)})</div>
              <div style={{
            ...FI,
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 4,
            color: T.bad
          }}>3 bahan minus terbesar</div>
              {minus.length === 0 ? <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            marginBottom: 10
          }}>—</div> : minus.map(x => <div key={x.bahan.id} style={{
            display: "flex",
            justifyContent: "space-between",
            ...FI,
            fontSize: 12.5,
            padding: "3px 0"
          }}><span>{x.bahan.name}</span><span style={{
              ...FM,
              color: T.bad
            }}>{wasteRp(x.nilaiMinus)}</span></div>)}
              <div style={{
            ...FI,
            fontSize: 11,
            fontWeight: 700,
            margin: "10px 0 4px",
            color: T.good
          }}>3 bahan plus terbesar</div>
              {plus.length === 0 ? <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted
          }}>—</div> : plus.map(x => <div key={x.bahan.id} style={{
            display: "flex",
            justifyContent: "space-between",
            ...FI,
            fontSize: 12.5,
            padding: "3px 0"
          }}><span>{x.bahan.name}</span><span style={{
              ...FM,
              color: T.good
            }}>+{rupiah(x.nilaiPlus)}</span></div>)}
            </div>;
      })}
      </div>
    </div>;
}
function WasteCalculationPage({
  stores,
  allStores,
  bahan,
  products,
  reportLog,
  purchaseReports,
  minyakConfig,
  homeOnly,
  banding,
  setBanding,
  currentUser
}) {
  const [bandingOpen, setBandingOpen] = useState(false);
  const [tab, setTab] = useState("home");
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [pakaiToleransi, setPakaiToleransi] = useState(true);
  const semuaTab = [{
    key: "home",
    label: "Home"
  }, {
    key: "theolines",
    label: "TheoLines Ayam"
  }, {
    key: "theowide",
    label: "TheoWide"
  }, {
    key: "daily",
    label: "Waste Daily"
  }, {
    key: "price",
    label: "Waste Price"
  }, {
    key: "demand",
    label: "DemandWide"
  }];
  const storeIds = stores.map(s => s.id);
  const bandingPending = (banding || []).filter(b => b.status === "pending" && storeIds.includes(b.storeId)).length;
  semuaTab.push({
    key: "banding",
    label: `Banding${bandingPending ? ` (${bandingPending})` : ""}`
  });
  // SPV: Home, Waste Daily (lihat saja + ajukan banding), dan status Banding.
  const tabs = homeOnly ? semuaTab.filter(t => ["home", "daily", "banding"].includes(t.key)) : semuaTab;
  const ajukanBanding = data => {
    setBanding([...(banding || []), {
      id: `bd_${Date.now()}`,
      storeId: store,
      ...data,
      status: "pending",
      qtyAmpun: 0,
      diajukanOleh: currentUser.name,
      diajukanOlehId: currentUser.id,
      diajukanAt: new Date().toISOString(),
      log: [{
        aksi: "diajukan",
        oleh: currentUser.name,
        at: new Date().toISOString()
      }]
    }]);
    setBandingOpen(false);
  };
  const summaries = useMemo(() => stores.map(s => ({
    storeId: s.id,
    name: s.name,
    calc: hitungWasteBulan({
      storeId: s.id,
      stores: allStores || stores,
      month,
      reportLog,
      products,
      bahan,
      purchaseReports,
      minyakConfig,
      pakaiToleransi,
      banding
    })
  })).map(x => ({
    ...x,
    totals: x.calc.totals
  })), [stores, allStores, month, reportLog, products, bahan, purchaseReports, minyakConfig, pakaiToleransi, banding]);
  const calc = summaries.find(s => s.storeId === store)?.calc || summaries[0]?.calc;
  const common = {
    calc,
    store,
    month,
    stores
  };
  return <div>
      <SectionTitle icon={FileBarChart2}>Waste Calculation</SectionTitle>
      {tabs.length > 1 && <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      maxWidth: homeOnly ? 420 : 820
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>}
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        {homeOnly && tab === "home" ? <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" /> : <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />}
        {!homeOnly && <label style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer"
      }}>
          <input type="checkbox" checked={pakaiToleransi} onChange={e => setPakaiToleransi(e.target.checked)} className="ais-control" />
          TheoWide memakai toleransi BOM
        </label>}
      </div>
      {calc?.mirrorTidakKetemu?.length > 0 && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.warn,
      marginBottom: 12,
      background: T.warnSoft,
      padding: "8px 12px",
      borderRadius: 10
    }}>
          Bahan mirror belum ada di Master Bahan Baku: {calc.mirrorTidakKetemu.join(", ")}.
        </div>}
      {tab === "home" && <WasteHomeTab summaries={summaries} />}
      {tab === "theolines" && calc && <WasteTheoLinesTab {...common} />}
      {tab === "theowide" && calc && <WasteMatrixTab {...common} valueOf={r => r ? r.theo : null} judul="TheoWide" filename="theowide" totalLabel="Total" catatan="TheoWide = qty terjual × BOM. Ayam Original = Pack Terbuka (TheoLines). Minyak Goreng memakai rumus khusus: (Ayam Utuh + Ayam Original + Hotwings ÷ 7 × 3 + Kulit Ayam ÷ 12 × 3) × 0,1 × 1,15 (angka bisa diatur di Master Minyak). Bahan bertanda mirror diambil dari Out Toko crew." />}
      {tab === "daily" && calc && <>
        {bandingOpen && <BandingForm calc={calc} store={store} stores={stores} banding={banding} onSubmit={ajukanBanding} onCancel={() => setBandingOpen(false)} />}
        <WasteMatrixTab {...common} valueOf={r => r ? r.selisih : null} judul="Waste Daily" filename="waste-daily" totalLabel="Total" colorize markBanding headerAction={homeOnly && !bandingOpen && <button onClick={() => setBandingOpen(true)} style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        borderRadius: 9,
        padding: "9px 14px",
        background: T.accent,
        color: "#fff",
        ...FI,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer"
      }} className="ais-button ais-button--primary ais-flex-layout">
              <AlertTriangle size={14} /> Ajukan Banding / Komplain
            </button>} catatan="Selisih = TheoWide − Out Toko (merah = minus/kerugian, hijau = plus). Minyak Goreng memakai susut fryer 1 hari, bukan Out Toko. Selisih Cabe ditambah tangkai cabe (gr) dan selisih Hotwings ditambah sisa matang Shift 2, sehingga kerugian berkurang. Bahan mirror selalu 0." />
        </>}
      {tab === "price" && calc && <WastePriceTab {...common} allStoresSummary={summaries} />}
      {tab === "banding" && <WasteBandingTab banding={banding} setBanding={setBanding} store={store} stores={stores} month={month} currentUser={currentUser} />}
      {tab === "demand" && calc && <WasteMatrixTab {...common} valueOf={r => r ? r.demand : null} judul="DemandWide" filename="demandwide" totalLabel="Total" catatan="DemandWide = nilai terkecil antara TheoWide dan Out Toko. Pengecualian Minyak Goreng: diambil dari total Top Up 1 + 2 pada laporan produksi. Contoh: saos TheoWide 12, Out Toko 19 → DemandWide 12." />}
    </div>;
}
function RekapKerjaHarianPage({
  employees,
  laporanManajemen,
  customTasks,
  setCustomTasks,
  currentUser
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openKey, setOpenKey] = useState(null);
  const [taskFor, setTaskFor] = useState("");
  const [taskText, setTaskText] = useState("");

  // Kunci laporan: `${empId}_${tanggal}` — sama dengan yang ditulis mobile app.
  const rows = Object.entries(laporanManajemen || {}).filter(([k]) => k.slice(-10).startsWith(month)).map(([k, v]) => {
    const empId = k.slice(0, k.length - 11);
    const tanggal = k.slice(-10);
    const list = v.checklist || {};
    const total = Object.keys(list).length;
    const selesai = Object.values(list).filter(x => taskItemStatus(x) === "done").length; // hanya status Done yang dihitung selesai
    return {
      key: k,
      empId,
      emp: employees.find(e => e.id === empId),
      tanggal,
      checklist: list,
      total,
      selesai,
      data: v
    };
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const kandidat = employees.filter(e => ["manajemen", "spv", "tl"].includes(e.group) && e.status === "aktif");
  const bisaTugaskan = currentUser?.access === "all";
  const tambahTugas = () => {
    if (!taskFor || !taskText.trim()) return;
    // "label" & "mandatory" dipakai mobile app; "text" disimpan untuk data lama.
    setCustomTasks([...(customTasks || []), {
      id: `task_${Date.now()}`,
      empId: taskFor,
      label: taskText.trim(),
      text: taskText.trim(),
      mandatory: true,
      by: currentUser.name,
      at: new Date().toISOString(),
      status: "open"
    }]);
    setTaskText("");
  };
  const tugasAktif = (customTasks || []).filter(t => t.status !== "done" && !t.resolved);
  const [tabRekap, setTabRekap] = useState("karyawan");
  return <div>
      <SectionTitle icon={FileBarChart2} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Laporan Kerja Harian — ${month}`} meta={[`Periode: ${month}`, `Jumlah laporan: ${rows.length}`]} filename={`rekap-kerja-harian_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "nama",
        label: "Nama"
      }, {
        key: "jabatan",
        label: "Jabatan"
      }, {
        key: "selesai",
        label: "Tugas Selesai"
      }, {
        key: "total",
        label: "Total Tugas"
      }, {
        key: "persen",
        label: "% Selesai"
      }]} rows={rows.map(r => ({
        tanggal: r.tanggal,
        nama: r.emp?.name || r.empId,
        jabatan: r.emp?.jabatan || "-",
        selesai: r.selesai,
        total: r.total,
        persen: r.total ? Math.round(r.selesai / r.total * 100) + "%" : "-"
      }))} />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap Daily Task</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Checklist daily task yang diisi Manajemen &amp; SPV/TL sebelum clock out. Task berasal dari <b>Master Data → Master Task Karyawan</b>; Direksi juga dapat menambahkan tugas khusus sekali pakai di bawah.
        Yang dihitung selesai hanya task berstatus <b>Done</b>.
      </div>

      {bisaTugaskan && <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20
    }} className="ais-content-panel">
          <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 10
      }}>Tugaskan Pekerjaan Khusus</div>
          <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "flex-end"
      }} className="ais-flex-layout">
            <select value={taskFor} onChange={e => setTaskFor(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface,
          minWidth: 190
        }} className="ais-control">
              <option value="">Pilih karyawan…</option>
              {kandidat.map(e => <option key={e.id} value={e.id}>{e.name} — {e.jabatan}</option>)}
            </select>
            <input value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Uraian tugas" style={{
          flex: 1,
          minWidth: 240,
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "9px 12px",
          ...FI,
          fontSize: 13
        }} className="ais-control" />
            <button onClick={tambahTugas} disabled={!taskFor || !taskText.trim()} style={{
          border: "none",
          borderRadius: 9,
          padding: "9px 16px",
          background: taskFor && taskText.trim() ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: taskFor && taskText.trim() ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--default">Tugaskan</button>
          </div>
          {tugasAktif.length > 0 && <div style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px solid ${T.line}`
      }}>
              <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 5
        }}>Tugas Aktif ({tugasAktif.length})</div>
              {tugasAktif.map(t => <div key={t.id} style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          padding: "3px 0"
        }}>
                  <b style={{
            color: T.ink
          }}>{employees.find(e => e.id === t.empId)?.name || t.empId}</b> — {t.label || t.text} <span style={{
            fontSize: 11
          }}>(oleh {t.by})</span>
                </div>)}
            </div>}
        </div>}

      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 320
    }} className="ais-flex-layout ais-content-panel">
        {[{
        key: "karyawan",
        label: "Per Karyawan / Hari"
      }, {
        key: "task",
        label: "Per Task"
      }].map(t => <button key={t.key} onClick={() => setTabRekap(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tabRekap === t.key ? T.surface : "transparent",
        color: tabRekap === t.key ? T.ink : T.inkMuted,
        boxShadow: tabRekap === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tabRekap === t.key}>{t.label}</button>)}
      </div>
      {tabRekap === "task" && <RekapDailyTaskPerTask rows={rows} employees={employees} />}

      {tabRekap === "karyawan" && <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 620
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Nama", "Jabatan", "Progress", "Status", ""].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada laporan kerja harian untuk bulan ini.</td></tr>}
            {rows.map(r => {
            const buka = openKey === r.key;
            const pct = r.total ? Math.round(r.selesai / r.total * 100) : 0;
            return <Fragment key={r.key}>
                  <tr onClick={() => setOpenKey(buka ? null : r.key)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: buka ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{r.tanggal}</td>
                    <td style={{
                  ...TD,
                  fontWeight: 600
                }}>{r.emp?.name || r.empId}</td>
                    <td style={{
                  ...TD,
                  color: T.inkMuted
                }}>{r.emp?.jabatan || "-"}</td>
                    <td style={{
                  ...TD,
                  ...FM
                }}>{r.selesai} / {r.total}</td>
                    <td style={TD}><Badge tone={pct === 100 ? "good" : pct >= 60 ? "warn" : "bad"}>{pct}%</Badge></td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: buka ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {buka && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={6} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <div style={{
                    ...FI,
                    fontSize: 10.5,
                    color: T.inkMuted,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6
                  }}>Checklist Tugas</div>
                        {Object.entries(r.checklist).map(([tugas, nilai]) => {
                    const st = taskItemStatus(nilai);
                    const selesai = st === "done";
                    const meta = (r.data.items || []).find(i => i.label === tugas);
                    return <div key={tugas} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      ...FI,
                      fontSize: 12.5,
                      padding: "3px 0",
                      flexWrap: "wrap"
                    }} className="ais-flex-layout">
                              {selesai ? <Check size={13} color={T.good} style={{
                        flexShrink: 0
                      }} /> : <span style={{
                        width: 13,
                        height: 13,
                        border: `1.5px solid ${T.line}`,
                        borderRadius: 4,
                        flexShrink: 0
                      }} />}
                              <span style={{
                        color: selesai ? T.ink : T.inkMuted
                      }}>{tugas}</span>
                              {meta?.mandatory && <Badge tone="bad">Wajib</Badge>}
                              {st && !selesai && <Badge tone={st === "pending" ? "warn" : "bad"}>{TASK_STATUS_LABEL[st] || st}</Badge>}
                              {nilai?.keterangan && <span style={{
                        fontSize: 11.5,
                        color: T.inkMuted
                      }}>— {nilai.keterangan}</span>}
                            </div>;
                  })}
                        {r.data.submittedAt && <div style={{
                    ...FI,
                    fontSize: 11,
                    color: T.inkMuted,
                    marginTop: 8
                  }}>
                            Disubmit {new Date(r.data.submittedAt).toLocaleString("id-ID")}
                            {r.data.editedAt ? ` · diedit ${new Date(r.data.editedAt).toLocaleString("id-ID")}` : ""}
                          </div>}
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>}
    </div>;
}
function RekapSambelCiprekTab({
  stores,
  reportLog,
  products,
  bahan,
  ciprekConfig
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openDate, setOpenDate] = useState(null);
  const days = useMemo(() => dayEntries(reportLog, store, month), [reportLog, store, month]);
  const sopItems = ciprekSopItems(products, bahan);
  const anchorMap = ciprekConfig?.[store]?.anchors || {};
  const rows = days.map(d => {
    const sesi = [d.data.base_prep?.sambelCiprek, d.data.base_prep_2?.sambelCiprek].map((s, i) => s && s.jumlahCabe ? {
      ...s,
      shift: i + 1
    } : null);
    const cabe = sesi.reduce((a, s) => a + (s?.jumlahCabe || 0), 0);
    const cup = sesi.reduce((a, s) => a + (s?.jumlahCup || 0), 0);
    const targetCup = sesi.reduce((a, s) => a + (s?.targetCup || 0), 0);
    const totalJadi = sesi.reduce((a, s) => a + (s?.totalJadi || 0), 0);
    const sisaGr = sesi.reduce((a, s) => a + (s?.sisaSambal || 0), 0);
    const sisaCup = d.data.produksi_shift2?.sisaCiprekCup ?? null;
    return {
      date: d.date,
      sesi,
      cabe,
      cup,
      targetCup,
      totalJadi,
      sisaGr,
      sisaCup,
      adaData: cabe > 0
    };
  }).filter(r => r.adaData);
  const totCabe = rows.reduce((a, r) => a + r.cabe, 0);
  const totCup = rows.reduce((a, r) => a + r.cup, 0);
  const totTarget = rows.reduce((a, r) => a + r.targetCup, 0);
  const totSisaCup = rows.reduce((a, r) => a + (r.sisaCup || 0), 0);
  const akurasi = totTarget ? Math.round(totCup / totTarget * 100) : 0;
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title={`Rekap Sambal Ciprek — ${stores.find(s => s.id === store)?.name} — ${month}`} meta={[`Toko: ${stores.find(s => s.id === store)?.name}`, `Periode: ${month}`, `Total cabe: ${totCabe} gr · ${totCup} cup`]} filename={`rekap-ciprek_${store}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "shift",
        label: "Sesi"
      }, {
        key: "frs_ca_01_001",
        label: "Cabe (gr)"
      }, {
        key: "targetCup",
        label: "Target Cup"
      }, {
        key: "jumlahCup",
        label: "Cup Aktual"
      }, {
        key: "selisihCup",
        label: "Selisih Cup"
      }, {
        key: "teoritis",
        label: "Teoritis (gr)"
      }, {
        key: "totalJadi",
        label: "Aktual Jadi (gr)"
      }, {
        key: "selisihGr",
        label: "Selisih (gr)"
      }, {
        key: "sisaSambal",
        label: "Sisa Sambal (gr)"
      }]} rows={rows.flatMap(r => r.sesi.filter(Boolean).map(s => {
        const t = hitungCiprek(s.jumlahCabe, sopItems, anchorMap);
        return {
          tanggal: r.date,
          shift: `Base Prep ${s.shift}`,
          cabe: s.jumlahCabe,
          targetCup: s.targetCup,
          jumlahCup: s.jumlahCup,
          selisihCup: s.jumlahCup - s.targetCup,
          teoritis: t.totalSambalJadi,
          totalJadi: s.totalJadi,
          selisihGr: Math.round((s.totalJadi - t.totalSambalJadi) * 10) / 10,
          sisaSambal: s.sisaSambal
        };
      }))} />
        <RekapFilterBar store={store} setStore={setStore} stores={stores} month={month} setMonth={setMonth} />
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Cabe Terpakai" value={`${totCabe} gr`} />
        <StatCard label="Total Cup Dihasilkan" value={`${totCup} cup`} tone="good" />
        <StatCard label="Sisa Ciprek Akhir Hari" value={`${totSisaCup} cup`} tone={totSisaCup > 0 ? "warn" : "good"} />
        <StatCard label="Akurasi vs Target" value={`${akurasi}%`} tone={akurasi >= 100 ? "good" : akurasi >= 90 ? "warn" : "bad"} />
      </div>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>
        Klik tanggal untuk melihat rincian per sesi beserta perbandingan hasil aktual terhadap ringkasan produksi teoritis.
      </div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 620
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Pakai Cabe", "Cup Dihasilkan", "Sisa Ciprek (Akhir Hari)", ""].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada produksi sambal untuk toko &amp; bulan ini.</td></tr>}
            {rows.map(r => {
            const isOpen = openDate === r.date;
            return <Fragment key={r.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : r.date)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{r.date}</td>
                    <td style={{
                  ...TD,
                  ...FM
                }}>{r.cabe} gr</td>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 700
                }}>{r.cup} cup</td>
                    <td style={TD}>{r.sisaCup != null ? `${r.sisaCup} cup` : <span style={{
                    color: T.inkMuted
                  }}>-</span>}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={5} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16
                  }} className="ais-responsive-grid">
                          {r.sesi.map((s, i) => {
                      if (!s) return <div key={i} style={{
                        ...FI,
                        fontSize: 12.5,
                        color: T.inkMuted
                      }}>Base Prep {i + 1}: tidak ada produksi sambal.</div>;
                      const t = hitungCiprek(s.jumlahCabe, sopItems, anchorMap);
                      const selisihGr = Math.round((s.totalJadi - t.totalSambalJadi) * 10) / 10;
                      const selisihCup = s.jumlahCup - s.targetCup;
                      const Baris = ({
                        label,
                        teori,
                        aktual,
                        selisih,
                        unit
                      }) => <tr style={{
                        borderTop: `1px solid ${T.line}`
                      }}>
                                <td style={{
                          padding: "4px 8px 4px 0",
                          color: T.inkMuted
                        }}>{label}</td>
                                <td style={{
                          padding: "4px 8px",
                          ...FM
                        }}>{teori}{unit}</td>
                                <td style={{
                          padding: "4px 8px",
                          ...FM,
                          fontWeight: 700
                        }}>{aktual}{unit}</td>
                                <td style={{
                          padding: "4px 0",
                          ...FM,
                          fontWeight: 700,
                          color: selisih === 0 ? T.good : selisih > 0 ? T.good : T.bad
                        }}>
                                  {selisih > 0 ? "+" : ""}{selisih}{unit}
                                </td>
                              </tr>;
                      return <div key={i}>
                                <div style={{
                          ...FB,
                          fontWeight: 700,
                          fontSize: 14,
                          marginBottom: 6
                        }}>Base Prep {s.shift} · cabe {s.jumlahCabe} gr</div>

                                <div style={{
                          ...FI,
                          fontSize: 10,
                          color: T.inkMuted,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          marginBottom: 3
                        }}>Bahan yang Seharusnya Dipakai</div>
                                <div style={{
                          ...FI,
                          fontSize: 11.5,
                          color: T.inkMuted,
                          marginBottom: 10
                        }}>
                                  {t.rows.map(b => `${b.bahanName} ${b.qtyFinal ?? "-"}`).join(" · ")}
                                </div>

                                <div style={{
                          ...FI,
                          fontSize: 10,
                          color: T.inkMuted,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          marginBottom: 3
                        }}>Teoritis vs Aktual</div>
                                <table style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          ...FI,
                          fontSize: 12
                        }}>
                                  <thead><tr style={{
                              textAlign: "left",
                              color: T.inkMuted
                            }}><th style={{
                                padding: "2px 8px 4px 0"
                              }}>Ukuran</th><th style={{
                                padding: "2px 8px"
                              }}>Teoritis</th><th style={{
                                padding: "2px 8px"
                              }}>Aktual</th><th style={{
                                padding: "2px 0"
                              }}>Selisih</th></tr></thead>
                                  <tbody>
                                    <Baris label="Sambal jadi" teori={t.totalSambalJadi} aktual={s.totalJadi} selisih={selisihGr} unit=" gr" />
                                    <Baris label="Jumlah cup" teori={s.targetCup} aktual={s.jumlahCup} selisih={selisihCup} unit=" cup" />
                                  </tbody>
                                </table>

                                <div style={{
                          ...FI,
                          fontSize: 11.5,
                          color: T.inkMuted,
                          marginTop: 8,
                          lineHeight: 1.7
                        }}>
                                  Sisa sambal tak ter-cup: <b style={{
                            color: T.ink
                          }}>{s.sisaSambal}</b> gr<br />
                                  Rata² per cup: <b style={{
                            color: T.ink
                          }}>{s.jumlahCup ? Math.round(s.totalJadi / s.jumlahCup * 10) / 10 : "-"}</b> gr
                                </div>

                                <div style={{
                          marginTop: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: selisihCup >= 0 ? T.goodSoft : T.badSoft,
                          color: selisihCup >= 0 ? T.good : T.bad,
                          padding: "5px 10px",
                          borderRadius: 999,
                          ...FI,
                          fontWeight: 600,
                          fontSize: 11
                        }}>
                                  {selisihCup >= 0 ? "Sesuai / melebihi target" : `Kurang ${Math.abs(selisihCup)} cup dari target`}
                                </div>

                                {(s.fotoTimbangan || s.fotoCup) && <div style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 10
                        }} className="ais-flex-layout">
                                    {s.fotoTimbangan && <img src={s.fotoTimbangan} alt="timbangan" style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: `1px solid ${T.line}`
                          }} />}
                                    {s.fotoCup && <img src={s.fotoCup} alt="cup" style={{
                            width: 64,
                            height: 64,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: `1px solid ${T.line}`
                          }} />}
                                  </div>}
                              </div>;
                    })}
                        </div>
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function RekapProduksiPage({
  stores,
  reportLog,
  products,
  bahan,
  ciprekConfig
}) {
  const [tab, setTab] = useState("produksi");
  const tabs = [{
    key: "produksi",
    label: "Produksi"
  }, {
    key: "etalase",
    label: "Etalase"
  }, {
    key: "oil_mi_01_001",
    label: "Minyak"
  }, {
    key: "sambel",
    label: "Sambel Ciprek"
  }];
  return <div>
      <SectionTitle icon={FileBarChart2}>Rekap Produksi</SectionTitle>
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 460
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>
      {tab === "produksi" && <RekapProduksiTab stores={stores} reportLog={reportLog} />}
      {tab === "etalase" && <RekapEtalaseTab stores={stores} reportLog={reportLog} />}
      {tab === "oil_mi_01_001" && <RekapMinyakTab stores={stores} reportLog={reportLog} />}
      {tab === "sambel" && <RekapSambelCiprekTab stores={stores} reportLog={reportLog} products={products} bahan={bahan} ciprekConfig={ciprekConfig} />}
    </div>;
}

/* ---------------------------------------------------------
   PAGE: PnL (PROFIT & LOSS)
--------------------------------------------------------- */
const BULAN_ID = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const PNL_DEFAULT = {
  pendapatanLain: 0,
  discPenjualan: 0,
  komisiOnline: 0,
  feeLainLain: 0,
  persediaanAwal: 0,
  pembelian: 0,
  ongkosKirim: 0,
  persediaanAkhir: 0,
  biayaOperasionalResto: 0,
  biayaGajiKaryawan: 0,
  biayaSewaTempat: 0,
  biayaPajakResto: 0,
  biayaPajakReklame: 0,
  biayaPenyusutan: 0,
  thr: 0,
  joinFee: 0,
  aplikasiPawoon: 0,
  biayaListrik: 0,
  biayaPdam: 0,
  biayaInternet: 0,
  biayaMaintenance: 0,
  toolsMarketing: 0,
  claimOffice: 0,
  jasaMarinir: 0,
  bonusOmset: 0,
  zakatPercent: 2.5,
  labaDitahan: 0,
  pengelolaPercent: 0
};
function PnLValueInput({
  value,
  onChange
}) {
  return <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} style={{
    width: 108,
    textAlign: "right",
    border: `1px solid ${T.line}`,
    borderRadius: 6,
    padding: "4px 7px",
    ...FM,
    fontSize: 11.5,
    background: T.surface
  }} className="ais-control" />;
}
function PnLRow({
  label,
  value,
  editable,
  onChange,
  bold,
  indent = 0,
  percent,
  highlight,
  sectionEnd,
  sign
}) {
  // sign: "minus" = kolom Beban, "plus" = kolom Pemasukan, undefined = baris Subtotal Kategori
  const borderTop = sectionEnd ? `1px solid ${T.line}` : "none";
  const cellPad = bold ? "6px 8px" : "3px 8px";
  return <tr style={{
    background: highlight ? T.accentSoft : "transparent"
  }}>
      <td style={{
      padding: cellPad,
      paddingLeft: indent,
      borderTop,
      ...FI,
      fontWeight: bold ? 700 : 500,
      fontSize: bold ? 12.5 : 12,
      color: highlight ? T.accentDeep : T.ink
    }}>{label}</td>
      <td style={{
      padding: cellPad,
      borderTop,
      textAlign: "right"
    }}>
        {sign === "minus" && (editable ? <PnLValueInput value={value} onChange={onChange} /> : <span style={{
        ...FM,
        fontSize: 12,
        color: T.bad
      }}>{value ? `(${rupiah(value)})` : "-"}</span>)}
      </td>
      <td style={{
      padding: cellPad,
      borderTop,
      textAlign: "right"
    }}>
        {sign === "plus" && (editable ? <PnLValueInput value={value} onChange={onChange} /> : <span style={{
        ...FM,
        fontSize: 12,
        color: T.good
      }}>{rupiah(value)}</span>)}
      </td>
      <td style={{
      padding: cellPad,
      borderTop,
      textAlign: "right"
    }}>
        {!sign && <span style={{
        fontFamily: "JetBrains Mono",
        fontWeight: bold ? 700 : 500,
        fontSize: bold ? 13 : 12,
        color: highlight ? value < 0 ? T.bad : T.good : T.ink
      }}>{rupiah(value)}</span>}
      </td>
      <td style={{
      padding: cellPad,
      borderTop,
      textAlign: "right"
    }}>
        {percent != null && <span style={{
        ...FM,
        fontSize: 11,
        color: T.inkMuted
      }}>{percent}%</span>}
      </td>
    </tr>;
}
function PnLTableHeader() {
  const th = (label, color, align = "right") => <th style={{
    textAlign: align,
    padding: "6px 8px",
    ...FI,
    fontWeight: 700,
    fontSize: 10,
    color,
    textTransform: "uppercase",
    borderBottom: `2px solid ${T.ink}`,
    whiteSpace: "nowrap"
  }}>{label}</th>;
  return <thead>
      <tr>
        {th("Uraian", T.inkMuted, "left")}
        {th("Beban", T.bad)}
        {th("Pemasukan", T.good)}
        {th("Subtotal Kategori", T.ink)}
        {th("%", T.inkMuted)}
      </tr>
    </thead>;
}
function PnLSectionLabel({
  children,
  top
}) {
  return <tr>
      <td colSpan={5} style={{
      paddingTop: top ?? 16,
      paddingBottom: 6
    }}>
        <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 13.5,
        color: T.ink,
        letterSpacing: 0.3
      }}>{children}</div>
      </td>
    </tr>;
}
function PnLSubLabel({
  children
}) {
  return <tr>
      <td colSpan={5} style={{
      paddingTop: 8,
      paddingBottom: 2
    }}>
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 11.5,
        color: T.inkMuted
      }}>{children}</div>
      </td>
    </tr>;
}
function PnLCustomRow({
  label,
  percentInput,
  percentValue,
  onPercentChange,
  disabled,
  value
}) {
  return <tr>
      <td style={{
      padding: "3px 8px 3px 0",
      ...FI,
      fontSize: 12,
      color: T.ink
    }}>
        <span style={{
        display: "flex",
        alignItems: "center",
        gap: 6
      }} className="ais-flex-layout">
          {label} <input type="number" step="0.1" disabled={disabled} value={percentValue} onChange={e => onPercentChange(Number(e.target.value))} style={{
          width: 44,
          border: `1px solid ${T.line}`,
          borderRadius: 6,
          padding: "2px 5px",
          ...FM,
          fontSize: 11.5,
          background: disabled ? T.surfaceSunk : T.surface
        }} className="ais-control" />%
        </span>
      </td>
      <td style={{
      padding: "3px 8px",
      textAlign: "right"
    }}>
        <span style={{
        ...FM,
        fontSize: 12,
        color: T.bad
      }}>{value ? `(${rupiah(value)})` : "-"}</span>
      </td>
      <td style={{
      padding: "3px 8px"
    }} />
      <td style={{
      padding: "3px 8px"
    }} />
      <td style={{
      padding: "3px 8px"
    }} />
    </tr>;
}

/* ---------------------------------------------------------
   PAGE: REKAP PEMBELIAN BULANAN
--------------------------------------------------------- */
// Sumber barang suatu bahan (Stokis DTOP / ACK) dari Master Bahan Baku.
function sumberBarangOf(bahanId, bahan) {
  return (bahan || []).find(b => b.id === bahanId)?.supplier || "Belum diisi";
}

// Total nilai pembelian dikelompokkan per sumber barang.
function breakdownSumber(items, bahan) {
  const out = {};
  (items || []).forEach(it => {
    const s = sumberBarangOf(it.bahanId, bahan);
    out[s] = (out[s] || 0) + (it.subtotal || 0);
  });
  return out;
}
function InvoiceUploadButton({
  purchaseId,
  purchaseReports,
  setPurchaseReports
}) {
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPurchaseReports(purchaseReports.map(p => p.id === purchaseId ? {
        ...p,
        invoiceFoto: reader.result,
        invoiceUploadedAt: new Date().toISOString()
      } : p));
    };
    reader.readAsDataURL(file);
  };
  return <label onClick={e => e.stopPropagation()} style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: `1px solid ${T.line}`,
    borderRadius: 7,
    padding: "5px 10px",
    cursor: "pointer",
    ...FI,
    fontWeight: 600,
    fontSize: 11.5,
    color: T.accentDeep,
    whiteSpace: "nowrap"
  }}>
      <Plus size={12} /> Upload Invoice
      <input type="file" accept="image/*" onChange={handleFile} style={{
      display: "none"
    }} className="ais-control" />
    </label>;
}
function PembelianInputPanel({
  stores,
  bahan,
  products,
  purchaseReports,
  setPurchaseReports,
  purchaseStatus,
  setPurchaseStatus,
  currentUser
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [tanggal, setTanggal] = useState(dateStr(new Date()));
  const key = `${store}_${tanggal}`;
  const existing = purchaseReports.find(p => p.storeId === store && p.tanggal === tanggal);
  // Laporan yang sudah ada tapi belum punya catatan status (mis. dari mobile app / data lama)
  // otomatis dianggap terkunci, supaya alur "Ajukan Edit" tetap muncul.
  const rawStatus = purchaseStatus[key];
  const statusData = rawStatus || {
    status: existing ? "locked" : "empty",
    approvals: {}
  };
  const setStatus = next => setPurchaseStatus({
    ...purchaseStatus,
    [key]: {
      ...statusData,
      ...next
    }
  });
  const isSubmitterRole = currentUser.id === "eri" || currentUser.id === "nana";
  const approverId = statusData.editRequestedById === "eri" ? "nana" : "eri";
  const approverName = approverId === "eri" ? "Eri" : "Nana";
  const canInput = isSubmitterRole && (statusData.status === "empty" || statusData.status === "unlocked");
  const isApproverNow = statusData.status === "edit_requested" && currentUser.id === approverId;
  const [items, setItems] = useState([{
    bahanId: bahan[0]?.id,
    qty: "",
    harga: ""
  }]);
  useEffect(() => {
    if (existing && statusData.status === "unlocked") {
      setItems(existing.items.map(it => ({
        bahanId: it.bahanId,
        qty: String(it.qty),
        harga: String(it.harga)
      })));
    } else {
      setItems([{
        bahanId: bahan[0]?.id,
        qty: "",
        harga: ""
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, tanggal, statusData.status]);
  const upd = (i, f, v) => setItems(items.map((it, idx) => idx === i ? {
    ...it,
    [f]: v
  } : it));
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.harga) || 0), 0);
  const complete = items.length > 0 && items.every(it => it.bahanId && Number(it.qty) > 0 && Number(it.harga) > 0);
  const submit = () => {
    const payload = items.map(it => {
      const b = bahan.find(x => x.id === it.bahanId);
      return {
        bahanId: it.bahanId,
        bahanName: b?.name || it.bahanId,
        qty: Number(it.qty),
        harga: Number(it.harga),
        subtotal: Number(it.qty) * Number(it.harga)
      };
    });
    const record = {
      id: existing?.id || `pb_${key}`,
      storeId: store,
      tanggal,
      items: payload,
      total,
      inputOleh: currentUser.name,
      inputOlehId: currentUser.id,
      submittedAt: new Date().toISOString(),
      invoiceFoto: existing?.invoiceFoto || null,
      ...(statusData.status === "unlocked" ? {
        editedBy: currentUser.name,
        editedAt: new Date().toISOString()
      } : {})
    };
    setPurchaseReports(existing ? purchaseReports.map(p => p.id === existing.id ? record : p) : [...purchaseReports, record]);
    setStatus({
      status: "locked",
      lockedBy: currentUser.name,
      lockedAt: new Date().toISOString(),
      editRequestedById: null
    });
  };
  if (!isSubmitterRole) return null;
  return <FormSurface title="Belanja, tercatat rapi." subtitle="Lengkapi rincian bahan, nilai, dan bukti pembelian." code="PURCHASE"><div className="ais-content-panel">
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 4
      }}>Input Pembelian Bahan Baku</div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 12
      }}>
        Terkunci 1 kali per toko per tanggal. Untuk mengubah, ajukan edit — approval oleh {currentUser.id === "eri" ? "Nana" : "Eri"}. Alur ini sama persis dengan di mobile app.
      </div>

      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        <select value={store} onChange={e => setStore(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" max={dateStr(new Date())} value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13
        }} className="ais-control" />
      </div>

      {statusData.status === "locked" && <div style={{
        background: T.goodSoft,
        color: T.good,
        borderRadius: 10,
        padding: "11px 13px",
        ...FI,
        fontSize: 12.5,
        marginBottom: 12
      }}>
          <div style={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 6
        }} className="ais-flex-layout"><Lock size={13} /> Sudah dikunci oleh {existing?.inputOleh}</div>
          <div style={{
          fontSize: 11.5,
          marginTop: 2
        }}>Total {rupiah(existing?.total || 0)} · {existing?.items.length} item{existing?.editedBy ? ` · diedit oleh ${existing.editedBy}` : ""}</div>
          <button onClick={() => setStatus({
          status: "edit_requested",
          editRequestedBy: currentUser.name,
          editRequestedById: currentUser.id,
          editRequestedAt: new Date().toISOString()
        })} style={{
          marginTop: 8,
          border: `1px solid ${T.good}`,
          borderRadius: 8,
          padding: "6px 12px",
          background: "transparent",
          color: T.good,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Ajukan Edit</button>
        </div>}

      {statusData.status === "edit_requested" && <div style={{
        background: T.warnSoft,
        color: T.warn,
        borderRadius: 10,
        padding: "11px 13px",
        ...FI,
        fontSize: 12.5,
        marginBottom: 12
      }}>
          <div style={{
          fontWeight: 700
        }}>Menunggu approval {approverName}</div>
          <div style={{
          fontSize: 11.5,
          marginTop: 2
        }}>Diajukan oleh {statusData.editRequestedBy}</div>
          {isApproverNow && <div style={{
          display: "flex",
          gap: 8,
          marginTop: 8
        }} className="ais-flex-layout">
              <button onClick={() => setStatus({
            status: "unlocked",
            approvedBy: currentUser.name,
            approvedAt: new Date().toISOString()
          })} style={{
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            background: T.good,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">Setujui Edit</button>
              <button onClick={() => setStatus({
            status: "locked",
            editRequestedById: null
          })} style={{
            border: `1px solid ${T.bad}`,
            borderRadius: 8,
            padding: "6px 12px",
            background: "transparent",
            color: T.bad,
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--danger">Tolak</button>
            </div>}
        </div>}

      {canInput && <div>
          {statusData.status === "unlocked" && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.accentDeep,
          marginBottom: 10
        }}>Mode edit aktif (disetujui {statusData.approvedBy}). Simpan untuk mengunci kembali.</div>}
          <div style={{
          overflowX: "auto",
          marginBottom: 10
        }}>
            <table style={{
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12.5,
            minWidth: 560
          }}>
              <thead>
                <tr style={THBG}>
                  {["Bahan Baku", "Qty", "Harga/Satuan", "Subtotal", ""].map(h => <th key={h} style={{
                  padding: "7px 10px",
                  fontSize: 10.5,
                  color: T.inkMuted,
                  whiteSpace: "nowrap"
                }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => <tr key={i} style={{
                borderTop: `1px solid ${T.line}`
              }}>
                    <td style={{
                  padding: "5px 10px"
                }}>
                      <select value={it.bahanId} onChange={e => upd(i, "bahanId", e.target.value)} style={{
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "6px 8px",
                    ...FI,
                    fontSize: 12,
                    background: T.surface,
                    minWidth: 170
                  }} className="ais-control">
                        {bahanUntukToko(store, stores, products, bahan).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                    <td style={{
                  padding: "5px 10px"
                }}>
                      <input type="number" value={it.qty} onChange={e => upd(i, "qty", e.target.value)} placeholder="0" style={{
                    width: 75,
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "6px 8px",
                    ...FM,
                    fontSize: 12,
                    textAlign: "right"
                  }} className="ais-control" />
                    </td>
                    <td style={{
                  padding: "5px 10px"
                }}>
                      <input type="number" value={it.harga} onChange={e => upd(i, "harga", e.target.value)} placeholder="0" style={{
                    width: 105,
                    border: `1px solid ${T.line}`,
                    borderRadius: 7,
                    padding: "6px 8px",
                    ...FM,
                    fontSize: 12,
                    textAlign: "right"
                  }} className="ais-control" />
                    </td>
                    <td style={{
                  padding: "5px 10px",
                  ...FM,
                  fontWeight: 600
                }}>{rupiah((Number(it.qty) || 0) * (Number(it.harga) || 0))}</td>
                    <td style={{
                  padding: "5px 10px"
                }}>
                      {items.length > 1 && <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={{
                    border: "none",
                    background: "transparent",
                    color: T.bad,
                    cursor: "pointer"
                  }} className="ais-button ais-button--danger"><Trash2 size={13} /></button>}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          <button onClick={() => setItems([...items, {
          bahanId: bahan[0]?.id,
          qty: "",
          harga: ""
        }])} style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: `1px dashed ${T.line}`,
          borderRadius: 9,
          padding: "7px 12px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          marginBottom: 12
        }} className="ais-button ais-button--default ais-flex-layout"><Plus size={13} /> Tambah Item</button>

          <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 0",
          borderTop: `1px solid ${T.line}`,
          marginBottom: 12
        }}>
            <span style={{
            ...FI,
            fontWeight: 700,
            fontSize: 13.5
          }}>Total Pembelian</span>
            <span style={{
            ...FM,
            fontWeight: 700,
            fontSize: 15
          }}>{rupiah(total)}</span>
          </div>
          <button onClick={submit} disabled={!complete} style={{
          border: "none",
          borderRadius: 10,
          padding: "10px 18px",
          background: complete ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: complete ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--default">
            {statusData.status === "unlocked" ? "Simpan Perubahan & Kunci" : "Submit & Kunci Pembelian"}
          </button>
        </div>}
    </div></FormSurface>;
}
function RekapPembelianPage({
  stores,
  purchaseReports,
  setPurchaseReports,
  reportLog,
  bahan,
  products,
  purchaseStatus,
  setPurchaseStatus,
  currentUser
}) {
  const [storeFilter, setStoreFilter] = useState("all");
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openId, setOpenId] = useState(null);
  const rows = purchaseReports.filter(p => (storeFilter === "all" || p.storeId === storeFilter) && p.tanggal.startsWith(month)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const total = rows.reduce((s, p) => s + p.total, 0);
  const belumInvoice = rows.filter(p => !p.invoiceFoto).length;
  const targetStores = storeFilter === "all" ? stores : stores.filter(s => s.id === storeFilter);
  const omset = targetStores.reduce((sum, s) => {
    const days = dayEntries(reportLog, s.id, month);
    return sum + days.reduce((ds, d) => ds + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);
  }, 0);
  const pctOmset = omset ? total / omset * 100 : 0;
  return <div>
      <SectionTitle icon={FileBarChart2} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Pembelian Bahan Baku — ${month}`} meta={[`Toko: ${storeFilter === "all" ? "Semua Toko" : stores.find(s => s.id === storeFilter)?.name}`, `Periode: ${month}`, `Total Pembelian: ${rupiah(total)}`]} filename={`rekap-pembelian_${storeFilter}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "toko",
        label: "Toko"
      }, {
        key: "bahan",
        label: "Bahan"
      }, {
        key: "sumber",
        label: "Sumber Barang"
      }, {
        key: "qty",
        label: "Qty"
      }, {
        key: "harga",
        label: "Harga Satuan"
      }, {
        key: "subtotal",
        label: "Subtotal"
      }, {
        key: "invoice",
        label: "Invoice"
      }, {
        key: "oleh",
        label: "Diinput Oleh"
      }]} rows={rows.flatMap(p => p.items.map(it => ({
        tanggal: p.tanggal,
        toko: stores.find(s => s.id === p.storeId)?.name || p.storeId,
        bahan: it.bahanName,
        sumber: sumberBarangOf(it.bahanId, bahan),
        qty: it.qty,
        harga: it.harga,
        subtotal: it.subtotal,
        invoice: p.invoiceFoto ? "Terupload" : "Belum",
        oleh: p.inputOleh
      })))} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Toko</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap Pembelian Bahan Baku</SectionTitle>

      <PembelianInputPanel stores={stores} bahan={bahan} products={products} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} currentUser={currentUser} />

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Item & qty bersumber dari fitur <b>Pembelian Bahan Baku</b> di mobile app (diinput Eri/Nana, terkunci 1x per toko per tanggal). <b>Upload invoice dilakukan di dashboard ini</b> setelah invoice fisik diterima.
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Total Pembelian (Gabungan)" value={rupiah(total)} tone="good" />
        {SUMBER_BARANG.map(s => {
        const nilai = rows.flatMap(p => p.items).filter(it => sumberBarangOf(it.bahanId, bahan) === s).reduce((a, it) => a + (it.subtotal || 0), 0);
        return <StatCard key={s} label={`Pembelian ${s}`} value={rupiah(nilai)} />;
      })}
        <StatCard label="Jumlah Transaksi" value={rows.length} />
        <StatCard label="% dari Omset" value={`${pctOmset.toFixed(1)}%`} tone={pctOmset > 40 ? "bad" : pctOmset > 25 ? "warn" : "good"} />
        <StatCard label="Belum Ada Invoice" value={belumInvoice} tone={belumInvoice > 0 ? "warn" : "good"} />
      </div>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik baris untuk lihat rincian item & foto invoice.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Toko", "Jumlah Item", "Total", "Invoice", "Diinput Oleh", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada laporan pembelian untuk filter ini.</td></tr>}
            {rows.map(p => {
            const isOpen = openId === p.id;
            return <Fragment key={p.id}>
                  <tr onClick={() => setOpenId(isOpen ? null : p.id)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{p.tanggal}</td>
                    <td style={TD}>{stores.find(s => s.id === p.storeId)?.name}</td>
                    <td style={TD}>{p.items.length}</td>
                    <td style={{
                  ...TD,
                  fontWeight: 700
                }}>{rupiah(p.total)}</td>
                    <td style={TD}>
                      {p.invoiceFoto ? <Badge tone="good">Terupload</Badge> : <InvoiceUploadButton purchaseId={p.id} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} />}
                    </td>
                    <td style={{
                  ...TD,
                  color: T.inkMuted
                }}>{p.inputOleh}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={7} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    ...FI,
                    fontSize: 12,
                    marginBottom: 10
                  }}>
                          <thead><tr style={{
                        textAlign: "left",
                        color: T.inkMuted
                      }}><th style={{
                          padding: "2px 8px 6px 0"
                        }}>Bahan</th><th style={{
                          padding: "2px 8px"
                        }}>Sumber</th><th style={{
                          padding: "2px 8px"
                        }}>Qty</th><th style={{
                          padding: "2px 8px"
                        }}>Harga/Satuan</th><th style={{
                          padding: "2px 0"
                        }}>Subtotal</th></tr></thead>
                          <tbody>
                            {p.items.map((it, i) => <tr key={i}>
                                <td style={{
                          padding: "2px 8px 2px 0"
                        }}>{it.bahanName}</td>
                                <td style={{
                          padding: "2px 8px",
                          color: T.inkMuted
                        }}>{sumberBarangOf(it.bahanId, bahan)}</td>
                                <td style={{
                          padding: "2px 8px"
                        }}>{it.qty}</td>
                                <td style={{
                          padding: "2px 8px"
                        }}>{rupiah(it.harga)}</td>
                                <td style={{
                          padding: "2px 0"
                        }}>{rupiah(it.subtotal)}</td>
                              </tr>)}
                          </tbody>
                        </table>

                        <div style={{
                    background: T.surface,
                    border: `1px solid ${T.line}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 12
                  }} className="ais-content-panel">
                          <div style={{
                      ...FI,
                      fontSize: 10.5,
                      color: T.inkMuted,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      marginBottom: 6
                    }}>Breakdown per Sumber Barang</div>
                          {(() => {
                      const bd = breakdownSumber(p.items, bahan);
                      return <div>
                                {Object.entries(bd).map(([sumber, nilai]) => <div key={sumber} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          ...FI,
                          fontSize: 12.5,
                          padding: "2px 0"
                        }}>
                                    <span style={{
                            color: T.inkMuted
                          }}>{sumber}</span>
                                    <span style={{
                            ...FM,
                            fontWeight: 600
                          }}>{rupiah(nilai)}</span>
                                  </div>)}
                                <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          ...FI,
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "6px 0 0",
                          borderTop: `1px solid ${T.line}`,
                          marginTop: 5
                        }}>
                                  <span>Total</span><span style={{
                            fontFamily: "JetBrains Mono"
                          }}>{rupiah(p.total)}</span>
                                </div>
                              </div>;
                    })()}
                        </div>
                        {p.invoiceFoto ? <div>
                            <div style={{
                      ...FI,
                      fontSize: 11,
                      color: T.inkMuted,
                      marginBottom: 6
                    }}>Foto Invoice</div>
                            <img src={p.invoiceFoto} alt="invoice" style={{
                      width: 120,
                      height: 120,
                      borderRadius: 8,
                      objectFit: "cover",
                      border: `1px solid ${T.line}`
                    }} />
                          </div> : <div onClick={e => e.stopPropagation()}>
                            <div style={{
                      ...FI,
                      fontSize: 11.5,
                      color: T.warn,
                      fontStyle: "italic",
                      marginBottom: 8
                    }}>Invoice belum diupload.</div>
                            <InvoiceUploadButton purchaseId={p.id} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} />
                          </div>}
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: REKAP STOK OPNAME
--------------------------------------------------------- */
function OpnameInputPanel({
  stores,
  bahan,
  products,
  reportLog,
  stockOpnameReports,
  setStockOpnameReports,
  opnameStatus,
  setOpnameStatus,
  currentUser
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [tanggal, setTanggal] = useState(dateStr(new Date()));
  const key = `${store}_${tanggal}`;
  const existing = stockOpnameReports.find(o => o.storeId === store && o.tanggal === tanggal);
  const rawStatus = opnameStatus[key];
  const statusData = rawStatus || {
    status: existing ? "locked" : "empty",
    approvals: {}
  };
  const setStatus = next => setOpnameStatus({
    ...opnameStatus,
    [key]: {
      ...statusData,
      ...next
    }
  });
  const isSubmitterRole = currentUser.id === "eri" || currentUser.access === "elin" || currentUser.id === "nana";
  const isApprover = currentUser.access === "all";
  const canInput = isSubmitterRole && (statusData.status === "empty" || statusData.status === "unlocked");
  const [rows, setRows] = useState({});
  useEffect(() => {
    const r = {};
    if (existing && statusData.status === "unlocked") existing.items.forEach(it => {
      r[it.bahanId] = {
        aktual: String(it.aktual),
        keterangan: it.keterangan || ""
      };
    });
    setRows(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, tanggal, statusData.status]);

  // Qty tercatat = stok akhir terakhir yang dilaporkan toko untuk bahan tsb.
  const tercatatOf = bahanId => {
    const keys = Object.keys(reportLog).filter(k => k.startsWith(`${store}_`) && k.slice(store.length + 1) <= tanggal).sort();
    for (let i = keys.length - 1; i >= 0; i--) {
      const v = reportLog[keys[i]]?.stok?.[bahanId];
      if (v && v.akhir != null) return v.akhir;
    }
    return 0;
  };
  const bahanList = bahanUntukToko(store, stores, products, bahan);
  const filled = bahanList.filter(b => rows[b.id]?.aktual !== "" && rows[b.id]?.aktual != null);
  const submit = () => {
    const items = filled.map(b => {
      const tercatat = tercatatOf(b.id);
      const aktual = Number(rows[b.id].aktual) || 0;
      return {
        bahanId: b.id,
        bahanName: b.name,
        tercatat,
        aktual,
        selisih: aktual - tercatat,
        keterangan: rows[b.id].keterangan || ""
      };
    });
    const wasEdit = statusData.status === "unlocked";
    const record = {
      id: existing?.id || `op_${key}`,
      storeId: store,
      tanggal,
      items,
      inputOleh: existing?.inputOleh || currentUser.name,
      inputOlehId: existing?.inputOlehId || currentUser.id,
      submittedAt: existing?.submittedAt || new Date().toISOString(),
      ...(wasEdit ? {
        editedBy: currentUser.name,
        editedAt: new Date().toISOString()
      } : {})
    };
    setStockOpnameReports(existing ? stockOpnameReports.map(o => o.id === existing.id ? record : o) : [...stockOpnameReports, record]);
    setStatus({
      status: "locked",
      submittedBy: statusData.submittedBy || currentUser.name,
      submittedAt: statusData.submittedAt || new Date().toISOString(),
      approvals: {}
    });
    setRows({});
  };
  if (!isSubmitterRole && !isApprover) return null;
  return <FormSurface title="Cocokkan stok aktual." subtitle="Catat hasil pemeriksaan fisik sesuai lokasi dan satuan." code="OPNAME"><div className="ais-content-panel">
      <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 4
      }}>Input Stok Opname</div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 12
      }}>
        Terkunci 1 kali per toko per tanggal. Untuk mengubah, ajukan edit — perlu approval Kurnia &amp; Juhaeri. Alur sama dengan mobile app.
      </div>

      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
        <select value={store} onChange={e => setStore(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" max={dateStr(new Date())} value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13
        }} className="ais-control" />
      </div>

      {statusData.status === "locked" && <div style={{
        background: T.goodSoft,
        color: T.good,
        borderRadius: 10,
        padding: "11px 13px",
        ...FI,
        fontSize: 12.5
      }}>
          <div style={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 6
        }} className="ais-flex-layout"><Lock size={13} /> Sudah dikunci oleh {existing?.inputOleh}</div>
          <div style={{
          fontSize: 11.5,
          marginTop: 2
        }}>{existing?.items.length} bahan diopname{existing?.editedBy ? ` · diedit oleh ${existing.editedBy}` : ""}</div>
          {isSubmitterRole && <button onClick={() => setStatus({
          status: "edit_requested",
          editRequestedBy: currentUser.name,
          editRequestedAt: new Date().toISOString(),
          approvals: {}
        })} style={{
          marginTop: 8,
          border: `1px solid ${T.good}`,
          borderRadius: 8,
          padding: "6px 12px",
          background: "transparent",
          color: T.good,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Ajukan Edit</button>}
        </div>}

      {statusData.status === "edit_requested" && <div style={{
        background: T.warnSoft,
        color: T.warn,
        borderRadius: 10,
        padding: "11px 13px",
        ...FI,
        fontSize: 12.5
      }}>
          <div style={{
          fontWeight: 700
        }}>Menunggu approval Direksi</div>
          <div style={{
          fontSize: 11.5,
          marginTop: 2
        }}>
            Diajukan {statusData.editRequestedBy} · Kurnia: <b>{statusData.approvals?.kurnia ? "Setuju" : "Menunggu"}</b> · Juhaeri: <b>{statusData.approvals?.juhaeri ? "Setuju" : "Menunggu"}</b>
          </div>
          {isApprover && !statusData.approvals?.[currentUser.id] && <button onClick={() => {
          const next = {
            ...(statusData.approvals || {}),
            [currentUser.id]: true
          };
          setStatus({
            approvals: next,
            status: next.kurnia && next.juhaeri ? "unlocked" : "edit_requested"
          });
        }} style={{
          marginTop: 8,
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.warn,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Setujui Edit</button>}
        </div>}

      {canInput && <div>
          {statusData.status === "unlocked" && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.accentDeep,
          marginBottom: 10
        }}>Mode edit aktif. Simpan untuk mengunci kembali.</div>}
          <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted,
          marginBottom: 8
        }}>Isi hanya bahan yang diopname. Qty tercatat diambil otomatis dari stok akhir terakhir yang dilaporkan toko.</div>
          <div style={{
          overflowX: "auto",
          marginBottom: 12,
          maxHeight: 380,
          border: `1px solid ${T.line}`,
          borderRadius: 10
        }}>
            <table style={{
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12.5,
            minWidth: 560
          }}>
              <thead>
                <tr style={THBG}>
                  {["Bahan", "Tercatat", "Aktual", "Selisih", "Keterangan"].map(h => <th key={h} style={{
                  padding: "7px 10px",
                  fontSize: 10.5,
                  color: T.inkMuted,
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  background: T.surfaceSunk
                }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bahanList.map(b => {
                const tercatat = tercatatOf(b.id);
                const val = rows[b.id]?.aktual ?? "";
                const selisih = val === "" ? null : (Number(val) || 0) - tercatat;
                return <tr key={b.id} style={{
                  borderTop: `1px solid ${T.line}`
                }}>
                      <td style={{
                    padding: "5px 10px"
                  }}>{b.name}</td>
                      <td style={{
                    padding: "5px 10px",
                    ...FM,
                    color: T.inkMuted
                  }}>{tercatat}</td>
                      <td style={{
                    padding: "4px 10px"
                  }}>
                        <input type="number" value={val} onChange={e => setRows({
                      ...rows,
                      [b.id]: {
                        ...(rows[b.id] || {}),
                        aktual: e.target.value
                      }
                    })} placeholder="-" style={{
                      width: 75,
                      border: `1px solid ${T.line}`,
                      borderRadius: 7,
                      padding: "5px 8px",
                      ...FM,
                      fontSize: 12,
                      textAlign: "right"
                    }} className="ais-control" />
                      </td>
                      <td style={{
                    padding: "5px 10px",
                    ...FM,
                    fontWeight: 700,
                    color: selisih == null ? T.inkMuted : selisih < 0 ? T.bad : selisih > 0 ? T.good : T.inkMuted
                  }}>
                        {selisih == null ? "-" : `${selisih > 0 ? "+" : ""}${selisih}`}
                      </td>
                      <td style={{
                    padding: "4px 10px"
                  }}>
                        <input value={rows[b.id]?.keterangan ?? ""} onChange={e => setRows({
                      ...rows,
                      [b.id]: {
                        ...(rows[b.id] || {}),
                        keterangan: e.target.value
                      }
                    })} placeholder="opsional" style={{
                      width: 150,
                      border: `1px solid ${T.line}`,
                      borderRadius: 7,
                      padding: "5px 8px",
                      ...FI,
                      fontSize: 12
                    }} className="ais-control" />
                      </td>
                    </tr>;
              })}
              </tbody>
            </table>
          </div>
          <button onClick={submit} disabled={filled.length === 0} style={{
          border: "none",
          borderRadius: 10,
          padding: "10px 18px",
          background: filled.length ? T.manajemen : T.line,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: filled.length ? "pointer" : "not-allowed"
        }} className="ais-button ais-button--default">
            {statusData.status === "unlocked" ? "Simpan Perubahan & Kunci" : `Submit & Kunci Opname (${filled.length} bahan)`}
          </button>
        </div>}
    </div></FormSurface>;
}
function OpnameEditPanel({
  record,
  opnameEditLock,
  setOpnameEditLock,
  stockOpnameReports,
  setStockOpnameReports,
  currentUser
}) {
  const lockKey = record.id;
  const lock = opnameEditLock[lockKey] || {
    editCount: 0,
    direksiStatus: "none",
    direksiApprovals: {},
    log: []
  };
  const canEditRole = ["eri", "nana"].includes(currentUser.id) || currentUser.access === "all";
  const canEditFreely = lock.editCount === 0 || lock.direksiStatus === "approved";
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState({});
  const [alasan, setAlasan] = useState("");
  const startEdit = () => {
    const r = {};
    record.items.forEach(it => {
      r[it.bahanId] = String(it.aktual);
    });
    setRows(r);
    setAlasan("");
    setEditing(true);
  };
  const save = () => {
    const items = record.items.map(it => {
      const aktual = Number(rows[it.bahanId]) || 0;
      return {
        ...it,
        aktual,
        selisih: aktual - it.tercatat
      };
    });
    setStockOpnameReports(stockOpnameReports.map(o => o.id === record.id ? {
      ...o,
      items,
      editedBy: currentUser.name,
      editedAt: new Date().toISOString(),
      editReason: alasan
    } : o));
    setOpnameEditLock({
      ...opnameEditLock,
      [lockKey]: {
        editCount: lock.editCount + 1,
        direksiStatus: "none",
        direksiApprovals: {},
        log: [...(lock.log || []), {
          by: currentUser.name,
          at: new Date().toISOString(),
          alasan
        }]
      }
    });
    setEditing(false);
  };
  if (!canEditRole) return null;
  return <FormSurface title="Tinjau kembali selisih." subtitle="Perbarui catatan stok dengan alasan yang dapat ditelusuri." code="REVISION"><div>
      {(lock.log || []).length > 0 && <div style={{
        marginBottom: 8
      }}>
          <div style={{
          ...FI,
          fontSize: 10,
          color: T.inkMuted,
          fontWeight: 700,
          textTransform: "uppercase"
        }}>Log Edit</div>
          {lock.log.map((l, i) => <div key={i} style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted
        }}>{l.by} · {new Date(l.at).toLocaleString("id-ID")}{l.alasan ? ` — "${l.alasan}"` : ""}</div>)}
        </div>}

      {!editing && canEditFreely && <button onClick={startEdit} style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "6px 12px",
        background: "transparent",
        color: T.accentDeep,
        ...FI,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer"
      }} className="ais-button ais-button--default"><PenLine size={12} /> Edit Hasil Opname</button>}

      {!editing && !canEditFreely && lock.direksiStatus === "none" && <button onClick={() => setOpnameEditLock({
        ...opnameEditLock,
        [lockKey]: {
          ...lock,
          direksiStatus: "pending",
          direksiApprovals: {}
        }
      })} style={{
        border: `1px solid ${T.warn}`,
        borderRadius: 8,
        padding: "6px 12px",
        background: "transparent",
        color: T.warn,
        ...FI,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer"
      }} className="ais-button ais-button--primary">Ajukan Approval Direksi (sudah 1x edit)</button>}

      {!editing && lock.direksiStatus === "pending" && <div style={{
        background: T.warnSoft,
        borderRadius: 8,
        padding: "8px 10px",
        ...FI,
        fontSize: 11.5,
        color: T.warn
      }}>
          Menunggu approval Direksi — Kurnia: <b>{lock.direksiApprovals?.kurnia ? "Setuju" : "Menunggu"}</b> · Juhaeri: <b>{lock.direksiApprovals?.juhaeri ? "Setuju" : "Menunggu"}</b>
          {currentUser.access === "all" && !lock.direksiApprovals?.[currentUser.id] && <button onClick={() => {
          const next = {
            ...lock.direksiApprovals,
            [currentUser.id]: true
          };
          setOpnameEditLock({
            ...opnameEditLock,
            [lockKey]: {
              ...lock,
              direksiApprovals: next,
              direksiStatus: next.kurnia && next.juhaeri ? "approved" : "pending"
            }
          });
        }} style={{
          display: "block",
          marginTop: 6,
          border: "none",
          borderRadius: 7,
          padding: "5px 10px",
          background: T.warn,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 11,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Setujui Edit</button>}
        </div>}

      {editing && <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: 12
      }} className="ais-content-panel">
          <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 8
        }}>Edit Qty Aktual</div>
          {record.items.map(it => <div key={it.bahanId} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "3px 0"
        }}>
              <span style={{
            ...FI,
            fontSize: 12
          }}>{it.bahanName} <span style={{
              color: T.inkMuted,
              fontSize: 11
            }}>(tercatat {it.tercatat})</span></span>
              <input type="number" value={rows[it.bahanId] ?? ""} onChange={e => setRows({
            ...rows,
            [it.bahanId]: e.target.value
          })} style={{
            width: 80,
            border: `1px solid ${T.line}`,
            borderRadius: 7,
            padding: "5px 8px",
            ...FM,
            fontSize: 12,
            textAlign: "right"
          }} className="ais-control" />
            </div>)}
          <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Alasan edit (tercatat di log)" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 10px",
          ...FI,
          fontSize: 12.5,
          margin: "10px 0"
        }} className="ais-control" />
          <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
            <button onClick={save} style={{
            border: "none",
            borderRadius: 9,
            padding: "8px 14px",
            background: T.manajemen,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">Simpan</button>
            <button onClick={() => setEditing(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 14px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">Batal</button>
          </div>
        </div>}
    </div></FormSurface>;
}
function RekapOpnamePage({
  stores,
  bahan,
  products,
  reportLog,
  stokEditRequests,
  setStokEditRequests,
  stockOpnameReports,
  setStockOpnameReports,
  opnameEditLock,
  setOpnameEditLock,
  opnameStatus,
  setOpnameStatus,
  currentUser,
  readOnly
}) {
  const storeIdsIni = new Set(stores.map(s => s.id));
  const [storeFilter, setStoreFilter] = useState("all");
  const [month, setMonth] = useState(monthStr(new Date()));
  const [openId, setOpenId] = useState(null);
  const rows = stockOpnameReports.filter(o => storeIdsIni.has(o.storeId) && (storeFilter === "all" || o.storeId === storeFilter) && o.tanggal.startsWith(month)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const totalSelisihMinus = rows.reduce((s, o) => s + o.items.filter(it => it.selisih < 0).reduce((s2, it) => s2 + it.selisih, 0), 0);
  const jumlahItemSelisih = rows.reduce((s, o) => s + o.items.filter(it => it.selisih !== 0).length, 0);
  return <div>
      <SectionTitle icon={RefreshCcw} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Rekap Stok Opname — ${month}`} meta={[`Toko: ${storeFilter === "all" ? "Semua Toko" : stores.find(s => s.id === storeFilter)?.name}`, `Periode: ${month}`]} filename={`rekap-opname_${storeFilter}_${month}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "toko",
        label: "Toko"
      }, {
        key: "bahan",
        label: "Bahan"
      }, {
        key: "tercatat",
        label: "Tercatat"
      }, {
        key: "aktual",
        label: "Aktual"
      }, {
        key: "selisih",
        label: "Selisih"
      }, {
        key: "keterangan",
        label: "Keterangan"
      }, {
        key: "oleh",
        label: "Diinput Oleh"
      }]} rows={rows.flatMap(o => o.items.map(it => ({
        tanggal: o.tanggal,
        toko: stores.find(s => s.id === o.storeId)?.name || o.storeId,
        bahan: it.bahanName,
        tercatat: it.tercatat,
        aktual: it.aktual,
        selisih: it.selisih,
        keterangan: it.keterangan || "",
        oleh: o.inputOleh
      })))} />
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            <option value="all">Semua Toko</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap Stok Opname</SectionTitle>

      {!readOnly && (stokEditRequests || []).filter(r => r.status === "pending").length > 0 && <div style={{
      background: T.warnSoft,
      border: `1px solid ${T.warn}33`,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20
    }}>
          <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        color: T.warn,
        marginBottom: 4
      }}>
            Permintaan Edit Stok dari Toko ({(stokEditRequests || []).filter(r => r.status === "pending").length})
          </div>
          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 12
      }}>
            Diajukan lewat mobile app oleh Akun Toko. Persetujuan membuka kunci laporan stok tanggal tersebut.
          </div>
          {(stokEditRequests || []).filter(r => r.status === "pending").map(r => <div key={r.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 11,
        padding: "11px 13px",
        marginBottom: 8
      }} className="ais-content-panel">
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10
        }} className="ais-flex-layout">
                <div>
                  <div style={{
              ...FI,
              fontWeight: 700,
              fontSize: 13
            }}>
                    {stores.find(s => s.id === r.storeId)?.name || r.storeId} · {r.tanggal}
                  </div>
                  <div style={{
              ...FI,
              fontSize: 12,
              color: T.inkMuted,
              marginTop: 2
            }}>
                    {r.deskripsi} — <i>{r.alasan}</i>
                  </div>
                  <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginTop: 2
            }}>
                    Diajukan {r.requestedBy} · {new Date(r.requestedAt).toLocaleString("id-ID")}
                  </div>
                </div>
                <div style={{
            display: "flex",
            gap: 7,
            flexShrink: 0
          }} className="ais-flex-layout">
                  <button onClick={() => setStokEditRequests(stokEditRequests.map(x => x.id === r.id ? {
              ...x,
              status: "approved",
              approvedBy: currentUser.name,
              approvedAt: new Date().toISOString()
            } : x))} style={{
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              background: T.good,
              color: "#fff",
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--primary">Setujui</button>
                  <button onClick={() => setStokEditRequests(stokEditRequests.map(x => x.id === r.id ? {
              ...x,
              status: "rejected",
              approvedBy: currentUser.name,
              approvedAt: new Date().toISOString()
            } : x))} style={{
              border: `1px solid ${T.bad}`,
              borderRadius: 8,
              padding: "6px 12px",
              background: "transparent",
              color: T.bad,
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--danger">Tolak</button>
                </div>
              </div>
            </div>)}
        </div>}

      {!readOnly && <OpnameInputPanel stores={stores} bahan={bahan} products={products} reportLog={reportLog} stockOpnameReports={stockOpnameReports} setStockOpnameReports={setStockOpnameReports} opnameStatus={opnameStatus} setOpnameStatus={setOpnameStatus} currentUser={currentUser} />}

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Data bersumber dari fitur <b>Stok Opname</b> di mobile app (diinput Eri/Elin, terkunci 1x per toko per hari, edit perlu approval silang Kurnia & Juhaeri). Halaman ini <b>khusus tampilan (view-only)</b>.
      </div>

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Jumlah Sesi Opname" value={rows.length} />
        <StatCard label="Item dengan Selisih" value={jumlahItemSelisih} tone={jumlahItemSelisih > 0 ? "warn" : "good"} />
        <StatCard label="Total Selisih Kurang" value={totalSelisihMinus} tone={totalSelisihMinus < 0 ? "bad" : "good"} />
      </div>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik baris untuk lihat rincian per bahan.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Toko", "Jumlah Item", "Item Selisih", "Diinput Oleh", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada laporan stok opname untuk filter ini.</td></tr>}
            {rows.map(o => {
            const isOpen = openId === o.id;
            const selisihCount = o.items.filter(it => it.selisih !== 0).length;
            return <Fragment key={o.id}>
                  <tr onClick={() => setOpenId(isOpen ? null : o.id)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{o.tanggal}</td>
                    <td style={TD}>{stores.find(s => s.id === o.storeId)?.name}</td>
                    <td style={TD}>{o.items.length}</td>
                    <td style={TD}>{selisihCount > 0 ? <Badge tone="warn">{selisihCount} item</Badge> : <Badge tone="good">Sesuai</Badge>}</td>
                    <td style={{
                  ...TD,
                  color: T.inkMuted
                }}>{o.inputOleh}</td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={6} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    ...FI,
                    fontSize: 12
                  }}>
                          <thead><tr style={{
                        textAlign: "left",
                        color: T.inkMuted
                      }}><th style={{
                          padding: "2px 8px 6px 0"
                        }}>Bahan</th><th style={{
                          padding: "2px 8px"
                        }}>Tercatat</th><th style={{
                          padding: "2px 8px"
                        }}>Aktual</th><th style={{
                          padding: "2px 8px"
                        }}>Selisih</th><th style={{
                          padding: "2px 0"
                        }}>Keterangan</th></tr></thead>
                          <tbody>
                            {o.items.map((it, i) => <tr key={i}>
                                <td style={{
                          padding: "3px 8px 3px 0"
                        }}>{it.bahanName}</td>
                                <td style={{
                          padding: "3px 8px"
                        }}>{it.tercatat}</td>
                                <td style={{
                          padding: "3px 8px"
                        }}>{it.aktual}</td>
                                <td style={{
                          padding: "3px 8px",
                          fontWeight: 700,
                          color: it.selisih < 0 ? T.bad : it.selisih > 0 ? T.good : T.inkMuted
                        }}>{it.selisih > 0 ? "+" : ""}{it.selisih}</td>
                                <td style={{
                          padding: "3px 0",
                          color: T.inkMuted,
                          fontStyle: it.keterangan ? "italic" : "normal"
                        }}>{it.keterangan || "-"}</td>
                              </tr>)}
                          </tbody>
                        </table>
                        {o.editedBy && <div style={{
                    ...FI,
                    fontSize: 11,
                    color: T.accentDeep,
                    marginTop: 8
                  }}>Diedit oleh {o.editedBy}{o.editReason ? ` — "${o.editReason}"` : ""}</div>}
                        {!readOnly && <OpnameEditPanel record={o} opnameEditLock={opnameEditLock} setOpnameEditLock={setOpnameEditLock} stockOpnameReports={stockOpnameReports} setStockOpnameReports={setStockOpnameReports} currentUser={currentUser} />}
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function TransferHargaInlineEdit({
  transferId,
  bahanId,
  stockTransfers,
  setStockTransfers
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const save = () => {
    if (val === "") return;
    setStockTransfers(stockTransfers.map(t => t.id === transferId ? {
      ...t,
      items: t.items.map(it => it.bahanId === bahanId ? {
        ...it,
        hargaSatuan: Number(val)
      } : it)
    } : t));
    setEditing(false);
    setVal("");
  };
  if (!editing) {
    return <button onClick={e => {
      e.stopPropagation();
      setEditing(true);
    }} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 7,
      padding: "4px 9px",
      background: "transparent",
      color: T.accentDeep,
      fontFamily: "DM Sans",
      fontWeight: 600,
      fontSize: 11.5,
      cursor: "pointer"
    }} className="ais-button ais-button--default">Input Harga</button>;
  }
  return <div onClick={e => e.stopPropagation()} style={{
    display: "flex",
    gap: 5,
    alignItems: "center"
  }} className="ais-flex-layout">
      <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Harga/satuan" autoFocus style={{
      width: 100,
      border: `1px solid ${T.line}`,
      borderRadius: 6,
      padding: "4px 7px",
      ...FM,
      fontSize: 11.5
    }} className="ais-control" />
      <button onClick={save} style={{
      border: "none",
      borderRadius: 6,
      padding: "4px 8px",
      background: T.manajemen,
      color: "#fff",
      ...FI,
      fontWeight: 600,
      fontSize: 11,
      cursor: "pointer"
    }} className="ais-button ais-button--primary">Simpan</button>
    </div>;
}
function RekapTransferStokPage({
  stores,
  stockTransfers,
  setStockTransfers
}) {
  const [storeFilter, setStoreFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const rows = stockTransfers.filter(t => storeFilter === "all" || t.asalToko === storeFilter || t.tujuanToko === storeFilter).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const belumHarga = stockTransfers.filter(t => t.items.some(it => it.hargaSatuan == null));
  return <div>
      <SectionTitle icon={ArrowLeftRight} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <ExportButtons title="Rekap Transfer Stok" meta={[`Toko: ${storeFilter === "all" ? "Semua Toko" : stores.find(s => s.id === storeFilter)?.name}`, `Jumlah transfer: ${rows.length}`]} filename={`rekap-transfer_${storeFilter}`} columns={[{
        key: "tanggal",
        label: "Tanggal"
      }, {
        key: "asal",
        label: "Toko Asal"
      }, {
        key: "tujuan",
        label: "Toko Tujuan"
      }, {
        key: "bahan",
        label: "Bahan"
      }, {
        key: "qty",
        label: "Qty"
      }, {
        key: "harga",
        label: "Harga Satuan"
      }, {
        key: "nilai",
        label: "Nilai"
      }, {
        key: "spv",
        label: "SPV"
      }, {
        key: "status",
        label: "Status"
      }]} rows={rows.flatMap(t => t.items.map(it => ({
        tanggal: t.tanggal,
        asal: stores.find(s => s.id === t.asalToko)?.name,
        tujuan: stores.find(s => s.id === t.tujuanToko)?.name,
        bahan: it.bahanName,
        qty: it.qty,
        harga: it.hargaSatuan ?? "",
        nilai: it.hargaSatuan != null ? it.hargaSatuan * it.qty : "",
        spv: t.spvPenanggungJawab,
        status: t.status === "confirmed" ? "Dikonfirmasi" : "Menunggu"
      })))} />
        <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
          <option value="all">Semua Toko</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        </div>}>Rekap Transfer Stok</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Data bersumber dari fitur <b>Transfer Stok</b> di mobile app (Transfer Out oleh SPV toko asal, Transfer In dikonfirmasi SPV toko tujuan). <b>Input harga bahan yang ditransfer bisa dilakukan di sini maupun lewat mobile app</b> (Eri) — datanya sama-sama valid, tinggal pilih yang paling nyaman.
      </div>

      {belumHarga.length > 0 && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      background: T.warnSoft,
      color: T.warn,
      padding: "12px 14px",
      borderRadius: 12,
      ...FI,
      fontWeight: 600,
      fontSize: 12.5,
      marginBottom: 16
    }} className="ais-flex-layout">
          <span>⚠</span>
          <div>
            Ada {belumHarga.length} transfer dengan bahan yang belum ada harga — mohon Eri input harganya.
            <div style={{
          fontWeight: 400,
          marginTop: 3
        }}>
              {belumHarga.map(t => `${stores.find(s => s.id === t.asalToko)?.name} → ${stores.find(s => s.id === t.tujuanToko)?.name} (${t.tanggal})`).join(", ")}
            </div>
          </div>
        </div>}

      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <StatCard label="Jumlah Transfer" value={rows.length} />
        <StatCard label="Belum Ada Harga" value={belumHarga.length} tone={belumHarga.length > 0 ? "warn" : "good"} />
      </div>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 10
    }}>Klik baris untuk lihat rincian bahan, qty, harga & bukti terima.</div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={THBG}>
              {["Tanggal", "Toko Asal", "Toko Tujuan", "Bukti Terima", "Qty Item", "Status Harga", "SPV Penanggung Jawab", "Status", ""].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{
              padding: 16,
              color: T.inkMuted
            }}>Belum ada transfer stok untuk filter ini.</td></tr>}
            {rows.map(t => {
            const isOpen = openId === t.id;
            const allPriced = t.items.every(it => it.hargaSatuan != null);
            return <Fragment key={t.id}>
                  <tr onClick={() => setOpenId(isOpen ? null : t.id)} style={{
                borderTop: `1px solid ${T.line}`,
                cursor: "pointer",
                background: isOpen ? T.surfaceSunk : "transparent"
              }}>
                    <td style={{
                  ...TD,
                  ...FM,
                  fontWeight: 600
                }}>{t.tanggal}</td>
                    <td style={TD}>{stores.find(s => s.id === t.asalToko)?.name}</td>
                    <td style={TD}>{stores.find(s => s.id === t.tujuanToko)?.name}</td>
                    <td style={TD}>{t.buktiTerimaFoto ? <Badge tone="good">Ada Foto</Badge> : <span style={{
                    color: T.inkMuted
                  }}>-</span>}</td>
                    <td style={TD}>{t.items.length}</td>
                    <td style={TD}>{allPriced ? <Badge tone="good">Lengkap</Badge> : <Badge tone="warn">Belum Lengkap</Badge>}</td>
                    <td style={{
                  ...TD,
                  color: T.inkMuted
                }}>{t.spvPenanggungJawab}</td>
                    <td style={TD}><Badge tone={t.status === "confirmed" ? "good" : "warn"}>{t.status === "confirmed" ? "Dikonfirmasi" : "Menunggu Konfirmasi"}</Badge></td>
                    <td style={{
                  ...TD,
                  textAlign: "right"
                }}><ChevronDown size={14} color={T.inkMuted} style={{
                    transform: isOpen ? "rotate(180deg)" : "none"
                  }} /></td>
                  </tr>
                  {isOpen && <tr style={{
                background: T.surfaceSunk
              }}>
                      <td colSpan={9} style={{
                  padding: "14px 16px",
                  borderTop: `1px dashed ${T.line}`
                }}>
                        <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    ...FI,
                    fontSize: 12,
                    marginBottom: 10
                  }}>
                          <thead><tr style={{
                        textAlign: "left",
                        color: T.inkMuted
                      }}><th style={{
                          padding: "2px 8px 6px 0"
                        }}>Bahan</th><th style={{
                          padding: "2px 8px"
                        }}>Qty</th><th style={{
                          padding: "2px 0"
                        }}>Harga/Satuan</th></tr></thead>
                          <tbody>
                            {t.items.map((it, i) => <tr key={i}>
                                <td style={{
                          padding: "3px 8px 3px 0"
                        }}>{it.bahanName}</td>
                                <td style={{
                          padding: "3px 8px"
                        }}>{it.qty}</td>
                                <td style={{
                          padding: "3px 0"
                        }}>
                                  {it.hargaSatuan != null ? rupiah(it.hargaSatuan) : <TransferHargaInlineEdit transferId={t.id} bahanId={it.bahanId} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} />}
                                </td>
                              </tr>)}
                          </tbody>
                        </table>
                        <div style={{
                    ...FI,
                    fontSize: 11.5,
                    color: T.inkMuted
                  }}>
                          {t.confirmedBy ? `Diterima & dikonfirmasi oleh ${t.confirmedBy}.` : "Belum dikonfirmasi oleh SPV toko tujuan."}
                          {t.buktiTerimaFoto && " Bukti terima (foto) tersimpan di mobile app."}
                        </div>
                      </td>
                    </tr>}
                </Fragment>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function avgHargaBeliBulan(storeId, bahanId, month, purchaseReports) {
  const items = purchaseReports.filter(p => p.storeId === storeId && p.tanggal.startsWith(month)).flatMap(p => p.items).filter(it => it.bahanId === bahanId);
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalValue = items.reduce((s, it) => s + it.subtotal, 0);
  return totalQty ? totalValue / totalQty : null; // null = tidak ada transaksi bulan ini
}

// Kalau di bulan target tidak ada pembelian sama sekali untuk bahan itu, jangan jatuh ke 0 —
// pakai harga pembelian TERAKHIR yang tercatat (sebelum/di bulan itu), sesuai praktik valuasi stok umum.
// Kalau belum pernah ada transaksi sama sekali, baru fallback ke rata² dari transaksi manapun yang ada.
function hargaBeliUntukBulan(storeId, bahanId, month, purchaseReports) {
  const bulanIni = avgHargaBeliBulan(storeId, bahanId, month, purchaseReports);
  if (bulanIni != null) return bulanIni;
  const sebelumBulanIni = purchaseReports.filter(p => p.storeId === storeId && p.tanggal < `${month}-01`).flatMap(p => p.items.map(it => ({
    ...it,
    tanggal: p.tanggal
  }))).filter(it => it.bahanId === bahanId).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  if (sebelumBulanIni.length) return sebelumBulanIni[0].harga;
  const kapanSaja = purchaseReports.filter(p => p.storeId === storeId).flatMap(p => p.items).filter(it => it.bahanId === bahanId);
  if (kapanSaja.length) return kapanSaja.reduce((s, it) => s + it.harga, 0) / kapanSaja.length;
  return 0; // benar-benar belum pernah ada transaksi pembelian untuk bahan ini di toko ini
}

// akhir=false -> nilai Persediaan Awal (qty Stok Awal bulan ini × harga beli terakhir sampai bulan LALU)
// akhir=true  -> nilai Persediaan Akhir (qty Stok Akhir bulan ini × harga beli terakhir sampai bulan BERJALAN)
function persediaanNilai(storeId, month, bahan, reportLog, stockLedger, purchaseReports, akhir) {
  const priceMonth = akhir ? month : prevMonthStr(month);
  return bahan.reduce((total, b) => {
    const stokAwal = computeStokAwal(storeId, b.id, month, reportLog, stockLedger, b);
    let qty = stokAwal;
    if (akhir) {
      const inQty = sumStokFieldFromLaporan(storeId, b.id, month, reportLog, "masuk");
      const outQty = sumStokFieldFromLaporan(storeId, b.id, month, reportLog, "pakai");
      const transferIn = sumLedgerJenis(storeId, b.id, month, stockLedger, "transfer_in");
      const transferOut = sumLedgerJenis(storeId, b.id, month, stockLedger, "transfer_out");
      const adjustment = sumLedgerJenis(storeId, b.id, month, stockLedger, "adjustment");
      qty = stokAwal + inQty - outQty + transferIn - transferOut + adjustment;
    }
    const harga = hargaBeliUntukBulan(storeId, b.id, priceMonth, purchaseReports);
    return total + qty * harga;
  }, 0);
}

/* ---- Agregator bulanan untuk PnL ---- */

// Total Diskon Penjualan sebulan = diskon offline + diskon tiap platform online.
function totalDiskonBulan(storeId, month, reportLog) {
  return dayEntries(reportLog, storeId, month).reduce((sum, d) => {
    const so = d.data.salesOnline;
    if (!so) return sum;
    const offline = Number(so.offlineDiskon) || 0;
    const online = ONLINE_PLATFORMS.reduce((a, pl) => a + (Number(so[pl.key]?.diskon) || 0), 0);
    return sum + offline + online;
  }, 0);
}

// Komisi Penjualan Online = fee pembayaran non-tunai (0,7%) + fee platform ojol (20%).
function totalKomisiBulan(storeId, month, reportLog) {
  return dayEntries(reportLog, storeId, month).reduce((sum, d) => {
    const feePembayaran = ["sales_shift1", "sales_shift2"].reduce((a, k) => a + (d.data[k] ? salesFeeBreakdown(d.data[k]).totalFee : 0), 0);
    const so = d.data.salesOnline;
    const feeOnline = so ? ONLINE_PLATFORMS.reduce((a, pl) => a + feePlatform(pl.key, Number(so[pl.key]?.gross) || 0, Number(so[pl.key]?.diskon) || 0, so[pl.key]?.fee), 0) : 0;
    return sum + feePembayaran + feeOnline;
  }, 0);
}

// Nilai rupiah transfer stok masuk/keluar sebulan (harga diinput Eri di Rekap Transfer Stok).
function nilaiTransferBulan(storeId, month, stockTransfers, arah) {
  return (stockTransfers || []).filter(t => (t.tanggal || "").startsWith(month)).filter(t => arah === "in" ? t.tujuanToko === storeId && t.status === "confirmed" : t.asalToko === storeId).reduce((sum, t) => sum + t.items.reduce((a, it) => a + (it.hargaSatuan != null ? it.hargaSatuan * it.qty : 0), 0), 0);
}

// Pembelian bahan baku yang sumber barangnya ACK (untuk Biaya Operasional Resto).
function pembelianSumberACK(storeId, month, purchaseReports, bahan) {
  const ackIds = new Set(bahan.filter(b => b.supplier === "ACK").map(b => b.id));
  return purchaseReports.filter(p => p.storeId === storeId && p.tanggal.startsWith(month)).flatMap(p => p.items).filter(it => ackIds.has(it.bahanId)).reduce((s, it) => s + (it.subtotal || 0), 0);
}

// Total pengeluaran harian toko sebulan (dari Laporan Sales Shift 2).
function totalPengeluaranHarianBulan(storeId, month, reportLog) {
  return dayEntries(reportLog, storeId, month).reduce((s, d) => s + (d.data.sales_shift2?.pengeluaran || 0), 0);
}

// Total beban toko sebulan per jenis (token listrik / PDAM / pulsa-internet).
function totalBebanTokoBulan(storeId, month, bebanToko, jenis, subJenis) {
  return (bebanToko || []).filter(b => b.storeId === storeId && (b.tanggal || "").startsWith(month) && b.jenis === jenis).filter(b => subJenis ? b.subJenis === subJenis : true).reduce((s, b) => s + (b.jumlah || 0), 0);
}

/* ---------------------------------------------------------
   SIMULASI PENUH SEPTEMBER 2026
   Dipakai untuk menguji rantai data: Laporan Sales & Stok harian → Pembelian →
   Transfer Stok → Beban Toko → Rekap-rekap → PnL. Deterministik (bukan acak)
   supaya angkanya bisa dicek ulang secara manual.
--------------------------------------------------------- */
const SIM_MONTH = "2026-09";
function seedSimulasiBulanan() {
  const reportLog = {};
  const purchaseReports = [];
  const stockTransfers = [];
  const bebanToko = [];
  const stockLedger = [];
  const stores = SEED_STORES.filter(s => s.status === "holding" && s.jenisToko === "resto").slice(0, 3);
  const ciprekSop = ciprekSopItems(SEED_PRODUCTS, SEED_BAHAN);
  const ciprekAnchor = sid => SEED_CIPREK_CONFIG[sid]?.anchors || {};
  const daysInMonth = 30; // September
  const operatorOf = {
    dtop_baros: "Galuh",
    dtop_cipanengah: "Hilman",
    dtop_lembursitu: "Revy"
  };

  // stok berjalan per toko+bahan sepanjang bulan
  // TheoWide harian per toko dari sales x BOM, dihitung dulu supaya pemakaian & pembelian bahan di simulasi
  // sebanding dengan penjualan (dengan simpangan kecil), bukan angka acak yang tak berhubungan.
  const theoSim = {};
  const mirrorSim = wasteMirrorIds(SEED_BAHAN).ids;
  {
    const mc = wasteMinyakCfg(null);
    stores.forEach((store, si) => {
      for (let day = 1; day <= daysInMonth + 3; day++) {
        const dow = new Date(2026, 8, day).getDay();
        const boost = dow === 0 || dow === 6 ? 1.35 : 1;
        const q1 = seedQtyProduk(day + si * 3, 1, boost),
          q2 = seedQtyProduk(day + si * 3, 2, boost);
        const qm = {};
        [q1, q2].forEach(q => Object.entries(q).forEach(([k, v]) => {
          qm[k] = (qm[k] || 0) + v;
        }));
        theoSim[`${store.id}_${day}`] = hitungTheoWideHari({
          qtyMap: qm,
          products: SEED_PRODUCTS,
          bahan: SEED_BAHAN,
          minyakCfg: mc,
          pakaiToleransi: true,
          mirrorIds: mirrorSim,
          outToko: null
        }).theo;
      }
    });
  }
  const pakaiTheo = b => b.id !== WASTE_ID.oil && !mirrorSim.has(b.id);
  const theoOf = (sid, day, bid) => theoSim[`${sid}_${day}`]?.[bid] || 0;
  const running = {};
  const pakaiBaseOf = b => b.harga >= 15000 ? 2 : b.harga >= 5000 ? 3 : b.harga >= 1000 ? 6 : 110;
  SEED_BAHAN.forEach((b, bi) => stores.forEach((s, si) => {
    // stok awal ± 5 hari konsumsi, biar tidak minus dan tidak menumpuk
    const konsumsiAwal = [1, 2, 3, 4, 5].reduce((a, d) => a + theoOf(s.id, d, b.id), 0);
    running[`${s.id}_${b.id}`] = pakaiTheo(b) && konsumsiAwal > 0 ? Math.ceil(konsumsiAwal * 1.1) : pakaiBaseOf(b) * 5 + (bi + si) % 3 * pakaiBaseOf(b);
  }));
  stores.forEach((store, si) => {
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${SIM_MONTH}-${pad(day)}`;
      const dow = new Date(2026, 8, day).getDay();
      const weekend = dow === 0 || dow === 6;
      const boost = weekend ? 1.35 : 1;
      const op = operatorOf[store.id];

      // --- Produk terjual ---
      const qty1 = seedQtyProduk(day + si * 3, 1, boost);
      const qty2 = seedQtyProduk(day + si * 3, 2, boost);
      const sumQty = q => SEED_PRODUCTS.reduce((s, p) => s + (q[p.id] || 0) * p.price, 0);
      const omsetKotor1 = sumQty(qty1);
      const omsetKotor2 = sumQty(qty2);
      const omsetKotorHarian = omsetKotor1 + omsetKotor2;

      // --- Penjualan online (ojol) ---
      const gofoodGross = Math.round(omsetKotorHarian * (weekend ? 0.14 : 0.11));
      const grabGross = Math.round(omsetKotorHarian * (weekend ? 0.10 : 0.08));
      const shopeeGross = Math.round(omsetKotorHarian * 0.06);
      const grossOnline = gofoodGross + grabGross + shopeeGross;
      const salesOnline = {
        gofood: {
          gross: gofoodGross,
          diskon: Math.round(gofoodGross * 0.08)
        },
        grabfood: {
          gross: grabGross,
          diskon: Math.round(grabGross * 0.06)
        },
        shopeefood: {
          gross: shopeeGross,
          diskon: Math.round(shopeeGross * 0.05)
        },
        offlineDiskon: day % 7 === 0 ? 25000 : 0,
        // promo mingguan
        inputBy: "Eri",
        inputAt: `${ds}T22:00:00`
      };

      // --- Pembayaran (offline dibagi ke cash/qris/debit/gopay) ---
      const offlineTotal = Math.max(omsetKotorHarian - grossOnline, 0);
      const bagi = (t, r) => Math.round(t * r);
      const pay1 = {
        cash: bagi(omsetKotor1 * (offlineTotal / omsetKotorHarian), 0.55),
        qris: bagi(omsetKotor1 * (offlineTotal / omsetKotorHarian), 0.28),
        debit: bagi(omsetKotor1 * (offlineTotal / omsetKotorHarian), 0.07),
        gopay: bagi(omsetKotor1 * (offlineTotal / omsetKotorHarian), 0.10)
      };
      const pay2 = {
        cash: bagi(omsetKotor2 * (offlineTotal / omsetKotorHarian), 0.50),
        qris: bagi(omsetKotor2 * (offlineTotal / omsetKotorHarian), 0.30),
        debit: bagi(omsetKotor2 * (offlineTotal / omsetKotorHarian), 0.08),
        gopay: bagi(omsetKotor2 * (offlineTotal / omsetKotorHarian), 0.12)
      };

      // --- Pengeluaran harian (di Shift 2) ---
      const peng = {
        "Sayur": 18000 + day % 4 * 2000,
        "Es Batu": 8000,
        "Sampah": 5000,
        "Parkir": 3000,
        "Ops. Karyawan": 20000
      };
      if (day % 5 === 0) peng["Gas 3 Kg"] = 22000;
      if (day % 9 === 0) peng["Chemical"] = 35000;
      if (day % 6 === 0) peng["Bensin"] = 15000;
      if (day % 11 === 0) peng["ATK"] = 18000;
      const pengeluaran = Object.values(peng).reduce((a, v) => a + v, 0);

      // --- Minyak (base prep & closing) ---
      const fryerPagi = 8 + day % 3;
      const fryerMalam = 7 + day % 3;
      const minyakBeku = 15 + si % 3 * 2;
      const minyakDatang = day % 6 === 0 ? 18 : 0;
      const totalBeku = minyakBeku + minyakDatang;
      const topUpCm = 3 + day % 2;
      const topUpL = Math.round(topUpCm * 1.68 * 100) / 100;

      // --- Stok bahan baku harian (rantai berjalan) ---
      // Pemakaian harian disesuaikan tier harga supaya COGS realistis; pembelian tiap 3 hari
      // dihitung menutup konsumsi 3 hari, sehingga stok akhir bulan tidak minus.
      const pakaiBase = b => b.harga >= 15000 ? 2 : b.harga >= 5000 ? 3 : b.harga >= 1000 ? 6 : 110;
      const stokPayload = {
        inputOleh: op,
        submittedAt: `${ds}T21:20:00`
      };
      const hariBeli = day % 3 === 1; // pembelian tiap 3 hari
      const purchaseItems = [];
      SEED_BAHAN.forEach((b, bi) => {
        const key = `${store.id}_${b.id}`;
        const awal = running[key];
        const theoHariIni = theoOf(store.id, day, b.id);
        const dariSales = pakaiTheo(b) && theoHariIni > 0;
        const base = pakaiBase(b);
        // Bahan yang ada di BOM: pemakaian crew = TheoWide ± simpangan (−3%..+9%); selain itu pola lama.
        // Crew menimbang cabe beserta tangkainya, dan Hotwings yang matang tapi tak terjual ikut terhitung pakai.
        const tambahan = b.id === WASTE_ID.cabe ? Math.round((400 + day % 4 * 100 + 200 + day % 3 * 100) * 0.08) : b.id === WASTE_ID.hotwing ? 1 + si % 2 : 0;
        let pakai = dariSales ? Math.round(theoHariIni * (1 + ((day + bi) % 5 - 1) * 0.03)) + tambahan : Math.round(base * (weekend ? 1.3 : 1)) + (day + bi) % 2;
        let masuk = 0;
        if (hariBeli) {
          masuk = dariSales ? Math.ceil((theoHariIni + theoOf(store.id, day + 1, b.id) + theoOf(store.id, day + 2, b.id)) * 1.25) : base * 3 + Math.round(base * 0.2); // konsumsi 3 hari + buffer 20%
          const hargaBeli = Math.round(b.harga * (1 + (day % 5 - 2) * 0.02)); // fluktuasi ±4%
          purchaseItems.push({
            bahanId: b.id,
            bahanName: b.name,
            qty: masuk,
            harga: hargaBeli,
            subtotal: masuk * hargaBeli
          });
        }
        pakai = Math.min(pakai, awal + masuk); // rantai stok tidak boleh minus
        const akhir = awal + masuk - pakai;
        running[key] = akhir;
        stokPayload[b.id] = {
          awal,
          masuk,
          pakai,
          transferIn: 0,
          transferOut: 0,
          akhir
        };
      });
      if (purchaseItems.length) {
        purchaseReports.push({
          id: `pb_${store.id}_${ds}`,
          storeId: store.id,
          tanggal: ds,
          items: purchaseItems,
          total: purchaseItems.reduce((a, it) => a + it.subtotal, 0),
          inputOleh: day % 2 === 0 ? "Nana" : "Eri",
          inputOlehId: day % 2 === 0 ? "nana" : "eri",
          submittedAt: `${ds}T10:00:00`,
          invoiceFoto: null
        });
      }
      reportLog[`${store.id}_${ds}`] = {
        opening: {
          submittedAt: `${ds}T06:55:00`,
          inputOleh: op
        },
        base_prep: {
          sambelCiprek: (() => {
            const cabe = 400 + day % 4 * 100;
            const target = Math.floor(cabe / 20);
            // Aktual dibuat mendekati teoritis dengan simpangan kecil (−3%..+1%), seperti di lapangan.
            const teoritis = hitungCiprek(cabe, ciprekSop, ciprekAnchor(store.id)).totalSambalJadi;
            const variance = 1 - day % 5 * 0.01;
            return {
              jumlahCabe: cabe,
              targetCup: target,
              bahan: [],
              fotoTimbangan: null,
              fotoCup: null,
              totalJadi: Math.round(teoritis * variance),
              jumlahCup: target - (day % 3 === 0 ? 1 : 0),
              sisaSambal: 4 + day % 6
            };
          })(),
          saosHotwing: {
            cup: 6 + si % 2,
            foto: null
          },
          minyak: {
            minyakBekuKg: minyakBeku,
            minyakDatangKg: minyakDatang,
            totalMinyakBekuKg: totalBeku,
            minyakFryerCm: fryerPagi,
            literMinyakFryer: Math.round((fryerPagi * 1.68 + 14.57) * 100) / 100,
            totalStokAwalMinyak: Math.round((totalBeku + fryerPagi * 1.68 + 14.57) * 100) / 100,
            topUp1Cm: topUpCm,
            topUp1Liter: topUpL
          },
          inputOleh: op,
          submittedAt: `${ds}T06:50:00`
        },
        etalase_0700: {
          stok: 18 + si % 4,
          note: "",
          submittedAt: `${ds}T07:05:00`,
          inputOleh: op
        },
        etalase_1100: {
          stok: 22 + day % 4,
          note: "",
          submittedAt: `${ds}T11:03:00`,
          inputOleh: op
        },
        sales_shift1: {
          qty: qty1,
          omsetKotor: omsetKotor1,
          pengeluaran: 0,
          omsetOnline: Math.round(grossOnline * 0.4),
          payment: pay1,
          omsetBersih: omsetKotor1 - Math.round(grossOnline * 0.4),
          inputOleh: op,
          submittedAt: `${ds}T15:10:00`
        },
        produksi_shift1: {
          batch: 6 + day % 3,
          sisaAyamBreakdown: {
            dada: 1 + day % 2,
            pahaAtas: 1,
            pahaBawah: day % 2,
            sayap: 1 + (day + si) % 2
          },
          sisaAyam: 1 + day % 2 + 1 + day % 2 + (1 + (day + si) % 2),
          sisaHotwing: 2 + si % 3,
          sisaKulit: 1 + day % 2,
          catatan: day % 12 === 0 ? "1 batch gosong, sudah dibuang." : "",
          inputOleh: op,
          submittedAt: `${ds}T15:12:00`
        },
        etalase_1700: {
          stok: 15 + si % 3,
          note: "",
          submittedAt: `${ds}T17:04:00`,
          inputOleh: op
        },
        base_prep_2: (() => {
          const adaTopUp2 = day % 3 !== 0; // sebagian hari tidak ada top up kedua
          const tu2Cm = 2 + day % 2;
          const tu2L = Math.round(tu2Cm * 1.68 * 100) / 100;
          const sebelumCm = fryerMalam + 1; // pembacaan sebelum top up 2 lebih tinggi dari closing (minyak terus terpakai setelah top up 2)
          const sebelumL = Math.round((sebelumCm * 1.68 + 14.57) * 100) / 100;
          return {
            sesi: 2,
            sambelCiprek: (() => {
              const cabe = 200 + day % 3 * 100;
              const target = Math.floor(cabe / 20);
              const teoritis = hitungCiprek(cabe, ciprekSop, ciprekAnchor(store.id)).totalSambalJadi;
              const variance = 1 - day % 4 * 0.012;
              return {
                jumlahCabe: cabe,
                targetCup: target,
                bahan: [],
                fotoTimbangan: null,
                fotoCup: null,
                totalJadi: Math.round(teoritis * variance),
                jumlahCup: target - (day % 4 === 0 ? 1 : 0),
                sisaSambal: 3 + day % 5
              };
            })(),
            saosHotwing: {
              cup: 4 + day % 2,
              foto: null
            },
            topUpMinyak2: {
              ada: adaTopUp2,
              ...(adaTopUp2 ? {
                sebelumCm,
                sebelumLiter: sebelumL,
                topUpCm: tu2Cm,
                topUp2Liter: tu2L,
                sesudahLiter: Math.round((sebelumL + tu2L) * 100) / 100
              } : {}),
              topUp1Liter: topUpL,
              totalTopUp: Math.round((topUpL + (adaTopUp2 ? tu2L : 0)) * 100) / 100
            },
            inputOleh: op,
            submittedAt: `${ds}T17:30:00`
          };
        })(),
        etalase_2000: {
          stok: 5 + day % 4,
          ajukanGoreng: day % 4 === 0,
          qtyGoreng: day % 4 === 0 ? 15 : 0,
          submittedAt: `${ds}T20:02:00`,
          inputOleh: op
        },
        sales_shift2: {
          qty: qty2,
          omsetKotor: omsetKotor2,
          pengeluaran,
          pengeluaranItems: peng,
          omsetOnline: grossOnline - Math.round(grossOnline * 0.4),
          payment: pay2,
          omsetBersih: omsetKotor2 - (grossOnline - Math.round(grossOnline * 0.4)) - pengeluaran,
          inputOleh: op,
          submittedAt: `${ds}T21:15:00`
        },
        produksi_shift2: {
          batch: 5 + day % 2,
          sisaAyamBreakdown: {
            dada: day % 2,
            pahaAtas: 1,
            pahaBawah: day % 2,
            sayap: si % 2
          },
          sisaAyam: day % 2 + 1 + day % 2 + si % 2,
          sisaHotwing: 1 + si % 2,
          sisaKulit: day % 2,
          sisaCiprekCup: day % 3,
          sisaSaosHotwingCup: day % 2,
          tangkaiCabeGr: Math.round((400 + day % 4 * 100 + 200 + day % 3 * 100) * 0.08),
          catatan: "",
          inputOleh: op,
          submittedAt: `${ds}T21:17:00`,
          minyakClosing: {
            minyakBekuAkhir: Math.round(Math.max(totalBeku - (topUpL + (day % 3 !== 0 ? Math.round((2 + day % 2) * 1.68 * 100) / 100 : 0)), 0) * 100) / 100,
            minyakFryerAkhirCm: fryerMalam,
            literMinyakFryerAkhir: Math.round((fryerMalam * 1.68 + 14.57) * 100) / 100,
            totalStokAkhirMinyak: Math.round((Math.max(totalBeku - topUpL, 0) + fryerMalam * 1.68 + 14.57) * 100) / 100
          }
        },
        stok: stokPayload,
        salesOnline,
        closing: {
          submittedAt: `${ds}T21:30:00`,
          inputOleh: op
        }
      };
    }
  });

  // --- Transfer stok antar toko (sudah berharga, supaya masuk PnL) ---
  const transferPlan = [{
    day: 5,
    asal: 0,
    tujuan: 1,
    spv: "Sodik",
    items: [["oil_mi_01_001", 10], ["dry_te_01_001", 5]]
  }, {
    day: 12,
    asal: 0,
    tujuan: 2,
    spv: "Sahrul",
    items: [["aym_ay_01_002", 20]]
  }, {
    day: 18,
    asal: 1,
    tujuan: 0,
    spv: "Sodik",
    items: [["dry_be_01_003", 15], ["dry_ke_01_002", 30]]
  }, {
    day: 25,
    asal: 2,
    tujuan: 1,
    spv: "Sahrul",
    items: [["aym_ho_01_003", 25]]
  }];
  transferPlan.forEach((t, idx) => {
    const ds = `${SIM_MONTH}-${pad(t.day)}`;
    const items = t.items.map(([bid, q]) => {
      const b = SEED_BAHAN.find(x => x.id === bid);
      return {
        bahanId: bid,
        bahanName: b.name,
        qty: q,
        hargaSatuan: b.harga
      };
    });
    stockTransfers.push({
      id: `tf_ags_${idx}`,
      tanggal: ds,
      asalToko: stores[t.asal].id,
      tujuanToko: stores[t.tujuan].id,
      spvPenanggungJawab: t.spv,
      items,
      status: "confirmed",
      buktiTerimaFoto: "confirmed_placeholder",
      confirmedBy: t.spv,
      submittedAt: `${ds}T10:00:00`
    });
    // Entri ledger tidak ditulis di sini — sudah diturunkan otomatis oleh deriveLedger()
    // dari daftar stockTransfers, supaya tidak terhitung dua kali.
  });

  // --- Beban toko sebulan ---
  stores.forEach((store, si) => {
    [3, 10, 17, 24].forEach((day, i) => bebanToko.push({
      id: `bb_tl_${store.id}_${i}`,
      storeId: store.id,
      jenis: "token_listrik",
      tanggal: `${SIM_MONTH}-${pad(day)}`,
      jumlah: 200000 + si * 25000,
      olehId: "galuh",
      olehNama: operatorOf[store.id],
      submittedAt: `${SIM_MONTH}-${pad(day)}T09:00:00`
    }));
    bebanToko.push({
      id: `bb_pdam_${store.id}`,
      storeId: store.id,
      jenis: "pdam",
      tanggal: `${SIM_MONTH}-15`,
      jumlah: 185000 + si * 15000,
      olehId: "galuh",
      olehNama: operatorOf[store.id],
      submittedAt: `${SIM_MONTH}-15T09:00:00`
    });
    bebanToko.push({
      id: `bb_net_${store.id}`,
      storeId: store.id,
      jenis: "pulsa_internet",
      tanggal: `${SIM_MONTH}-05`,
      jumlah: 350000,
      subJenis: "internet",
      nomorHp: null,
      olehId: "galuh",
      olehNama: operatorOf[store.id],
      submittedAt: `${SIM_MONTH}-05T09:00:00`
    });
    bebanToko.push({
      id: `bb_pulsa_${store.id}`,
      storeId: store.id,
      jenis: "pulsa_internet",
      tanggal: `${SIM_MONTH}-20`,
      jumlah: 50000,
      subJenis: "pulsa",
      nomorHp: `08123456${700 + si}`,
      olehId: "galuh",
      olehNama: operatorOf[store.id],
      submittedAt: `${SIM_MONTH}-20T09:00:00`
    });
  });
  return {
    reportLog,
    purchaseReports,
    stockTransfers,
    bebanToko,
    stockLedger
  };
}

/* ---------------------------------------------------------
   EKSPOR LAPORAN (Excel/CSV & PDF) — selalu mengikuti filter yang sedang aktif
--------------------------------------------------------- */
function toCsvValue(v) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename, columns, rows, meta) {
  const lines = [];
  (meta || []).forEach(m => lines.push(toCsvValue(m)));
  if (meta?.length) lines.push("");
  lines.push(columns.map(c => toCsvValue(c.label)).join(";"));
  rows.forEach(r => lines.push(columns.map(c => toCsvValue(r[c.key])).join(";")));
  // BOM supaya karakter Indonesia terbaca benar di Excel
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function buildPrintableHtml(title, meta, columns, rows) {
  const head = columns.map(c => `<th>${c.label}</th>`).join("");
  const body = rows.map(r => `<tr>${columns.map(c => `<td>${r[c.key] == null ? "" : String(r[c.key])}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;padding:24px}
    h1{font-size:17px;margin:0 0 4px}
    .meta{font-size:11px;color:#666;margin-bottom:14px;line-height:1.6}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f2f2f2}
    @media print{@page{margin:12mm}}
  </style></head><body>
  <h1>${title}</h1>
  <div class="meta">${(meta || []).join("<br>")}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;
}
function downloadPdf(title, meta, columns, rows) {
  const html = buildPrintableHtml(title, meta, columns, rows);
  const w = window.open("", "_blank");
  if (!w) {
    // Pop-up diblokir — jatuhkan ke unduhan berkas HTML yang bisa dicetak jadi PDF
    const blob = new Blob([html], {
      type: "text/html;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  w.document.write(html);
  w.document.close();
}
function ExportButtons({
  title,
  meta,
  columns,
  rows,
  filename
}) {
  const disabled = !rows || rows.length === 0;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: `1px solid ${T.line}`,
    borderRadius: 8,
    padding: "7px 11px",
    background: "transparent",
    ...FI,
    fontWeight: 600,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap"
  };
  return <div style={{
    display: "flex",
    gap: 8
  }} className="ais-flex-layout">
      <button disabled={disabled} onClick={() => downloadCsv(filename, columns, rows, meta)} style={{
      ...base,
      color: T.good
    }} className="ais-button ais-button--default">
        <Download size={13} /> Excel
      </button>
      <button disabled={disabled} onClick={() => downloadPdf(title, meta, columns, rows)} style={{
      ...base,
      color: T.bad
    }} className="ais-button ais-button--danger">
        <Download size={13} /> PDF
      </button>
    </div>;
}

/* ---------------------------------------------------------
   KONVERSI PACK AYAM ORIGINAL
   1 pack Ayam Original = 9 potong: 3 Dada, 2 Paha Atas, 2 Paha Bawah, 2 Sayap.
   BOM menghitung per potongan, sementara stok dibeli & dicatat per pack — jadi
   pemakaian pack dihitung balik dari potongan yang terpakai.
--------------------------------------------------------- */
const AYAM_YIELD = {
  aym_dd_01_008: 3,
  // Dada
  aym_pa_01_005: 2,
  // Paha Atas
  aym_pb_01_006: 2,
  // Paha Bawah
  aym_sw_01_007: 2 // Sayap
};
const AYAM_PACK_ID = "aym_ay_01_002";

// Pack yang harus dibuka = potongan terbanyak yang dibutuhkan di antara semua bagian.
// Membuka 1 pack sekaligus menyediakan seluruh bagian, jadi dipakai MAX bukan penjumlahan.
function packAyamTerbuka(pakaiPerPotongan) {
  return Math.max(0, ...Object.entries(AYAM_YIELD).map(([id, yld]) => Math.ceil((Number(pakaiPerPotongan?.[id]) || 0) / yld)));
}

// Sisa potongan setelah pack dibuka, dikurangi sisa matang dari Laporan Produksi.
// Nilai positif = masih ada potongan mentah yang belum terpakai (muncul sebagai catatan).
function sisaPotonganAyam(pakaiPerPotongan, sisaMatang) {
  const pack = packAyamTerbuka(pakaiPerPotongan);
  const out = {};
  Object.entries(AYAM_YIELD).forEach(([id, yld]) => {
    const tersedia = pack * yld;
    const terpakai = Number(pakaiPerPotongan?.[id]) || 0;
    const matang = Number(sisaMatang?.[id]) || 0;
    out[id] = Math.max(0, tersedia - terpakai - matang);
  });
  return {
    pack,
    sisaMentah: out,
    adaSisa: Object.values(out).some(v => v > 0)
  };
}

// Pemakaian potongan ayam menurut sistem = qty produk terjual × BOM.
function pakaiPotonganDariSales(salesQty, products) {
  const out = {
    aym_dd_01_008: 0,
    aym_pa_01_005: 0,
    aym_pb_01_006: 0,
    aym_sw_01_007: 0
  };
  Object.entries(salesQty || {}).forEach(([pid, qty]) => {
    const p = (products || []).find(x => x.id === pid);
    (p?.resep || []).forEach(r => {
      if (out[r.bahanId] !== undefined) out[r.bahanId] += (Number(qty) || 0) * (Number(r.qty) || 0);
    });
  });
  return out;
}
const PNL_STATUS_DEFAULT = {
  status: "draft",
  submittedBy: null,
  submittedAt: null,
  editRequestedBy: null,
  editRequestedAt: null,
  approvals: {},
  editedBy: null,
  editedAt: null
};
function fmtWaktu(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString("id-ID")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function PnLPage({
  stores,
  bahan,
  reportLog,
  stockLedger,
  purchaseReports,
  stockTransfers,
  bebanToko,
  pnlInputs,
  setPnlInputs,
  pnlStatusAll,
  setPnlStatusAll,
  currentUser
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const key = `${store}_${month}`;
  const data = {
    ...PNL_DEFAULT,
    ...(pnlInputs[key] || {})
  };
  const setField = (field, value) => setPnlInputs({
    ...pnlInputs,
    [key]: {
      ...data,
      [field]: value
    }
  });
  const statusData = {
    ...PNL_STATUS_DEFAULT,
    ...(pnlStatusAll[key] || {})
  };
  const setStatus = next => setPnlStatusAll({
    ...pnlStatusAll,
    [key]: {
      ...statusData,
      ...next
    }
  });
  const isEri = currentUser.id === "eri";
  const isApprover = currentUser.id === "kurnia" || currentUser.id === "juhaeri";
  const fieldsEditable = isEri && (statusData.status === "draft" || statusData.status === "unlocked");
  const submitLock = () => {
    const wasEdit = statusData.status === "unlocked";
    setStatus({
      status: "locked",
      submittedBy: statusData.submittedBy || currentUser.name,
      submittedAt: statusData.submittedAt || new Date().toISOString(),
      ...(wasEdit ? {
        editedBy: currentUser.name,
        editedAt: new Date().toISOString()
      } : {})
    });
  };
  const requestEdit = () => setStatus({
    status: "edit_requested",
    editRequestedBy: currentUser.name,
    editRequestedAt: new Date().toISOString(),
    approvals: {}
  });
  const approveEdit = () => {
    const nextApprovals = {
      ...statusData.approvals,
      [currentUser.id]: true
    };
    const bothApproved = nextApprovals.kurnia && nextApprovals.juhaeri;
    setStatus({
      approvals: nextApprovals,
      status: bothApproved ? "unlocked" : "edit_requested"
    });
  };
  const days = dayEntries(reportLog, store, month);
  const omset = days.reduce((s, d) => s + (d.data.sales_shift1?.omsetKotor || 0) + (d.data.sales_shift2?.omsetKotor || 0), 0);

  // --- otomatis dari operasional harian ---
  const diskonPenjualan = totalDiskonBulan(store, month, reportLog);
  const komisiOnline = totalKomisiBulan(store, month, reportLog);
  const pembelianRaw = purchaseReports.filter(p => p.storeId === store && p.tanggal.startsWith(month)).reduce((s, p) => s + p.total, 0);
  const nilaiTransferIn = nilaiTransferBulan(store, month, stockTransfers, "in");
  const nilaiTransferOut = nilaiTransferBulan(store, month, stockTransfers, "out");
  const pembelianTotal = pembelianRaw + nilaiTransferIn - nilaiTransferOut;
  const persediaanAwalValue = persediaanNilai(store, month, bahan, reportLog, stockLedger, purchaseReports, false);
  const persediaanAkhirValue = persediaanNilai(store, month, bahan, reportLog, stockLedger, purchaseReports, true);
  const totalPenjualanBersih = omset + data.pendapatanLain - diskonPenjualan - data.feeLainLain - komisiOnline;
  const cogs = persediaanAwalValue + pembelianTotal + data.ongkosKirim - persediaanAkhirValue;
  const labaKotor = totalPenjualanBersih - cogs;

  // Biaya Operasional Resto = pembelian bahan dari ACK + pengeluaran harian toko
  const pembelianACK = pembelianSumberACK(store, month, purchaseReports, bahan);
  const pengeluaranHarian = totalPengeluaranHarianBulan(store, month, reportLog);
  const biayaOperasionalResto = pembelianACK + pengeluaranHarian;
  const totalOperasional = biayaOperasionalResto + data.biayaGajiKaryawan + data.biayaSewaTempat + data.biayaPajakResto + data.biayaPajakReklame + data.biayaPenyusutan + data.thr + data.joinFee + data.aplikasiPawoon;

  // Listrik / PDAM / Internet otomatis dari Rekap Beban Toko
  const biayaListrik = totalBebanTokoBulan(store, month, bebanToko, "token_listrik");
  const biayaPdam = totalBebanTokoBulan(store, month, bebanToko, "pdam");
  const biayaInternet = totalBebanTokoBulan(store, month, bebanToko, "pulsa_internet");
  const totalBiayaLain = biayaListrik + biayaPdam + biayaInternet + data.biayaMaintenance + data.toolsMarketing + data.claimOffice + data.jasaMarinir + data.bonusOmset;
  const totalBiayaOperasional = totalOperasional + totalBiayaLain;
  const labaSebelumZakat = labaKotor - totalBiayaOperasional;
  const zakat = labaSebelumZakat > 0 ? labaSebelumZakat * (data.zakatPercent / 100) : 0;
  const labaSetelahZakat = labaSebelumZakat - zakat;
  const labaBersih = labaSetelahZakat - data.labaDitahan;
  const pengelola = labaBersih * (data.pengelolaPercent / 100);
  const holding = labaBersih - pengelola;
  const pct = v => omset ? Math.round(v / omset * 100) : 0;
  const storeObj = stores.find(s => s.id === store);
  const monthName = BULAN_ID[Number(month.slice(5, 7)) - 1] || "";
  const year = month.slice(0, 4);
  return <div>
      <SectionTitle icon={FileBarChart2} action={<div style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }} className="ais-flex-layout">
          <ExportButtons title={`Laporan Laba Rugi — ${storeObj?.name} — ${monthName} ${year}`} meta={[`Toko: ${storeObj?.name}`, `Periode: ${monthName} ${year}`, `Status: ${statusData.status === "submitted" ? "Sudah Disubmit" : statusData.status === "unlocked" ? "Dibuka untuk Edit" : "Draft"}`]} filename={`pnl_${store}_${month}`} columns={[{
        key: "pos",
        label: "Pos"
      }, {
        key: "nilai",
        label: "Nilai (Rp)"
      }, {
        key: "persen",
        label: "% Omset"
      }]} rows={[{
        pos: "I. PENDAPATAN",
        nilai: "",
        persen: ""
      }, {
        pos: "Penjualan / Omset",
        nilai: omset,
        persen: pct(omset)
      }, {
        pos: "Pendapatan Lain-lain",
        nilai: data.pendapatanLain,
        persen: pct(data.pendapatanLain)
      }, {
        pos: "Diskon Penjualan",
        nilai: -diskonPenjualan,
        persen: pct(diskonPenjualan)
      }, {
        pos: "Fee Lain-lain",
        nilai: -data.feeLainLain,
        persen: pct(data.feeLainLain)
      }, {
        pos: "Komisi Penjualan Online",
        nilai: -komisiOnline,
        persen: pct(komisiOnline)
      }, {
        pos: "Total Penjualan Bersih",
        nilai: totalPenjualanBersih,
        persen: pct(totalPenjualanBersih)
      }, {
        pos: "Persediaan Awal",
        nilai: persediaanAwalValue,
        persen: pct(persediaanAwalValue)
      }, {
        pos: "Pembelian (termasuk Transfer In/Out)",
        nilai: pembelianTotal,
        persen: pct(pembelianTotal)
      }, {
        pos: "Biaya Ongkos Kirim",
        nilai: data.ongkosKirim,
        persen: pct(data.ongkosKirim)
      }, {
        pos: "Persediaan Akhir",
        nilai: -persediaanAkhirValue,
        persen: pct(persediaanAkhirValue)
      }, {
        pos: "COGS",
        nilai: cogs,
        persen: pct(cogs)
      }, {
        pos: "LABA KOTOR",
        nilai: labaKotor,
        persen: pct(labaKotor)
      }, {
        pos: "II. BIAYA OPERASIONAL",
        nilai: "",
        persen: ""
      }, {
        pos: "Biaya Operasional Resto",
        nilai: biayaOperasionalResto,
        persen: pct(biayaOperasionalResto)
      }, {
        pos: "Biaya Gaji Karyawan",
        nilai: data.biayaGajiKaryawan,
        persen: pct(data.biayaGajiKaryawan)
      }, {
        pos: "Biaya Sewa Tempat",
        nilai: data.biayaSewaTempat,
        persen: pct(data.biayaSewaTempat)
      }, {
        pos: "Biaya Pajak Resto",
        nilai: data.biayaPajakResto,
        persen: pct(data.biayaPajakResto)
      }, {
        pos: "Biaya Pajak Reklame",
        nilai: data.biayaPajakReklame,
        persen: pct(data.biayaPajakReklame)
      }, {
        pos: "Biaya Penyusutan",
        nilai: data.biayaPenyusutan,
        persen: pct(data.biayaPenyusutan)
      }, {
        pos: "THR",
        nilai: data.thr,
        persen: pct(data.thr)
      }, {
        pos: "Join Fee",
        nilai: data.joinFee,
        persen: pct(data.joinFee)
      }, {
        pos: "Aplikasi Pawoon",
        nilai: data.aplikasiPawoon,
        persen: pct(data.aplikasiPawoon)
      }, {
        pos: "Total Operasional",
        nilai: totalOperasional,
        persen: pct(totalOperasional)
      }, {
        pos: "Biaya Listrik",
        nilai: biayaListrik,
        persen: pct(biayaListrik)
      }, {
        pos: "Biaya PDAM",
        nilai: biayaPdam,
        persen: pct(biayaPdam)
      }, {
        pos: "Biaya Internet & Pulsa",
        nilai: biayaInternet,
        persen: pct(biayaInternet)
      }, {
        pos: "Total Biaya Lain-lain",
        nilai: totalBiayaLain,
        persen: pct(totalBiayaLain)
      }, {
        pos: "TOTAL BIAYA OPERASIONAL",
        nilai: totalBiayaOperasional,
        persen: pct(totalBiayaOperasional)
      }, {
        pos: "Laba Sebelum Zakat",
        nilai: labaSebelumZakat,
        persen: pct(labaSebelumZakat)
      }, {
        pos: `Zakat ${data.zakatPercent}%`,
        nilai: -zakat,
        persen: pct(zakat)
      }, {
        pos: "Laba Setelah Zakat",
        nilai: labaSetelahZakat,
        persen: pct(labaSetelahZakat)
      }, {
        pos: "Laba Ditahan",
        nilai: -data.labaDitahan,
        persen: pct(data.labaDitahan)
      }, {
        pos: "LABA BERSIH",
        nilai: labaBersih,
        persen: pct(labaBersih)
      }, {
        pos: `Pengelola ${data.pengelolaPercent}%`,
        nilai: pengelola,
        persen: pct(pengelola)
      }, {
        pos: "Holding",
        nilai: holding,
        persen: pct(holding)
      }]} />
          <select value={store} onChange={e => setStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>PnL — Profit & Loss</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Baris bertanda <b>(auto)</b> dihitung dari operasional harian: <b>Omset</b> &amp; <b>Pengeluaran Harian</b> dari Laporan Sales; <b>Diskon</b> &amp; <b>Komisi Online</b> dari Laporan Sales Online (fee pembayaran 0,7% + fee platform 20%); <b>Pembelian</b> = Pembelian Bahan Baku + nilai Transfer In − Transfer Out; <b>Biaya Operasional Resto</b> = pembelian bahan sumber ACK + pengeluaran harian; <b>Listrik/PDAM/Internet</b> dari Rekap Beban Toko. <b>Persediaan Awal</b> = Stok Awal × harga beli bulan lalu, <b>Persediaan Akhir</b> = Stok Akhir × rata² harga beli bulan berjalan. Sisanya diinput manual. Hanya <b>Eri</b> yang dapat menginput &amp; submit laporan ini.
      </div>

      {statusData.status === "locked" && <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
      background: T.goodSoft,
      color: T.good,
      padding: "10px 14px",
      borderRadius: 10
    }} className="ais-flex-layout">
          <span style={{
        ...FI,
        fontSize: 12.5,
        fontWeight: 600
      }}>
            <Check size={13} style={{
          verticalAlign: -2
        }} /> Terkunci — disubmit oleh {statusData.submittedBy} pada {fmtWaktu(statusData.submittedAt)}.
            {statusData.editedBy && ` Terakhir diedit oleh ${statusData.editedBy} pada ${fmtWaktu(statusData.editedAt)}.`}
          </span>
          {isEri && <button onClick={requestEdit} style={{
        border: "none",
        borderRadius: 8,
        padding: "6px 12px",
        background: T.good,
        color: "#fff",
        ...FI,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }} className="ais-button ais-button--primary">Ajukan Edit</button>}
        </div>}

      {statusData.status === "edit_requested" && <div style={{
      marginBottom: 16,
      background: T.warnSoft,
      color: T.warn,
      padding: "10px 14px",
      borderRadius: 10
    }}>
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 6
      }} className="ais-flex-layout">
            <span style={{
          ...FI,
          fontSize: 12.5,
          fontWeight: 600
        }}>
              Menunggu approval Kurnia & Juhaeri untuk membuka akses edit (diajukan oleh {statusData.editRequestedBy}).
            </span>
          </div>
          <div style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        flexWrap: "wrap"
      }} className="ais-flex-layout">
            <span style={{
          ...FI,
          fontSize: 12
        }}>Kurnia: <b>{statusData.approvals?.kurnia ? "Sudah setuju" : "Menunggu"}</b></span>
            <span style={{
          ...FI,
          fontSize: 12
        }}>Juhaeri: <b>{statusData.approvals?.juhaeri ? "Sudah setuju" : "Menunggu"}</b></span>
            {isApprover && !statusData.approvals?.[currentUser.id] && <button onClick={approveEdit} style={{
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.warn,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">Setujui Buka Edit</button>}
          </div>
        </div>}

      {statusData.status === "unlocked" && <div style={{
      marginBottom: 16,
      background: T.accentSoft,
      color: T.accentDeep,
      padding: "10px 14px",
      borderRadius: 10,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600
    }}>
          <PenLine size={13} style={{
        verticalAlign: -2
      }} /> Akses edit terbuka (disetujui Kurnia & Juhaeri) — silakan edit lalu Submit ulang untuk mengunci kembali.
        </div>}

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "28px 30px",
      maxWidth: 860,
      margin: "0 auto",
      overflowX: "auto"
    }} className="ais-content-panel">
        <div style={{
        textAlign: "center",
        marginBottom: 18,
        paddingBottom: 14,
        borderBottom: `2px solid ${T.ink}`
      }}>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: 0.4
        }}>D'TOP CHICKEN & BURGER {(storeObj?.name || "").replace(/^DTOP\s*/i, "").toUpperCase()}</div>
          <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 13,
          marginTop: 4,
          letterSpacing: 0.3
        }}>LAPORAN LABA RUGI</div>
          <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          marginTop: 2
        }}>PERIODE {monthName} {year}</div>
        </div>

        <table style={{
        width: "100%",
        borderCollapse: "collapse"
      }}>
          <tbody>
            <PnLSectionLabel top={12}>I. PENDAPATAN</PnLSectionLabel>
            <PnLRow label="Penjualan / Omset" value={omset} sign="plus" />
            <PnLRow label="Pendapatan Lain Lain" value={data.pendapatanLain} editable={fieldsEditable} onChange={v => setField("pendapatanLain", v)} percent={pct(data.pendapatanLain)} sign="plus" />
            <PnLRow label="Diskon Penjualan (auto)" value={diskonPenjualan} percent={pct(diskonPenjualan)} sign="minus" />
            <PnLRow label="Fee Lain-lain" value={data.feeLainLain} editable={fieldsEditable} onChange={v => setField("feeLainLain", v)} percent={pct(data.feeLainLain)} sign="minus" />
            <PnLRow label="Komisi Penjualan Online (auto)" value={komisiOnline} percent={pct(komisiOnline)} sign="minus" />
            <PnLRow label="Total Penjualan Bersih" value={totalPenjualanBersih} bold sectionEnd />

            <PnLRow label="Persediaan Awal" value={persediaanAwalValue} percent={pct(persediaanAwalValue)} sign="plus" />
            <PnLRow label="Pembelian (auto)" value={pembelianTotal} percent={pct(pembelianTotal)} sign="plus" />
            <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            padding: "0 0 6px 14px"
          }}>
              Pembelian {rupiah(pembelianRaw)} + Transfer In {rupiah(nilaiTransferIn)} − Transfer Out {rupiah(nilaiTransferOut)}
            </div>
            <PnLRow label="Biaya Ongkos Kirim" value={data.ongkosKirim} editable={fieldsEditable} onChange={v => setField("ongkosKirim", v)} percent={pct(data.ongkosKirim)} sign="plus" />
            <PnLRow label="Persediaan Akhir" value={persediaanAkhirValue} percent={pct(persediaanAkhirValue)} sign="minus" />
            <PnLRow label="COGS / HPP" value={cogs} bold percent={pct(cogs)} sectionEnd />

            <PnLRow label="LABA KOTOR" value={labaKotor} bold highlight percent={pct(labaKotor)} />

            <PnLSectionLabel>II. BIAYA-BIAYA</PnLSectionLabel>
            <PnLSubLabel>1. Biaya Operasional</PnLSubLabel>
            <PnLRow label="Biaya Operasional Resto (auto)" value={biayaOperasionalResto} percent={pct(biayaOperasionalResto)} indent={12} sign="minus" />
            <PnLRow label="Biaya Gaji Karyawan" value={data.biayaGajiKaryawan} editable={fieldsEditable} onChange={v => setField("biayaGajiKaryawan", v)} percent={pct(data.biayaGajiKaryawan)} indent={12} sign="minus" />
            <PnLRow label="Biaya Sewa Tempat" value={data.biayaSewaTempat} editable={fieldsEditable} onChange={v => setField("biayaSewaTempat", v)} indent={12} sign="minus" />
            <PnLRow label="Biaya Pajak Resto" value={data.biayaPajakResto} editable={fieldsEditable} onChange={v => setField("biayaPajakResto", v)} indent={12} sign="minus" />
            <PnLRow label="Biaya Pajak Reklame" value={data.biayaPajakReklame} editable={fieldsEditable} onChange={v => setField("biayaPajakReklame", v)} indent={12} sign="minus" />
            <PnLRow label="Biaya Penyusutan" value={data.biayaPenyusutan} editable={fieldsEditable} onChange={v => setField("biayaPenyusutan", v)} indent={12} sign="minus" />
            <PnLRow label="THR" value={data.thr} editable={fieldsEditable} onChange={v => setField("thr", v)} indent={12} sign="minus" />
            <PnLRow label="Join Fee" value={data.joinFee} editable={fieldsEditable} onChange={v => setField("joinFee", v)} indent={12} sign="minus" />
            <PnLRow label="Aplikasi Pawoon" value={data.aplikasiPawoon} editable={fieldsEditable} onChange={v => setField("aplikasiPawoon", v)} indent={12} sign="minus" />
            <PnLRow label="Total Operasional" value={totalOperasional} bold indent={12} sectionEnd />

            <PnLSubLabel>2. Biaya Lain Lain</PnLSubLabel>
            <PnLRow label="Biaya Listrik (auto)" value={biayaListrik} indent={12} sign="minus" />
            <PnLRow label="Biaya PDAM (auto)" value={biayaPdam} indent={12} sign="minus" />
            <PnLRow label="Biaya Internet & Pulsa (auto)" value={biayaInternet} indent={12} sign="minus" />
            <PnLRow label="Biaya Maintenance" value={data.biayaMaintenance} editable={fieldsEditable} onChange={v => setField("biayaMaintenance", v)} indent={12} sign="minus" />
            <PnLRow label="Tools Marketing" value={data.toolsMarketing} editable={fieldsEditable} onChange={v => setField("toolsMarketing", v)} indent={12} sign="minus" />
            <PnLRow label="Claim Office" value={data.claimOffice} editable={fieldsEditable} onChange={v => setField("claimOffice", v)} indent={12} sign="minus" />
            <PnLRow label="Jasa Marinir" value={data.jasaMarinir} editable={fieldsEditable} onChange={v => setField("jasaMarinir", v)} indent={12} sign="minus" />
            <PnLRow label="Bonus Omset" value={data.bonusOmset} editable={fieldsEditable} onChange={v => setField("bonusOmset", v)} indent={12} sign="minus" />
            <PnLRow label="Total Biaya Lain Lain" value={totalBiayaLain} bold indent={12} sectionEnd />

            <PnLRow label="TOTAL BIAYA OPERASIONAL" value={totalBiayaOperasional} bold percent={pct(totalBiayaOperasional)} sectionEnd />

            <PnLRow label="LABA SEBELUM ZAKAT" value={labaSebelumZakat} bold sectionEnd />
            <PnLCustomRow label="Zakat" percentValue={data.zakatPercent} onPercentChange={v => setField("zakatPercent", v)} disabled={!fieldsEditable} value={zakat} />
            <PnLRow label="Laba Ditahan" value={data.labaDitahan} editable={fieldsEditable} onChange={v => setField("labaDitahan", v)} sectionEnd sign="minus" />
            <PnLRow label="LABA BERSIH" value={labaBersih} bold highlight percent={pct(labaBersih)} />

            <PnLSectionLabel>PEMBAGIAN LABA</PnLSectionLabel>
            <PnLCustomRow label="Pengelola" percentValue={data.pengelolaPercent} onPercentChange={v => setField("pengelolaPercent", v)} disabled={!fieldsEditable} value={pengelola} />
            <PnLRow label={`Holding ${100 - data.pengelolaPercent}%`} value={holding} bold sectionEnd />
          </tbody>
        </table>

        {isEri && (statusData.status === "draft" || statusData.status === "unlocked") && <button onClick={submitLock} style={{
        width: "100%",
        marginTop: 22,
        border: "none",
        borderRadius: 10,
        padding: "12px 16px",
        background: T.manajemen,
        color: "#fff",
        ...FB,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        cursor: "pointer"
      }} className="ais-button ais-button--default">{statusData.status === "unlocked" ? "Simpan & Kunci Kembali" : "Submit & Kunci Laporan"}</button>}
      </div>

      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 14,
      textAlign: "center"
    }}>
        Format mengikuti template Laporan Laba Rugi D'TOP. Input tersimpan otomatis per toko & per bulan.
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PAGE: IJIN KERJA
--------------------------------------------------------- */
function IjinBadge({
  status
}) {
  const tone = status === "approved" ? "good" : status === "rejected" ? "bad" : "warn";
  const label = status === "approved" ? "Disetujui" : status === "rejected" ? "Ditolak" : "Menunggu";
  return <Badge tone={tone}>{label}</Badge>;
}
function RekapBulananIjinPanel({
  ijinList,
  employees,
  stores
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const [filterStore, setFilterStore] = useState("all");
  const relevantEmp = employees.filter(e => e.status === "aktif" && e.group !== "toko_device" && e.group !== "direksi").filter(e => {
    if (filterStore === "all") return true;
    if (filterStore === "kantor") return e.group === "manajemen";
    if (e.group === "manajemen") return false;
    return (e.stores || [e.store]).includes(filterStore);
  });
  const rows = relevantEmp.map(emp => {
    const items = ijinList.filter(i => i.empId === emp.id && i.status === "approved" && i.tanggalMulai?.startsWith(month));
    const sakitHari = items.filter(i => i.jenis === "sakit").reduce((s, i) => s + daysBetweenInclusive(i.tanggalMulai, i.tanggalSelesai), 0);
    const tidakHadirHari = items.filter(i => i.jenis === "tidak_hadir").reduce((s, i) => s + daysBetweenInclusive(i.tanggalMulai, i.tanggalSelesai), 0);
    const cutiHari = items.filter(i => i.jenis === "cuti").reduce((s, i) => s + daysBetweenInclusive(i.tanggalMulai, i.tanggalSelesai), 0);
    const tukarShiftKali = items.filter(i => i.jenis === "tukar_shift").length;
    const totalHari = sakitHari + tidakHadirHari + cutiHari;
    return {
      emp,
      sakitHari,
      tidakHadirHari,
      cutiHari,
      tukarShiftKali,
      totalHari
    };
  }).filter(r => r.sakitHari + r.tidakHadirHari + r.cutiHari + r.tukarShiftKali > 0);
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      marginBottom: 14,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
          <option value="all">Semua Toko & Manajemen</option>
          <option value="kantor">Manajemen (Kantor)</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Berlaku untuk seluruh karyawan (Manajemen, Crew, Part Time, SPV). Menampilkan yang punya minimal satu pengajuan ijin berstatus <b>disetujui</b> pada bulan & filter terpilih.
      </div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5,
        minWidth: 700
      }}>
          <thead>
            <tr style={THBG}>
              {["Nama", "Grup", "Sakit (hari)", "Tidak Hadir (hari)", "Cuti (hari)", "Tukar Shift (kali)", "Total Hari Ijin"].map(h => <th key={h} style={{
              ...TD,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{
              padding: 16,
              color: T.inkMuted
            }}>Tidak ada pengajuan disetujui untuk bulan & filter ini.</td></tr>}
            {rows.map(r => <tr key={r.emp.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TD,
              fontWeight: 600
            }}>{r.emp.name}</td>
                <td style={TD}><Badge tone="manajemen">{GROUP_LABEL[r.emp.group]}</Badge></td>
                <td style={TD}>{r.sakitHari || "-"}</td>
                <td style={TD}>{r.tidakHadirHari || "-"}</td>
                <td style={TD}>{r.cutiHari || "-"}</td>
                <td style={TD}>{r.tukarShiftKali || "-"}</td>
                <td style={{
              ...TD,
              fontWeight: 700
            }}>{r.totalHari}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}
function IjinKerjaPage({
  ijinList,
  setIjinList,
  employees,
  stores,
  currentUser
}) {
  const [tab, setTab] = useState("daftar");
  const [filterJenis, setFilterJenis] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const pending = ijinList.filter(i => i.status === "pending");
  const approvedThisMonth = ijinList.filter(i => i.status === "approved" && i.decidedAt?.startsWith(monthStr(new Date())));
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const approveItem = item => {
    if (!canDecideLeave(currentUser.id, item)) return;
    setIjinList(ijinList.map(i => i.id === item.id ? {
      ...i,
      status: "approved",
      decidedBy: currentUser.name,
      decidedAt: new Date().toISOString()
    } : i));
  };
  const submitReject = item => {
    if (!rejectReason.trim() || !canDecideLeave(currentUser.id, item)) return;
    setIjinList(ijinList.map(i => i.id === item.id ? {
      ...i,
      status: "rejected",
      decidedBy: currentUser.name,
      decidedAt: new Date().toISOString(),
      rejectReason: rejectReason.trim()
    } : i));
    setRejectingId(null);
    setRejectReason("");
  };
  const filtered = ijinList.filter(i => filterJenis === "all" || i.jenis === filterJenis).filter(i => filterStatus === "all" || i.status === filterStatus).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return <div>
      <SectionTitle icon={CalendarClock}>Ijin Kerja</SectionTitle>
      <div style={{
      display: "flex",
      gap: 14,
      marginBottom: 20
    }} className="ais-flex-layout">
        <StatCard label="Menunggu Approval" value={pending.length} tone="warn" />
        <StatCard label="Disetujui Bulan Ini" value={approvedThisMonth.length} tone="good" />
        <StatCard label="Total Pengajuan" value={ijinList.length} />
      </div>

      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 18,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 320
    }} className="ais-flex-layout ais-content-panel">
        {[{
        key: "daftar",
        label: "Daftar Pengajuan"
      }, {
        key: "rekap",
        label: "Rekap Bulanan"
      }].map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>

      {tab === "rekap" && <RekapBulananIjinPanel ijinList={ijinList} employees={employees} stores={stores} />}

      {tab === "daftar" && <div>
          <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 16
      }} className="ais-flex-layout">
            <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
              <option value="all">Semua Jenis</option>
              {Object.entries(LEAVE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 6
      }} className="ais-content-panel">
            {filtered.length === 0 && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted,
          padding: 16
        }}>Tidak ada data untuk filter ini.</div>}
            {filtered.map(item => <div key={item.id} style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${T.line}`
        }}>
                <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 6
          }} className="ais-flex-layout">
                  <div>
                    <div style={{
                ...FI,
                fontWeight: 700,
                fontSize: 13.5
              }}>{item.empName} <span style={{
                  color: T.inkMuted,
                  fontWeight: 500
                }}>· {LEAVE_TYPE_LABEL[item.jenis]}</span></div>
                    <div style={{
                ...FI,
                fontSize: 12,
                color: T.inkMuted,
                marginTop: 2
              }}>
                      {item.tanggalMulai}{item.tanggalSelesai && item.tanggalSelesai !== item.tanggalMulai ? ` – ${item.tanggalSelesai}` : ""}
                      {item.requestedByName && item.requestedById !== item.empId ? ` · Diajukan oleh ${item.requestedByName}` : ""}
                    </div>
                  </div>
                  <IjinBadge status={item.status} />
                </div>
                {item.alasan && <div style={{
            ...FI,
            fontSize: 12.5,
            color: T.ink,
            fontStyle: "italic",
            marginBottom: 4
          }}>"{item.alasan}"</div>}
                {item.crewPengganti && <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            marginBottom: 4
          }}>Pengganti: {item.crewPengganti}</div>}
                {item.jenis === "tukar_shift" && <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            marginBottom: 4
          }}>
                    {SHIFT_CODES[item.shiftAsal] || item.shiftAsal} ({item.tanggalMulai}) → {SHIFT_CODES[item.shiftTukar] || item.shiftTukar} ({item.tanggalTukar}) dengan {item.crewPenukar}
                  </div>}
                {item.decidedBy && <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>Diputuskan oleh {item.decidedBy}</div>}
                {item.status === "rejected" && item.rejectReason && <div style={{
            ...FI,
            fontSize: 12,
            color: T.bad,
            marginBottom: 4
          }}>Alasan penolakan: <span style={{
              fontStyle: "italic"
            }}>"{item.rejectReason}"</span></div>}
                {canDecideLeave(currentUser.id, item) && rejectingId !== item.id && <div style={{
            display: "flex",
            gap: 8,
            marginTop: 8
          }} className="ais-flex-layout">
                    <button onClick={() => approveItem(item)} style={{
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              background: T.good,
              color: "#fff",
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--primary">Approve</button>
                    <button onClick={() => {
              setRejectingId(item.id);
              setRejectReason("");
            }} style={{
              border: `1px solid ${T.bad}`,
              borderRadius: 8,
              padding: "6px 12px",
              background: "transparent",
              color: T.bad,
              ...FI,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer"
            }} className="ais-button ais-button--danger">Reject</button>
                  </div>}
                {canDecideLeave(currentUser.id, item) && rejectingId === item.id && <div style={{
            marginTop: 8
          }}>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Alasan penolakan (wajib diisi)…" style={{
              width: "100%",
              border: `1px solid ${T.line}`,
              borderRadius: 9,
              padding: "8px 10px",
              ...FI,
              fontSize: 12.5,
              resize: "none",
              marginBottom: 8,
              background: T.surface
            }} className="ais-control" />
                    <div style={{
              display: "flex",
              gap: 8
            }} className="ais-flex-layout">
                      <button onClick={() => submitReject(item)} disabled={!rejectReason.trim()} style={{
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                background: rejectReason.trim() ? T.bad : T.line,
                color: "#fff",
                fontFamily: "DM Sans",
                fontWeight: 600,
                fontSize: 12,
                cursor: rejectReason.trim() ? "pointer" : "not-allowed"
              }} className="ais-button ais-button--danger">Kirim Penolakan</button>
                      <button onClick={() => {
                setRejectingId(null);
                setRejectReason("");
              }} style={{
                border: `1px solid ${T.line}`,
                borderRadius: 8,
                padding: "6px 12px",
                background: "transparent",
                color: T.inkMuted,
                ...FI,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer"
              }} className="ais-button ais-button--default">Batal</button>
                    </div>
                  </div>}
              </div>)}
          </div>
          <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginTop: 10
      }}>
            Approval utama Ijin Kerja dilakukan di mobile app (Eri untuk non-manajemen, Kurnia untuk manajemen). Keputusan pada dashboard mengikuti approver yang sama dan mencatat nama akun yang mengambil keputusan.
          </div>
        </div>}
    </div>;
}
function getDashStokLock(lock, key) {
  return lock[key] || {
    editCount: 0,
    direksiStatus: "none",
    direksiApprovals: {}
  };
}
function ApprovalStokTab({
  stores,
  bahan,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  stokEditLock,
  setStokEditLock,
  currentUser
}) {
  const isElin = currentUser.access === "elin";
  const isDireksi = currentUser.access === "all";
  const stokItems = approvalQueue.filter(a => a.type === "stok").sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
  const [selectedId, setSelectedId] = useState(stokItems[0]?.id || null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(null);
  const selected = stokItems.find(a => a.id === selectedId);
  const key = selected ? `${selected.storeId}_${selected.date}` : null;
  const data = key ? reportLog[key]?.stok : null;
  const lockInfo = key ? getDashStokLock(stokEditLock, key) : {
    editCount: 0,
    direksiStatus: "none",
    direksiApprovals: {}
  };
  const canEditFreely = lockInfo.editCount === 0 || lockInfo.direksiStatus === "approved";
  const bahanKeys = data ? Object.keys(data).filter(k => !["inputOleh", "submittedAt", "editedBy", "editedAt", "editReason"].includes(k)) : [];
  useEffect(() => {
    if (editing && data) {
      const r = {};
      bahanKeys.forEach(bid => {
        r[bid] = {
          awal: data[bid]?.awal ?? "",
          masuk: data[bid]?.masuk ?? "",
          pakai: data[bid]?.pakai ?? ""
        };
      });
      setRows(r);
    }
  }, [editing, selectedId]);
  if (!isElin && !isDireksi) {
    return <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>Approval Stok Bahan Baku khusus untuk Elin (Admin Inventory) & Direksi.</div>;
  }
  const approveDirect = () => {
    if (!selected) return;
    setApprovalQueue(approvalQueue.map(a => a.id === selected.id ? {
      ...a,
      status: "approved",
      respondedAt: new Date().toISOString(),
      decidedBy: currentUser.name
    } : a));
  };
  const rejectDirect = () => {
    if (!selected) return;
    setApprovalQueue(approvalQueue.map(a => a.id === selected.id ? {
      ...a,
      status: "rejected",
      respondedAt: new Date().toISOString(),
      decidedBy: currentUser.name
    } : a));
  };
  const requestDireksiApproval = () => {
    setStokEditLock({
      ...stokEditLock,
      [key]: {
        ...lockInfo,
        direksiStatus: "pending",
        direksiApprovals: {},
        requestedBy: currentUser.name,
        requestedAt: new Date().toISOString()
      }
    });
  };
  const approveDireksiEdit = () => {
    const nextApprovals = {
      ...lockInfo.direksiApprovals,
      [currentUser.id]: true
    };
    const bothApproved = nextApprovals.kurnia && nextApprovals.juhaeri;
    setStokEditLock({
      ...stokEditLock,
      [key]: {
        ...lockInfo,
        direksiApprovals: nextApprovals,
        direksiStatus: bothApproved ? "approved" : "pending"
      }
    });
  };
  const saveEdit = () => {
    const payload = {};
    bahanKeys.forEach(bid => {
      const r = rows[bid];
      payload[bid] = {
        awal: Number(r.awal) || 0,
        masuk: Number(r.masuk) || 0,
        pakai: Number(r.pakai) || 0,
        akhir: (Number(r.awal) || 0) + (Number(r.masuk) || 0) - (Number(r.pakai) || 0)
      };
    });
    setReportLog({
      ...reportLog,
      [key]: {
        ...reportLog[key],
        stok: {
          ...data,
          ...payload,
          editedBy: currentUser.name,
          editedAt: new Date().toISOString()
        }
      }
    });
    setStokEditLock({
      ...stokEditLock,
      [key]: {
        editCount: lockInfo.editCount + 1,
        direksiStatus: "none",
        direksiApprovals: {}
      }
    });
    if (selected.status === "pending") {
      setApprovalQueue(approvalQueue.map(a => a.id === selected.id ? {
        ...a,
        status: "approved",
        respondedAt: new Date().toISOString(),
        decidedBy: currentUser.name
      } : a));
    }
    setEditing(false);
  };
  return <div style={{
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 16
  }} className="ais-responsive-grid">
      <div>
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 11,
        color: T.inkMuted,
        textTransform: "uppercase",
        marginBottom: 8
      }}>Daftar ({stokItems.length})</div>
        {stokItems.length === 0 && <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>Tidak ada laporan stok.</div>}
        {stokItems.map(a => <button key={a.id} onClick={() => {
        setSelectedId(a.id);
        setEditing(false);
      }} style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 11px",
        marginBottom: 6,
        background: selectedId === a.id ? T.surfaceSunk : T.surface,
        cursor: "pointer"
      }} className="ais-button ais-button--default" aria-pressed={selectedId === a.id}>
            <div style={{
          ...FI,
          fontWeight: 600,
          fontSize: 12.5
        }}>{stores.find(s => s.id === a.storeId)?.name}</div>
            <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted
        }}>Laporan: Stok Bahan Baku</div>
            <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted,
          marginBottom: 4
        }}>{a.date}</div>
            <Badge tone={a.status === "pending" ? "warn" : a.status === "approved" ? "good" : "bad"}>{a.status === "pending" ? "Menunggu" : a.status === "approved" ? "Disetujui" : "Ditolak"}</Badge>
          </button>)}
      </div>
      <div>
        {!selected && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>Pilih salah satu laporan di kiri.</div>}
        {selected && !data && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>Data laporan stok belum tersedia untuk tanggal ini.</div>}
        {selected && data && <div>
            <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          marginBottom: 10
        }}>{stores.find(s => s.id === selected.storeId)?.name} · {selected.date} · Diinput oleh {data.inputOleh}</div>

            {lockInfo.editCount > 0 && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 10
        }}>Sudah diedit {lockInfo.editCount}x. Edit berikutnya butuh approval Kurnia & Juhaeri.</div>}

            {isElin && !canEditFreely && lockInfo.direksiStatus === "none" && !editing && <div style={{
          background: T.warnSoft,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 12
        }}>
                <div style={{
            ...FI,
            fontSize: 12.5,
            color: T.warn,
            fontWeight: 600,
            marginBottom: 8
          }}>Sudah pernah diedit — edit berikutnya harus disetujui Kurnia & Juhaeri.</div>
                <button onClick={requestDireksiApproval} style={{
            border: "none",
            borderRadius: 8,
            padding: "8px 12px",
            background: T.warn,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">Ajukan Approval Direksi</button>
              </div>}

            {lockInfo.direksiStatus === "pending" && <div style={{
          background: T.warnSoft,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 12
        }}>
                <div style={{
            ...FI,
            fontSize: 12.5,
            color: T.warn,
            fontWeight: 600,
            marginBottom: 6
          }}>Menunggu approval Direksi untuk edit berikutnya.</div>
                <div style={{
            display: "flex",
            gap: 12,
            ...FI,
            fontSize: 11.5,
            marginBottom: isDireksi && !lockInfo.direksiApprovals?.[currentUser.id] ? 8 : 0
          }} className="ais-flex-layout">
                  <span>Kurnia: <b>{lockInfo.direksiApprovals?.kurnia ? "Setuju" : "Menunggu"}</b></span>
                  <span>Juhaeri: <b>{lockInfo.direksiApprovals?.juhaeri ? "Setuju" : "Menunggu"}</b></span>
                </div>
                {isDireksi && !lockInfo.direksiApprovals?.[currentUser.id] && <button onClick={approveDireksiEdit} style={{
            border: "none",
            borderRadius: 8,
            padding: "7px 12px",
            background: T.warn,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">Setujui Edit</button>}
              </div>}

            {!editing ? <div>
                <table style={{
            width: "100%",
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12.5,
            marginBottom: 12
          }}>
                  <thead><tr style={THBG}><th style={{
                  padding: "6px 8px"
                }}>Bahan</th><th style={{
                  padding: "6px 8px"
                }}>Awal</th><th style={{
                  padding: "6px 8px"
                }}>In</th><th style={{
                  padding: "6px 8px"
                }}>Pakai</th><th style={{
                  padding: "6px 8px"
                }}>Akhir</th></tr></thead>
                  <tbody>
                    {bahanKeys.map(bid => <tr key={bid} style={{
                borderTop: `1px solid ${T.line}`
              }}>
                        <td style={{
                  padding: "6px 8px"
                }}>{bahan.find(b => b.id === bid)?.name || bid}</td>
                        <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>{data[bid]?.awal}</td>
                        <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>{data[bid]?.masuk}</td>
                        <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>{data[bid]?.pakai}</td>
                        <td style={{
                  padding: "6px 8px",
                  ...FM,
                  fontWeight: 700
                }}>{data[bid]?.akhir}</td>
                      </tr>)}
                  </tbody>
                </table>
                {data.editedBy && <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.accentDeep,
            marginBottom: 10
          }}>Diedit oleh {data.editedBy}</div>}
                {isElin && <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                    {canEditFreely && <button onClick={() => setEditing(true)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "8px 14px",
              background: "transparent",
              color: T.ink,
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">Edit</button>}
                    {selected.status === "pending" && <>
                        <button onClick={approveDirect} style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                background: T.good,
                color: "#fff",
                ...FI,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer"
              }} className="ais-button ais-button--primary">Approve</button>
                        <button onClick={rejectDirect} style={{
                border: `1px solid ${T.bad}`,
                borderRadius: 8,
                padding: "8px 14px",
                background: "transparent",
                color: T.bad,
                ...FI,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer"
              }} className="ais-button ais-button--danger">Reject</button>
                      </>}
                  </div>}
              </div> : <div>
                <table style={{
            width: "100%",
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12.5,
            marginBottom: 12
          }}>
                  <thead><tr style={THBG}><th style={{
                  padding: "6px 8px"
                }}>Bahan</th><th style={{
                  padding: "6px 8px"
                }}>Awal</th><th style={{
                  padding: "6px 8px"
                }}>In</th><th style={{
                  padding: "6px 8px"
                }}>Pakai</th><th style={{
                  padding: "6px 8px"
                }}>Akhir</th></tr></thead>
                  <tbody>
                    {rows && bahanKeys.map(bid => {
                const r = rows[bid];
                const akhir = (Number(r.awal) || 0) + (Number(r.masuk) || 0) - (Number(r.pakai) || 0);
                return <tr key={bid} style={{
                  borderTop: `1px solid ${T.line}`
                }}>
                          <td style={{
                    padding: "6px 8px"
                  }}>{bahan.find(b => b.id === bid)?.name || bid}</td>
                          {["awal", "masuk", "pakai"].map(f => <td key={f} style={{
                    padding: "5px 6px"
                  }}>
                              <input type="number" value={r[f]} onChange={e => setRows({
                      ...rows,
                      [bid]: {
                        ...rows[bid],
                        [f]: e.target.value
                      }
                    })} style={{
                      width: 64,
                      border: `1px solid ${T.line}`,
                      borderRadius: 6,
                      padding: "5px 6px",
                      ...FM,
                      fontSize: 12
                    }} className="ais-control" />
                            </td>)}
                          <td style={{
                    padding: "6px 8px",
                    ...FM,
                    fontWeight: 700
                  }}>{akhir}</td>
                        </tr>;
              })}
                  </tbody>
                </table>
                <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                  <button onClick={saveEdit} style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              background: T.manajemen,
              color: "#fff",
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--primary">Simpan & Setujui</button>
                  <button onClick={() => setEditing(false)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "8px 14px",
              background: "transparent",
              color: T.inkMuted,
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">Batal</button>
                </div>
              </div>}
          </div>}
      </div>
    </div>;
}
function ApprovalDashboardPage({
  stores,
  bahan,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  stokEditLock,
  setStokEditLock,
  currentUser,
  readOnly
}) {
  const isElin = currentUser.access === "elin";
  const [tab, setTab] = useState(isElin ? "stok" : "laporan");
  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");
  const today = new Date().toISOString().slice(0, 10);

  // Approval Stok Bahan Baku sudah eksklusif ditangani Elin (opsi: lewat dashboard ini atau mobile app),
  // jadi dikeluarkan dari tab Laporan Toko yang diakses Eri/Direksi.
  const relevantQueue = approvalQueue.filter(a => a.type !== "stok");
  const decide = (item, status, finalQty) => {
    setApprovalQueue(approvalQueue.map(a => a.id === item.id ? {
      ...a,
      status,
      respondedAt: new Date().toISOString(),
      ...(finalQty != null ? {
        finalQty
      } : {})
    } : a));
  };
  const pendingAll = relevantQueue.filter(a => a.status === "pending");
  const approvedToday = relevantQueue.filter(a => a.status === "approved" && a.respondedAt?.startsWith(today));
  const rejectedToday = relevantQueue.filter(a => a.status === "rejected" && a.respondedAt?.startsWith(today));
  const stokPendingCount = approvalQueue.filter(a => a.type === "stok" && a.status === "pending").length;
  const filtered = relevantQueue.filter(a => filterStore === "all" || a.storeId === filterStore).filter(a => filterStatus === "all" || a.status === filterStatus).sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
  return <div>
      <SectionTitle icon={ClipboardCheck}>Approval Laporan</SectionTitle>

      {!isElin && <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 340
    }} className="ais-flex-layout ais-content-panel">
          {[{
        key: "laporan",
        label: "Laporan Toko"
      }, {
        key: "stok",
        label: `Stok Bahan Baku${stokPendingCount > 0 ? ` (${stokPendingCount})` : ""}`
      }].map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
        </div>}

      {tab === "stok" && !isElin && <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: T.surfaceSunk,
      color: T.inkMuted,
      padding: "8px 12px",
      borderRadius: 9,
      ...FI,
      fontWeight: 600,
      fontSize: 12,
      marginBottom: 14
    }} className="ais-flex-layout ais-content-panel">
          <Eye size={13} /> Mode lihat saja — approval Stok Bahan Baku khusus ditangani Elin (Admin Inventory).
        </div>}

      {tab === "stok" && <ApprovalStokTab stores={stores} bahan={bahan} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} currentUser={currentUser} />}

      {tab === "laporan" && <div>
          <div style={{
        display: "flex",
        gap: 14,
        marginBottom: 20
      }} className="ais-flex-layout">
            <StatCard label="Menunggu" value={pendingAll.length} tone="warn" />
            <StatCard label="Disetujui Hari Ini" value={approvedToday.length} tone="good" />
            <StatCard label="Ditolak Hari Ini" value={rejectedToday.length} tone="bad" />
          </div>

          <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 16
      }} className="ais-flex-layout">
            <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
              <option value="all">Semua Toko</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 12px",
          ...FI,
          fontSize: 13,
          background: T.surface
        }} className="ais-control">
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: 6
      }} className="ais-content-panel">
            {filtered.length === 0 && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted,
          padding: 16
        }}>Tidak ada data untuk filter ini.</div>}
            {filtered.map(item => <ApprovalRow key={item.id} item={item} storeName={stores.find(s => s.id === item.storeId)?.name} onDecide={decide} readOnly={readOnly} />)}
          </div>
        </div>}
    </div>;
}
function ApprovalRow({
  item,
  storeName,
  onDecide,
  readOnly
}) {
  const [qty, setQty] = useState(item.payload?.qtyGoreng || 0);
  return <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: `1px solid ${T.line}`,
    gap: 16
  }} className="ais-flex-layout">
      <div style={{
      minWidth: 160
    }}>
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 13.5
      }}>{storeName}</div>
        <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted
      }}>{item.date}{item.payload?.inputOleh ? ` · ${item.payload.inputOleh}` : ""}</div>
      </div>
      <div style={{
      flex: 1
    }}>
        <div style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        marginBottom: 3
      }}>Laporan:</div>
        <Badge tone="warn">{APPROVAL_TYPE_LABEL[item.type]}</Badge>
      </div>
      <div style={{
      flex: 2,
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted
    }}>
        {item.type === "etalase_2000" && `Sisa ${item.payload.stok} potong · Diajukan goreng ${item.payload.qtyGoreng} potong`}
        {item.type === "stok" && "Lihat rincian di laporan toko"}
      </div>
      {item.status === "pending" && !readOnly ? <div style={{
      display: "flex",
      gap: 8,
      alignItems: "center"
    }} className="ais-flex-layout">
          {item.type === "etalase_2000" && <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{
        width: 70,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "6px 8px",
        ...FM,
        fontSize: 12.5
      }} className="ais-control" />}
          <button onClick={() => onDecide(item, "approved", item.type === "etalase_2000" ? Number(qty) : undefined)} style={{
        border: "none",
        borderRadius: 8,
        padding: "7px 12px",
        background: T.good,
        color: "#fff",
        ...FI,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer"
      }} className="ais-button ais-button--primary">Approve</button>
          <button onClick={() => onDecide(item, "rejected")} style={{
        border: `1px solid ${T.bad}`,
        borderRadius: 8,
        padding: "7px 12px",
        background: "transparent",
        color: T.bad,
        ...FI,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer"
      }} className="ais-button ais-button--danger">Reject</button>
        </div> : <Badge tone={item.status === "approved" ? "good" : item.status === "rejected" ? "bad" : "warn"}>{item.status === "approved" ? "Disetujui" : item.status === "rejected" ? "Ditolak" : "Menunggu"}</Badge>}
    </div>;
}

/* ---------------------------------------------------------
   PAGE: INVENTORY
--------------------------------------------------------- */
function stokAwalDefault(bahanItem) {
  return Math.round((bahanItem.konversi || 10) * 1.5);
}
const VARIABEL_LABEL = {
  in: "Barang Masuk",
  out: "Barang Keluar (Pemakaian)",
  transfer_in: "Transfer Masuk",
  transfer_out: "Transfer Keluar",
  adjustment: "Adjustment (+/-)"
};

// Barang Masuk & Barang Keluar bersumber dari Laporan Stok harian toko (reportLog), bukan input terpisah —
// sesuai laporan closing crew yang sudah mencatat kolom "masuk" & "pakai" per bahan tiap hari.
function sumStokFieldFromLaporan(storeId, bahanId, month, reportLog, field) {
  return Object.keys(reportLog).filter(k => k.startsWith(storeId + "_") && k.slice(storeId.length + 1).startsWith(month)).reduce((sum, k) => sum + (reportLog[k]?.stok?.[bahanId]?.[field] || 0), 0);
}

// Transfer In/Out & Adjustment bersumber dari stockLedger (form Transfer Stok & Stok Opname di mobile app)
// Transfer Stok & Stok Opname bisa diinput dari mobile app maupun dashboard, dan keduanya
// TIDAK menulis ke stockLedger. Helper ini menurunkan entri ledger setara dari kedua sumber
// bersama itu, supaya nilai Persediaan di PnL tetap akurat dari mana pun datanya diinput.
function deriveLedger(stockTransfers, stockOpnameReports) {
  const out = [];
  (stockTransfers || []).forEach(t => {
    if (t.status !== "confirmed") return; // transfer belum dikonfirmasi belum mengubah stok penerima
    // Toko mitra tidak punya inventory: transfer hanya dicatat di sisi toko holding.
    const asalMitra = t.asalMitra === true;
    const tujuanMitra = t.tujuanMitra === true;
    (t.items || []).forEach(it => {
      if (!asalMitra) out.push({
        id: `tf_out_${t.id}_${it.bahanId}`,
        storeId: t.asalToko,
        bahanId: it.bahanId,
        tanggal: t.tanggal,
        jenis: "transfer_out",
        qty: it.qty
      });
      if (!tujuanMitra) out.push({
        id: `tf_in_${t.id}_${it.bahanId}`,
        storeId: t.tujuanToko,
        bahanId: it.bahanId,
        tanggal: t.tanggal,
        jenis: "transfer_in",
        qty: it.qty
      });
    });
  });
  (stockOpnameReports || []).forEach(o => {
    (o.items || []).forEach(it => {
      if (!it.selisih) return;
      out.push({
        id: `op_${o.id}_${it.bahanId}`,
        storeId: o.storeId,
        bahanId: it.bahanId,
        tanggal: o.tanggal,
        jenis: "adjustment",
        qty: it.selisih
      });
    });
  });
  return out;
}

// Gabungan ledger manual + turunan, dengan dedupe berdasarkan id.
function effectiveLedger(stockLedger, stockTransfers, stockOpnameReports, stores) {
  const mitraIds = new Set((stores || []).filter(s => s.status === "mitra").map(s => s.id));
  const tf = (stockTransfers || []).map(t => ({
    ...t,
    asalMitra: mitraIds.has(t.asalToko),
    tujuanMitra: mitraIds.has(t.tujuanToko)
  }));
  const merged = [...(stockLedger || [])];
  const seen = new Set(merged.map(l => l.id));
  deriveLedger(tf, stockOpnameReports).forEach(e => {
    if (!seen.has(e.id)) {
      merged.push(e);
      seen.add(e.id);
    }
  });
  return merged;
}
function sumLedgerJenis(storeId, bahanId, month, stockLedger, jenis) {
  return stockLedger.filter(l => l.storeId === storeId && l.bahanId === bahanId && l.jenis === jenis && l.tanggal.startsWith(month)).reduce((s, e) => s + e.qty, 0);
}
function prevMonthStr(monthISO) {
  const [y, m] = monthISO.split("-").map(Number);
  return monthStr(new Date(y, m - 2, 1));
}
function hasDataInMonth(storeId, bahanId, month, reportLog, stockLedger) {
  const hasReport = Object.keys(reportLog).some(k => k.startsWith(storeId + "_") && k.slice(storeId.length + 1).startsWith(month) && reportLog[k]?.stok?.[bahanId]);
  const hasLedger = stockLedger.some(l => l.storeId === storeId && l.bahanId === bahanId && l.tanggal.startsWith(month));
  return hasReport || hasLedger;
}

// Stok Awal bulan = Stok Akhir bulan sebelumnya (rolling). Kalau bulan sebelumnya tidak ada data sama
// sekali (misal awal pemakaian sistem), pakai estimasi dasar stokAwalDefault sebagai titik mulai.
function computeStokAwal(storeId, bahanId, month, reportLog, stockLedger, bahanItem, depth = 0) {
  if (depth > 11) return stokAwalDefault(bahanItem);
  const prevMonth = prevMonthStr(month);
  if (!hasDataInMonth(storeId, bahanId, prevMonth, reportLog, stockLedger)) return stokAwalDefault(bahanItem);
  const prevAwal = computeStokAwal(storeId, bahanId, prevMonth, reportLog, stockLedger, bahanItem, depth + 1);
  const prevIn = sumStokFieldFromLaporan(storeId, bahanId, prevMonth, reportLog, "masuk");
  const prevOut = sumStokFieldFromLaporan(storeId, bahanId, prevMonth, reportLog, "pakai");
  const prevTransferIn = sumLedgerJenis(storeId, bahanId, prevMonth, stockLedger, "transfer_in");
  const prevTransferOut = sumLedgerJenis(storeId, bahanId, prevMonth, stockLedger, "transfer_out");
  const prevAdjustment = sumLedgerJenis(storeId, bahanId, prevMonth, stockLedger, "adjustment");
  return prevAwal + prevIn - prevOut + prevTransferIn - prevTransferOut + prevAdjustment;
}
function getVariabelValueForDay(storeId, bahanId, ds, variabel, reportLog, stockLedger) {
  if (variabel === "in" || variabel === "out") {
    const field = variabel === "in" ? "masuk" : "pakai";
    const v = reportLog[`${storeId}_${ds}`]?.stok?.[bahanId]?.[field];
    return v == null ? null : v;
  }
  const entries = stockLedger.filter(l => l.storeId === storeId && l.bahanId === bahanId && l.jenis === variabel && l.tanggal === ds);
  return entries.length ? entries.reduce((s, e) => s + e.qty, 0) : null;
}
function getVariabelTotalForMonth(storeId, bahanId, month, variabel, reportLog, stockLedger) {
  if (variabel === "in" || variabel === "out") {
    return sumStokFieldFromLaporan(storeId, bahanId, month, reportLog, variabel === "in" ? "masuk" : "pakai");
  }
  return sumLedgerJenis(storeId, bahanId, month, stockLedger, variabel);
}
function RingkasanStokPage({
  stores,
  bahan,
  products,
  reportLog,
  stockLedger
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const rows = bahanUntukToko(store, stores, products, bahan).map(b => {
    const totalIn = sumStokFieldFromLaporan(store, b.id, month, reportLog, "masuk");
    const totalOut = sumStokFieldFromLaporan(store, b.id, month, reportLog, "pakai");
    const transferIn = sumLedgerJenis(store, b.id, month, stockLedger, "transfer_in");
    const transferOut = sumLedgerJenis(store, b.id, month, stockLedger, "transfer_out");
    const adjustment = sumLedgerJenis(store, b.id, month, stockLedger, "adjustment");
    const stokAwal = computeStokAwal(store, b.id, month, reportLog, stockLedger, b);
    const stokAkhir = stokAwal + totalIn - totalOut + transferIn - transferOut + adjustment;
    return {
      bahan: b,
      stokAwal,
      totalIn,
      totalOut,
      transferIn,
      transferOut,
      adjustment,
      stokAkhir
    };
  });
  return <div>
      <SectionTitle icon={Boxes} action={<div style={{
      display: "flex",
      gap: 8
    }} className="ais-flex-layout">
          <select value={store} onChange={e => setStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Ringkasan Stok</SectionTitle>

      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: "10px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        <b>In / Out</b> bersumber dari Laporan Stok harian toko (kolom "masuk" & "pakai" yang dicatat Akun Toko tiap closing). <b>Transfer In/Out</b> dari form Transfer Stok (mobile, SPV Jr). <b>Adjustment (+/-)</b> dari form Stok Opname (mobile, Eri/Elin). <b>Stok Awal</b> = Stok Akhir bulan sebelumnya (rolling), dengan estimasi dasar hanya untuk bulan pertama tanpa data historis.
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 13,
        minWidth: 760
      }}>
          <thead>
            <tr style={THBG}>
              {["Bahan", "Stok Awal", "In", "Out", "Transfer In", "Transfer Out", "Adjustment", "Stok Akhir"].map(h => <th key={h} style={{
              ...TDW,
              fontSize: 11,
              color: T.inkMuted,
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r.bahan.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              ...TDW,
              fontWeight: 600
            }}>{r.bahan.name}</td>
                <td style={{
              ...TDW,
              ...FM
            }}>{r.stokAwal} {r.bahan.unitKecil}</td>
                <td style={{
              ...TDW,
              ...FM,
              color: T.good
            }}>+{r.totalIn}</td>
                <td style={{
              ...TDW,
              ...FM,
              color: T.bad
            }}>-{r.totalOut}</td>
                <td style={{
              ...TDW,
              ...FM,
              color: T.manajemen
            }}>+{r.transferIn}</td>
                <td style={{
              ...TDW,
              ...FM,
              color: T.warn
            }}>-{r.transferOut}</td>
                <td style={{
              ...TDW,
              ...FM,
              color: r.adjustment < 0 ? T.bad : r.adjustment > 0 ? T.good : T.inkMuted
            }}>{r.adjustment > 0 ? "+" : ""}{r.adjustment}</td>
                <td style={{
              ...TDW,
              ...FM,
              fontWeight: 700
            }}>{r.stokAkhir} {r.bahan.unitKecil}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}
function RekapVariabelPage({
  stores,
  bahan,
  products,
  reportLog,
  stockLedger
}) {
  const [variabel, setVariabel] = useState("out");
  const [store, setStore] = useState(stores[0]?.id);
  const [month, setMonth] = useState(monthStr(new Date()));
  const nDays = daysInMonth(month);
  const days = Array.from({
    length: nDays
  }, (_, i) => i + 1);
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("id-ID", {
    month: "long"
  }).toUpperCase();
  const valueFor = (bahanId, day) => {
    const ds = `${month}-${pad(day)}`;
    return getVariabelValueForDay(store, bahanId, ds, variabel, reportLog, stockLedger);
  };
  const totalPerBahan = bahanUntukToko(store, stores, products, bahan).map(b => ({
    bahan: b,
    total: getVariabelTotalForMonth(store, b.id, month, variabel, reportLog, stockLedger)
  }));
  return <div>
      <SectionTitle icon={SlidersHorizontal} action={<div style={{
      display: "flex",
      gap: 8
    }} className="ais-flex-layout">
          <select value={variabel} onChange={e => setVariabel(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            {Object.entries(VARIABEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={store} onChange={e => setStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control">
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "8px 12px",
        ...FI,
        fontSize: 13,
        background: T.surface
      }} className="ais-control" />
        </div>}>Rekap per Variabel — {VARIABEL_LABEL[variabel]}</SectionTitle>

      <div style={{
      display: "flex",
      gap: 10,
      marginBottom: 20,
      flexWrap: "wrap",
      maxHeight: 76,
      overflow: "hidden"
    }} className="ais-flex-layout">
        {totalPerBahan.filter(r => r.total > 0).slice(0, 6).map(({
        bahan: b,
        total
      }) => <StatCard key={b.id} label={b.name} value={`${total} ${b.unitKecil}`} />)}
      </div>

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto"
    }} className="ais-content-panel">
        <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 11.5,
        minWidth: 900
      }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{
              position: "sticky",
              left: 0,
              top: 0,
              zIndex: 3,
              background: T.surfaceSunk,
              padding: "8px 12px",
              textAlign: "left",
              borderBottom: `1px solid ${T.line}`,
              minWidth: 170
            }}>Item</th>
              <th colSpan={nDays} style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: T.surfaceSunk,
              padding: "6px 4px",
              textAlign: "center",
              fontWeight: 700,
              borderBottom: `1px solid ${T.line}`
            }}>{monthLabel}</th>
            </tr>
            <tr>
              {days.map(d => <th key={d} style={{
              position: "sticky",
              top: 29,
              zIndex: 2,
              background: T.surfaceSunk,
              padding: "5px 3px",
              minWidth: 34,
              fontSize: 10.5,
              borderBottom: `1px solid ${T.line}`
            }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {bahan.map(b => <tr key={b.id} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              position: "sticky",
              left: 0,
              background: T.surface,
              padding: "6px 12px",
              fontWeight: 600,
              whiteSpace: "nowrap"
            }}>{b.name}</td>
                {days.map(d => {
              const v = valueFor(b.id, d);
              return <td key={d} style={{
                padding: "5px 3px",
                textAlign: "center",
                ...FM,
                fontSize: 11,
                color: v ? T.ink : T.line
              }}>
                      {v ?? 0}
                    </td>;
            })}
              </tr>)}
          </tbody>
        </table>
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 10
    }}>
        Format mengikuti rekap pemakaian bahan baku toko: baris item, kolom tanggal per bulan berjalan.
      </div>
    </div>;
}

/* =========================================================
   ROQ (RECOMMENDED ORDER QUANTITY) — versi ringkas dari sheet operasional
   Rumus (terbukti identik dengan sheet Calculation untuk metode A/B):
     Kebutuhan = Rata2 × (Cycle + L_eff) + z(class) × Variasi × √H − Stok   (minimal 0)
       H = Cycle + L_eff (Metode A) | Cycle + L_fromOrder (Metode B)
     Order     = Kebutuhan ÷ Konversi → TriggerPct (kosong = bulat ke atas) → minimal MOQ
   Rata2 & Variasi dari DemandWide (Waste Calculation) N hari tepat sebelum tanggal cutoff (jendela sama).
   Satuan pakai ROQ = satuan Waste Calculation (Kg untuk Tepung Bumbu, Beras, Minyak Goreng).
========================================================= */
// >>> ROQ-LOGIC-START
const ROQ_PARAM_DEFAULT = {
  cycle: 2,
  historyHari: 35,
  tglKirim: null,
  jamKirim: "08:00",
  jamCutoff: "02:00",
  jamOrder: "22:00",
  metode: "B",
  z: {
    A: 1.65,
    B: 1.28,
    C: 1.04
  },
  log: []
};
const ROQ_SNAPSHOT_BATAS = "14:00";
const ROQ_DIREKSI = ["kurnia", "juhaeri"];
const ROQ_INPUT_PARAM = ["eri", "elin"];
function roqTglKirim(param, today) {
  return param?.tglKirim || addDaysStr(today, 1);
}
// Tanggal & jam turunan: cutoff dan order = H-1 dari pengiriman.
function roqJadwal(param, today) {
  const p = {
    ...ROQ_PARAM_DEFAULT,
    ...(param || {})
  };
  const kirim = roqTglKirim(p, today);
  const h1 = addDaysStr(kirim, -1);
  const ts = (d, j) => new Date(`${d}T${j}:00`).getTime();
  const tKirim = ts(kirim, p.jamKirim),
    tCut = ts(h1, p.jamCutoff),
    tOrder = ts(h1, p.jamOrder);
  const hari = ms => ms / 86400000;
  return {
    kirim,
    cutoff: h1,
    order: h1,
    jamKirim: p.jamKirim,
    jamCutoff: p.jamCutoff,
    jamOrder: p.jamOrder,
    L_eff: hari(tKirim - tCut),
    delta: hari(tOrder - tCut),
    L_fromOrder: hari(tKirim - tOrder)
  };
}

// Faktor satuan: satuan stok master → satuan ROQ (Kg untuk Tepung/Beras dari gr). Minyak di laporan stok sudah Kg/L.
function roqSatuan(b) {
  if (b.id === WASTE_ID.oil) return {
    unit: "Kg",
    fkStok: 1,
    conv: b.unitKecil === "gr" ? (b.konversi || 1) / 1000 : b.konversi || 1
  };
  const fk = wasteFaktorKg(b);
  return {
    unit: fk === 1000 ? "Kg" : b.unitKecil,
    fkStok: fk,
    conv: (b.konversi || 1) / fk
  };
}
function roqStdevS(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, v) => a + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, v) => a + (v - m) * (v - m), 0) / (arr.length - 1));
}

// Class otomatis: pembelian terakhir yang siklusnya sudah lewat → % terpakai selama `cycle` hari.
function roqClassBahan(storeId, b, cutoff, cycle, purchaseReports, reportLog) {
  const beli = (purchaseReports || []).filter(p => p.storeId === storeId && p.tanggal < addDaysStr(cutoff, -cycle + 1)).flatMap(p => (p.items || []).filter(it => it.bahanId === b.id && Number(it.qty) > 0).map(it => ({
    tanggal: p.tanggal,
    qty: Number(it.qty)
  }))).sort((a, c) => c.tanggal.localeCompare(a.tanggal))[0];
  if (!beli) return {
    kelas: b.kelas || "C",
    sumber: "master",
    pct: null
  };
  let pakai = 0;
  for (let i = 0; i < cycle; i++) pakai += Number(reportLog?.[`${storeId}_${addDaysStr(beli.tanggal, i)}`]?.stok?.[b.id]?.pakai) || 0;
  const pct = pakai / beli.qty;
  return {
    kelas: pct >= 0.85 ? "A" : pct >= 0.5 ? "B" : "C",
    sumber: "otomatis",
    pct,
    beli
  };
}
function roqSnapshotToko(snapshots, storeId, tanggal) {
  return (snapshots || []).filter(s => s.storeId === storeId && s.tanggal === tanggal && s.status !== "batal").sort((a, c) => (c.submittedAt || "").localeCompare(a.submittedAt || ""))[0] || null;
}
function hitungRoqToko({
  storeId,
  stores,
  param,
  reportLog,
  products,
  bahan,
  purchaseReports,
  minyakConfig,
  snapshots,
  nowIso
}) {
  const p = {
    ...ROQ_PARAM_DEFAULT,
    ...(param || {}),
    z: {
      ...ROQ_PARAM_DEFAULT.z,
      ...(param?.z || {})
    }
  };
  const today = (nowIso || new Date().toISOString()).slice(0, 10);
  const j = roqJadwal(p, today);
  const H = p.cycle + (p.metode === "A" ? j.L_eff : j.L_fromOrder);
  const horizonRata = p.cycle + j.L_eff;
  const winAkhir = addDaysStr(j.cutoff, -1);
  const winAwal = addDaysStr(j.cutoff, -p.historyHari);

  // DemandWide harian (dari Waste Calculation) untuk semua bulan yang tersentuh jendela.
  const bulan = [...new Set([winAwal.slice(0, 7), winAkhir.slice(0, 7)])];
  const demand = {}; // bahanId -> { tanggal: qty }
  bulan.forEach(m => {
    const c = hitungWasteBulan({
      storeId,
      stores,
      month: m,
      reportLog,
      products,
      bahan,
      purchaseReports,
      minyakConfig,
      pakaiToleransi: true,
      banding: []
    });
    c.days.forEach(d => {
      if (d.date < winAwal || d.date > winAkhir) return;
      Object.entries(d.rows).forEach(([bid, r]) => {
        if (r.demand != null) {
          (demand[bid] = demand[bid] || {})[d.date] = r.demand;
        }
      });
    });
  });

  // Stok terupdate: snapshot SPV di tanggal cutoff (≤ 14.00); bila tidak ada → sisa stok laporan H-1 cutoff.
  const snap = roqSnapshotToko(snapshots, storeId, j.cutoff);
  const stokH1 = reportLog?.[`${storeId}_${addDaysStr(j.cutoff, -1)}`]?.stok || null;
  const sumberStok = snap ? "snapshot" : stokH1 ? "laporan_h1" : "tidak_ada";
  const daftar = bahanUntukToko(storeId, stores, products, bahan).filter(b => !WASTE_CUTS.some(c => c.id === b.id));
  const rows = daftar.map(b => {
    const sat = roqSatuan(b);
    const seri = Object.values(demand[b.id] || {});
    const rata = seri.length ? seri.reduce((a, v) => a + v, 0) / seri.length : 0;
    const variasi = roqStdevS(seri);
    const kls = roqClassBahan(storeId, b, j.cutoff, p.cycle, purchaseReports, reportLog);
    const z = Number(p.z[kls.kelas] ?? 1.28);
    let stok = 0;
    if (snap) stok = Number(snap.items?.[b.id]) || 0;else if (stokH1?.[b.id]) stok = (Number(stokH1[b.id].akhir) || 0) / sat.fkStok;
    const kebutuhan = Math.max(0, rata * horizonRata + z * variasi * Math.sqrt(H) - stok);
    const raw = sat.conv ? kebutuhan / sat.conv : 0;
    const rawR = Math.round(raw * 1e9) / 1e9;
    const t = b.triggerPct;
    let unit = rawR <= 0 ? 0 : t == null || t === "" ? Math.ceil(rawR) : Math.floor(rawR) + (rawR - Math.floor(rawR) >= Number(t) ? 1 : 0);
    if (unit > 0 && Number(b.minOrder) > 0) unit = Math.max(unit, Number(b.minOrder));
    const stokSaatTiba = stok - rata * j.L_eff;
    const coverSetelah = rata ? (stokSaatTiba + unit * sat.conv) / rata : 0;
    const peringatan = [];
    if (stokSaatTiba < 0) peringatan.push("Stok habis sebelum barang tiba");
    if (b.shelfLifeDays > 0 && coverSetelah > b.shelfLifeDays) peringatan.push("Risiko melewati shelf life");
    return {
      bahan: b,
      unit: sat.unit,
      conv: sat.conv,
      hariData: seri.length,
      rata,
      variasi,
      kelas: kls.kelas,
      kelasSumber: kls.sumber,
      kelasPct: kls.pct,
      z,
      stok,
      kebutuhan,
      orderRaw: raw,
      order: unit,
      stokSaatTiba,
      coverSetelah,
      peringatan
    };
  });
  return {
    jadwal: j,
    H,
    horizonRata,
    window: {
      awal: winAwal,
      akhir: winAkhir
    },
    snap,
    sumberStok,
    rows,
    param: p
  };
}
// <<< ROQ-LOGIC-END

const roqFmt = (v, d = 2) => v == null || !Number.isFinite(v) ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("id-ID", {
  maximumFractionDigits: d
});
const ROQ_SUMBER_STOK = {
  snapshot: {
    label: "Snapshoot SPV",
    tone: "good"
  },
  laporan_h1: {
    label: "Sisa stok laporan H-1 (snapshoot tidak diisi)",
    tone: "warn"
  },
  tidak_ada: {
    label: "Tidak ada data stok",
    tone: "bad"
  }
};
const fmtTglId = ds => {
  try {
    return new Date(ds + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch (e) {
    return ds;
  }
};
function RoqJadwalBar({
  jadwal,
  param
}) {
  const item = (l, v) => <div style={{
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    padding: "8px 12px"
  }} className="ais-content-panel">
      <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      fontWeight: 700,
      textTransform: "uppercase"
    }}>{l}</div>
      <div style={{
      ...FM,
      fontSize: 13,
      fontWeight: 700
    }}>{v}</div>
    </div>;
  return <div style={{
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16
  }} className="ais-flex-layout">
      {item("Cutoff", `${jadwal.cutoff} ${jadwal.jamCutoff}`)}
      {item("Order", `${jadwal.order} ${jadwal.jamOrder}`)}
      {item("Pengiriman", `${jadwal.kirim} ${jadwal.jamKirim}`)}
      {item("Cycle", `${param.cycle} hari`)}
      {item("Metode", param.metode)}
      {item("History", `${param.historyHari} hari`)}
    </div>;
}

// Parameter ROQ disimpan PER TOKO: ais-roq-param = { [storeId]: { ...param, submittedAt, submittedBy, log } }.
// Data lama (satu parameter untuk semua toko) tetap terbaca sebagai nilai awal.
function roqParamToko(all, storeId) {
  const legacy = all && all.cycle != null ? all : null;
  const own = all && all[storeId] && typeof all[storeId] === "object" ? all[storeId] : null;
  const src = own || legacy || {};
  return {
    ...ROQ_PARAM_DEFAULT,
    ...src,
    z: {
      ...ROQ_PARAM_DEFAULT.z,
      ...(src.z || {})
    },
    _tersimpan: !!own
  };
}
function RoqCell({
  label,
  kunci,
  children,
  hint
}) {
  return <div style={{
    minWidth: 170
  }}>
      <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      fontWeight: 700,
      textTransform: "uppercase",
      marginBottom: 4
    }}>{label} {kunci && <Lock size={10} />}</div>
      {children}
      {hint && <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      marginTop: 3
    }}>{hint}</div>}
    </div>;
}
function RoqParamForm({
  p,
  onSubmit,
  currentUser
}) {
  const today = dateStr(new Date());
  const awal = () => ({
    ...p,
    tglKirim: roqTglKirim(p, today)
  });
  const [f, setF] = useState(awal);
  useEffect(() => {
    setF(awal()); /* eslint-disable-next-line */
  }, [JSON.stringify(p)]);
  const isDir = ROQ_DIREKSI.includes(currentUser.id);
  const bolehInput = isDir || ROQ_INPUT_PARAM.includes(currentUser.id);
  const j = roqJadwal(f, today);
  const set = (k, v) => setF({
    ...f,
    [k]: v
  });
  const inp = dis => ({
    border: `1px solid ${T.line}`,
    borderRadius: 9,
    padding: "7px 10px",
    ...FM,
    fontSize: 13,
    background: dis ? T.surfaceSunk : T.surface,
    width: 150
  });
  return <FormSurface title="Rencanakan persediaan." subtitle="Atur parameter perencanaan sesuai kebutuhan lokasi." code="ROQ"><div>
      <div style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 12
      }} className="ais-flex-layout">
        <RoqCell label="Tanggal Pengiriman" hint={`${fmtTglId(f.tglKirim)} · ${f.jamKirim}`}>
          <input type="date" value={f.tglKirim} disabled={!bolehInput} onChange={e => set("tglKirim", e.target.value)} style={inp(!bolehInput)} className="ais-control" />
        </RoqCell>
        <RoqCell label="Cycle Order (hari)"><input type="number" min={1} value={f.cycle} disabled={!bolehInput} onChange={e => set("cycle", e.target.value)} style={{
            ...inp(!bolehInput),
            width: 90
          }} className="ais-control" /></RoqCell>
        <RoqCell label="Metode" hint="A: dari cutoff · B: dari waktu order">
          <div style={{
            display: "flex",
            gap: 6
          }} className="ais-flex-layout">
            {["A", "B"].map(m => <button key={m} disabled={!bolehInput} onClick={() => set("metode", m)} style={{
              border: `1px solid ${f.metode === m ? T.manajemen : T.line}`,
              background: f.metode === m ? T.manajemenSoft : T.surface,
              color: f.metode === m ? T.manajemen : T.inkMuted,
              borderRadius: 9,
              padding: "6px 16px",
              ...FI,
              fontWeight: 700,
              fontSize: 13,
              cursor: bolehInput ? "pointer" : "default"
            }} className="ais-button ais-button--default" aria-pressed={f.metode === m}>{m}</button>)}
          </div>
        </RoqCell>
        <RoqCell label="Cutoff · Order (otomatis)"><div style={{
            ...FM,
            fontSize: 12.5,
            fontWeight: 700,
            paddingTop: 6
          }}>{j.cutoff} {f.jamCutoff} · {f.jamOrder}</div></RoqCell>
      </div>
      <div style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 12,
        paddingTop: 10,
        borderTop: `1px dashed ${T.line}`
      }} className="ais-flex-layout">
        <RoqCell label="History Pengeluaran (hari)" kunci={!isDir}><input type="number" min={2} value={f.historyHari} disabled={!isDir} onChange={e => set("historyHari", e.target.value)} style={{
            ...inp(!isDir),
            width: 90
          }} className="ais-control" /></RoqCell>
        <RoqCell label="Jam Cutoff / Order / Kirim" kunci={!isDir}>
          <div style={{
            display: "flex",
            gap: 4
          }} className="ais-flex-layout">{["jamCutoff", "jamOrder", "jamKirim"].map(k => <input key={k} type="time" value={f[k]} disabled={!isDir} onChange={e => set(k, e.target.value)} style={{
              ...inp(!isDir),
              width: 98
            }} className="ais-control" />)}</div>
        </RoqCell>
        <RoqCell label="z per Class (A / B / C)" kunci={!isDir} hint="A ≥85% terpakai · B 50–84% · C <50%">
          <div style={{
            display: "flex",
            gap: 4
          }} className="ais-flex-layout">{["A", "B", "C"].map(k => <input key={k} type="number" step="0.01" value={f.z[k]} disabled={!isDir} onChange={e => setF({
              ...f,
              z: {
                ...f.z,
                [k]: e.target.value
              }
            })} style={{
              ...inp(!isDir),
              width: 70
            }} className="ais-control" />)}</div>
        </RoqCell>
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 10
      }}>L_eff {roqFmt(j.L_eff, 4)} hari · Delta cutoff→order {roqFmt(j.delta, 4)} · L order→kirim {roqFmt(j.L_fromOrder, 4)}</div>
      {bolehInput && <button onClick={() => onSubmit({
        ...f,
        cycle: Number(f.cycle) || 1,
        historyHari: Number(f.historyHari) || 2,
        z: {
          A: Number(f.z.A),
          B: Number(f.z.B),
          C: Number(f.z.C)
        }
      })} style={{
        border: "none",
        borderRadius: 10,
        padding: "9px 18px",
        background: T.manajemen,
        color: "#fff",
        ...FI,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer"
      }} className="ais-button ais-button--default">
          {p._tersimpan ? "Submit Ulang Parameter" : "Submit Parameter"}
        </button>}
    </div></FormSurface>;
}
function roqTeksWhatsapp(storeName, jadwal, items) {
  const baris = items.filter(i => i.qtyFinal > 0).map((i, n) => `${n + 1}. ${i.nama} — ${i.qtyFinal} ${i.satuan}`);
  return `*Order Bahan Baku — ${storeName}*\nPengiriman: ${fmtTglId(jadwal.kirim)} ${jadwal.jamKirim}\n\n${baris.join("\n") || "(tidak ada order)"}`;
}
async function salinTeks(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = teks;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (e2) {
      return false;
    }
  }
}

// Status kesiapan snapshoot untuk satu toko & tanggal cutoff-nya.
function roqStatusSnapshot(snapshots, storeId, jadwal, now) {
  const today = dateStr(now);
  const jam = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const snap = roqSnapshotToko(snapshots, storeId, jadwal.cutoff);
  if (snap) return {
    kode: "terisi",
    siap: true,
    snap
  };
  if (today < jadwal.cutoff) return {
    kode: "belum_waktunya",
    siap: false
  };
  if (today === jadwal.cutoff && jam < ROQ_SNAPSHOT_BATAS) return {
    kode: "menunggu",
    siap: false
  };
  return {
    kode: "lewat",
    siap: true
  };
}
function RoqLangkah({
  no,
  judul,
  aktif,
  selesai,
  children
}) {
  return <div style={{
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    opacity: aktif ? 1 : 0.5
  }} className="ais-content-panel">
      <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: aktif ? 12 : 0
    }} className="ais-flex-layout">
        <span style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        background: selesai ? T.good : aktif ? T.manajemen : T.line,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...FI,
        fontWeight: 700,
        fontSize: 12.5
      }}>{selesai ? <Check size={14} /> : no}</span>
        <span style={{
        ...FB,
        fontWeight: 700,
        fontSize: 16
      }}>{judul}</span>
      </div>
      {aktif && children}
    </div>;
}

/* =========================================================
   ROQ — satu halaman per toko, bertahap:
   1 Pilih toko → 2 Parameter (submit) → 3 Kesiapan snapshoot (Ingatkan SPV / lewat 14.00 pakai stok H-1)
   → 4 Qty order (review & revisi) → 5 Submit order + salin WhatsApp
========================================================= */
function RoqPage({
  stores,
  allStores,
  roqParam,
  setRoqParam,
  reportLog,
  products,
  bahan,
  purchaseReports,
  minyakConfig,
  roqSnapshots,
  roqOrders,
  setRoqOrders,
  roqIngatkan,
  setRoqIngatkan,
  employees,
  currentUser,
  readOnly
}) {
  const [store, setStore] = useState(stores[0]?.id);
  const [revisi, setRevisi] = useState({});
  const [semua, setSemua] = useState(false);
  const [detail, setDetail] = useState(false);
  const [pesan, setPesan] = useState("");
  const now = new Date();
  const isDir = ROQ_DIREKSI.includes(currentUser.id);
  const p = roqParamToko(roqParam, store);
  const jadwal = roqJadwal(p, dateStr(now));
  const st = roqStatusSnapshot(roqSnapshots, store, jadwal, now);
  const calc = useMemo(() => store && p._tersimpan && st.siap ? hitungRoqToko({
    storeId: store,
    stores: allStores,
    param: p,
    reportLog,
    products,
    bahan,
    purchaseReports,
    minyakConfig,
    snapshots: roqSnapshots
  }) : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store, JSON.stringify(p), st.siap, allStores, reportLog, products, bahan, purchaseReports, minyakConfig, roqSnapshots]);
  const existing = (roqOrders || []).find(o => o.storeId === store && o.tglKirim === jadwal.kirim);
  useEffect(() => {
    setRevisi(existing ? Object.fromEntries(existing.items.filter(i => i.qtyRevisi).map(i => [i.bahanId, String(i.qtyRevisi)])) : {});
    setPesan(""); /* eslint-disable-next-line */
  }, [store, jadwal.kirim, existing?.submittedAt]);
  const storeName = stores.find(s => s.id === store)?.name || store;
  const spvToko = (employees || []).filter(e => (e.group === "spv" || e.group === "tl") && e.status !== "nonaktif" && (e.stores || [e.store]).includes(store)).map(e => e.name);
  const ingatTerakhir = (roqIngatkan || []).filter(x => x.storeId === store && x.cutoff === jadwal.cutoff).sort((a, b) => b.at.localeCompare(a.at))[0];
  const submitParam = f => {
    const at = new Date().toISOString();
    const lama = roqParam && roqParam[store] && typeof roqParam[store] === "object" ? roqParam[store] : {};
    const {
      _tersimpan,
      ...bersih
    } = f;
    const base = roqParam && roqParam.cycle == null ? roqParam : {}; // buang format lama (satu parameter global)
    setRoqParam({
      ...base,
      [store]: {
        ...bersih,
        submittedAt: at,
        submittedBy: currentUser.name,
        log: [...(lama.log || []), {
          oleh: currentUser.name,
          at,
          ringkas: `kirim ${f.tglKirim}, cycle ${f.cycle}, metode ${f.metode}, history ${f.historyHari}`
        }].slice(-30)
      }
    });
  };
  const ingatkan = () => setRoqIngatkan([...(roqIngatkan || []), {
    id: `ingat_${store}_${Date.now()}`,
    storeId: store,
    cutoff: jadwal.cutoff,
    oleh: currentUser.name,
    at: new Date().toISOString()
  }]);
  const items = calc ? calc.rows.map(r => {
    const rev = Number(revisi[r.bahan.id]) || 0;
    return {
      bahanId: r.bahan.id,
      nama: r.bahan.name,
      satuan: r.bahan.unitBesar,
      qtyHitung: r.order,
      qtyRevisi: rev,
      qtyFinal: Math.max(0, r.order + rev),
      r
    };
  }) : [];
  const tampil = items.filter(i => semua || i.qtyHitung > 0 || i.qtyRevisi !== 0);
  const submitOrder = () => {
    const rec = {
      id: existing?.id || `roq_${store}_${jadwal.kirim}`,
      storeId: store,
      storeName,
      tglKirim: jadwal.kirim,
      cutoff: jadwal.cutoff,
      metode: p.metode,
      cycle: p.cycle,
      sumberStok: calc.sumberStok,
      items: items.filter(i => i.qtyHitung > 0 || i.qtyRevisi !== 0).map(({
        r,
        ...i
      }) => i),
      submittedBy: currentUser.name,
      submittedById: currentUser.id,
      submittedAt: new Date().toISOString(),
      versi: (existing?.versi || 0) + 1,
      riwayat: [...(existing?.riwayat || []), ...(existing ? [{
        at: existing.submittedAt,
        oleh: existing.submittedBy,
        items: existing.items
      }] : [])]
    };
    setRoqOrders([...(roqOrders || []).filter(o => o.id !== rec.id), rec]);
    setPesan(existing ? "Order diperbarui." : "Order tersimpan ke Laporan ROQ.");
  };
  const salin = async () => setPesan((await salinTeks(roqTeksWhatsapp(storeName, jadwal, items))) ? "Teks order tersalin — tinggal paste di WhatsApp." : "Gagal menyalin otomatis.");
  const kotak = (bg, fg, isi) => <div style={{
    background: bg,
    color: fg,
    borderRadius: 10,
    padding: "10px 12px",
    ...FI,
    fontSize: 12.5,
    lineHeight: 1.6,
    marginBottom: 10
  }}>{isi}</div>;
  const btn = (bg, fg, border) => ({
    border: border || "none",
    borderRadius: 10,
    padding: "9px 16px",
    background: bg,
    color: fg,
    ...FI,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer"
  });
  const paramOk = p._tersimpan;
  return <div>
      <SectionTitle icon={SlidersHorizontal}>ROQ — Rekomendasi Order</SectionTitle>

      <RoqLangkah no={1} judul="Pilih Toko" aktif selesai={!!store}>
        <div style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
          {stores.map(s => {
          const o = (roqOrders || []).find(x => x.storeId === s.id && x.tglKirim === roqJadwal(roqParamToko(roqParam, s.id), dateStr(now)).kirim);
          return <button key={s.id} onClick={() => setStore(s.id)} style={{
            border: `1px solid ${store === s.id ? T.manajemen : T.line}`,
            background: store === s.id ? T.manajemenSoft : T.surface,
            color: store === s.id ? T.manajemen : T.ink,
            borderRadius: 10,
            padding: "8px 14px",
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            gap: 6,
            alignItems: "center"
          }} className="ais-button ais-button--default" aria-pressed={store === s.id}>
                {s.name}{o && <Check size={13} color={T.good} />}
              </button>;
        })}
        </div>
        <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginTop: 6
      }}>Parameter, class bahan, data hitung, snapshoot, dan order berlaku per toko. Tanda ✓ = order sudah disubmit.</div>
      </RoqLangkah>

      <RoqLangkah no={2} judul={`Parameter — ${storeName}`} aktif={!!store} selesai={paramOk}>
        {!paramOk && kotak(T.warnSoft, T.warn, "Parameter toko ini belum disubmit. Isi lalu tekan Submit Parameter untuk melanjutkan.")}
        {paramOk && <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 10
      }}>Disubmit {p.submittedBy} · {new Date(p.submittedAt).toLocaleString("id-ID")}</div>}
        <RoqParamForm p={p} onSubmit={submitParam} currentUser={currentUser} />
      </RoqLangkah>

      <RoqLangkah no={3} judul="Kesiapan Snapshoot Stok" aktif={paramOk} selesai={st.siap}>
        <RoqJadwalBar jadwal={jadwal} param={p} />
        {st.kode === "terisi" && kotak(T.goodSoft, T.good, <>Snapshoot sudah diisi oleh <b>{st.snap.inputOleh}</b> pukul {new Date(st.snap.submittedAt).toTimeString().slice(0, 5)} ({jadwal.cutoff}). Stok memakai snapshoot.</>)}
        {st.kode === "belum_waktunya" && kotak(T.surfaceSunk, T.inkMuted, <>Snapshoot baru bisa diisi SPV pada <b>{jadwal.cutoff}</b> sampai pukul {ROQ_SNAPSHOT_BATAS}. Qty order muncul setelah snapshoot terisi atau batas waktu lewat.</>)}
        {st.kode === "menunggu" && <>
            {kotak(T.badSoft, T.bad, <><b>Snapshoot belum diinput.</b> SPV {spvToko.join(", ") || "toko ini"} harus mengisi sebelum pukul {ROQ_SNAPSHOT_BATAS}. Lewat dari itu, ROQ otomatis memakai sisa stok laporan H-1 cutoff.</>)}
            <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap"
        }} className="ais-flex-layout">
              {!readOnly && <button onClick={ingatkan} style={btn(T.accent, "#fff")} className="ais-button ais-button--default"><Bell size={13} style={{
              verticalAlign: -2,
              marginRight: 6
            }} />Ingatkan SPV</button>}
              {ingatTerakhir && <span style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted
          }}>Terakhir diingatkan {ingatTerakhir.oleh} pukul {new Date(ingatTerakhir.at).toTimeString().slice(0, 5)} — notifikasi terkirim ke aplikasi SPV.</span>}
            </div>
          </>}
        {st.kode === "lewat" && kotak(T.warnSoft, T.warn, <>Snapshoot tidak diisi sampai pukul {ROQ_SNAPSHOT_BATAS}. ROQ otomatis memakai <b>sisa stok laporan bahan baku {addDaysStr(jadwal.cutoff, -1)}</b> (H-1 cutoff).</>)}
      </RoqLangkah>

      <RoqLangkah no={4} judul="Qty Order — Review & Revisi" aktif={paramOk && st.siap && !!calc} selesai={!!existing}>
        {calc && <>
            <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 10
        }} className="ais-flex-layout">
              <label style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            display: "inline-flex",
            gap: 6,
            alignItems: "center"
          }}>
                <input type="checkbox" checked={semua} onChange={e => setSemua(e.target.checked)} className="ais-control" /> Tampilkan semua bahan
              </label>
              {isDir && <label style={{
            ...FI,
            fontSize: 12,
            color: T.manajemen,
            display: "inline-flex",
            gap: 6,
            alignItems: "center",
            fontWeight: 600
          }}>
                  <input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} className="ais-control" /> Detail perhitungan (Direksi)
                </label>}
            </div>
            {isDir && detail && kotak(T.surfaceSunk, T.inkMuted, <>Kebutuhan = Rata2 × {roqFmt(calc.horizonRata, 4)} + z × Variasi × √{roqFmt(calc.H, 4)} − Stok · Order = Kebutuhan ÷ Konversi → TriggerPct (kosong = bulat ke atas) → minimal MOQ. Rata2 &amp; Variasi dari DemandWide {calc.window.awal} s.d. {calc.window.akhir}.</>)}
            <div style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          overflow: "auto",
          maxHeight: 560,
          marginBottom: 12
        }}>
              <table style={{
            width: "100%",
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12.5,
            minWidth: isDir && detail ? 1100 : 620
          }}>
                <thead><tr style={THBG}>
                  {["Bahan Baku", ...(isDir && detail ? ["Class", "z", "Rata2/hari", "Variasi", "Stok", "Kebutuhan", "Stok saat tiba", "Cover (hari)"] : []), "Qty Hitung", "Revisi (+/−)", "Qty Final", ""].map((h, i) => <th key={h + i} style={{
                  ...TH,
                  position: "sticky",
                  top: 0,
                  background: T.surfaceSunk,
                  textAlign: i === 0 || h === "" ? "left" : "right",
                  whiteSpace: "nowrap"
                }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {tampil.length === 0 && <tr><td colSpan={12} style={{
                  ...TD,
                  color: T.inkMuted,
                  padding: 18
                }}>Tidak ada bahan yang perlu diorder.</td></tr>}
                  {tampil.map(i => <tr key={i.bahanId} style={{
                borderTop: `1px solid ${T.line}`,
                background: i.r.peringatan.length ? T.warnSoft : "transparent"
              }}>
                      <td style={{
                  ...TD,
                  fontWeight: 600
                }}>{i.nama} <span style={{
                    color: T.inkMuted,
                    fontWeight: 400
                  }}>({i.r.unit})</span></td>
                      {isDir && detail && <>
                        <td style={{
                    ...TD,
                    textAlign: "right"
                  }} title={i.r.kelasSumber === "otomatis" ? `${Math.round((i.r.kelasPct || 0) * 100)}% terpakai dari pembelian terakhir` : "Dari master"}><Badge tone={i.r.kelas === "A" ? "bad" : i.r.kelas === "B" ? "warn" : "good"}>{i.r.kelas}</Badge></td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{i.r.z}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{roqFmt(i.r.rata, 3)}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{roqFmt(i.r.variasi, 3)}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{roqFmt(i.r.stok)}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{roqFmt(i.r.kebutuhan)}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM,
                    color: i.r.stokSaatTiba < 0 ? T.bad : T.ink
                  }}>{roqFmt(i.r.stokSaatTiba)}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right",
                    ...FM
                  }}>{roqFmt(i.r.coverSetelah, 1)}</td>
                      </>}
                      <td style={{
                  ...TD,
                  textAlign: "right",
                  ...FM
                }}>{i.qtyHitung} {i.satuan}</td>
                      <td style={{
                  ...TD,
                  textAlign: "right"
                }}>
                        <input type="number" step="1" value={revisi[i.bahanId] ?? ""} disabled={readOnly} placeholder="0" onChange={e => setRevisi({
                    ...revisi,
                    [i.bahanId]: e.target.value
                  })} style={{
                    width: 76,
                    border: `1px solid ${T.line}`,
                    borderRadius: 8,
                    padding: "5px 8px",
                    ...FM,
                    fontSize: 12.5,
                    textAlign: "right"
                  }} className="ais-control" />
                      </td>
                      <td style={{
                  ...TD,
                  textAlign: "right",
                  ...FM,
                  fontWeight: 700,
                  color: i.qtyRevisi ? T.accentDeep : T.ink
                }}>{i.qtyFinal} {i.satuan}</td>
                      <td style={{
                  ...TD,
                  fontSize: 11,
                  color: T.bad
                }}>{i.r.peringatan.join(" · ")}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </>}
      </RoqLangkah>

      <RoqLangkah no={5} judul="Submit Order" aktif={paramOk && st.siap && !!calc} selesai={!!existing}>
        {existing && kotak(T.goodSoft, T.good, <>Sudah disubmit v{existing.versi} oleh {existing.submittedBy} · {new Date(existing.submittedAt).toLocaleString("id-ID")}. Bisa disubmit ulang bila ada revisi.</>)}
        {!readOnly && <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center"
      }} className="ais-flex-layout">
            <button onClick={submitOrder} style={btn(T.manajemen, "#fff")} className="ais-button ais-button--default">{existing ? "Submit Ulang Order" : "Submit Order"}</button>
            <button onClick={salin} style={btn(T.good, "#fff")} className="ais-button ais-button--default">Order — Salin ke WhatsApp</button>
            {pesan && <span style={{
          ...FI,
          fontSize: 12.5,
          color: T.good,
          fontWeight: 600
        }}>{pesan}</span>}
          </div>}
      </RoqLangkah>
    </div>;
}

/* ---- Laporan ROQ: tab Laporan Order & Laporan Snapshoot ---- */
function LaporanRoqPage({
  stores,
  roqOrders,
  roqSnapshots,
  roqParam,
  employees
}) {
  const [tab, setTab] = useState("order");
  const [month, setMonth] = useState(monthStr(new Date()));
  const [buka, setBuka] = useState(null);
  const [pesan, setPesan] = useState("");
  const ids = stores.map(s => s.id);
  const nama = id => stores.find(s => s.id === id)?.name || id;
  const orders = (roqOrders || []).filter(o => ids.includes(o.storeId) && (o.tglKirim || "").startsWith(month)).sort((a, b) => b.tglKirim.localeCompare(a.tglKirim) || a.storeId.localeCompare(b.storeId));
  const snaps = (roqSnapshots || []).filter(s => ids.includes(s.storeId) && (s.tanggal || "").startsWith(month)).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  // Cutoff yang lewat jam 14.00 tanpa snapshoot → tampil sebagai "terlambat" (ROQ memakai sisa stok H-1).
  // Per toko: tiap toko punya parameter (tanggal kirim → cutoff) sendiri.
  const today = dateStr(new Date());
  const jamNow = new Date().toTimeString().slice(0, 5);
  const telat = stores.map(s => {
    const p = roqParamToko(roqParam, s.id);
    if (!p._tersimpan) return null;
    const j = roqJadwal(p, today);
    const lewat = today > j.cutoff || today === j.cutoff && jamNow >= ROQ_SNAPSHOT_BATAS;
    return j.cutoff.startsWith(month) && lewat && !roqSnapshotToko(roqSnapshots, s.id, j.cutoff) ? {
      ...s,
      cutoff: j.cutoff
    } : null;
  }).filter(Boolean);
  const tabs = [{
    key: "order",
    label: "Laporan Order"
  }, {
    key: "snapshot",
    label: "Laporan Snapshoot"
  }];
  return <div>
      <SectionTitle icon={FileBarChart2} action={<input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      padding: "8px 12px",
      ...FI,
      fontSize: 13,
      background: T.surface
    }} className="ais-control" />}>Laporan ROQ</SectionTitle>
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 16,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 10,
      width: 360
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>{t.label}</button>)}
      </div>
      {tab === "order" && <div>
          {pesan && <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.good,
        fontWeight: 600,
        marginBottom: 8
      }}>{pesan}</div>}
          <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        overflow: "auto"
      }} className="ais-content-panel">
            <table style={{
          width: "100%",
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12.5,
          minWidth: 720
        }}>
              <thead><tr style={THBG}>{["Tgl Kirim", "Toko", "Item", "Direvisi", "Sumber Stok", "Disubmit", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={7} style={{
                ...TD,
                color: T.inkMuted,
                padding: 18
              }}>Belum ada order pada bulan ini.</td></tr>}
                {orders.map(o => {
              const isOpen = buka === o.id;
              return <Fragment key={o.id}>
                      <tr onClick={() => setBuka(isOpen ? null : o.id)} style={{
                  borderTop: `1px solid ${T.line}`,
                  cursor: "pointer",
                  background: isOpen ? T.surfaceSunk : "transparent"
                }}>
                        <td style={{
                    ...TD,
                    ...FM,
                    fontWeight: 600
                  }}>{o.tglKirim}</td>
                        <td style={{
                    ...TD,
                    fontWeight: 600
                  }}>{nama(o.storeId)}</td>
                        <td style={{
                    ...TD,
                    ...FM
                  }}>{o.items.filter(i => i.qtyFinal > 0).length}</td>
                        <td style={TD}>{o.items.some(i => i.qtyRevisi) ? <Badge tone="warn">{o.items.filter(i => i.qtyRevisi).length} item</Badge> : "—"}</td>
                        <td style={TD}><Badge tone={ROQ_SUMBER_STOK[o.sumberStok]?.tone || "manajemen"}>{o.sumberStok === "snapshot" ? "Snapshoot" : o.sumberStok === "laporan_h1" ? "Laporan H-1" : "Tidak ada"}</Badge></td>
                        <td style={{
                    ...TD,
                    color: T.inkMuted
                  }}>{o.submittedBy} · {new Date(o.submittedAt).toLocaleString("id-ID")}{o.versi > 1 ? ` · v${o.versi}` : ""}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right"
                  }}><ChevronDown size={14} color={T.inkMuted} style={{
                      transform: isOpen ? "rotate(180deg)" : "none"
                    }} /></td>
                      </tr>
                      {isOpen && <tr style={{
                  background: T.surfaceSunk
                }}><td colSpan={7} style={{
                    padding: "12px 16px",
                    borderTop: `1px dashed ${T.line}`
                  }}>
                          <table style={{
                      borderCollapse: "collapse",
                      ...FI,
                      fontSize: 12
                    }}>
                            <thead><tr style={{
                          color: T.inkMuted,
                          textAlign: "left"
                        }}>{["Bahan", "Hitung", "Revisi", "Final"].map(h => <th key={h} style={{
                            padding: "2px 14px 6px 0"
                          }}>{h}</th>)}</tr></thead>
                            <tbody>{o.items.map(i => <tr key={i.bahanId}><td style={{
                            padding: "2px 14px 2px 0"
                          }}>{i.nama}</td><td style={{
                            ...FM,
                            padding: "2px 14px 2px 0"
                          }}>{i.qtyHitung}</td>
                                <td style={{
                            ...FM,
                            padding: "2px 14px 2px 0",
                            color: i.qtyRevisi ? T.accentDeep : T.inkMuted
                          }}>{i.qtyRevisi ? (i.qtyRevisi > 0 ? "+" : "") + i.qtyRevisi : "—"}</td>
                                <td style={{
                            ...FM,
                            padding: "2px 0",
                            fontWeight: 700
                          }}>{i.qtyFinal} {i.satuan}</td></tr>)}</tbody>
                          </table>
                          <button onClick={async e => {
                      e.stopPropagation();
                      setPesan((await salinTeks(roqTeksWhatsapp(nama(o.storeId), {
                        kirim: o.tglKirim,
                        jamKirim: roqParamToko(roqParam, o.storeId).jamKirim
                      }, o.items))) ? "Teks order tersalin." : "Gagal menyalin.");
                    }} style={{
                      marginTop: 10,
                      border: `1px solid ${T.good}`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      background: "transparent",
                      color: T.good,
                      ...FI,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer"
                    }} className="ais-button ais-button--default">Salin ke WhatsApp</button>
                        </td></tr>}
                    </Fragment>;
            })}
              </tbody>
            </table>
          </div>
        </div>}
      {tab === "snapshot" && <div>
          {telat.length > 0 && <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.bad,
        background: T.badSoft,
        padding: "10px 12px",
        borderRadius: 10,
        marginBottom: 12
      }}>
              Terlambat mengisi snapshoot (batas {ROQ_SNAPSHOT_BATAS}): <b>{telat.map(s => `${s.name} (cutoff ${s.cutoff})`).join(", ")}</b>. ROQ memakai sisa stok laporan H-1.
            </div>}
          <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        overflow: "auto"
      }} className="ais-content-panel">
            <table style={{
          width: "100%",
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12.5,
          minWidth: 620
        }}>
              <thead><tr style={THBG}>{["Tanggal", "Toko", "Item Diisi", "Diinput Oleh", "Waktu", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {snaps.length === 0 && <tr><td colSpan={6} style={{
                ...TD,
                color: T.inkMuted,
                padding: 18
              }}>Belum ada snapshoot pada bulan ini.</td></tr>}
                {snaps.map(s => {
              const isOpen = buka === s.id;
              return <Fragment key={s.id}>
                      <tr onClick={() => setBuka(isOpen ? null : s.id)} style={{
                  borderTop: `1px solid ${T.line}`,
                  cursor: "pointer",
                  background: isOpen ? T.surfaceSunk : "transparent"
                }}>
                        <td style={{
                    ...TD,
                    ...FM,
                    fontWeight: 600
                  }}>{s.tanggal}</td>
                        <td style={{
                    ...TD,
                    fontWeight: 600
                  }}>{nama(s.storeId)}</td>
                        <td style={{
                    ...TD,
                    ...FM
                  }}>{Object.keys(s.items || {}).length}</td>
                        <td style={TD}>{s.inputOleh}</td>
                        <td style={{
                    ...TD,
                    color: T.inkMuted
                  }}>{new Date(s.submittedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}</td>
                        <td style={{
                    ...TD,
                    textAlign: "right"
                  }}><ChevronDown size={14} color={T.inkMuted} style={{
                      transform: isOpen ? "rotate(180deg)" : "none"
                    }} /></td>
                      </tr>
                      {isOpen && <tr style={{
                  background: T.surfaceSunk
                }}><td colSpan={6} style={{
                    padding: "12px 16px",
                    borderTop: `1px dashed ${T.line}`,
                    ...FI,
                    fontSize: 12
                  }}>
                          <div style={{
                      columns: 3,
                      columnGap: 24
                    }}>
                            {Object.entries(s.items || {}).map(([bid, q]) => <div key={bid} style={{
                        padding: "2px 0"
                      }}>{s.namaBahan?.[bid] || bid}: <b style={FM}>{q}</b> {s.satuan?.[bid] || ""}</div>)}
                          </div>
                        </td></tr>}
                    </Fragment>;
            })}
              </tbody>
            </table>
          </div>
        </div>}
    </div>;
}

/* ---------------------------------------------------------
   PAGE: ROLE & AKSES
--------------------------------------------------------- */
function PermissionCell({
  value,
  onChange
}) {
  const meta = PERMISSION_LEVELS.find(l => l.value === value) || PERMISSION_LEVELS[0];
  const idx = PERMISSION_LEVELS.findIndex(l => l.value === value);
  const toneColor = {
    bad: T.bad,
    manajemen: T.manajemen,
    warn: T.warn,
    good: T.good
  };
  const toneBg = {
    bad: T.badSoft,
    manajemen: T.manajemenSoft,
    warn: T.warnSoft,
    good: T.goodSoft
  };
  return <button onClick={() => onChange(PERMISSION_LEVELS[(idx + 1) % PERMISSION_LEVELS.length].value)} style={{
    border: "none",
    borderRadius: 8,
    padding: "7px 10px",
    ...FI,
    fontWeight: 700,
    fontSize: 11,
    background: toneBg[meta.tone],
    color: toneColor[meta.tone],
    cursor: "pointer",
    width: "100%"
  }} className="ais-button ais-button--default">{meta.label}</button>;
}
function RolePermissionPage({
  matrix,
  setMatrix
}) {
  const setCell = (page, role, value) => setMatrix({
    ...matrix,
    [page]: {
      ...matrix[page],
      [role]: value
    }
  });
  return <div>
      <SectionTitle icon={ShieldCheck}>Role & Akses</SectionTitle>
      <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted,
      marginBottom: 16
    }}>
        Klik sel untuk mengganti level akses. Matriks ini adalah acuan yang di working app akan otomatis mengontrol tampilan & API tiap role.
      </div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "auto",
      padding: 6
    }} className="ais-content-panel">
        <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12,
        width: "100%"
      }}>
          <thead>
            <tr>
              <th style={{
              ...TDW,
              textAlign: "left",
              background: T.surfaceSunk,
              position: "sticky",
              left: 0
            }}>Halaman</th>
              {PERMISSION_ROLES.map(r => <th key={r} style={{
              padding: "10px 8px",
              background: T.surfaceSunk,
              fontSize: 11,
              whiteSpace: "nowrap"
            }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_PAGES.map(page => <tr key={page} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              padding: "8px 14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              position: "sticky",
              left: 0,
              background: T.surface
            }}>{page}</td>
                {PERMISSION_ROLES.map(role => <td key={role} style={{
              padding: "6px 6px",
              minWidth: 100
            }}>
                    <PermissionCell value={matrix[page]?.[role] || "none"} onChange={v => setCell(page, role, v)} />
                  </td>)}
              </tr>)}
          </tbody>
        </table>
      </div>
      <div style={{
      display: "flex",
      gap: 14,
      marginTop: 14,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        {PERMISSION_LEVELS.map(l => <div key={l.value} style={{
        display: "flex",
        alignItems: "center",
        gap: 6
      }} className="ais-flex-layout">
            <span style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: {
            bad: T.bad,
            manajemen: T.manajemen,
            warn: T.warn,
            good: T.good
          }[l.tone]
        }} />
            <span style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted
        }}>{l.label}</span>
          </div>)}
      </div>
    </div>;
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */
function LoginScreen({
  userId,
  setUserId,
  onLogin,
  passwordMeta
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    // Password yang sudah diubah lewat mobile app ikut berlaku di dashboard.
    const tersimpan = passwordMeta?.[userId]?.currentPassword || "0000";
    if (password !== tersimpan) {
      setError("Password salah.");
      return;
    }
    setError("");
    onLogin();
  };
  return <div style={{
    background: T.bg,
    minHeight: "100vh",
    ...FI,
    color: T.ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px"
  }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        select:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
      `}</style>
      <div style={{
      width: "100%",
      maxWidth: 400,
      background: T.surface,
      borderRadius: 20,
      padding: 30,
      border: `1px solid ${T.line}`,
      boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
    }} className="ais-content-panel">
        <div style={{
        textAlign: "center",
        marginBottom: 24
      }}>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 26,
          color: T.manajemen,
          letterSpacing: 0.3
        }}>Welcome to AIS</div>
          <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          marginTop: 2
        }}>ACK Integrated System</div>
        </div>

        <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Username</div>
        <select value={userId} onChange={e => setUserId(e.target.value)} style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        ...FI,
        fontSize: 14,
        background: T.surface,
        marginBottom: 16
      }} className="ais-control">
          {DASHBOARD_USERS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.jabatan}</option>)}
        </select>

        <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>Password</div>
        <input type="password" value={password} onChange={e => {
        setPassword(e.target.value);
        setError("");
      }} placeholder="Masukkan password" onKeyDown={e => e.key === "Enter" && submit()} style={{
        width: "100%",
        border: `1px solid ${error ? T.bad : T.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        ...FI,
        fontSize: 14,
        marginBottom: 6
      }} className="ais-control" />
        <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginBottom: 16
      }}>Prototype — password awal "0000". Jika sudah diubah lewat mobile app, pakai password yang baru.</div>
        {error && <div style={{
        ...FI,
        fontSize: 12,
        color: T.bad,
        marginBottom: 14
      }}>{error}</div>}

        <button onClick={submit} style={{
        width: "100%",
        border: "none",
        borderRadius: 10,
        padding: "12px",
        background: T.manajemen,
        color: "#fff",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer"
      }} className="ais-button ais-button--default">Login</button>
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PENGAMAN LAYAR PUTIH: kalau ada error saat menampilkan halaman, aplikasi tidak blank.
   Pesan error asli ditampilkan supaya bisa dilaporkan & diperbaiki.
--------------------------------------------------------- */
class AisErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      info: null
    };
  }
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  componentDidCatch(error, info) {
    this.setState({
      info
    });
    console.error("AIS error:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const stack = (this.state.info?.componentStack || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6).join(" ← ");
    return <div style={{
      minHeight: "100vh",
      background: "#EEEBE2",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Inter, sans-serif"
    }}>
        <div style={{
        maxWidth: 440,
        width: "100%",
        background: "#fff",
        border: "1px solid #DEDACC",
        borderRadius: 16,
        padding: 20
      }}>
          <div style={{
          fontWeight: 700,
          fontSize: 16,
          color: "#B23A2E",
          marginBottom: 6
        }}>Terjadi kesalahan saat menampilkan halaman</div>
          <div style={{
          fontSize: 12.5,
          color: "#767C86",
          marginBottom: 12
        }}>Data Anda aman. Mohon screenshot pesan di bawah ini dan kirim ke tim pengembang.</div>
          <div style={{
          fontFamily: "monospace",
          fontSize: 11.5,
          background: "#F5F3EC",
          borderRadius: 10,
          padding: 10,
          wordBreak: "break-word",
          marginBottom: 6
        }}>{String(this.state.error?.message || this.state.error)}</div>
          {stack && <div style={{
          fontFamily: "monospace",
          fontSize: 10.5,
          color: "#767C86",
          wordBreak: "break-word",
          marginBottom: 12
        }}>{stack}</div>}
          <button onClick={() => this.setState({
          error: null,
          info: null,
          kunci: (this.state.kunci || 0) + 1
        })} style={{
          border: "none",
          borderRadius: 10,
          padding: "10px 16px",
          background: "#1F3A5F",
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default">Coba Lagi</button>
        </div>
      </div>;
  }
}
export default function App({
  identity,
  initialPage
}) {
  return <AisErrorBoundary><AppInti identity={identity} initialPage={initialPage} /></AisErrorBoundary>;
}
function AppInti({
  identity,
  initialPage
}) {
  const [userId, setUserId] = useState(identity.id);
  const currentUser = DASHBOARD_USERS.find(u => u.id === userId) || DASHBOARD_USERS[0];
  const [page, setPage] = useState(initialPage || "overview");
  const [loggedIn, setLoggedIn] = useState(true);
  const [employees, setEmployees, empLoaded] = useStoredState("ais-employees", SEED_EMPLOYEES);
  const [sanksiList, setSanksiList, sanksiLoaded] = useStoredState("ais-sanksi-list", []);
  const [stores, setStores, storeLoaded] = useStoredState("ais-stores", SEED_STORES);
  const [products, setProducts, prodLoaded] = useStoredState("ais-products", SEED_PRODUCTS);
  const [bahan, setBahan, bahanLoaded] = useStoredState("ais-bahan", SEED_BAHAN);
  const [schedule, setSchedule, schedLoaded] = useStoredState("ais-schedule", {});
  const [attendance, setAttendance, attLoaded] = useStoredState("ais-attendance-summary", []);
  const [attendanceLog, setAttendanceLog, attLogLoaded] = useStoredState("ais-attendance-log", []);
  const [storeLocations, setStoreLocations, storeLocLoaded] = useStoredState("ais-store-locations", {});
  const [laporanManajemen, setLaporanManajemen, lapMjLoaded] = useStoredState("ais-laporan-manajemen", {});
  const [customTasks, setCustomTasks, tasksLoaded] = useStoredState("ais-custom-tasks", []);
  const [masterTask, setMasterTask, masterTaskLoaded] = useStoredState("ais-master-task", DEFAULT_MASTER_TASK);
  const [wasteBanding, setWasteBanding, bandingLoaded] = useStoredState("ais-waste-banding", []);
  const [notifRead, setNotifRead, notifReadLoaded] = useStoredState("ais-notif-read", {});
  const [roqParam, setRoqParam, roqParamLoaded] = useStoredState("ais-roq-param", {}); // per toko: { [storeId]: param }
  const [roqSnapshots,, roqSnapLoaded] = useStoredState("ais-roq-snapshot", []);
  const [roqOrders, setRoqOrders, roqOrderLoaded] = useStoredState("ais-roq-orders", []);
  const [roqIngatkan, setRoqIngatkan, roqIngatLoaded] = useStoredState("ais-roq-ingatkan", []);
  const [stokEditRequests, setStokEditRequests, stokReqLoaded] = useStoredState("ais-stok-edit-requests", []);
  const [deviceBinding, setDeviceBinding, deviceLoaded] = useStoredState("ais-device-binding", {});
  const [passwordMeta, setPasswordMeta, pwLoaded] = useStoredState("ais-password-meta", {});
  const [approvalQueue, setApprovalQueue, apprLoaded] = useStoredState("ais-approval-queue", []);
  const [reportLog, setReportLog, reportLoaded] = useStoredState("ais-report-log", {});
  const [ijinList, setIjinList, ijinLoaded] = useStoredState("ais-ijin-kerja", []);
  const [stockLedger, setStockLedger, ledgerLoaded] = useStoredState("ais-stock-ledger", []);
  const [purchaseReports, setPurchaseReports, purchaseLoaded] = useStoredState("ais-purchase-reports", []);
  const [stockOpnameReports, setStockOpnameReports, opnameRepLoaded] = useStoredState("ais-stock-opname", []);
  const [dashStockTransfers, setDashStockTransfers, transferRepLoaded] = useStoredState("ais-stock-transfers", []);
  const [stokEditLock, setStokEditLock, stokEditLockLoaded] = useStoredState("ais-stok-edit-lock", {});
  const [matrix, setMatrix, matrixLoaded] = useStoredState("ais-permission-matrix", DEFAULT_PERMISSION_MATRIX);
  const [workHours, setWorkHours, workHoursLoaded] = useStoredState("ais-work-hours", WORK_HOURS_DEFAULT);
  const [jadwalStatus, setJadwalStatus, jadwalStatusLoaded] = useStoredState("ais-jadwal-status", {});
  const [bebanToko, setBebanToko, bebanLoaded] = useStoredState("ais-beban-toko", []);
  const [salesEditLock, setSalesEditLock, salesLockLoaded] = useStoredState("ais-sales-edit-lock", {});
  const [purchaseStatus, setPurchaseStatus, purchaseStatusLoaded] = useStoredState("ais-purchase-status", {});
  const [opnameEditLock, setOpnameEditLock, opnameLockLoaded] = useStoredState("ais-opname-edit-lock", {});
  const [opnameStatus, setOpnameStatus, opnameStatusLoaded] = useStoredState("ais-stock-opname-status", {});
  const [pengajuan, setPengajuan, pengajuanLoaded] = useStoredState("ais-pengajuan", []);
  const [minyakConfig, setMinyakConfig, minyakCfgLoaded] = useStoredState("ais-minyak-config", {
    literPerCm: 1.68,
    konstanta: 14.57,
    koefMinyak: 0.1,
    allowanceMinyak: 0.15,
    ekorPerBatch: 3
  });
  const [ciprekConfig, setCiprekConfig, ciprekCfgLoaded] = useStoredState("ais-ciprek-config", SEED_CIPREK_CONFIG);
  const [pnlInputs, setPnlInputs, pnlLoaded] = useStoredState("ais-pnl-inputs", {});
  const [pnlStatusAll, setPnlStatusAll, pnlStatusLoaded] = useStoredState("ais-pnl-status", {});
  const [seeded, setSeeded] = useState(false);

  // Ledger efektif = entri manual + turunan dari Transfer Stok & Stok Opname (sumber bersama
  // dengan mobile app). Dipakai semua perhitungan persediaan agar konsisten.
  // Toko mitra tidak punya inventory/laporan — hanya tampil di Master Toko, Rekap Transfer,
  // dan modul kepegawaian (absensi/jadwal/ijin), karena SPV-nya tetap kita kelola.
  // Titik koordinat yang ditandai lewat mobile app (Akun Toko) menimpa koordinat master,
  // karena penandaan di lapangan lebih akurat daripada isian manual.
  const storesWithPin = useMemo(() => stores.map(s => {
    const pin = storeLocations?.[s.id];
    return pin ? {
      ...s,
      lat: pin.lat,
      lng: pin.lng,
      activatedAt: pin.at || s.activatedAt,
      pinnedBy: pin.by
    } : s;
  }), [stores, storeLocations]);
  const holdingOnly = useMemo(() => holdingStores(storesWithPin), [storesWithPin]);

  // Absensi dari mobile app tersimpan per aksi (clock in/out). Diubah ke bentuk ringkas
  // per hari, lalu digabung dengan data ringkas milik dashboard — data app didahulukan.
  const attendanceGabungan = useMemo(() => {
    const dariApp = deriveAttendanceSummary(attendanceLog, schedule, workHours);
    const kunciApp = new Set(dariApp.map(a => `${a.empId}_${a.date}`));
    return [...dariApp, ...attendance.filter(a => !kunciApp.has(`${a.empId}_${a.date}`))];
  }, [attendanceLog, attendance, schedule, workHours]);

  // SPV & TL hanya melihat toko yang mereka naungi. Role lain melihat semua toko holding.
  const scopedStores = useMemo(() => {
    if (currentUser?.access !== "spv") return holdingOnly;
    const self = employees.find(e => e.id === currentUser.id);
    const ids = self ? (self.stores || [self.store]).filter(Boolean) : [];
    return holdingOnly.filter(s => ids.includes(s.id));
  }, [holdingOnly, currentUser, employees]);

  // Karyawan di toko yang dinaungi SPV/TL yang login (tanpa dirinya sendiri) — dipakai Data Sanksi.
  const scopedEmployees = useMemo(() => {
    if (currentUser?.access !== "spv") return employees;
    const ids = scopedStores.map(s => s.id);
    return employees.filter(e => e.id !== currentUser.id && ["crew", "parttime", "tl"].includes(e.group) && (e.stores || [e.store]).some(sid => ids.includes(sid)));
  }, [employees, scopedStores, currentUser]);
  const isSpv = currentUser?.access === "spv";

  // Notifikasi untuk user yang login — dihitung dari data yang sama dengan halaman-halaman approval.
  const nowIso = new Date().toISOString();
  const notifItems = useMemo(() => {
    if (!currentUser) return [];
    const peran = currentUser.access === "all" ? "direksi" : currentUser.access === "spv" ? "spv" : ["eri", "nana", "elin"].includes(currentUser.id) ? currentUser.id : "manajemen";
    const u = {
      id: currentUser.id,
      name: currentUser.name,
      peran,
      storeIds: peran === "spv" ? scopedStores.map(s => s.id) : [],
      emp: employees.find(e => e.id === currentUser.id)
    };
    try {
      return hitungNotifikasi(u, {
        approvalQueue,
        stokEditRequests,
        stokEditLock,
        opnameEditLock,
        salesEditLock,
        pnlStatus: pnlStatusAll,
        purchaseStatus,
        ijinList,
        pengajuan,
        stockTransfers: dashStockTransfers,
        jadwalStatus,
        wasteBanding,
        customTasks,
        masterTask,
        laporanManajemen,
        sanksiList,
        employees,
        stores,
        schedule,
        reportLog,
        stockOpnameReports,
        roqParam,
        roqSnapshots,
        roqOrders,
        roqIngatkan
      }, nowIso);
    } catch (e) {
      console.error("notifikasi gagal dihitung", e);
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, scopedStores, employees, approvalQueue, stokEditRequests, stokEditLock, opnameEditLock, salesEditLock, pnlStatusAll, purchaseStatus, ijinList, pengajuan, dashStockTransfers, jadwalStatus, wasteBanding, customTasks, masterTask, laporanManajemen, sanksiList, stores, schedule, reportLog, stockOpnameReports, roqParam, roqSnapshots, roqOrders, roqIngatkan]);
  const notifReadSaya = currentUser && notifRead[currentUser.id] || {};
  const tandaiNotif = ids => {
    const at = new Date().toISOString();
    setNotifRead({
      ...notifRead,
      [currentUser.id]: {
        ...notifReadSaya,
        ...Object.fromEntries(ids.map(id => [id, at]))
      }
    });
  };
  const bukaNotif = n => {
    if (n.tujuan?.dash && getAccess(currentUser, n.tujuan.dash)) setPage(n.tujuan.dash);
  };
  const effectiveStockLedger = useMemo(() => effectiveLedger(stockLedger, dashStockTransfers, stockOpnameReports, stores), [stockLedger, dashStockTransfers, stockOpnameReports, stores]);
  const ready = empLoaded && storeLoaded && prodLoaded && bahanLoaded && schedLoaded && attLoaded && attLogLoaded && storeLocLoaded && pwLoaded && lapMjLoaded && tasksLoaded && masterTaskLoaded && bandingLoaded && notifReadLoaded && roqParamLoaded && roqSnapLoaded && roqOrderLoaded && roqIngatLoaded && stokReqLoaded && deviceLoaded && apprLoaded && reportLoaded && ijinLoaded && ledgerLoaded && matrixLoaded && pnlLoaded && pnlStatusLoaded && purchaseLoaded && workHoursLoaded && opnameRepLoaded && sanksiLoaded && stokEditLockLoaded && transferRepLoaded && jadwalStatusLoaded && bebanLoaded && salesLockLoaded && purchaseStatusLoaded && opnameLockLoaded && opnameStatusLoaded && pengajuanLoaded && minyakCfgLoaded && ciprekCfgLoaded;
  useEffect(() => {
    if (ready && !seeded) {
      setSeeded(true);
      if (attendance.length === 0 && Object.keys(schedule).length === 0) {
        const seed = seedAttendanceAndSchedule();
        setSchedule(seed.schedule);
        setAttendance(seed.attendance);
      }
      if (approvalQueue.length === 0) setApprovalQueue(seedApprovalQueue());
      // Merge-aware: mobile app juga menulis ke reportLog yang sama (khusus stage "stok"), jadi jangan
      // pakai cek "kosong total" — cukup lengkapi tanggal yang belum punya data sales.
      {
        const seedLog = seedLaporanToko();
        const mergedLog = {
          ...reportLog
        };
        let logChanged = false;
        Object.keys(seedLog).forEach(k => {
          if (!mergedLog[k]?.sales_shift1) {
            mergedLog[k] = {
              ...seedLog[k],
              ...(mergedLog[k] || {})
            };
            logChanged = true;
          }
        });
        if (logChanged) setReportLog(mergedLog);
      }
      if (ijinList.length === 0) setIjinList(seedIjinKerja());
      if (stockLedger.length === 0) setStockLedger(seedStockLedger());
      if (purchaseReports.length === 0) setPurchaseReports(seedPurchaseReports());
      if (stockOpnameReports.length === 0) setStockOpnameReports(seedStockOpnameReports());
      if (dashStockTransfers.length === 0) setDashStockTransfers(seedStockTransfers());

      // --- Simulasi penuh bulan berjalan (uji rantai data sampai PnL) ---
      // Ditambahkan hanya jika belum ada; tidak menimpa data lain di bulan berjalan.
      {
        const sim = seedSimulasiBulanan();
        const sudahAda = Object.keys(reportLog).some(k => k.includes(`_${SIM_MONTH}-`));
        if (!sudahAda) {
          setReportLog((() => {
            const merged = {
              ...reportLog
            };
            Object.entries(sim.reportLog).forEach(([k, v]) => {
              merged[k] = v;
            });
            return merged;
          })());
          setPurchaseReports([...purchaseReports.filter(p => !p.tanggal.startsWith(SIM_MONTH)), ...sim.purchaseReports]);
          setDashStockTransfers([...dashStockTransfers.filter(t => !(t.tanggal || "").startsWith(SIM_MONTH)), ...sim.stockTransfers]);
          setBebanToko([...bebanToko.filter(b => !(b.tanggal || "").startsWith(SIM_MONTH)), ...sim.bebanToko]);
          setStockLedger([...stockLedger.filter(l => !l.tanggal.startsWith(SIM_MONTH)), ...sim.stockLedger]);
        }
      }
      if (sanksiList.length === 0) {
        const today = new Date();
        const back = n => {
          const d = new Date(today);
          d.setDate(d.getDate() - n);
          return dateStr(d);
        };
        const galuh = employees.find(e => e.name === "Galuh");
        const hadi = employees.find(e => e.name === "Hadi");
        const seed = [];
        if (galuh) seed.push({
          id: uid(),
          empId: galuh.id,
          jenis: "teguran1",
          tanggal: back(20),
          keterangan: "Terlambat berulang tanpa konfirmasi",
          inputBy: "Eri",
          inputAt: `${back(20)}T10:00:00`
        });
        if (hadi) seed.push({
          id: uid(),
          empId: hadi.id,
          jenis: "sp1",
          tanggal: back(30),
          keterangan: "Tidak mengikuti SOP closing",
          inputBy: "Eri",
          inputAt: `${back(30)}T10:00:00`
        }, {
          id: uid(),
          empId: hadi.id,
          jenis: "teguran1",
          tanggal: back(60),
          keterangan: "Absen tanpa keterangan",
          inputBy: "Kurnia",
          inputAt: `${back(60)}T10:00:00`
        });
        if (seed.length) setSanksiList(seed);
      }
    }
  }, [ready, seeded]);
  useEffect(() => {
    // kalau ganti user dan halaman aktif tidak terlihat untuk role itu, kembali ke overview
    if (!getAccess(currentUser, page)) setPage("overview");
  }, [userId]);
  if (!ready) {
    return <div style={{
      padding: 40,
      ...FI,
      color: T.inkMuted
    }}>Memuat dashboard…</div>;
  }
  if (!loggedIn) {
    return <LoginScreen userId={userId} setUserId={setUserId} passwordMeta={passwordMeta} onLogin={() => {
      setPage("overview");
      setLoggedIn(true);
    }} />;
  }
  const access = getAccess(currentUser, page);
  const initials = currentUser.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return <div style={{
    background: T.bg,
    minHeight: "100vh",
    ...FI,
    color: T.ink,
    display: "flex"
  }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        select:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
      `}</style>

      

      <div style={{
      flex: 1,
      padding: "0",
      maxWidth: 1600,
      margin: "0 auto",
      width: "100%"
    }}>
        {!access ? <AccessDenied /> : <ReadOnlyWrap access={access}>
            {page === "overview" && <OverviewPage employees={employees} stores={scopedStores} approvalQueue={approvalQueue} reportLog={reportLog} bahan={bahan} stockLedger={effectiveStockLedger} purchaseReports={purchaseReports} stockTransfers={dashStockTransfers} pnlInputs={pnlInputs} attendance={attendanceGabungan} currentUser={currentUser} products={products} allStores={stores} minyakConfig={minyakConfig} banding={wasteBanding} />}
            {page === "karyawan_master" && <MasterKaryawanPage employees={employees} setEmployees={setEmployees} stores={stores} ijinList={ijinList} sanksiList={sanksiList} deviceBinding={deviceBinding} setDeviceBinding={setDeviceBinding} currentUser={currentUser} />}
            {page === "karyawan_sanksi" && <DataSanksiPage employees={scopedEmployees} sanksiList={sanksiList} setSanksiList={setSanksiList} currentUser={currentUser} readOnly={access !== "edit"} scopeNote={isSpv ? `Menampilkan sanksi karyawan di toko yang Anda naungi saja: ${scopedStores.map(s => s.name).join(" & ") || "-"}.` : null} />}
            {page === "karyawan_role" && <RolePermissionPage matrix={matrix} setMatrix={setMatrix} />}
            {page === "produksi_toko" && <MasterTokoPage stores={storesWithPin} setStores={setStores} products={products} bahan={bahan} />}
            {page === "produksi_bahan" && <MasterBahanPage bahan={bahan} setBahan={setBahan} products={products} />}
            {page === "produksi_produk" && <MasterProdukPage products={products} setProducts={setProducts} bahan={bahan} />}
            {page === "produksi_resep" && <MasterResepPage products={products} setProducts={setProducts} bahan={bahan} />}
            {page === "produksi_task" && <MasterTaskPage masterTask={masterTask} setMasterTask={setMasterTask} employees={employees} currentUser={currentUser} readOnly={access !== "edit"} />}
            {page === "produksi_produksi" && <MasterProduksiPage minyakConfig={minyakConfig} setMinyakConfig={setMinyakConfig} stores={holdingOnly} products={products} bahan={bahan} ciprekConfig={ciprekConfig} setCiprekConfig={setCiprekConfig} currentUser={currentUser} readOnly={access === "view"} />}
            {page === "absensi_jadwal" && <MasterJadwalPage mode={isSpv ? "spv" : access === "edit" ? "approver" : "view"} employees={employees} stores={isSpv ? scopedStores : stores} schedule={schedule} setSchedule={setSchedule} workHours={workHours} setWorkHours={setWorkHours} jadwalStatus={jadwalStatus} setJadwalStatus={setJadwalStatus} currentUser={currentUser} />}
            {page === "absensi_rekap" && <RekapBulananPage employees={isSpv ? employees.filter(e => e.id === currentUser.id || scopedEmployees.some(s => s.id === e.id)) : employees} stores={stores} attendance={isSpv ? attendanceGabungan.filter(a => scopedEmployees.some(e => e.id === a.empId) || a.empId === currentUser.id) : attendanceGabungan} currentUser={currentUser} />}
            {page === "absensi_ijin" && <IjinKerjaPage currentUser={currentUser} ijinList={ijinList} setIjinList={setIjinList} employees={employees} stores={stores} />}
            {page === "laporan_sales" && <RekapSalesPage stores={scopedStores} reportLog={reportLog} setReportLog={setReportLog} salesEditLock={salesEditLock} setSalesEditLock={setSalesEditLock} currentUser={currentUser} />}
            {page === "laporan_pengeluaran" && <RekapPengeluaranPage stores={scopedStores} reportLog={reportLog} />}
            {page === "laporan_beban" && <RekapBebanTokoPage stores={scopedStores} bebanToko={bebanToko} />}
            {page === "laporan_pengajuan" && <RekapPengajuanPage stores={scopedStores} pengajuan={pengajuan} setPengajuan={setPengajuan} currentUser={currentUser} />}
            {page === "laporan_produksi" && <RekapProduksiPage stores={scopedStores} reportLog={reportLog} products={products} bahan={bahan} ciprekConfig={ciprekConfig} />}
            {page === "laporan_waste" && <WasteCalculationPage homeOnly={isSpv} banding={wasteBanding} setBanding={setWasteBanding} currentUser={currentUser} allStores={stores} stores={scopedStores} bahan={bahan} products={products} reportLog={reportLog} purchaseReports={purchaseReports} minyakConfig={minyakConfig} />}
            {page === "laporan_kerja_harian" && <RekapKerjaHarianPage employees={employees} laporanManajemen={laporanManajemen} customTasks={customTasks} setCustomTasks={setCustomTasks} currentUser={currentUser} />}
            {page === "laporan_pembelian" && <RekapPembelianPage stores={scopedStores} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} reportLog={reportLog} bahan={bahan} products={products} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} currentUser={currentUser} />}
            {page === "laporan_opname" && <RekapOpnamePage stores={scopedStores} bahan={bahan} products={products} reportLog={reportLog} stokEditRequests={stokEditRequests} setStokEditRequests={setStokEditRequests} stockOpnameReports={stockOpnameReports} setStockOpnameReports={setStockOpnameReports} opnameEditLock={opnameEditLock} setOpnameEditLock={setOpnameEditLock} opnameStatus={opnameStatus} setOpnameStatus={setOpnameStatus} currentUser={currentUser} readOnly={access !== "edit"} />}
            {page === "laporan_transfer" && <RekapTransferStokPage stores={stores} stockTransfers={dashStockTransfers} setStockTransfers={setDashStockTransfers} />}
            {page === "laporan_pnl" && <PnLPage stores={scopedStores} bahan={bahan} reportLog={reportLog} stockLedger={effectiveStockLedger} purchaseReports={purchaseReports} stockTransfers={dashStockTransfers} bebanToko={bebanToko} pnlInputs={pnlInputs} setPnlInputs={setPnlInputs} pnlStatusAll={pnlStatusAll} setPnlStatusAll={setPnlStatusAll} currentUser={currentUser} />}
            {page === "laporan_approval" && <ApprovalDashboardPage stores={scopedStores} bahan={bahan} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} currentUser={currentUser} readOnly={access === "view"} />}
            {page === "inventory_ringkasan" && <RingkasanStokPage stores={scopedStores} bahan={bahan} products={products} reportLog={reportLog} stockLedger={effectiveStockLedger} />}
            {page === "inventory_rekap" && <RekapVariabelPage stores={scopedStores} bahan={bahan} products={products} reportLog={reportLog} stockLedger={effectiveStockLedger} />}
            {page === "roq" && <RoqPage stores={holdingOnly} allStores={stores} roqParam={roqParam} setRoqParam={setRoqParam} bahan={bahan} products={products} reportLog={reportLog} purchaseReports={purchaseReports} minyakConfig={minyakConfig} roqSnapshots={roqSnapshots} roqOrders={roqOrders} setRoqOrders={setRoqOrders} roqIngatkan={roqIngatkan} setRoqIngatkan={setRoqIngatkan} employees={employees} currentUser={currentUser} readOnly={access !== "edit"} />}
            {page === "laporan_roq" && <LaporanRoqPage stores={holdingOnly} roqOrders={roqOrders} roqSnapshots={roqSnapshots} roqParam={roqParam} employees={employees} />}
          </ReadOnlyWrap>}
      </div>
    </div>;
}
export { SEED_EMPLOYEES, SEED_STORES, DASHBOARD_USERS, ACCESS_MAP, NAV_GROUPS };
export { seedAttendanceAndSchedule, seedIjinKerja, seedApprovalQueue };
