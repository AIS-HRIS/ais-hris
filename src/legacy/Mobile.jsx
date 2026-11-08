"use client";

import FormSurface, { Field } from "../views/components/FormSurface";
import { CameraCapture } from "../views/attendance/AttendanceExperience";
import { readAttendanceLocation } from "../models/attendanceLocation";
import { getBaseline, assertAttendanceBaseline } from "../models/baseline";
import { useAttendanceIdentity } from "../views/attendance/AttendanceIdentity";
import { duplicateRequest } from "../models/requestRules";
import { useState, useEffect, useRef, useMemo, Component } from "react";
import { Clock, MapPin, Camera, LogIn, LogOut, User, Store, CalendarDays, CheckCircle2, AlertTriangle, ArrowRightLeft, ClipboardList, Users, BarChart3, ChevronDown, RefreshCcw, Lock, ImageOff, Check, PenLine, Plus, Trash2, ArrowLeftRight, Receipt, MoreVertical, Bell } from "lucide-react";

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');";
const T = {
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceSunk: "#F7F9FC",
  ink: "#20242B",
  inkMuted: "#767C86",
  line: "#E7EDF4",
  accent: "#DD7A0F",
  accentDeep: "#8A4A08",
  accentSoft: "#F6E3C7",
  manajemen: "#1F3A5F",
  manajemenSoft: "#DCE4EE",
  lapangan: "#8A4A08",
  lapanganSoft: "#F6E3C7",
  good: "#2F7D5C",
  goodSoft: "#DDEEE5",
  warn: "#B9790E",
  warnSoft: "#F5E6C8",
  bad: "#B23A2E",
  badSoft: "#F5DFDB"
};

/* ---------------------------------------------------------
   STATIC DATA
--------------------------------------------------------- */
const STORES = [{
  id: "dtop_baros",
  name: "DTOP Baros",
  jenisToko: "resto",
  status: "holding",
  manage: "tl",
  pjId: "hilman",
  lat: -6.92,
  lng: 107.605,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Baros, Sukabumi",
  telepon: "0266-221001"
}, {
  id: "dtop_cipanengah",
  name: "DTOP Cipanengah",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "jafar_sodik",
  lat: -6.93,
  lng: 107.62,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Cipanengah, Sukabumi",
  telepon: "0266-221002"
}, {
  id: "dtop_lembursitu",
  name: "DTOP Lembursitu",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "jafar_sodik",
  lat: -6.94,
  lng: 107.59,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Lembursitu, Sukabumi",
  telepon: "0266-221003"
}, {
  id: "dtop_jubleg",
  name: "DTOP Jubleg",
  jenisToko: "express",
  status: "holding",
  manage: "admin",
  pjId: "eri",
  lat: -6.915,
  lng: 107.63,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Jubleg, Sukabumi",
  telepon: "0266-221005"
}, {
  id: "dtop_purabaya",
  name: "DTOP Purabaya",
  jenisToko: "resto",
  status: "holding",
  manage: "spv",
  pjId: "sahrul",
  lat: -6.95,
  lng: 106.98,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Purabaya, Sukabumi",
  telepon: "0266-221006"
}, {
  id: "dtop_sagaranten",
  name: "DTOP Sagaranten",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "sahrul",
  lat: -7.12,
  lng: 106.78,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Sagaranten, Sukabumi",
  telepon: "0266-221007"
}, {
  id: "dtop_mangkalaya",
  name: "DTOP Mangkalaya",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "endin",
  lat: -6.96,
  lng: 106.92,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Mangkalaya, Sukabumi",
  telepon: "0266-221008"
}, {
  id: "dtop_cikembar",
  name: "DTOP Cikembar",
  jenisToko: "resto",
  status: "mitra",
  manage: "spv",
  pjId: "endin",
  lat: -6.98,
  lng: 106.86,
  radius: 10,
  transitLimitMinutes: 30,
  alamat: "Jl. Cikembar, Sukabumi",
  telepon: "0266-221009"
}];
const STORE_STATUS_LABEL = {
  holding: "Holding",
  mitra: "Mitra"
};
const STORE_MANAGE_LABEL = {
  spv: "SPV",
  tl: "Team Leader",
  admin: "Admin"
};
// Toko mitra hanya untuk absen & transfer — tidak punya inventory maupun laporan.
const isMitraStore = id => STORES.find(s => s.id === id)?.status === "mitra";
// Toko mitra tidak punya laporan/inventory — dikeluarkan dari semua pilihan yang berkaitan.
const STORES_HOLDING = STORES.filter(s => s.status !== "mitra");
const JENIS_TOKO_LABEL = {
  resto: "Resto",
  express: "Express"
};
const KANTOR_LOCATION = {
  id: "kantor",
  name: "Kantor DTOP",
  lat: -6.91,
  lng: 107.61,
  radius: 10
};
// Jam kantor manajemen: Senin–Jumat dan Sabtu berbeda. Nilai resminya diatur
// dari dashboard (Master Jadwal → Master Jam Kerja); ini hanya nilai bawaan.
const OFFICE_HOURS = {
  start: "08:00",
  end: "17:00"
};
const OFFICE_HOURS_SABTU = {
  start: "08:00",
  end: "14:00"
};

// Mengembalikan jam kantor sesuai hari dari tanggal (YYYY-MM-DD) atau objek Date.
function jamKantorHari(tglAtauDate, workHours) {
  const d = tglAtauDate instanceof Date ? tglAtauDate : new Date(String(tglAtauDate) + "T00:00:00");
  const sabtu = d.getDay() === 6;
  const wh = workHours || {};
  if (sabtu) return wh.manajemenSabtu || OFFICE_HOURS_SABTU;
  return wh.manajemen || OFFICE_HOURS;
}
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Token style bersama — memangkas pengulangan tanpa mengubah tampilan. */
const FI = {
  fontFamily: "DM Sans"
};
const FM = {
  fontFamily: "JetBrains Mono"
};
const FB = {
  fontFamily: "Manrope"
};
const SHIFT_LABELS = {
  satu_toko: "1 Toko",
  1: "Shift 1",
  2: "Shift 2",
  longshift: "Longshift",
  backup: "Backup",
  mobile: "Mobile",
  kantor: "Kantor",
  audit: "Audit Toko",
  off: "Libur"
};

// Catatan: jam kerja ini nantinya akan diambil dari Master Jadwal di dashboard (bisa diubah sewaktu-waktu).
// Untuk prototype, nilai berikut jadi acuan tetap: Manajemen masuk 08:00 (lihat OFFICE_HOURS),
// Crew/Part Time/SPV Shift 1 masuk 06:00, Shift 2 masuk 14:00. Toleransi terlambat: 15 menit.
// "satu_toko" (khusus SPV) tidak terikat jam mulai — hanya durasi kerja 8 jam.
// Durasi kerja shift "1 Toko" (SPV/TL) diatur dari dashboard: Master Jadwal -> Master Jam Kerja.
const WORK_HOURS_DEFAULT = {
  manajemen: {
    start: "08:00",
    end: "17:00"
  },
  manajemenSabtu: {
    start: "08:00",
    end: "14:00"
  },
  1: {
    start: "06:00",
    end: "14:00"
  },
  2: {
    start: "14:00",
    end: "22:00"
  },
  toleransi: 15,
  durasiSpvJam: 8
};
const SHIFT_BERBASIS_DURASI = new Set(["satu_toko"]);
const durasiShiftJam = (shift, workHours) => SHIFT_BERBASIS_DURASI.has(shift) ? workHours?.durasiSpvJam ?? WORK_HOURS_DEFAULT.durasiSpvJam : null;
const SHIFT_TIME = {
  1: {
    start: "06:00",
    end: "14:00"
  },
  2: {
    start: "14:00",
    end: "22:00"
  },
  longshift: {
    start: "06:00",
    end: "22:00"
  },
  backup: {
    start: "06:00",
    end: "14:00"
  },
  mobile: {
    start: "06:00",
    end: "22:00"
  },
  satu_toko: null // durasi-based, bukan jam tetap
};
const LATE_TOLERANCE_MIN = 15;
const EMPLOYEES = [{
  id: "eri",
  name: "Eri",
  jabatan: "Admin Utama",
  group: "manajemen",
  store: null,
  joinDate: "2022-03-01",
  statusKontrak: "tetap",
  cutiKuota: 12,
  isAdminUtama: true
}, {
  id: "nana",
  name: "Nana",
  jabatan: "Finance",
  group: "manajemen",
  store: null,
  joinDate: "2022-08-15",
  statusKontrak: "tetap",
  cutiKuota: 12
}, {
  id: "elin",
  name: "Elin",
  jabatan: "Admin Inventory",
  group: "manajemen",
  store: null,
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
  joinDate: "2023-05-02",
  statusKontrak: "tetap"
}, {
  id: "hilman",
  name: "Hilman",
  jabatan: "Team Leader",
  group: "tl",
  store: "dtop_baros",
  stores: ["dtop_baros"],
  joinDate: "2023-09-18",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-09-18"
}, {
  id: "revy",
  name: "Revy",
  jabatan: "Crew",
  group: "crew",
  store: "dtop_lembursitu",
  joinDate: "2024-06-10",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-12-10"
}, {
  id: "hadi",
  name: "Hadi",
  jabatan: "Part Time",
  group: "parttime",
  store: "dtop_baros",
  joinDate: "2025-01-20",
  statusKontrak: "parttime"
}, {
  id: "jafar_sodik",
  name: "Jafar Sodik",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_cipanengah",
  stores: ["dtop_cipanengah", "dtop_lembursitu"],
  joinDate: "2022-11-01",
  statusKontrak: "tetap"
}, {
  id: "sahrul",
  name: "Sahrul",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_purabaya",
  stores: ["dtop_purabaya", "dtop_sagaranten"],
  joinDate: "2023-03-14",
  statusKontrak: "kontrak",
  kontrakEnd: "2026-09-14"
}, {
  id: "endin",
  name: "Endin",
  jabatan: "SPV Jr",
  group: "spv",
  store: "dtop_mangkalaya",
  stores: ["dtop_mangkalaya", "dtop_cikembar"],
  joinDate: "2024-02-05",
  statusKontrak: "tetap"
}, {
  id: "juhaeri",
  name: "Juhaeri",
  jabatan: "Manajemen",
  group: "direksi",
  store: null,
  joinDate: "2020-01-01",
  statusKontrak: "tetap"
}, {
  id: "kurnia",
  name: "Kurnia",
  jabatan: "Manajemen",
  group: "direksi",
  store: null,
  joinDate: "2020-01-01",
  statusKontrak: "tetap"
}, {
  id: "toko_dtop_baros",
  name: "Akun Toko — DTOP Baros",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_baros"
}, {
  id: "toko_dtop_cipanengah",
  name: "Akun Toko — DTOP Cipanengah",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_cipanengah"
}, {
  id: "toko_dtop_lembursitu",
  name: "Akun Toko — DTOP Lembursitu",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_lembursitu"
}, {
  id: "toko_dtop_jubleg",
  name: "Akun Toko — DTOP Jubleg",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_jubleg"
}, {
  id: "toko_dtop_purabaya",
  name: "Akun Toko — DTOP Purabaya",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_purabaya"
}, {
  id: "toko_dtop_sagaranten",
  name: "Akun Toko — DTOP Sagaranten",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_sagaranten"
}, {
  id: "toko_dtop_mangkalaya",
  name: "Akun Toko — DTOP Mangkalaya",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_mangkalaya"
}, {
  id: "toko_dtop_cikembar",
  name: "Akun Toko — DTOP Cikembar",
  jabatan: "Device Toko",
  group: "toko_device",
  store: "dtop_cikembar"
}];
const STATUS_KONTRAK_LABEL = {
  parttime: "Part Time",
  kontrak: "Kontrak (PKWT)",
  tetap: "Karyawan Tetap"
};

// Data sanksi karyawan (simulasi) — di working app akan bersumber dari modul Data Sanksi di dashboard.
const SANKSI_TYPES_APP = {
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
function seedSanksiApp() {
  const today = new Date();
  const back = n => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return dateStr(d);
  };
  return [{
    id: "sanksi_1",
    empId: "galuh",
    jenis: "teguran1",
    tanggal: back(20),
    keterangan: "Terlambat berulang tanpa konfirmasi",
    inputBy: "Eri"
  }, {
    id: "sanksi_2",
    empId: "hadi",
    jenis: "sp1",
    tanggal: back(30),
    keterangan: "Tidak mengikuti SOP closing",
    inputBy: "Eri"
  }, {
    id: "sanksi_3",
    empId: "hadi",
    jenis: "teguran1",
    tanggal: back(120),
    keterangan: "Absen tanpa keterangan",
    inputBy: "Kurnia"
  }];
}
function formatMasaKerjaApp(joinDate) {
  if (!joinDate) return "-";
  const start = new Date(joinDate + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return "-";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} tahun` : null, m ? `${m} bulan` : null].filter(Boolean).join(" ") || "Baru bergabung";
}
const GROUP_LABEL = {
  manajemen: "Manajemen",
  crew: "Crew Toko",
  spv: "SPV Toko",
  tl: "Team Leader",
  parttime: "Part Time",
  direksi: "Manajemen",
  // label tampilan saja; kunci grup tetap "direksi"
  toko_device: "Akun Toko (Device)"
};

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
const pad = n => String(n).padStart(2, "0");
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const monthStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addDays = (dateStr_, n) => {
  const d = new Date(dateStr_ + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateStr(d);
};
const storeName = id => id ? STORES.find(s => s.id === id)?.name || "-" : KANTOR_LOCATION.name;
const minutesOf = hhmm => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const minutesOfDate = d => d.getHours() * 60 + d.getMinutes();

// Hitung keterlambatan (menit) untuk satu event clock-in terhadap jam mulai yang berlaku.
// scheduleShift: kode shift ("1","2","longshift", dst) untuk crew/spv/parttime — null untuk manajemen (pakai OFFICE_HOURS).
function lateMinutesFor(clockInDate, scheduledShift, workHours) {
  // Shift berbasis durasi (mis. "1 Toko" untuk SPV) tidak punya jam mulai tetap,
  // sehingga tidak ada konsep keterlambatan.
  if (scheduledShift && SHIFT_BERBASIS_DURASI.has(scheduledShift)) return 0;
  const cfg = scheduledShift ? SHIFT_TIME[scheduledShift] : null;
  const startHHMM = scheduledShift ? cfg ? cfg.start : SHIFT_TIME["1"].start : jamKantorHari(clockInDate, workHours).start;
  const lateBy = minutesOfDate(clockInDate) - minutesOf(startHHMM);
  return lateBy;
}

// Akumulasi total menit terlambat (yang melewati toleransi) untuk karyawan pada bulan berjalan.
// Jumlah HARI terlambat bulan ini (beda dari totalLateMinutesThisMonth yang menjumlah menit).
// Master Jadwal di dashboard menyimpan kode shift sebagai string ("1","2","L","B","M","O","K","-"),
// sedangkan seed lama di mobile memakai objek { shift, storeId }. Helper ini menormalkan keduanya
// ke istilah shift yang dipakai mobile, supaya jadwal dari dashboard langsung terbaca di app.
const DASH_SHIFT_TO_MOBILE = {
  1: "1",
  2: "2",
  L: "longshift",
  B: "backup",
  M: "mobile",
  S: "satu_toko",
  O: "off",
  K: "kantor",
  "-": null
};
const MOBILE_SHIFT_TO_DASH = {
  1: "1",
  2: "2",
  longshift: "L",
  backup: "B",
  mobile: "M",
  satu_toko: "S",
  off: "O",
  kantor: "K"
};

// Rumus konversi minyak diatur dari dashboard (Master Data → Master Produksi → Master Minyak).
// Default mengikuti nilai yang selama ini dipakai; helper ini membacanya dari penyimpanan bersama.
const MINYAK_CONFIG_DEFAULT = {
  literPerCm: 1.68,
  konstanta: 14.57
};
function cmKeLiterFryer(cm, cfg) {
  const k = cfg || MINYAK_CONFIG_DEFAULT;
  return (Number(cm) || 0) * k.literPerCm + k.konstanta;
}
function cmKeLiterTopUp(cm, cfg) {
  const k = cfg || MINYAK_CONFIG_DEFAULT;
  return (Number(cm) || 0) * k.literPerCm;
}
function normalizeShift(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") return DASH_SHIFT_TO_MOBILE[entry] ?? null;
  return entry.shift ?? null;
}
function shiftOn(schedule, empId, ds) {
  return normalizeShift((schedule || {})[`${empId}_${ds}`]);
}
function countLateDaysThisMonth(emp, log, schedule, workHours) {
  const month = monthStr(new Date());
  let count = 0;
  if (emp.group === "manajemen") {
    const [y, m] = month.split("-").map(Number);
    const today = new Date();
    const upTo = today.getDate();
    for (let d = 1; d <= upTo; d++) {
      if (new Date(y, m - 1, d).getDay() === 0) continue;
      const ds = `${month}-${pad(d)}`;
      const clockIn = log.find(r => r.empId === emp.id && r.date === ds && r.type === "clock_in");
      if (!clockIn) continue;
      if (lateMinutesFor(new Date(clockIn.timestamp), null, workHours) > LATE_TOLERANCE_MIN) count++;
    }
  } else {
    Object.entries(schedule).filter(([k, v]) => k.startsWith(emp.id + "_") && k.slice(-7) === month && normalizeShift(v) && normalizeShift(v) !== "off").forEach(([k, v]) => {
      const date = k.slice(k.indexOf("_") + 1);
      const clockIn = log.find(r => r.empId === emp.id && r.date === date && r.type === "clock_in");
      if (!clockIn) return;
      if (lateMinutesFor(new Date(clockIn.timestamp), normalizeShift(v), workHours) > LATE_TOLERANCE_MIN) count++;
    });
  }
  return count;
}

// Periode gajian 21–20 yang sedang berjalan, untuk tampilan Jadwal Pribadi.
function currentPayrollPeriod(now) {
  let startMonth = now.getMonth();
  let startYear = now.getFullYear();
  if (now.getDate() < 21) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }
  const start = new Date(startYear, startMonth, 21);
  const end = new Date(startYear, startMonth + 1, 20);
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(dateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return {
    start: dateStr(start),
    end: dateStr(end),
    dates
  };
}

// Keterangan lokasi kerja di header — berlaku untuk semua role, bukan cuma crew.
function empLocationLabel(emp) {
  if (emp.group === "crew" || emp.group === "parttime" || emp.group === "toko_device") return storeName(emp.store);
  // TL hanya menaungi satu toko; SPV bisa beberapa.
  if (emp.group === "tl") return storeName(emp.stores?.[0] || emp.store);
  if (emp.group === "spv") return (emp.stores || [emp.store]).map(id => storeName(id)).join(" & ");
  if (emp.group === "manajemen" || emp.group === "direksi") return "Kantor";
  return null;
}

// Menu yang relevan per role di dropdown titik tiga — role yang tidak punya akses ke suatu modul tidak akan melihat menunya sama sekali.
// Semua toko yang dinaungi seseorang berstatus mitra? (SPV mitra hanya absen & transfer)
function hanyaMitra(emp) {
  const ids = emp.stores || (emp.store ? [emp.store] : []);
  return ids.length > 0 && ids.every(id => isMitraStore(id));
}

// Ke siapa approval/ijin/tukar shift diajukan — mengikuti kolom "manage" di master toko.
// Toko yang dikelola Admin tidak punya SPV/TL, jadi semuanya naik ke Eri.
function atasanToko(storeId) {
  const s = STORES.find(x => x.id === storeId);
  if (!s) return null;
  if (s.manage === "admin") return EMPLOYEES.find(e => e.id === "eri") || null;
  return EMPLOYEES.find(e => e.id === s.pjId) || null;
}
function allowedModuleMenu(emp) {
  // Akun toko mitra hanya menyimpan titik koordinat absen — tanpa laporan apa pun.
  if (emp.group === "toko_device") {
    return isMitraStore(emp.store) ? ["profile"] : ["profile", "laporan", "beban"];
  }
  if (emp.group === "crew" || emp.group === "parttime") return ["profile", "absensi", "ijin", "jadwal"];
  if (emp.group === "spv" || emp.group === "tl") {
    // SPV yang semua tokonya mitra: tidak ada laporan toko maupun laporan kerja harian.
    if (hanyaMitra(emp)) return ["profile", "absensi", "ijin", "jadwal"];
    return ["profile", "absensi", "absensi_harian", "laporan", "ijin", "jadwal"];
  }
  if (emp.group === "direksi") return ["profile", "absensi", "absensi_harian", "laporan", "opname", "ijin", "approval"];
  if (emp.group === "manajemen") {
    if (emp.id === "eri") return ["profile", "absensi", "absensi_harian", "laporan", "opname", "ijin", "approval"];
    if (emp.id === "elin") return ["profile", "absensi", "absensi_harian", "laporan", "opname", "ijin"];
    return ["profile", "absensi", "absensi_harian", "ijin"];
  }
  return ["profile", "absensi"];
}
function totalLateMinutesThisMonth(emp, log, schedule, workHours) {
  const month = monthStr(new Date());
  let total = 0;
  if (emp.group === "manajemen") {
    const [y, m] = month.split("-").map(Number);
    const today = new Date();
    const upTo = today.getDate();
    for (let d = 1; d <= upTo; d++) {
      if (new Date(y, m - 1, d).getDay() === 0) continue;
      const ds = `${month}-${pad(d)}`;
      const clockIn = log.find(r => r.empId === emp.id && r.date === ds && r.type === "clock_in");
      if (!clockIn) continue;
      const lateBy = lateMinutesFor(new Date(clockIn.timestamp), null, workHours);
      if (lateBy > LATE_TOLERANCE_MIN) total += lateBy;
    }
  } else {
    Object.entries(schedule).filter(([k, v]) => k.startsWith(emp.id + "_") && k.slice(-7) === month && normalizeShift(v) && normalizeShift(v) !== "off").forEach(([k, v]) => {
      const date = k.slice(k.indexOf("_") + 1);
      const clockIn = log.find(r => r.empId === emp.id && r.date === date && r.type === "clock_in");
      if (!clockIn) return;
      const lateBy = lateMinutesFor(new Date(clockIn.timestamp), normalizeShift(v), workHours);
      if (lateBy > LATE_TOLERANCE_MIN) total += lateBy;
    });
  }
  return total;
}

// Bangun pesan notifikasi telat (atau null kalau tidak telat / masih dalam toleransi).
function buildLateNotice(emp, clockInDate, scheduledShift, log, schedule, workHours) {
  const lateBy = lateMinutesFor(clockInDate, scheduledShift, workHours);
  if (lateBy <= LATE_TOLERANCE_MIN) return null;
  const totalMin = totalLateMinutesThisMonth(emp, log, schedule) + lateBy; // termasuk kejadian saat ini
  const totalJam = (totalMin / 60).toFixed(1);
  return `Anda terlambat ${lateBy} menit. Total terlambat Anda ${totalJam} jam.`;
}
function LateNotice({
  message
}) {
  if (!message) return null;
  return <div style={{
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    background: T.badSoft,
    color: T.bad,
    padding: "12px 14px",
    borderRadius: 12,
    ...FI,
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 14
  }} className="ais-flex-layout">
      <AlertTriangle size={16} style={{
      marginTop: 1,
      flexShrink: 0
    }} />
      {message}
    </div>;
}
function StokEditNotifBanner({
  stokEditRequests,
  stokEditLock,
  reportLog
}) {
  const pendingReq = (stokEditRequests || []).filter(r => r.status === "pending");
  const pendingDireksi = Object.entries(stokEditLock || {}).filter(([, v]) => v.direksiStatus === "pending");
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentEdits = Object.entries(stokEditLock || {}).filter(([, v]) => v.editCount > 0).map(([key]) => {
    const [storeId, ...dateParts] = key.split("_");
    const tanggal = dateParts.join("_");
    const editedAt = reportLog?.[key]?.stok?.editedAt;
    const editedBy = reportLog?.[key]?.stok?.editedBy;
    return {
      storeId,
      tanggal,
      editedAt,
      editedBy
    };
  }).filter(e => e.editedAt && new Date(e.editedAt) >= threeDaysAgo);
  if (pendingReq.length === 0 && pendingDireksi.length === 0 && recentEdits.length === 0) return null;
  return <div style={{
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
    marginBottom: 14
  }} className="ais-flex-layout">
      <AlertTriangle size={16} style={{
      marginTop: 1,
      flexShrink: 0
    }} />
      <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 6
    }} className="ais-flex-layout">
        {pendingReq.length > 0 && <div>
            Ada {pendingReq.length} permintaan edit Stok Bahan Baku menunggu
            review Elin:
            <div style={{
          fontWeight: 400,
          marginTop: 2
        }}>
              {pendingReq.map(r => `${storeName(r.storeId)} (${r.tanggal})`).join(", ")}
            </div>
          </div>}
        {pendingDireksi.length > 0 && <div>
            Ada {pendingDireksi.length} permintaan edit Stok Bahan Baku menunggu
            approval Kurnia & Juhaeri:
            <div style={{
          fontWeight: 400,
          marginTop: 2
        }}>
              {pendingDireksi.map(([k]) => {
            const [sid, ...dp] = k.split("_");
            return `${storeName(sid)} (${dp.join("_")})`;
          }).join(", ")}
            </div>
          </div>}
        {recentEdits.length > 0 && <div>
            Stok Bahan Baku baru saja diedit (3 hari terakhir):
            <div style={{
          fontWeight: 400,
          marginTop: 2
        }}>
              {recentEdits.map(e => `${storeName(e.storeId)} (${e.tanggal}) oleh ${e.editedBy}`).join(", ")}
            </div>
          </div>}
      </div>
    </div>;
}
function seedHistory() {
  const log = [];
  const schedule = {};
  const closing = {};
  const today = new Date();
  const workers = EMPLOYEES.filter(e => e.group === "crew" || e.group === "spv" || e.group === "tl");
  for (let back = 9; back >= 1; back--) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const ds = dateStr(d);
    workers.forEach((emp, idx) => {
      const shiftPool = (emp.group === "spv" || emp.group === "tl") && emp.id === "sahrul" ? ["mobile", "1", "2"] : ["1", "2", "longshift"];
      const shift = shiftPool[(back + idx) % shiftPool.length];
      schedule[`${emp.id}_${ds}`] = MOBILE_SHIFT_TO_DASH[shift] || shift;

      // inject one alpa and one late for realism
      const isAlpa = back === 6 && emp.id === "galuh";
      const isLate = back === 4 && emp.id === "hilman";
      const isEarlyOut = back === 3 && emp.id === "sodik";
      if (isAlpa) return;
      const {
        start,
        end
      } = SHIFT_TIME[shift];
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const inTime = new Date(d);
      inTime.setHours(sh, sm + (isLate ? 22 : 0), 0, 0);
      const outTime = new Date(d);
      outTime.setHours(eh, em - (isEarlyOut ? 35 : 0), 0, 0);
      if (shift === "mobile") {
        const midOut = new Date(d);
        midOut.setHours(13, 0, 0, 0);
        const midIn = new Date(d);
        midIn.setHours(13, 25, 0, 0);
        log.push(mkRecord(emp, ds, "clock_in", inTime, emp.store));
        log.push(mkRecord(emp, ds, "mobile_out", midOut, emp.store));
        log.push(mkRecord(emp, ds, "mobile_in", midIn, "dtop_cipanengah"));
        log.push(mkRecord(emp, ds, "clock_out", outTime, "dtop_cipanengah"));
      } else {
        log.push(mkRecord(emp, ds, "clock_in", inTime, emp.store));
        log.push(mkRecord(emp, ds, "clock_out", outTime, emp.store));
      }
      closing[`${emp.store}_${ds}`] = true;
    });
  }
  return {
    log,
    schedule,
    closing
  };
}

// Simulasi: laporan Stok Bahan Baku 5 hari ke belakang per toko, supaya kolom Stok Awal auto-fill
// dan date picker Elin punya beberapa hari histori untuk direview (di kondisi nyata datanya akan
// selalu ada karena laporan diinput crew tiap hari).
function seedReportLogStok() {
  const reportLog = {};
  const approvalEntries = [];
  const running = {}; // lacak stok akhir berjalan per toko+bahan supaya rantai antar hari realistis

  for (let daysBack = 5; daysBack >= 1; daysBack--) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const ds = dateStr(d);
    STORES.forEach((store, sIdx) => {
      const stokPayload = {
        inputOleh: "Simulasi (Data Awal)",
        inputOlehId: null,
        submittedAt: `${ds}T21:00:00`
      };
      BAHAN_BAKU.forEach((b, bIdx) => {
        const runKey = `${store.id}_${b.id}`;
        const baseline = 20 + (sIdx + bIdx) % 6 * 5;
        const awal = running[runKey] != null ? running[runKey] : baseline;
        const masuk = (bIdx + daysBack) % 3 === 0 ? bIdx % 3 * 5 + 5 : 0;
        const pakai = 5 + (bIdx + daysBack) % 4 * 2;
        const akhir = Math.max(awal + masuk - pakai, 0);
        running[runKey] = akhir;
        stokPayload[b.id] = {
          awal,
          masuk,
          pakai,
          transferIn: 0,
          transferOut: 0,
          akhir
        };
      });
      reportLog[`${store.id}_${ds}`] = {
        stok: stokPayload
      };

      // "Kemarin" (daysBack === 1) masih menunggu review Elin; hari-hari sebelumnya dianggap sudah disetujui,
      // supaya alur Approve/Reject di halaman Elin langsung kelihatan begitu app dibuka pertama kali.
      approvalEntries.push({
        id: `${store.id}_${ds}_stok_seed`,
        storeId: store.id,
        date: ds,
        type: "stok",
        payload: stokPayload,
        requestedAt: `${ds}T21:00:00`,
        ...(daysBack === 1 ? {
          status: "pending"
        } : {
          status: "approved",
          respondedAt: `${ds}T21:30:00`,
          decidedBy: "Elin"
        })
      });
    });
  }
  return {
    reportLog,
    approvalEntries
  };
}
function mkRecord(emp, ds, type, time, storeId) {
  return {
    id: `${emp.id}_${ds}_${type}_${time.getTime()}`,
    empId: emp.id,
    empName: emp.name,
    group: emp.group,
    store: storeId,
    shift: null,
    type,
    date: ds,
    timestamp: time.toISOString(),
    location: {
      lat: (-6.544 + Math.random() * 0.01).toFixed(5),
      lng: (106.789 + Math.random() * 0.01).toFixed(5),
      simulated: true
    },
    selfie: null
  };
}

/* ---------------------------------------------------------
   STORAGE HOOK
--------------------------------------------------------- */
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
function useStoredState(key, initial, pollMs) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const baca = async () => {
      try {
        const res = await bacaStorage(key);
        if (alive && res && res.value) setValue(JSON.parse(res.value));
      } catch (e) {
        /* belum ada isinya — pakai nilai awal */
      } finally {
        if (alive) setLoaded(true);
      }
    };
    baca();
    // pollMs (opsional): baca ulang berkala untuk data yang dikirim dari dashboard (mis. tombol "Ingatkan" ROQ).
    const t = pollMs ? setInterval(baca, pollMs) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [key, pollMs]);
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
    lapangan: {
      bg: T.lapanganSoft,
      fg: T.lapangan
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
    textTransform: "uppercase",
    whiteSpace: "nowrap"
  }}>
      {children}
    </span>;
}
function SectionLabel({
  children
}) {
  return <div style={{
    fontFamily: "Manrope",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: T.inkMuted,
    marginBottom: 10
  }} className="ais-section-label">
      {children}
    </div>;
}
function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled
}) {
  return <div style={{
    position: "relative"
  }}>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} style={{
      width: "100%",
      appearance: "none",
      background: disabled ? T.line : T.surfaceSunk,
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      padding: "10px 34px 10px 12px",
      fontFamily: "DM Sans",
      fontSize: 14,
      fontWeight: 500,
      color: disabled ? T.inkMuted : T.ink,
      cursor: disabled ? "not-allowed" : "pointer"
    }} className="ais-control">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>
            {o.label}
          </option>)}
      </select>
      <ChevronDown size={16} color={T.inkMuted} style={{
      position: "absolute",
      right: 10,
      top: 11,
      pointerEvents: "none"
    }} />
    </div>;
}

/* ---------------------------------------------------------
   SELFIE CAPTURE (downscaled thumbnail)
--------------------------------------------------------- */
function captureToThumb(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File foto tidak dapat dibaca."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format foto belum didukung. Gunakan JPEG atau PNG."));
      img.onload = () => {
        const size = 120;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale,
          h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function getLocation() {
  return readAttendanceLocation();
}
function LocationModeToggle() {
  return <div className="ais-location-note"><MapPin size={15} /><span>Lokasi GPS aktual digunakan saat attendance.</span></div>;
}
function pesanGagalKamera(err) {
  const n = err && err.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Akses kamera ditolak. Izinkan kamera untuk aplikasi ini di pengaturan browser/HP, lalu coba lagi.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "Kamera depan tidak ditemukan di perangkat ini.";
  if (n === "NotReadableError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut, lalu coba lagi.";
  return "Kamera tidak bisa dibuka. Pastikan akses kamera diizinkan untuk aplikasi ini (pengaturan browser/HP), lalu coba lagi. Absen wajib memakai kamera depan secara langsung.";
}
function KameraSelfie({
  judul,
  onAmbil,
  onBatal
}) {
  return <div className="attendance-camera-modal" role="dialog" aria-modal="true" aria-label={judul}><div className="attendance-camera-sheet"><header><span className="utility-label">ATTENDANCE / DAILY SELFIE</span><h2>{judul}</h2><p>Ambil selfie langsung untuk catatan attendance hari ini.</p></header><CameraCapture kind="daily" onCancel={onBatal} onCapture={async capture => {
        const thumb = await captureToThumb(capture.photo);
        await onAmbil(thumb);
      }} /></div></div>;
}
function PunchButton({
  label,
  sub,
  icon: Icon,
  tone = "accent",
  disabled,
  disabledReason,
  onCaptured,
  locationTarget,
  locationMode = "near"
}) {
  const identity = useAttendanceIdentity();
  const [kamera, setKamera] = useState(false);
  const timeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bg = disabled ? T.line : tone === "accent" ? T.accent : T.good;

  // 1) Cek jam server dulu, 2) buka kamera depan live, 3) setelah foto diambil → cek lokasi & catat.
  const mulai = async () => {
    setError(null);
    try {
      const baseline = await getBaseline(identity?.id);
      if (!baseline) {
        setError("Daftarkan foto baseline sebelum melakukan attendance.");
        return;
      }
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy(true);
    setError(null);
    const timeCheck = await validateDeviceTime();
    if (timeCheck.ok === false) {
      setBusy(false);
      const selisih = timeCheck.driftSec >= 60 ? `${Math.round(timeCheck.driftSec / 60)} menit` : `${Math.round(timeCheck.driftSec)} detik`;
      setError(`Absen ditolak — jam perangkat Anda menyimpang ${selisih} dari waktu server. Nonaktifkan pengaturan jam manual dan aktifkan "waktu otomatis" di perangkat, lalu coba lagi.`);
      return;
    }
    if (timeCheck.ok === null) {
      setBusy(false);
      setError("Absen ditolak — waktu server tidak dapat diverifikasi. Pastikan perangkat terhubung internet, lalu coba lagi.");
      return;
    }
    timeRef.current = timeCheck;
    setKamera(true);
  };
  const setelahFoto = async thumb => {
    setKamera(false);
    try {
      const timeCheck = timeRef.current || {
        serverTime: null,
        driftSec: 0
      };
      const loc = await getLocation(locationTarget, locationMode);
      if (loc.simulated) throw new Error("Lokasi asli belum tersedia. Izinkan GPS lalu coba kembali. Attendance tidak dicatat dengan lokasi simulasi.");
      if (locationTarget) {
        const dist = haversineMeters(Number(loc.lat), Number(loc.lng), locationTarget.lat, locationTarget.lng);
        const radius = locationTarget.radius || 10;
        if (dist > radius) {
          setBusy(false);
          setError(`Absen ditolak — lokasi ±${Math.round(dist)}m dari ${locationTarget.name}, melebihi radius maksimal ${radius}m.`);
          return;
        }
        await onCaptured({
          selfie: thumb,
          selfieSumber: "kamera_depan_langsung",
          location: loc,
          distance: Math.round(dist),
          serverTime: timeCheck.serverTime,
          driftSec: Math.round(timeCheck.driftSec)
        });
      } else {
        await onCaptured({
          selfie: thumb,
          selfieSumber: "kamera_depan_langsung",
          location: loc,
          serverTime: timeCheck.serverTime,
          driftSec: Math.round(timeCheck.driftSec)
        });
      }
    } catch (e) {
      setError(e.message || "Attendance belum berhasil dicatat.");
    } finally {
      setBusy(false);
    }
  };
  return <div>
      <button disabled={disabled || busy} onClick={mulai} style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      background: bg,
      color: disabled ? T.inkMuted : "#fff",
      border: "none",
      borderRadius: 14,
      padding: "16px 18px",
      ...FB,
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : "0 6px 16px -6px rgba(138,74,8,0.45)",
      transition: "transform .12s ease"
    }} onMouseDown={e => {
      if (!disabled) e.currentTarget.style.transform = "scale(0.98)";
    }} onMouseUp={e => {
      e.currentTarget.style.transform = "scale(1)";
    }} className="ais-button ais-button--primary ais-flex-layout">
        {busy ? <RefreshCcw size={20} className="spin" /> : <Icon size={20} />}
        {busy ? "Memproses…" : label}
      </button>
      {sub && !disabled && !error && <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted,
      textAlign: "center",
      marginTop: 7
    }}>
          {sub}
        </div>}
      {disabled && disabledReason && <div style={{
      display: "flex",
      gap: 6,
      alignItems: "flex-start",
      marginTop: 8,
      background: T.warnSoft,
      color: T.warn,
      padding: "8px 10px",
      borderRadius: 10,
      ...FI,
      fontSize: 12.5,
      fontWeight: 500
    }} className="ais-flex-layout">
          <Lock size={14} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          {disabledReason}
        </div>}
      {error && <div style={{
      display: "flex",
      gap: 6,
      alignItems: "flex-start",
      marginTop: 8,
      background: T.badSoft,
      color: T.bad,
      padding: "8px 10px",
      borderRadius: 10,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600
    }} className="ais-flex-layout">
          <MapPin size={14} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          {error}
        </div>}
      {kamera && <KameraSelfie judul={label} onAmbil={setelahFoto} onBatal={() => {
      setKamera(false);
      setBusy(false);
    }} />}
    </div>;
}

/* ---------------------------------------------------------
   IDENTITY HEADER
--------------------------------------------------------- */
function IdentityCard({
  emp,
  subtitleOverride
}) {
  const initials = emp.name.split(" ").map(w => w[0]).slice(0, 2).join("");
  const hideRole = emp.group === "direksi" && !emp.jabatan;
  return <div style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18
  }} className="ais-identity ais-flex-layout">
      <div style={{
      width: 46,
      height: 46,
      borderRadius: 12,
      background: hideRole ? T.ink : emp.group === "manajemen" ? T.manajemen : T.accent,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Manrope",
      fontWeight: 700,
      fontSize: 18
    }}>
        {initials}
      </div>
      <div>
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 16,
        color: T.ink
      }}>
          {emp.name}
        </div>
        {!hideRole && <div style={{
        display: "flex",
        gap: 6,
        marginTop: 3,
        alignItems: "center"
      }} className="ais-flex-layout">
            {subtitleOverride ? <span style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          fontWeight: 600
        }}>
                {subtitleOverride}
              </span> : <>
                <span style={{
            ...FI,
            fontSize: 12.5,
            color: T.inkMuted
          }}>
                  {emp.jabatan}
                </span>
                <span style={{
            color: T.line
          }}>•</span>
                <Badge tone={emp.group === "manajemen" ? "manajemen" : "lapangan"}>
                  {GROUP_LABEL[emp.group]}
                </Badge>
              </>}
          </div>}
      </div>
    </div>;
}

/* ---------------------------------------------------------
   HISTORY ROW
--------------------------------------------------------- */
const TYPE_META = {
  clock_in: {
    label: "Clock In",
    icon: LogIn,
    tone: "good"
  },
  clock_out: {
    label: "Clock Out",
    icon: LogOut,
    tone: "bad"
  },
  mobile_out: {
    label: "Mobile Out",
    icon: ArrowRightLeft,
    tone: "warn"
  },
  mobile_in: {
    label: "Mobile In",
    icon: ArrowRightLeft,
    tone: "good"
  }
};
function HistoryRow({
  rec
}) {
  const meta = TYPE_META[rec.type];
  const Icon = meta.icon;
  const t = new Date(rec.timestamp);
  return <div style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderBottom: `1px solid ${T.line}`
  }} className="ais-flex-layout">
      <div style={{
      width: 30,
      height: 30,
      borderRadius: 8,
      flexShrink: 0,
      background: meta.tone === "good" ? T.goodSoft : meta.tone === "bad" ? T.badSoft : T.warnSoft,
      color: meta.tone === "good" ? T.good : meta.tone === "bad" ? T.bad : T.warn,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
        <Icon size={15} />
      </div>
      <div style={{
      flex: 1,
      minWidth: 0
    }}>
        <div style={{
        ...FI,
        fontWeight: 600,
        fontSize: 13.5,
        color: T.ink
      }}>
          {meta.label} · {storeName(rec.store)}
        </div>
        <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        display: "flex",
        gap: 8,
        marginTop: 1
      }} className="ais-flex-layout">
          <span>
            <MapPin size={11} style={{
            verticalAlign: -1
          }} />{" "}
            {rec.location?.lat}, {rec.location?.lng}
            {rec.location?.simulated ? " (simulasi)" : ""}
            {rec.distance != null ? ` · ±${rec.distance}m dari lokasi` : ""}
          </span>
        </div>
      </div>
      {rec.selfie ? <img src={rec.selfie} alt="selfie" style={{
      width: 34,
      height: 34,
      borderRadius: 8,
      objectFit: "cover",
      border: `1px solid ${T.line}`
    }} /> : <div style={{
      width: 34,
      height: 34,
      borderRadius: 8,
      background: T.surfaceSunk,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }} className="ais-content-panel">
          <ImageOff size={14} color={T.inkMuted} />
        </div>}
      <div style={{
      ...FM,
      fontWeight: 600,
      fontSize: 13,
      color: T.ink,
      width: 64,
      textAlign: "right"
    }}>
        {pad(t.getHours())}:{pad(t.getMinutes())}
      </div>
    </div>;
}

/* ---------------------------------------------------------
   MANAJEMEN CARD (+ Modul 3: Laporan Kerja Harian)
--------------------------------------------------------- */
const CHECKLIST_MANAJEMEN = {
  "Admin Utama": [{
    label: "Rekap absensi & jadwal karyawan sudah dicek",
    mandatory: true
  }, {
    label: "Approval laporan toko hari ini sudah diproses",
    mandatory: true
  }, {
    label: "Koordinasi dengan SPV toko sudah dilakukan",
    mandatory: false
  }, {
    label: "Isu operasional (jika ada) sudah ditindaklanjuti",
    mandatory: false
  }],
  Finance: [{
    label: "Rekap omset harian semua toko sudah dicatat",
    mandatory: true
  }, {
    label: "Pengeluaran toko sudah diverifikasi",
    mandatory: true
  }, {
    label: "Kas/saldo harian sudah direkonsiliasi",
    mandatory: false
  }],
  "Admin Inventory": [{
    label: "Stok bahan baku semua toko sudah dicek",
    mandatory: true
  }, {
    label: "Kebutuhan pemesanan bahan sudah diproses",
    mandatory: false
  }, {
    label: "Data stok sudah sinkron dengan sistem",
    mandatory: false
  }],
  "Graphic Designer": [{
    label: "Brief/permintaan desain hari ini sudah diproses",
    mandatory: true
  }, {
    label: "Konten/asset hari ini sudah selesai atau di-review",
    mandatory: false
  }, {
    label: "File final sudah diupload ke folder terkait",
    mandatory: false
  }],
  "SPV Jr": [{
    label: "Monitoring toko dedicated hari ini sudah dilakukan",
    mandatory: true
  }, {
    label: "Laporan crew toko sudah dicek & sesuai",
    mandatory: false
  }, {
    label: "Isu operasional toko (jika ada) sudah ditindaklanjuti",
    mandatory: false
  }],
  default: [{
    label: "Tugas pokok hari ini sudah diselesaikan",
    mandatory: true
  }]
};
const STATUS_OPTIONS = [{
  value: "done",
  label: "Done",
  tone: "good"
}, {
  value: "pending",
  label: "Pending",
  tone: "warn"
}, {
  value: "notyet",
  label: "Not Yet",
  tone: "bad"
}];

/* ---- Master Task Karyawan (diatur Direksi di dashboard: Master Data → Master Task Karyawan) ----
   Sumber checklist Laporan Kerja Harian (syarat clock out) untuk Manajemen & SPV/TL.
   frekuensi "daily" = muncul setiap hari; "sesional" = hanya pada rentang tanggal mulai–selesai. */
const DEFAULT_MASTER_TASK = Object.entries(CHECKLIST_MANAJEMEN).filter(([jab]) => jab !== "default").flatMap(([jab, list]) => list.map((it, i) => ({
  id: `mt_${jab.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${i + 1}`,
  label: it.label,
  untukJabatan: [jab],
  untukKaryawan: [],
  frekuensi: "daily",
  mulai: null,
  selesai: null,
  mandatory: !!it.mandatory,
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

// Daftar task hari ini untuk seorang karyawan, diambil dari Master Task. Label kembar hanya muncul sekali.
function tugasHarianUntuk(emp, ds, masterTask) {
  const seen = new Set();
  return (masterTask || []).filter(t => taskBerlakuHari(t, emp, ds)).filter(t => {
    if (seen.has(t.label)) return false;
    seen.add(t.label);
    return true;
  }).map(t => ({
    label: t.label,
    mandatory: !!t.mandatory,
    taskId: t.id,
    frekuensi: t.frekuensi
  }));
}

// Salinan daftar task saat laporan disimpan, supaya rekap tetap akurat walau master diubah belakangan.
const snapshotItems = items => items.map(i => ({
  label: i.label,
  mandatory: !!i.mandatory,
  taskId: i.taskId || null,
  frekuensi: i.frekuensi || null,
  custom: !!i.custom
}));
function buildDisplayItems(jabatan, empId, checklist, customTasks, masterTask, savedItems) {
  const staticItems = CHECKLIST_MANAJEMEN[jabatan] || CHECKLIST_MANAJEMEN.default;
  const allCustomForEmp = (customTasks || []).filter(t => t.empId === empId);
  return Object.keys(checklist || {}).map(label => {
    const saved = (savedItems || []).find(i => i.label === label);
    if (saved) return saved;
    const masterMatch = (masterTask || []).find(t => t.label === label);
    if (masterMatch) return {
      label,
      mandatory: !!masterMatch.mandatory,
      taskId: masterMatch.id,
      frekuensi: masterMatch.frekuensi
    };
    const staticMatch = staticItems.find(i => i.label === label);
    if (staticMatch) return staticMatch;
    const customMatch = allCustomForEmp.find(t => t.label === label);
    return {
      label,
      mandatory: customMatch?.mandatory,
      custom: true
    };
  });
}
function StatusRow({
  item,
  value,
  onChange,
  disabled
}) {
  const status = value?.status || "";
  const keterangan = value?.keterangan || "";
  const needsNote = status && status !== "done";
  const meta = STATUS_OPTIONS.find(o => o.value === status);
  const toneBg = {
    good: T.goodSoft,
    warn: T.warnSoft,
    bad: T.badSoft
  };
  const toneFg = {
    good: T.good,
    warn: T.warn,
    bad: T.bad
  };
  return <div style={{
    padding: "10px 0",
    borderBottom: `1px solid ${T.line}`
  }}>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8
    }} className="ais-flex-layout">
        <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flex: 1
      }} className="ais-flex-layout">
          <span style={{
          ...FI,
          fontSize: 13,
          fontWeight: 500,
          color: T.ink
        }}>
            {item.label}
          </span>
          {item.mandatory && <Badge tone="bad">Wajib</Badge>}
          {item.custom && <Badge tone="manajemen">Dari Manajemen</Badge>}
        </div>
        <select disabled={disabled} value={status} onChange={e => onChange({
        status: e.target.value,
        keterangan
      })} style={{
        border: "none",
        borderRadius: 8,
        padding: "6px 9px",
        ...FI,
        fontWeight: 700,
        fontSize: 11.5,
        cursor: disabled ? "default" : "pointer",
        background: meta ? toneBg[meta.tone] : T.surfaceSunk,
        color: meta ? toneFg[meta.tone] : T.inkMuted
      }} className="ais-control">
          <option value="">Pilih status</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>
              {o.label}
            </option>)}
        </select>
      </div>
      {needsNote && <input value={keterangan} disabled={disabled} onChange={e => onChange({
      status,
      keterangan: e.target.value
    })} placeholder="Keterangan (wajib diisi)…" style={{
      width: "100%",
      marginTop: 7,
      border: `1px solid ${T.line}`,
      borderRadius: 8,
      padding: "7px 10px",
      ...FI,
      fontSize: 12.5,
      background: disabled ? T.surfaceSunk : T.surface
    }} className="ais-control" />}
    </div>;
}
function LaporanKerjaFields({
  items,
  checklist,
  setChecklist,
  disabled
}) {
  if (!items.length) {
    return <FormSurface title="Pekerjaan, langkah demi langkah." subtitle="Perbarui hasil tugas sesuai kondisi di lapangan." code="DAILY TASK"><div>
        <SectionLabel>Laporan Kerja Harian — Status Tugas</SectionLabel>
        <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          background: T.surfaceSunk,
          padding: "10px 12px",
          borderRadius: 10
        }} className="ais-content-panel">
          Tidak ada task dari Master Task untuk Anda hari ini. Anda bisa
          langsung clock out.
        </div>
      </div></FormSurface>;
  }
  return <FormSurface title="Pekerjaan, langkah demi langkah." subtitle="Perbarui hasil tugas sesuai kondisi di lapangan." code="DAILY TASK"><div>
      <SectionLabel>Laporan Kerja Harian — Status Tugas</SectionLabel>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 6
      }}>
        Tugas bertanda <Badge tone="bad">Wajib</Badge> harus berstatus Done
        sebelum bisa absen pulang. Tugas lain tidak memengaruhi absen pulang
        meski belum Done.
      </div>
      {items.map(item => <StatusRow key={item.label} item={item} value={checklist[item.label]} disabled={disabled} onChange={v => setChecklist({
        ...checklist,
        [item.label]: v
      })} />)}
    </div></FormSurface>;
}
function ManajemenCard({
  emp,
  log,
  addRecord,
  workHours,
  showIdentity = true,
  laporanManajemen,
  setLaporanManajemen,
  customTasks,
  masterTask,
  setCustomTasks
}) {
  const ds = dateStr(new Date());
  const todays = log.filter(r => r.empId === emp.id && r.date === ds).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const last = todays[todays.length - 1];
  const nextType = !last ? "clock_in" : last.type === "clock_in" ? "clock_out" : null;
  const activeCustomTasks = (customTasks || []).filter(t => t.empId === emp.id && !t.resolved);
  const items = [...tugasHarianUntuk(emp, ds, masterTask), ...activeCustomTasks.map(t => ({
    label: t.label,
    mandatory: t.mandatory,
    custom: true,
    taskId: t.id
  }))];
  const reportKey = `${emp.id}_${ds}`;
  const reportData = laporanManajemen[reportKey];
  const canEdit = emp.jabatan !== "Graphic Designer";
  const [checklist, setChecklist] = useState({});
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (editing && reportData) {
      setChecklist(reportData.checklist || {});
    }
  }, [editing]);
  const allFilled = items.every(i => checklist[i.label]?.status);
  const nonDoneHaveNote = items.every(i => {
    const v = checklist[i.label];
    return !v || v.status === "done" || (v.keterangan || "").trim().length > 0;
  });
  const mandatoryDone = items.every(i => !i.mandatory || checklist[i.label]?.status === "done");
  const checklistComplete = allFilled && nonDoneHaveNote && mandatoryDone;
  const [locationMode, setLocationMode] = useState("near");
  const [lateNotice, setLateNotice] = useState(null);

  // Mode Audit: khusus Eri & Elin yang berkeliling toko. Absen tidak terikat radius GPS
  // maupun jam kantor — selalu dianggap tepat waktu, karena jadwal kunjungan tidak tetap.
  const bolehAudit = emp.id === "eri" || emp.id === "elin";
  const [jenisAbsen, setJenisAbsen] = useState("kantor");
  const [tokoAudit, setTokoAudit] = useState(STORES_HOLDING[0]?.id || "");
  const [lokasiPulang, setLokasiPulang] = useState("KANTOR");
  const modeAudit = bolehAudit && jenisAbsen === "audit";
  // Nama saja yang beda: Eri = "Audit Toko", Elin = "Stok Opname". Aturannya sama persis.
  const namaAudit = emp.id === "elin" ? "Stok Opname" : "Audit Toko";

  // Absen masuk audit memakai toko tujuan; pulang bisa dari toko lain atau kantor.
  const auditInLabel = STORES.find(s => s.id === tokoAudit)?.name || "-";
  const auditOutLabel = lokasiPulang === "KANTOR" ? "Kantor DTOP" : STORES.find(s => s.id === lokasiPulang)?.name || "-";

  // Saat audit, lokasi tidak dibatasi radius.
  const targetLokasi = modeAudit ? null : KANTOR_LOCATION;
  const modeLokasi = modeAudit ? "free" : locationMode;
  const resolveDoneCustomTasks = async () => {
    if (!setCustomTasks) return;
    const doneIds = activeCustomTasks.filter(t => checklist[t.label]?.status === "done").map(t => t.id);
    if (doneIds.length) {
      await setCustomTasks((customTasks || []).map(t => doneIds.includes(t.id) ? {
        ...t,
        resolved: true,
        resolvedAt: new Date().toISOString()
      } : t));
    }
  };
  const handleCapture = async ({
    selfie,
    selfieSumber,
    location,
    distance,
    serverTime,
    driftSec
  }) => {
    if (nextType === "clock_out") {
      await setLaporanManajemen({
        ...laporanManajemen,
        [reportKey]: {
          checklist,
          items: snapshotItems(items),
          submittedAt: new Date().toISOString()
        }
      });
      await resolveDoneCustomTasks();
    }
    const rec = {
      id: `${emp.id}_${ds}_${nextType}_${Date.now()}`,
      empId: emp.id,
      empName: emp.name,
      group: emp.group,
      store: modeAudit ? nextType === "clock_in" ? tokoAudit : lokasiPulang === "KANTOR" ? null : lokasiPulang : null,
      shift: modeAudit ? "audit" : null,
      type: nextType,
      date: ds,
      timestamp: new Date(serverTime || Date.now()).toISOString(),
      location,
      selfie,
      selfieSumber,
      distance,
      driftSec,
      ...(modeAudit ? {
        audit: true,
        auditLokasi: nextType === "clock_in" ? auditInLabel : auditOutLabel
      } : {})
    };
    // Audit tidak dihitung terlambat — jadwal kunjungan memang tidak tetap.
    if (nextType === "clock_in" && !modeAudit) {
      setLateNotice(buildLateNotice(emp, new Date(rec.timestamp), null, log, {}, workHours));
    }
    await addRecord(rec);
  };
  const saveEdit = async () => {
    await setLaporanManajemen({
      ...laporanManajemen,
      [reportKey]: {
        ...reportData,
        checklist,
        items: snapshotItems(items),
        editedAt: new Date().toISOString()
      }
    });
    await resolveDoneCustomTasks();
    setEditing(false);
  };
  return <div>
      {showIdentity && <IdentityCard emp={emp} />}
      <LateNotice message={lateNotice} />

      {bolehAudit && nextType && <div style={{
      marginBottom: 14
    }}>
          <SectionLabel>Jenis Absen</SectionLabel>
          <div style={{
        display: "flex",
        gap: 8,
        marginBottom: modeAudit ? 10 : 0
      }} className="ais-flex-layout">
            {[{
          v: "kantor",
          l: "Kantor"
        }, {
          v: "audit",
          l: namaAudit
        }].map(o => <button key={o.v} onClick={() => setJenisAbsen(o.v)} style={{
          flex: 1,
          padding: "11px 10px",
          borderRadius: 12,
          cursor: "pointer",
          border: jenisAbsen === o.v ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
          background: jenisAbsen === o.v ? T.accentSoft : T.surface,
          color: jenisAbsen === o.v ? T.accentDeep : T.inkMuted,
          ...FI,
          fontWeight: 600,
          fontSize: 13
        }} className="ais-button ais-button--default" aria-pressed={jenisAbsen === o.v}>
                {o.l}
              </button>)}
          </div>
          {modeAudit && <div style={{
        background: T.accentSoft,
        borderRadius: 12,
        padding: "11px 13px"
      }}>
              <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.accentDeep,
          marginBottom: 8
        }}>
                Absen {namaAudit} bebas radius GPS dan jam kerja — selalu
                tercatat tepat waktu.
              </div>
              {nextType === "clock_in" ? <>
                  <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
                    Toko yang Dituju
                  </div>
                  <Select value={tokoAudit} onChange={setTokoAudit} options={STORES_HOLDING.map(s => ({
            value: s.id,
            label: s.name
          }))} />
                </> : <>
                  <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
                    Lokasi Saat Pulang
                  </div>
                  <Select value={lokasiPulang} onChange={setLokasiPulang} options={[{
            value: "KANTOR",
            label: "Kantor DTOP"
          }, ...STORES_HOLDING.map(s => ({
            value: s.id,
            label: s.name
          }))]} />
                </>}
            </div>}
        </div>}

      {nextType === "clock_in" && <div>
          {!modeAudit && <LocationModeToggle mode={locationMode} setMode={setLocationMode} />}
          <PunchButton label={modeAudit ? `Clock In ${namaAudit} — ${auditInLabel}` : "Clock In (On Work)"} sub="Ambil selfie untuk mencatat lokasi & waktu" icon={LogIn} tone="good" onCaptured={handleCapture} locationTarget={targetLokasi} locationMode={modeLokasi} />
        </div>}

      {nextType === "clock_out" && <div>
          <LaporanKerjaFields items={items} checklist={checklist} setChecklist={setChecklist} />
          <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 8
      }}>
            Laporan kerja ini disubmit satu halaman bersama absen pulang.
          </div>
          {!modeAudit && <LocationModeToggle mode={locationMode} setMode={setLocationMode} />}
          <PunchButton label={modeAudit ? `Submit Laporan & Clock Out — ${auditOutLabel}` : "Submit Laporan & Clock Out"} sub={checklistComplete ? "Ambil selfie untuk mencatat lokasi & waktu" : null} icon={LogOut} tone="accent" disabled={!checklistComplete} disabledReason={!checklistComplete ? "Lengkapi status semua tugas (isi keterangan bila belum Done) dan pastikan tugas Wajib berstatus Done." : null} onCaptured={handleCapture} locationTarget={targetLokasi} locationMode={modeLokasi} />
        </div>}

      {!nextType && <div>
          <div style={{
        background: T.goodSoft,
        color: T.good,
        padding: "14px 16px",
        borderRadius: 14,
        ...FI,
        fontWeight: 600,
        fontSize: 14,
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 16
      }} className="ais-flex-layout">
            <CheckCircle2 size={18} /> Absensi hari ini selesai.
          </div>

          {reportData && <div>
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4
        }}>
                <SectionLabel>Laporan Kerja Harian</SectionLabel>
                {canEdit && !editing && <button onClick={() => setEditing(true)} style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            border: "none",
            background: "transparent",
            color: T.accentDeep,
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--default ais-flex-layout">
                    <PenLine size={13} /> Edit
                  </button>}
              </div>

              {editing ? <div>
                  <LaporanKerjaFields items={items} checklist={checklist} setChecklist={setChecklist} />
                  <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                    <button onClick={saveEdit} disabled={!mandatoryDone || !nonDoneHaveNote} style={{
              flex: 1,
              border: "none",
              borderRadius: 10,
              padding: "9px 12px",
              background: mandatoryDone && nonDoneHaveNote ? T.manajemen : T.line,
              color: "#fff",
              ...FI,
              fontWeight: 600,
              fontSize: 13,
              cursor: mandatoryDone && nonDoneHaveNote ? "pointer" : "not-allowed"
            }} className="ais-button ais-button--primary">
                      Simpan Perubahan
                    </button>
                    <button onClick={() => setEditing(false)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 10,
              padding: "9px 14px",
              background: "transparent",
              color: T.inkMuted,
              ...FI,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer"
            }} className="ais-button ais-button--default">
                      Batal
                    </button>
                  </div>
                </div> : <div>
                  {(() => {
            const displayItems = buildDisplayItems(emp.jabatan, emp.id, reportData.checklist, customTasks, masterTask, reportData.items);
            return displayItems.map(item => {
              const v = reportData.checklist?.[item.label];
              const meta = STATUS_OPTIONS.find(o => o.value === v?.status);
              return <div key={item.label} style={{
                padding: "8px 0",
                borderBottom: `1px solid ${T.line}`
              }}>
                          <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8
                }} className="ais-flex-layout">
                            <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }} className="ais-flex-layout">
                              <span style={{
                      ...FI,
                      fontSize: 13,
                      color: T.ink
                    }}>
                                {item.label}
                              </span>
                              {item.mandatory && <Badge tone="bad">Wajib</Badge>}
                              {item.custom && <Badge tone="manajemen">Dari Manajemen</Badge>}
                            </div>
                            <Badge tone={meta?.tone || "manajemen"}>
                              {meta?.label || "-"}
                            </Badge>
                          </div>
                          {v?.keterangan && <div style={{
                  ...FI,
                  fontSize: 12,
                  color: T.inkMuted,
                  marginTop: 3,
                  fontStyle: "italic"
                }}>
                              "{v.keterangan}"
                            </div>}
                        </div>;
            });
          })()}
                  {!canEdit && <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 8,
            display: "flex",
            gap: 5,
            alignItems: "center"
          }} className="ais-flex-layout">
                      <Lock size={12} /> Sudah terkunci — role Graphic Designer
                      tidak memiliki akses edit.
                    </div>}
                  {reportData.editedAt && <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            marginTop: 4
          }}>
                      Terakhir diedit{" "}
                      {new Date(reportData.editedAt).toLocaleTimeString("id-ID").slice(0, 5)}
                    </div>}
                </div>}
            </div>}
        </div>}

      {todays.length > 0 && <div style={{
      marginTop: 20
    }}>
          <SectionLabel>Riwayat Hari Ini</SectionLabel>
          {todays.map(r => <HistoryRow key={r.id} rec={r} />)}
        </div>}
    </div>;
}

/* ---------------------------------------------------------
   CREW CARD
--------------------------------------------------------- */
function CrewCard({
  emp,
  log,
  reportLog,
  addRecord,
  schedule,
  workHours
}) {
  const ds = dateStr(new Date());
  const isParttime = emp.group === "parttime";
  const [selectedStore, setSelectedStore] = useState(emp.store);
  const store = isParttime ? selectedStore : emp.store; // crew dedicated ke 1 toko, part time bebas pilih toko absen
  const [shift, setShift] = useState("1");
  const [locationMode, setLocationMode] = useState("near");
  const [lateNotice, setLateNotice] = useState(null);
  const todays = log.filter(r => r.empId === emp.id && r.date === ds).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const last = todays[todays.length - 1];
  const nextType = !last ? "clock_in" : last.type === "clock_in" ? "clock_out" : null;
  const reportData = reportLog[`${store}_${ds}`] || {};
  const requiredKeys = requiredStagesForShift(shift);
  const missingStages = STAGES.filter(s => requiredKeys.includes(s.key) && !reportData[s.key] && !isEtalaseExpired(s, new Date()));

  // Toko mitra tidak punya fitur laporan, jadi absen pulang tidak bisa dikaitkan ke laporan.
  // Penggantinya: terikat jam selesai shift (Shift 1 -> 14:00, Shift 2 -> 22:00).
  const tokoMitra = isMitraStore(store);
  const jamSelesai = (SHIFT_TIME[shift] || SHIFT_TIME["1"])?.end || "14:00";
  const belumWaktunya = tokoMitra && nextType === "clock_out" && minutesOfDate(new Date()) < minutesOf(jamSelesai);
  const clockOutBlocked = nextType === "clock_out" && (tokoMitra ? belumWaktunya : missingStages.length > 0);
  const alasanTerkunci = !clockOutBlocked ? null : tokoMitra ? `Absen pulang terkunci — shift ini baru selesai pukul ${jamSelesai}.` : "Absen pulang terkunci — laporan toko untuk shift ini belum lengkap.";
  const storeTarget = STORES.find(s => s.id === store);
  const handleCapture = async ({
    selfie,
    selfieSumber,
    location,
    distance,
    serverTime,
    driftSec
  }) => {
    const rec = {
      id: `${emp.id}_${ds}_${nextType}_${Date.now()}`,
      empId: emp.id,
      empName: emp.name,
      group: emp.group,
      store,
      shift,
      type: nextType,
      date: ds,
      timestamp: new Date(serverTime || Date.now()).toISOString(),
      location,
      selfie,
      selfieSumber,
      distance,
      driftSec
    };
    if (nextType === "clock_in") {
      setLateNotice(buildLateNotice(emp, new Date(rec.timestamp), shift, log, schedule || {}, workHours));
    }
    await addRecord(rec);
  };
  return <div>
      <LateNotice message={lateNotice} />
      {isParttime && <div style={{
      marginBottom: 16
    }}>
          <SectionLabel>Toko Absen</SectionLabel>
          <Select value={selectedStore} onChange={setSelectedStore} disabled={!!last} options={STORES.map(s => ({
        value: s.id,
        label: s.name
      }))} />
        </div>}
      <div style={{
      marginBottom: 16
    }}>
        <SectionLabel>Shift</SectionLabel>
        <Select value={shift} onChange={setShift} options={["1", "2", "longshift", "backup"].map(s => ({
        value: s,
        label: SHIFT_LABELS[s]
      }))} />
      </div>

      {last && !tokoMitra && missingStages.length > 0 && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      marginBottom: 14,
      background: T.warnSoft,
      color: T.warn,
      padding: "10px 12px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5
    }} className="ais-flex-layout">
          <AlertTriangle size={15} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          <div>
            <b>Notifikasi:</b> laporan berikut belum diisi Akun Toko untuk shift
            ini — {missingStages.map(s => s.label).join(", ")}.
          </div>
        </div>}

      {nextType && <LocationModeToggle mode={locationMode} setMode={setLocationMode} />}

      {nextType ? <PunchButton label={nextType === "clock_in" ? "Clock In (On Work)" : "Clock Out (Off Work)"} sub={!clockOutBlocked ? "Ambil selfie untuk mencatat lokasi & waktu" : null} icon={nextType === "clock_in" ? LogIn : LogOut} tone={nextType === "clock_in" ? "good" : "accent"} disabled={clockOutBlocked} disabledReason={alasanTerkunci} onCaptured={handleCapture} locationTarget={storeTarget} locationMode={locationMode} /> : <div style={{
      background: T.goodSoft,
      color: T.good,
      padding: "14px 16px",
      borderRadius: 14,
      ...FI,
      fontWeight: 600,
      fontSize: 14,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }} className="ais-flex-layout">
          <CheckCircle2 size={18} /> Absensi hari ini selesai.
        </div>}

      {last && <div style={{
      marginTop: 14,
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      display: "flex",
      gap: 6,
      alignItems: "center"
    }} className="ais-flex-layout">
          <ClipboardList size={13} /> Laporan toko hanya dapat diinput lewat
          Akun Toko (device toko) — crew hanya melakukan absen.
        </div>}

      {todays.length > 0 && <div style={{
      marginTop: 20
    }}>
          <SectionLabel>Riwayat Hari Ini</SectionLabel>
          {todays.map(r => <HistoryRow key={r.id} rec={r} />)}
        </div>}
    </div>;
}

/* ---------------------------------------------------------
   SPV CARD (handles mobile shift 4-step flow)
--------------------------------------------------------- */
function SpvCard({
  emp,
  log,
  reportLog,
  addRecord,
  schedule,
  now,
  stokEditRequests,
  stokEditLock,
  laporanManajemen,
  setLaporanManajemen,
  customTasks,
  masterTask,
  setCustomTasks,
  workHours
}) {
  const ds = dateStr(now);
  const [shift, setShift] = useState("satu_toko");
  const dedicatedStores = emp.stores || [emp.store];
  // Absen Mobile hanya untuk SPV yang menaungi lebih dari satu toko.
  // TL memegang satu toko saja, jadi tidak ada perpindahan antar toko.
  const isTL = emp.group === "tl";
  const shiftOptions = isTL ? ["satu_toko", "longshift", "backup"] : ["satu_toko", "mobile", "longshift", "backup"];
  const [nonMobileStore, setNonMobileStore] = useState(dedicatedStores[0]);
  const [mobileStoreA, setMobileStoreA] = useState(dedicatedStores[0]);
  const [mobileStoreB, setMobileStoreB] = useState(dedicatedStores[1] || dedicatedStores[0]);
  const [locationMode, setLocationMode] = useState("near");
  const [lateNotice, setLateNotice] = useState(null);
  const activeCustomTasks = (customTasks || []).filter(t => t.empId === emp.id && !t.resolved);
  const kerjaItems = [...tugasHarianUntuk(emp, ds, masterTask), ...activeCustomTasks.map(t => ({
    label: t.label,
    mandatory: t.mandatory,
    custom: true,
    taskId: t.id
  }))];
  const kerjaReportKey = `${emp.id}_${ds}`;
  const kerjaReportData = laporanManajemen[kerjaReportKey];
  const [kerjaChecklist, setKerjaChecklist] = useState(kerjaReportData?.checklist || {});
  const [kerjaEditing, setKerjaEditing] = useState(false);
  useEffect(() => {
    if (kerjaEditing && kerjaReportData) setKerjaChecklist(kerjaReportData.checklist || {});
  }, [kerjaEditing]);

  // Autosave draft checklist selama shift berjalan, supaya progress tidak hilang kalau pindah tab lalu balik lagi.
  // Tidak menimpa laporan yang sudah final disubmit (submittedAt sudah ada) — itu hanya diubah lewat alur Edit.
  useEffect(() => {
    if (!last || !nextType) return;
    if (kerjaReportData?.submittedAt) return;
    if (Object.keys(kerjaChecklist).length === 0) return;
    setLaporanManajemen({
      ...laporanManajemen,
      [kerjaReportKey]: {
        ...kerjaReportData,
        checklist: kerjaChecklist,
        items: snapshotItems(kerjaItems),
        draftAt: now.toISOString()
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kerjaChecklist]);
  const kerjaAllFilled = kerjaItems.every(i => kerjaChecklist[i.label]?.status);
  const kerjaNonDoneHaveNote = kerjaItems.every(i => {
    const v = kerjaChecklist[i.label];
    return !v || v.status === "done" || (v.keterangan || "").trim().length > 0;
  });
  const kerjaMandatoryDone = kerjaItems.every(i => !i.mandatory || kerjaChecklist[i.label]?.status === "done");
  const kerjaComplete = kerjaAllFilled && kerjaNonDoneHaveNote && kerjaMandatoryDone;
  const resolveDoneCustomTasks = async () => {
    if (!setCustomTasks) return;
    const doneIds = activeCustomTasks.filter(t => kerjaChecklist[t.label]?.status === "done").map(t => t.id);
    if (doneIds.length) {
      await setCustomTasks((customTasks || []).map(t => doneIds.includes(t.id) ? {
        ...t,
        resolved: true,
        resolvedAt: new Date().toISOString()
      } : t));
    }
  };
  const saveKerjaEdit = async () => {
    await setLaporanManajemen({
      ...laporanManajemen,
      [kerjaReportKey]: {
        ...kerjaReportData,
        checklist: kerjaChecklist,
        items: snapshotItems(kerjaItems),
        editedAt: now.toISOString()
      }
    });
    await resolveDoneCustomTasks();
    setKerjaEditing(false);
  };
  const reportData = reportLog[`${emp.store}_${ds}`] || {};
  const missingStages = STAGES.filter(s => !reportData[s.key] && !isEtalaseExpired(s, now));
  const todays = log.filter(r => r.empId === emp.id && r.date === ds).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const last = todays[todays.length - 1];
  const clockInRec = todays.find(r => r.type === "clock_in");
  const mobileOutRec = todays.find(r => r.type === "mobile_out");
  const mobileInRec = todays.find(r => r.type === "mobile_in");
  const changeMobileStoreA = v => {
    setMobileStoreA(v);
    if (v === mobileStoreB) setMobileStoreB(mobileStoreA);
  };
  const changeMobileStoreB = v => {
    setMobileStoreB(v);
    if (v === mobileStoreA) setMobileStoreA(mobileStoreB);
  };

  // toko mobile dipilih dari 2 toko dedicated saja; terkunci begitu clock_in hari ini sudah tercatat
  const storeA = clockInRec ? clockInRec.store : mobileStoreA;
  const storeB = clockInRec ? dedicatedStores.find(id => id !== storeA) || mobileStoreB : mobileStoreB;
  // toko non-mobile: dipilih dari 2 toko dedicated, terkunci begitu clock_in sudah tercatat hari ini
  const lockedNonMobileStore = clockInRec ? clockInRec.store : nonMobileStore;
  const MIN_HOURS_PER_STORE = 4;
  const hoursSince = iso => (now.getTime() - new Date(iso).getTime()) / 3600000;
  let nextType,
    nextStore,
    nextLabel,
    nextIcon,
    gateBlocked = false,
    gateReason = null,
    transitWarning = null;
  if (shift === "mobile") {
    if (!last) {
      nextType = "clock_in";
      nextStore = storeA;
      nextLabel = `Clock In — ${storeName(storeA)}`;
      nextIcon = LogIn;
    } else if (last.type === "clock_in") {
      nextType = "mobile_out";
      nextStore = storeA;
      nextLabel = `Toko Out — ${storeName(storeA)}`;
      nextIcon = ArrowRightLeft;
      const worked = hoursSince(clockInRec.timestamp);
      if (worked < MIN_HOURS_PER_STORE) {
        gateBlocked = true;
        const remain = MIN_HOURS_PER_STORE - worked;
        gateReason = `Belum genap ${MIN_HOURS_PER_STORE} jam di ${storeName(storeA)} — sisa ±${Math.ceil(remain * 60)} menit.`;
      }
    } else if (last.type === "mobile_out") {
      nextType = "mobile_in";
      nextStore = storeB;
      nextLabel = `Toko In — ${storeName(storeB)}`;
      nextIcon = ArrowRightLeft;
      const storeAMaster = STORES.find(s => s.id === storeA);
      const transitMin = hoursSince(mobileOutRec.timestamp) * 60;
      if (transitMin > (storeAMaster?.transitLimitMinutes || 30)) {
        transitWarning = "Terlambat, mampir kemana dulu?";
      }
    } else if (last.type === "mobile_in") {
      nextType = "clock_out";
      nextStore = storeB;
      nextLabel = `Clock Out — ${storeName(storeB)}`;
      nextIcon = LogOut;
      const worked = hoursSince(mobileInRec.timestamp);
      if (worked < MIN_HOURS_PER_STORE) {
        gateBlocked = true;
        const remain = MIN_HOURS_PER_STORE - worked;
        gateReason = `Belum genap ${MIN_HOURS_PER_STORE} jam di ${storeName(storeB)} — sisa ±${Math.ceil(remain * 60)} menit.`;
      }
    } else nextType = null;
  } else {
    if (!last) {
      nextType = "clock_in";
      nextStore = nonMobileStore;
      nextLabel = "Clock In (On Work)";
      nextIcon = LogIn;
    } else if (last.type === "clock_in") {
      nextType = "clock_out";
      nextStore = lockedNonMobileStore;
      nextLabel = "Clock Out (Off Work)";
      nextIcon = LogOut;
      // Shift berbasis durasi ("1 Toko"): clock out baru boleh setelah durasi kerja terpenuhi,
      // tidak terikat jam mulai/selesai tertentu.
      const durasiWajib = durasiShiftJam(shift, workHours);
      if (durasiWajib) {
        const worked = hoursSince(clockInRec.timestamp);
        if (worked < durasiWajib) {
          gateBlocked = true;
          const remain = durasiWajib - worked;
          const jam = Math.floor(remain),
            menit = Math.ceil((remain - jam) * 60);
          gateReason = `Belum genap ${durasiWajib} jam kerja — sisa ±${jam > 0 ? `${jam} jam ` : ""}${menit} menit.`;
        }
      }
    } else nextType = null;
  }
  const nextStoreTarget = STORES.find(s => s.id === nextStore);
  const handleCapture = async ({
    selfie,
    selfieSumber,
    location,
    distance,
    serverTime,
    driftSec
  }) => {
    if (nextType === "clock_out") {
      await setLaporanManajemen({
        ...laporanManajemen,
        [kerjaReportKey]: {
          checklist: kerjaChecklist,
          items: snapshotItems(kerjaItems),
          submittedAt: now.toISOString()
        }
      });
      await resolveDoneCustomTasks();
    }
    const rec = {
      id: `${emp.id}_${ds}_${nextType}_${Date.now()}`,
      empId: emp.id,
      empName: emp.name,
      group: emp.group,
      store: nextStore,
      shift,
      type: nextType,
      date: ds,
      timestamp: new Date(serverTime || Date.now()).toISOString(),
      location,
      selfie,
      selfieSumber,
      distance,
      driftSec,
      transitLate: nextType === "mobile_in" ? !!transitWarning : undefined
    };
    if (nextType === "clock_in") {
      setLateNotice(buildLateNotice(emp, new Date(rec.timestamp), shift, log, schedule || {}, workHours));
    }
    await addRecord(rec);
  };
  const steps = shift === "mobile" ? [{
    key: "clock_in",
    label: `Clock In\n${storeName(storeA)}`
  }, {
    key: "mobile_out",
    label: `Toko Out\n${storeName(storeA)}`
  }, {
    key: "mobile_in",
    label: `Toko In\n${storeName(storeB)}`
  }, {
    key: "clock_out",
    label: `Clock Out\n${storeName(storeB)}`
  }] : [{
    key: "clock_in",
    label: "Clock In"
  }, {
    key: "clock_out",
    label: "Clock Out"
  }];
  const doneKeys = todays.map(t => t.type);
  return <div>
      <StokEditNotifBanner stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} reportLog={reportLog} />
      <LateNotice message={lateNotice} />
      {last && missingStages.length > 0 && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      marginBottom: 14,
      background: T.warnSoft,
      color: T.warn,
      padding: "10px 12px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5
    }} className="ais-flex-layout">
          <AlertTriangle size={15} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          <div>
            <b>Notifikasi:</b> {missingStages.length} laporan toko{" "}
            {storeName(emp.store)} hari ini belum diisi Akun Toko (
            {missingStages.map(s => s.label).join(", ")}). Cek di tab Laporan
            Toko.
          </div>
        </div>}
      <div style={{
      display: "grid",
      gridTemplateColumns: shift === "mobile" ? "1fr 1fr 1fr" : "1fr 1fr",
      gap: 10,
      marginBottom: 16
    }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Shift</SectionLabel>
          <Select value={shift} onChange={setShift} options={shiftOptions.map(s => ({
          value: s,
          label: SHIFT_LABELS[s]
        }))} />
        </div>
        {shift === "mobile" ? <>
            <div>
              <SectionLabel>Toko 1</SectionLabel>
              <Select value={storeA} onChange={changeMobileStoreA} disabled={!!clockInRec} options={dedicatedStores.map(id => ({
            value: id,
            label: storeName(id)
          }))} />
            </div>
            <div>
              <SectionLabel>Toko 2</SectionLabel>
              <Select value={storeB} onChange={changeMobileStoreB} disabled={!!clockInRec} options={dedicatedStores.map(id => ({
            value: id,
            label: storeName(id)
          }))} />
            </div>
          </> : <div>
            <SectionLabel>
              Toko (In & Out sama, terkunci setelah Clock In)
            </SectionLabel>
            <Select value={lockedNonMobileStore} onChange={setNonMobileStore} disabled={!!clockInRec} options={dedicatedStores.map(id => ({
          value: id,
          label: storeName(id)
        }))} />
          </div>}
      </div>

      {shift === "mobile" && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "9px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
          Pilihan toko hanya dari 2 toko dedicated sesuai master karyawan.{" "}
          {clockInRec ? "Rute hari ini sudah terkunci: " : "Rute: "}
          <b>{storeName(storeA)}</b> → <b>{storeName(storeB)}</b>.
        </div>}

      {/* stepper */}
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 16
    }} className="ais-flex-layout">
        {steps.map(s => {
        const done = doneKeys.includes(s.key);
        const current = nextType === s.key;
        return <div key={s.key} style={{
          flex: 1
        }}>
              <div style={{
            height: 5,
            borderRadius: 4,
            marginBottom: 6,
            background: done ? T.good : current ? T.accent : T.line
          }} />
              <div style={{
            fontFamily: "DM Sans",
            fontSize: 10.5,
            fontWeight: 600,
            whiteSpace: "pre-line",
            lineHeight: 1.25,
            color: done ? T.good : current ? T.accentDeep : T.inkMuted
          }}>
                {s.label}
              </div>
            </div>;
      })}
      </div>

      {transitWarning && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      marginBottom: 14,
      background: T.badSoft,
      color: T.bad,
      padding: "10px 12px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600
    }} className="ais-flex-layout">
          <AlertTriangle size={15} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          {transitWarning}
        </div>}

      {last && nextType && <div>
          <LaporanKerjaFields items={kerjaItems} checklist={kerjaChecklist} setChecklist={setKerjaChecklist} />
          <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 8
      }}>
            Bisa diisi bertahap sepanjang shift. Tugas{" "}
            <Badge tone="bad">Wajib</Badge> harus Done sebelum bisa Clock Out /
            absen pulang.
          </div>
        </div>}

      {nextType && <LocationModeToggle mode={locationMode} setMode={setLocationMode} />}

      {nextType ? <PunchButton label={nextLabel} sub={!gateBlocked && (nextType !== "clock_out" || kerjaComplete) ? "Ambil selfie untuk mencatat lokasi & waktu" : null} icon={nextIcon} tone={nextType === "clock_out" ? "accent" : "good"} onCaptured={handleCapture} disabled={gateBlocked || nextType === "clock_out" && !kerjaComplete} disabledReason={gateBlocked ? gateReason : nextType === "clock_out" && !kerjaComplete ? "Lengkapi status semua tugas (isi keterangan bila belum Done) dan pastikan tugas Wajib berstatus Done." : null} locationTarget={nextStoreTarget} locationMode={locationMode} /> : <div style={{
      background: T.goodSoft,
      color: T.good,
      padding: "14px 16px",
      borderRadius: 14,
      ...FI,
      fontWeight: 600,
      fontSize: 14,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }} className="ais-flex-layout">
          <CheckCircle2 size={18} /> Absensi hari ini selesai.
        </div>}

      {!nextType && kerjaReportData && <div style={{
      marginTop: 20
    }}>
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
      }}>
            <SectionLabel>Laporan Kerja Harian</SectionLabel>
            {!kerjaEditing && <button onClick={() => setKerjaEditing(true)} style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: "none",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--default ais-flex-layout">
                <PenLine size={13} /> Edit
              </button>}
          </div>
          {kerjaEditing ? <div>
              <LaporanKerjaFields items={kerjaItems} checklist={kerjaChecklist} setChecklist={setKerjaChecklist} />
              <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
                <button onClick={saveKerjaEdit} disabled={!kerjaMandatoryDone || !kerjaNonDoneHaveNote} style={{
            flex: 1,
            border: "none",
            borderRadius: 10,
            padding: "9px 12px",
            background: kerjaMandatoryDone && kerjaNonDoneHaveNote ? T.manajemen : T.line,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: kerjaMandatoryDone && kerjaNonDoneHaveNote ? "pointer" : "not-allowed"
          }} className="ais-button ais-button--primary">
                  Simpan Perubahan
                </button>
                <button onClick={() => setKerjaEditing(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 14px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                  Batal
                </button>
              </div>
            </div> : <div>
              {(() => {
          const displayItems = buildDisplayItems(emp.jabatan, emp.id, kerjaReportData.checklist, customTasks, masterTask, kerjaReportData.items);
          return displayItems.map(item => {
            const v = kerjaReportData.checklist?.[item.label];
            const meta = STATUS_OPTIONS.find(o => o.value === v?.status);
            return <div key={item.label} style={{
              padding: "8px 0",
              borderBottom: `1px solid ${T.line}`
            }}>
                      <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8
              }} className="ais-flex-layout">
                        <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }} className="ais-flex-layout">
                          <span style={{
                    ...FI,
                    fontSize: 13,
                    color: T.ink
                  }}>
                            {item.label}
                          </span>
                          {item.mandatory && <Badge tone="bad">Wajib</Badge>}
                          {item.custom && <Badge tone="manajemen">Dari Manajemen</Badge>}
                        </div>
                        <Badge tone={meta?.tone || "manajemen"}>
                          {meta?.label || "-"}
                        </Badge>
                      </div>
                      {v?.keterangan && <div style={{
                ...FI,
                fontSize: 12,
                color: T.inkMuted,
                marginTop: 3,
                fontStyle: "italic"
              }}>
                          "{v.keterangan}"
                        </div>}
                    </div>;
          });
        })()}
            </div>}
        </div>}

      {todays.length > 0 && <div style={{
      marginTop: 20
    }}>
          <SectionLabel>Riwayat Hari Ini</SectionLabel>
          {todays.map(r => <HistoryRow key={r.id} rec={r} />)}
        </div>}
    </div>;
}

/* ---------------------------------------------------------
   ADMIN KEPEGAWAIAN — Master Jadwal + Rekap Bulanan
--------------------------------------------------------- */
function DireksiManajemenReview({
  emp,
  laporanManajemen,
  customTasks,
  masterTask,
  setCustomTasks
}) {
  const targetList = EMPLOYEES.filter(e => e.group === "manajemen" || e.group === "spv" || e.group === "tl");
  const [reqEmp, setReqEmp] = useState(targetList[0]?.id);
  const [reqLabel, setReqLabel] = useState("");
  const [reqMandatory, setReqMandatory] = useState("tidak");
  const [viewEmp, setViewEmp] = useState(targetList[0]?.id);
  const [viewDate, setViewDate] = useState(dateStr(new Date()));
  const activeTasks = (customTasks || []).filter(t => !t.resolved);
  const submitRequest = () => {
    if (!reqLabel.trim()) return;
    const task = {
      id: `task_${Date.now()}`,
      empId: reqEmp,
      label: reqLabel.trim(),
      mandatory: reqMandatory === "ya",
      createdBy: emp.name,
      createdAt: new Date().toISOString(),
      resolved: false
    };
    setCustomTasks([...(customTasks || []), task]);
    setReqLabel("");
  };
  const viewKey = `${viewEmp}_${viewDate}`;
  const viewData = laporanManajemen[viewKey];
  const viewEmpObj = targetList.find(e => e.id === viewEmp);
  const displayItems = viewData ? buildDisplayItems(viewEmpObj?.jabatan, viewEmp, viewData.checklist, customTasks, masterTask, viewData.items) : [];
  return <div>
      <SectionLabel>Request Task ke Manajemen & SPV</SectionLabel>
      <div style={{
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr",
      gap: 10,
      marginBottom: 10
    }} className="ais-responsive-grid">
        <Select value={reqEmp} onChange={setReqEmp} options={targetList.map(e => ({
        value: e.id,
        label: `${e.name} (${e.jabatan})`
      }))} />
        <Select value={reqMandatory} onChange={setReqMandatory} options={[{
        value: "tidak",
        label: "Non-Mandatori"
      }, {
        value: "ya",
        label: "Mandatori"
      }]} />
      </div>
      <input value={reqLabel} onChange={e => setReqLabel(e.target.value)} placeholder="Deskripsi task…" style={{
      width: "100%",
      border: `1px solid ${T.line}`,
      borderRadius: 10,
      padding: "9px 12px",
      ...FI,
      fontSize: 13,
      marginBottom: 10
    }} className="ais-control" />
      <button onClick={submitRequest} disabled={!reqLabel.trim()} style={{
      border: "none",
      borderRadius: 10,
      padding: "9px 16px",
      background: reqLabel.trim() ? T.manajemen : T.line,
      color: "#fff",
      fontFamily: "DM Sans",
      fontWeight: 600,
      fontSize: 13,
      cursor: reqLabel.trim() ? "pointer" : "not-allowed",
      marginBottom: 8
    }} className="ais-button ais-button--primary">
        Kirim Request
      </button>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 20
    }}>
        Task <b>Non-Mandatori</b> akan tetap muncul di checklist harian karyawan
        setiap hari sampai ditandai Done. Task <b>Mandatori</b> wajib Done
        sebelum karyawan (manajemen maupun SPV) bisa absen pulang hari itu.
      </div>

      <SectionLabel>Task Aktif ({activeTasks.length})</SectionLabel>
      {activeTasks.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted,
      marginBottom: 20
    }}>
          Tidak ada task yang menunggu diselesaikan.
        </div>}
      {activeTasks.map(t => {
      const e = EMPLOYEES.find(e => e.id === t.empId);
      return <div key={t.id} style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: `1px solid ${T.line}`
      }}>
            <div>
              <div style={{
            ...FI,
            fontWeight: 600,
            fontSize: 13
          }}>
                {t.label}
              </div>
              <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted
          }}>
                Untuk {e?.name} (
                {e?.group === "spv" || e?.group === "tl" ? "SPV / TL" : "Manajemen"}
                ) · diminta {new Date(t.createdAt).toLocaleDateString("id-ID")}
              </div>
            </div>
            <Badge tone={t.mandatory ? "bad" : "warn"}>
              {t.mandatory ? "Mandatori" : "Berulang"}
            </Badge>
          </div>;
    })}

      <div style={{
      marginTop: 26
    }}>
        <SectionLabel>Riwayat Laporan Kerja</SectionLabel>
        <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 10,
        marginBottom: 14
      }} className="ais-responsive-grid">
          <Select value={viewEmp} onChange={setViewEmp} options={targetList.map(e => ({
          value: e.id,
          label: `${e.name} (${e.jabatan})`
        }))} />
          <input type="date" max={dateStr(new Date())} value={viewDate} onChange={e => setViewDate(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "9px 10px",
          ...FI,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
        </div>
        {!viewData && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>
            Tidak ada laporan kerja untuk tanggal ini.
          </div>}
        {viewData && displayItems.map(item => {
        const v = viewData.checklist?.[item.label];
        const meta = STATUS_OPTIONS.find(o => o.value === v?.status);
        return <div key={item.label} style={{
          padding: "8px 0",
          borderBottom: `1px solid ${T.line}`
        }}>
                <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8
          }} className="ais-flex-layout">
                  <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6
            }} className="ais-flex-layout">
                    <span style={{
                ...FI,
                fontSize: 13,
                color: T.ink
              }}>
                      {item.label}
                    </span>
                    {item.mandatory && <Badge tone="bad">Wajib</Badge>}
                    {item.custom && <Badge tone="manajemen">Dari Manajemen</Badge>}
                  </div>
                  <Badge tone={meta?.tone || "manajemen"}>
                    {meta?.label || "-"}
                  </Badge>
                </div>
                {v?.keterangan && <div style={{
            ...FI,
            fontSize: 12,
            color: T.inkMuted,
            marginTop: 3,
            fontStyle: "italic"
          }}>
                    "{v.keterangan}"
                  </div>}
              </div>;
      })}
      </div>
    </div>;
}

/* ---- Pembelian Bahan Baku (Eri & Nana) ---- */
function LaporanPembelianPage({
  emp,
  purchaseReports,
  setPurchaseReports,
  purchaseStatus,
  setPurchaseStatus,
  now
}) {
  const [store, setStore] = useState(STORES[0].id);
  const [tanggal, setTanggal] = useState(dateStr(now));
  const key = `${store}_${tanggal}`;
  const statusData = purchaseStatus[key] || {
    status: "empty",
    approvals: {}
  };
  const setStatus = next => setPurchaseStatus({
    ...purchaseStatus,
    [key]: {
      ...statusData,
      ...next
    }
  });
  const existingRecord = purchaseReports.find(p => p.storeId === store && p.tanggal === tanggal);
  const isSubmitterRole = emp.id === "eri" || emp.id === "nana";
  const approverId = statusData.editRequestedById === "eri" ? "nana" : "eri";
  const approverName = approverId === "eri" ? "Eri" : "Nana";
  const canInput = isSubmitterRole && (statusData.status === "empty" || statusData.status === "unlocked");
  const isApproverNow = statusData.status === "edit_requested" && emp.id === approverId;
  const [items, setItems] = useState([{
    bahanId: BAHAN_BAKU[0].id,
    qty: "",
    harga: ""
  }]);
  useEffect(() => {
    setItems([{
      bahanId: BAHAN_BAKU[0].id,
      qty: "",
      harga: ""
    }]);
  }, [store, tanggal]);
  const addItem = () => setItems([...items, {
    bahanId: BAHAN_BAKU[0].id,
    qty: "",
    harga: ""
  }]);
  const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => setItems(items.map((it, i) => i === idx ? {
    ...it,
    [field]: val
  } : it));
  const totalPembelian = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.harga) || 0), 0);
  const complete = items.length > 0 && items.every(it => it.bahanId && Number(it.qty) > 0 && Number(it.harga) > 0);
  const submit = async () => {
    const wasEdit = statusData.status === "unlocked";
    const record = {
      id: existingRecord?.id || `pembelian_${Date.now()}`,
      storeId: store,
      tanggal,
      items: items.map(it => ({
        bahanId: it.bahanId,
        bahanName: BAHAN_BAKU.find(b => b.id === it.bahanId)?.name,
        qty: Number(it.qty),
        harga: Number(it.harga),
        subtotal: Number(it.qty) * Number(it.harga)
      })),
      total: totalPembelian,
      inputOleh: emp.name,
      inputOlehId: emp.id,
      submittedAt: now.toISOString()
    };
    if (existingRecord) {
      await setPurchaseReports(purchaseReports.map(p => p.id === existingRecord.id ? record : p));
    } else {
      await setPurchaseReports([...purchaseReports, record]);
    }
    setStatus({
      status: "locked",
      submittedBy: statusData.submittedBy || emp.name,
      submittedAt: statusData.submittedAt || now.toISOString(),
      ...(wasEdit ? {
        editedBy: emp.name,
        editedAt: now.toISOString()
      } : {})
    });
    setItems([{
      bahanId: BAHAN_BAKU[0].id,
      qty: "",
      harga: ""
    }]);
  };
  const requestEdit = () => setStatus({
    status: "edit_requested",
    editRequestedBy: emp.name,
    editRequestedById: emp.id,
    editRequestedAt: now.toISOString()
  });
  const approveEdit = () => setStatus({
    status: "unlocked",
    approvedBy: emp.name,
    approvedAt: now.toISOString()
  });
  const riwayat = purchaseReports.filter(p => p.storeId === store && p.tanggal !== tanggal).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")).slice(0, 5);
  return <FormSurface title="Pembelian yang transparan." subtitle="Rincian kebutuhan bahan dan bukti belanja ada dalam satu catatan." code="PURCHASE"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 14
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Toko</SectionLabel>
          <Select value={store} onChange={setStore} options={STORES_HOLDING.map(s => ({
            value: s.id,
            label: s.name
          }))} />
        </div>
        <div>
          <SectionLabel>Tanggal Pembelian</SectionLabel>
          <input type="date" max={dateStr(now)} value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 16
      }}>
        Pembelian Bahan Baku hanya bisa diinput{" "}
        <b>1 kali per toko per tanggal</b>, oleh Eri atau Nana (siapa pun yang
        lebih dulu).
      </div>

      {statusData.status === "locked" && <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
        background: T.goodSoft,
        color: T.good,
        padding: "10px 14px",
        borderRadius: 12
      }} className="ais-flex-layout">
          <span style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600
        }}>
            Terkunci — disubmit oleh {statusData.submittedBy} pada{" "}
            {fmtWaktuID(statusData.submittedAt)}.
            {statusData.editedBy && ` Terakhir diedit oleh ${statusData.editedBy} pada ${fmtWaktuID(statusData.editedAt)}.`}
          </span>
          {isSubmitterRole && <button onClick={requestEdit} style={{
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.good,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 11.5,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0
        }} className="ais-button ais-button--primary">
              Ajukan Edit
            </button>}
        </div>}

      {statusData.status === "edit_requested" && <div style={{
        marginBottom: 14,
        background: T.warnSoft,
        color: T.warn,
        padding: "10px 14px",
        borderRadius: 12
      }}>
          <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6
        }}>
            Menunggu approval <b>{approverName}</b> untuk membuka edit (diajukan
            oleh {statusData.editRequestedBy}).
          </div>
          {isApproverNow && <button onClick={approveEdit} style={{
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.warn,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 11.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">
              Setujui Buka Edit
            </button>}
        </div>}

      {statusData.status === "unlocked" && isSubmitterRole && <div style={{
        marginBottom: 14,
        background: T.accentSoft,
        color: T.accentDeep,
        padding: "10px 14px",
        borderRadius: 12,
        ...FI,
        fontSize: 12,
        fontWeight: 600
      }}>
          Akses edit terbuka (disetujui {statusData.approvedBy}) — silakan edit
          lalu submit ulang.
        </div>}

      {canInput ? <div>
          <SectionLabel>
            Bahan Baku Dibeli & Harga (sesuai Invoice)
          </SectionLabel>
          {items.map((it, idx) => <div key={idx} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "10px 12px",
          marginBottom: 8
        }}>
              <div style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center"
          }} className="ais-flex-layout">
                <div style={{
              flex: 1
            }}>
                  <Select value={it.bahanId} onChange={v => updateItem(idx, "bahanId", v)} options={bahanTokoIni(store).map(b => ({
                value: b.id,
                label: b.name
              }))} />
                </div>
                {items.length > 1 && <button onClick={() => removeItem(idx)} style={{
              border: "none",
              background: "transparent",
              color: T.bad,
              cursor: "pointer",
              padding: 6,
              flexShrink: 0
            }} className="ais-button ais-button--danger">
                    <Trash2 size={16} />
                  </button>}
              </div>
              <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8
          }} className="ais-responsive-grid">
                <div>
                  <div style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted,
                marginBottom: 3
              }}>
                    Qty
                  </div>
                  <input type="number" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} style={{
                width: "100%",
                border: `1px solid ${T.line}`,
                borderRadius: 8,
                padding: "7px 9px",
                ...FM,
                fontSize: 13,
                textAlign: "center"
              }} className="ais-control" />
                </div>
                <div>
                  <div style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted,
                marginBottom: 3
              }}>
                    Harga Beli / Satuan
                  </div>
                  <input type="number" value={it.harga} onChange={e => updateItem(idx, "harga", e.target.value)} style={{
                width: "100%",
                border: `1px solid ${T.line}`,
                borderRadius: 8,
                padding: "7px 9px",
                ...FM,
                fontSize: 13,
                textAlign: "center"
              }} className="ais-control" />
                </div>
              </div>
              {Number(it.qty) > 0 && Number(it.harga) > 0 && <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginTop: 6,
            textAlign: "right"
          }}>
                  Subtotal: {rupiah(Number(it.qty) * Number(it.harga))}
                </div>}
            </div>)}
          <button onClick={addItem} style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1px dashed ${T.line}`,
          borderRadius: 10,
          padding: "8px 12px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer",
          marginBottom: 14
        }} className="ais-button ais-button--default ais-flex-layout">
            <Plus size={14} /> Tambah Bahan Baku
          </button>

          <div style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 0",
          ...FI,
          fontWeight: 700,
          fontSize: 14,
          borderTop: `1px solid ${T.line}`,
          marginBottom: 16
        }}>
            <span>Total Pembelian</span>
            <span style={{
            fontFamily: "JetBrains Mono"
          }}>
              {rupiah(totalPembelian)}
            </span>
          </div>

          <div style={{
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
            <AlertTriangle size={15} style={{
            marginTop: 1,
            flexShrink: 0
          }} />
            Upload invoice di dashboard apabila invoice sudah diterima.
          </div>

          <SubmitBtn label={statusData.status === "unlocked" ? "Simpan & Kunci Kembali" : "Submit Pembelian Bahan Baku"} disabled={!complete} onClick={submit} />
        </div> : <div>
          {!existingRecord && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>
              Belum ada Pembelian Bahan Baku untuk toko & tanggal ini.
            </div>}
          {existingRecord && <div>
              {existingRecord.items.map((it, i) => <div key={i} style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "7px 0",
            borderBottom: `1px solid ${T.line}`
          }}>
                  <span style={{
              ...FI,
              fontSize: 13
            }}>
                    {it.bahanName} × {it.qty}
                  </span>
                  <span style={{
              ...FM,
              fontSize: 12.5
            }}>
                    {rupiah(it.subtotal)}
                  </span>
                </div>)}
              <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 0",
            ...FI,
            fontWeight: 700,
            fontSize: 14
          }}>
                <span>Total Pembelian</span>
                <span style={{
              fontFamily: "JetBrains Mono"
            }}>
                  {rupiah(existingRecord.total)}
                </span>
              </div>
              <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginTop: 10
          }}>
                Diinput oleh {existingRecord.inputOleh} pada{" "}
                {fmtWaktuID(existingRecord.submittedAt)}
              </div>
            </div>}
        </div>}

      {riwayat.length > 0 && <div style={{
        marginTop: 24
      }}>
          <SectionLabel>Riwayat Pembelian Toko Ini</SectionLabel>
          {riwayat.map(p => <div key={p.id} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 8
        }}>
              <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4
          }}>
                <span style={{
              ...FI,
              fontWeight: 700,
              fontSize: 12.5
            }}>
                  {p.tanggal}
                </span>
                <span style={{
              ...FM,
              fontWeight: 700,
              fontSize: 12.5
            }}>
                  {rupiah(p.total)}
                </span>
              </div>
              <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted
          }}>
                {p.items.length} item · Diinput {p.inputOleh}
              </div>
            </div>)}
        </div>}
    </div></FormSurface>;
}

/* ---- Transfer Stok — Monitoring & Input Harga (Eri) ---- */
function TransferHargaCard({
  transfer,
  stockTransfers,
  setStockTransfers,
  emp,
  now
}) {
  const [editingHarga, setEditingHarga] = useState(false);
  const [harga, setHarga] = useState(Object.fromEntries(transfer.items.map(it => [it.bahanId, it.hargaSatuan != null ? String(it.hargaSatuan) : ""])));
  const allPriced = transfer.items.every(it => it.hargaSatuan != null);
  const saveHarga = async () => {
    const updatedItems = transfer.items.map(it => ({
      ...it,
      hargaSatuan: harga[it.bahanId] !== "" ? Number(harga[it.bahanId]) : null
    }));
    await setStockTransfers(stockTransfers.map(t => t.id === transfer.id ? {
      ...t,
      items: updatedItems,
      hargaInputBy: emp.name,
      hargaInputAt: now.toISOString()
    } : t));
    setEditingHarga(false);
  };
  return <FormSurface title="Nilai transfer, tercatat." subtitle="Lengkapi nilai barang sebelum melanjutkan proses transfer." code="TRANSFER VALUE"><div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
        flexWrap: "wrap",
        gap: 6
      }} className="ais-flex-layout">
        <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6
        }} className="ais-flex-layout">
          <ArrowLeftRight size={13} /> {storeName(transfer.asalToko)} →{" "}
          {storeName(transfer.tujuanToko)}
        </div>
        <div style={{
          display: "flex",
          gap: 6
        }} className="ais-flex-layout">
          <Badge tone={transfer.status === "confirmed" ? "good" : "warn"}>
            {transfer.status === "confirmed" ? "Dikonfirmasi" : "Menunggu Konfirmasi"}
          </Badge>
          <Badge tone={allPriced ? "good" : "manajemen"}>
            {allPriced ? "Sudah Ada Harga" : "Belum Ada Harga"}
          </Badge>
        </div>
      </div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 8
      }}>
        {transfer.tanggal} · Dikirim oleh {transfer.inputOleh}
        {transfer.konfirmasi ? ` · Diterima oleh ${transfer.konfirmasi.confirmedBy}` : ""}
      </div>

      {!editingHarga ? <div>
          {transfer.items.map(it => {
          const terima = transfer.konfirmasi?.items.find(k => k.bahanId === it.bahanId)?.qtyTerima;
          return <div key={it.bahanId} style={{
            display: "flex",
            justifyContent: "space-between",
            ...FI,
            fontSize: 12.5,
            padding: "3px 0"
          }}>
                <span>
                  {it.bahanName}: {it.qty}
                  {terima != null ? ` (diterima ${terima})` : ""}
                </span>
                <span style={{
              ...FM,
              color: it.hargaSatuan != null ? T.ink : T.inkMuted
            }}>
                  {it.hargaSatuan != null ? rupiah(it.hargaSatuan) : "Belum ada harga"}
                </span>
              </div>;
        })}
          <button onClick={() => setEditingHarga(true)} style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 10px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--default ais-flex-layout">
            <PenLine size={12} /> {allPriced ? "Ubah Harga" : "Input Harga"}
          </button>
        </div> : <div>
          {transfer.items.map(it => <div key={it.bahanId} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6
        }}>
              <span style={{
            ...FI,
            fontSize: 12.5
          }}>{it.bahanName}</span>
              <input type="number" value={harga[it.bahanId]} onChange={e => setHarga({
            ...harga,
            [it.bahanId]: e.target.value
          })} placeholder="Harga/satuan" style={{
            width: 110,
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "6px 8px",
            ...FM,
            fontSize: 12.5,
            textAlign: "right"
          }} className="ais-control" />
            </div>)}
          <div style={{
          display: "flex",
          gap: 8,
          marginTop: 8
        }} className="ais-flex-layout">
            <button onClick={saveHarga} style={{
            flex: 1,
            border: "none",
            borderRadius: 8,
            padding: "7px 10px",
            background: T.manajemen,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
              Simpan Harga
            </button>
            <button onClick={() => setEditingHarga(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "7px 12px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
              Batal
            </button>
          </div>
        </div>}
    </div></FormSurface>;
}
function TransferMonitoringEri({
  stockTransfers,
  setStockTransfers,
  emp,
  now
}) {
  const sorted = [...stockTransfers].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const belumHarga = sorted.filter(t => t.items.some(it => it.hargaSatuan == null)).length;
  return <div>
      <SectionLabel>Monitoring Transfer Stok ({sorted.length})</SectionLabel>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Input harga per bahan baku yang ditransfer supaya barang transfer punya
        nilai/harga — {belumHarga} transfer belum ada harga.
      </div>
      {sorted.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Belum ada transfer stok.
        </div>}
      {sorted.map(t => <TransferHargaCard key={t.id} transfer={t} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} emp={emp} now={now} />)}
    </div>;
}
function AdminUtamaCard({
  emp,
  log,
  schedule,
  addRecord,
  workHours,
  personalAbsen = true,
  laporanManajemen,
  setLaporanManajemen,
  visibleTabs,
  customTasks,
  masterTask,
  setCustomTasks,
  purchaseReports,
  setPurchaseReports,
  purchaseStatus,
  setPurchaseStatus,
  stokEditRequests,
  stokEditLock,
  reportLog,
  now,
  stockTransfers,
  setStockTransfers,
  pengajuan,
  setPengajuan
}) {
  const workers = EMPLOYEES.filter(e => e.group === "crew" || e.group === "spv" || e.group === "tl");
  const rekapWorkers = EMPLOYEES.filter(e => e.group !== "direksi" && e.group !== "toko_device");
  const allTabs = [{
    key: "absensi",
    label: "Absensi Saya",
    icon: User,
    show: personalAbsen
  }, {
    key: "ringkasan",
    label: "Live Absen Harian",
    icon: Users,
    show: true
  }, {
    key: "jadwal",
    label: "Master Jadwal",
    icon: CalendarDays,
    show: true
  }, {
    key: "rekap",
    label: "Rekap Absen",
    icon: BarChart3,
    show: true
  }, {
    key: "manajemen_review",
    label: "Task Request",
    icon: ClipboardList,
    show: emp.group === "direksi"
  }, {
    key: "pembelian",
    label: "Pembelian Bahan Baku",
    icon: Receipt,
    show: emp.id === "eri" || emp.id === "nana" || emp.group === "direksi"
  }];
  const tabs = allTabs.filter(t => t.show && (!visibleTabs || visibleTabs.includes(t.key)));
  const [tab, setTab] = useState(tabs[0]?.key);
  return <div>
      {emp.group === "direksi" && <StokEditNotifBanner stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} reportLog={reportLog} />}
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 18,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 12,
      flexWrap: "wrap"
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: "1 1 45%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 9,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default ais-flex-layout" aria-pressed={tab === t.key}>
            <t.icon size={14} />
            {t.label}
          </button>)}
      </div>

      {tab === "absensi" && personalAbsen && <ManajemenCard emp={emp} log={log} addRecord={addRecord} workHours={workHours} showIdentity={false} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} />}
      {tab === "ringkasan" && <LiveFeed log={log} workHours={workHours} />}
      {tab === "jadwal" && <MasterJadwal workers={workers} schedule={schedule} />}
      {tab === "rekap" && <RekapBulanan workers={rekapWorkers} log={log} schedule={schedule} workHours={workHours} />}
      {tab === "manajemen_review" && <DireksiManajemenReview emp={emp} laporanManajemen={laporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} />}
      {tab === "pembelian" && <LaporanPembelianPage emp={emp} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} now={now} />}
    </div>;
}
function LiveFeed({
  workHours: _wh,
  log
}) {
  const ds = dateStr(new Date());
  const [filterStore, setFilterStore] = useState("all");
  const todays = log.filter(r => r.date === ds).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const filtered = todays.filter(r => {
    if (filterStore === "all") return true;
    if (filterStore === "kantor") return !r.store;
    return r.store === filterStore;
  });
  const statusFor = r => {
    if (r.type !== "clock_in") return null;
    const lateBy = lateMinutesFor(new Date(r.timestamp), r.shift || null, _wh);
    return lateBy > LATE_TOLERANCE_MIN ? {
      label: "Terlambat",
      tone: "bad"
    } : {
      label: "Ontime",
      tone: "good"
    };
  };
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      flexWrap: "wrap",
      gap: 8
    }} className="ais-flex-layout">
        <SectionLabel>
          Aktivitas Absensi Hari Ini ({filtered.length})
        </SectionLabel>
        <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "6px 10px",
        ...FI,
        fontSize: 13,
        background: T.surfaceSunk
      }} className="ais-control">
          <option value="all">Semua Toko & Manajemen</option>
          <option value="kantor">Manajemen (Kantor)</option>
          {STORES_HOLDING.map(s => <option key={s.id} value={s.id}>
              {s.name}
            </option>)}
        </select>
      </div>
      {filtered.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Belum ada aktivitas untuk filter ini.
        </div>}
      {filtered.map(r => {
      const status = statusFor(r);
      return <div key={r.id} style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 0",
        borderBottom: `1px solid ${T.line}`,
        flexWrap: "wrap"
      }} className="ais-flex-layout">
            <div style={{
          ...FM,
          fontSize: 12.5,
          color: T.inkMuted,
          width: 50
        }}>
              {new Date(r.timestamp).toTimeString().slice(0, 5)}
            </div>
            <div style={{
          flex: 1,
          minWidth: 90,
          ...FI,
          fontSize: 13,
          fontWeight: 600,
          color: T.ink
        }}>
              {r.empName}
            </div>
            <Badge tone={r.type === "clock_in" ? "good" : r.type === "clock_out" ? "bad" : "warn"}>
              {TYPE_META[r.type].label}
            </Badge>
            {(r.group === "spv" || r.group === "tl") && r.shift && <Badge tone="manajemen">{SHIFT_LABELS[r.shift] || r.shift}</Badge>}
            {status && <Badge tone={status.tone}>{status.label}</Badge>}
            <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted,
          minWidth: 100,
          textAlign: "right"
        }}>
              {storeName(r.store) !== "-" ? storeName(r.store) : "Kantor"}
            </div>
          </div>;
    })}
    </div>;
}
function MasterJadwal({
  workers,
  schedule
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const monthEntries = Object.entries(schedule).filter(([k]) => k.slice(-7) === month).sort((a, b) => a[0].localeCompare(b[0]));
  return <div>
      <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      marginBottom: 16,
      background: T.warnSoft,
      color: T.warn,
      padding: "10px 12px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5,
      fontWeight: 500
    }} className="ais-flex-layout">
        <Lock size={15} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
        Master Jadwal di mobile app bersifat <b>view only</b>. Input & perubahan
        jadwal hanya dapat dilakukan lewat Dashboard Web oleh Admin Utama /
        Manajemen.
      </div>

      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    }}>
        <SectionLabel>Jadwal Bulan {month}</SectionLabel>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "6px 10px",
        ...FI,
        fontSize: 13,
        background: T.surfaceSunk
      }} className="ais-control" />
      </div>
      <div style={{
      maxHeight: 340,
      overflowY: "auto",
      border: `1px solid ${T.line}`,
      borderRadius: 10
    }}>
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12.5
      }}>
          <thead>
            <tr style={{
            background: T.surfaceSunk,
            textAlign: "left"
          }}>
              <th style={{
              padding: "8px 10px"
            }}>Tanggal</th>
              <th style={{
              padding: "8px 10px"
            }}>Karyawan</th>
              <th style={{
              padding: "8px 10px"
            }}>Shift</th>
            </tr>
          </thead>
          <tbody>
            {monthEntries.length === 0 && <tr>
                <td colSpan={3} style={{
              padding: 12,
              color: T.inkMuted
            }}>
                  Belum ada jadwal untuk bulan ini.
                </td>
              </tr>}
            {monthEntries.map(([k, v]) => {
            const [id, date] = [k.split("_")[0], k.slice(k.indexOf("_") + 1)];
            const w = workers.find(w => w.id === id);
            return <tr key={k} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                padding: "7px 10px",
                ...FM
              }}>{date}</td>
                  <td style={{
                padding: "7px 10px"
              }}>{w?.name || id}</td>
                  <td style={{
                padding: "7px 10px"
              }}>
                    {(() => {
                  const s = normalizeShift(v);
                  return s ? SHIFT_LABELS[s] || s : "-";
                })()}
                  </td>
                </tr>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
function countBusinessDaysSoFar(month) {
  const [y, m] = month.split("-").map(Number);
  const daysTotal = new Date(y, m, 0).getDate();
  const today = new Date();
  const isCurrentMonth = monthStr(today) === month;
  const lastDay = isCurrentMonth ? today.getDate() : daysTotal;
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(y, m - 1, d).getDay() !== 0) count++; // Senin–Sabtu dianggap hari kerja kantor
  }
  return count;
}
function RekapBulanan({
  workers,
  log,
  schedule,
  workHours
}) {
  const [month, setMonth] = useState(monthStr(new Date()));
  const [filterStore, setFilterStore] = useState("all");
  const workersFiltered = useMemo(() => {
    if (filterStore === "all") return workers;
    if (filterStore === "kantor") return workers.filter(w => w.group === "manajemen");
    return workers.filter(w => w.group !== "manajemen" && (w.stores || [w.store]).includes(filterStore));
  }, [workers, filterStore]);
  const rows = useMemo(() => workersFiltered.map(w => {
    const isManajemen = w.group === "manajemen";
    let terjadwal = 0,
      hadir = 0,
      telat = 0,
      telatMenitTotal = 0,
      pulangCepat = 0,
      alpa = 0,
      tidakSesuai = 0,
      totalMenit = 0;
    if (!isManajemen) {
      const schedDays = Object.entries(schedule).filter(([k, v]) => k.startsWith(w.id + "_") && k.slice(-7) === month && normalizeShift(v) && normalizeShift(v) !== "off");
      terjadwal = schedDays.length;
      schedDays.forEach(([k, v]) => {
        const date = k.slice(k.indexOf("_") + 1);
        const dayRecs = log.filter(r => r.empId === w.id && r.date === date);
        const clockIn = dayRecs.find(r => r.type === "clock_in");
        const clockOut = [...dayRecs].reverse().find(r => r.type === "clock_out");
        if (!clockIn) {
          alpa++;
          return;
        }
        hadir++;
        const {
          start,
          end
        } = SHIFT_TIME[normalizeShift(v)] || SHIFT_TIME["1"];
        const inMin = minutesOfDate(new Date(clockIn.timestamp));
        const lateBy = inMin - minutesOf(start);
        if (lateBy > LATE_TOLERANCE_MIN) {
          telat++;
          telatMenitTotal += lateBy;
        }
        if (clockOut) {
          const outMin = minutesOfDate(new Date(clockOut.timestamp));
          if (outMin < minutesOf(end) - 15) pulangCepat++;
          totalMenit += (outMin - inMin + 1440) % 1440;
        }
        if (clockIn.shift && clockIn.shift !== normalizeShift(v)) tidakSesuai++;
      });
    } else {
      terjadwal = countBusinessDaysSoFar(month);
      const [y, m] = month.split("-").map(Number);
      const daysTotal = new Date(y, m, 0).getDate();
      const isCurrentMonth = monthStr(new Date()) === month;
      const upTo = isCurrentMonth ? new Date().getDate() : daysTotal;
      for (let d = 1; d <= upTo; d++) {
        if (new Date(y, m - 1, d).getDay() === 0) continue; // libur Minggu
        const ds = `${month}-${pad(d)}`;
        const dayRecs = log.filter(r => r.empId === w.id && r.date === ds);
        const clockIn = dayRecs.find(r => r.type === "clock_in");
        const clockOut = [...dayRecs].reverse().find(r => r.type === "clock_out");
        if (!clockIn) {
          alpa++;
          continue;
        }
        hadir++;
        const inMin = minutesOfDate(new Date(clockIn.timestamp));
        // Absen audit bebas jam kerja — tidak pernah dihitung terlambat.
        const jamHariIni = jamKantorHari(ds, workHours);
        const lateBy = clockIn.audit ? 0 : inMin - minutesOf(jamHariIni.start);
        if (lateBy > LATE_TOLERANCE_MIN) {
          telat++;
          telatMenitTotal += lateBy;
        }
        if (clockOut) {
          const outMin = minutesOfDate(new Date(clockOut.timestamp));
          if (!clockIn.audit && outMin < minutesOf(jamHariIni.end) - 15) pulangCepat++;
          totalMenit += (outMin - inMin + 1440) % 1440;
        }
      }
    }
    const pct = terjadwal ? Math.round(hadir / terjadwal * 100) : 0;
    const avgJam = hadir ? (totalMenit / hadir / 60).toFixed(1) : "0.0";
    const telatJam = (telatMenitTotal / 60).toFixed(1);
    return {
      name: w.name,
      jabatan: w.jabatan || GROUP_LABEL[w.group],
      terjadwal,
      hadir,
      pct,
      avgJam,
      telat,
      telatJam,
      pulangCepat,
      alpa,
      tidakSesuai: isManajemen ? null : tidakSesuai
    };
  }), [workersFiltered, log, schedule, month]);
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      flexWrap: "wrap",
      gap: 8
    }} className="ais-flex-layout">
        <SectionLabel>Rekap Absen</SectionLabel>
        <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "6px 10px",
          ...FI,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control">
            <option value="all">Semua Toko & Manajemen</option>
            <option value="kantor">Manajemen (Kantor)</option>
            {STORES_HOLDING.map(s => <option key={s.id} value={s.id}>
                {s.name}
              </option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "6px 10px",
          ...FI,
          fontSize: 13,
          background: T.surfaceSunk
        }} className="ais-control" />
        </div>
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 10
    }}>
        Mencakup seluruh karyawan yang memiliki jadwal kerja (Manajemen, Crew,
        SPV). Untuk Manajemen, "Terjadwal" dihitung dari hari kerja kantor
        (Senin–Sabtu) dan jam kantor {OFFICE_HOURS.start}–{OFFICE_HOURS.end}.
      </div>
      <div style={{
      overflowX: "auto",
      border: `1px solid ${T.line}`,
      borderRadius: 10
    }}>
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 12,
        minWidth: 720
      }}>
          <thead>
            <tr style={{
            background: T.surfaceSunk,
            textAlign: "left"
          }}>
              {["Nama", "Posisi", "Terjadwal", "Hadir", "% Absensi", "Rata² Jam/Hari", "Terlambat", "Jam Terlambat", "Pulang Cepat", "Alpa", "Tdk Sesuai"].map(h => <th key={h} style={{
              padding: "8px 10px",
              whiteSpace: "nowrap"
            }}>
                  {h}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr>
                <td colSpan={11} style={{
              padding: "12px 10px",
              color: T.inkMuted
            }}>
                  Tidak ada karyawan untuk filter ini.
                </td>
              </tr>}
            {rows.map(r => <tr key={r.name} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              padding: "7px 10px",
              fontWeight: 600
            }}>
                  {r.name}
                </td>
                <td style={{
              padding: "7px 10px",
              color: T.inkMuted
            }}>
                  {r.jabatan}
                </td>
                <td style={{
              padding: "7px 10px"
            }}>{r.terjadwal}</td>
                <td style={{
              padding: "7px 10px"
            }}>{r.hadir}</td>
                <td style={{
              padding: "7px 10px"
            }}>
                  <span style={{
                color: r.pct >= 90 ? T.good : r.pct >= 75 ? T.warn : T.bad,
                fontWeight: 700
              }}>
                    {r.pct}%
                  </span>
                </td>
                <td style={{
              padding: "7px 10px",
              ...FM
            }}>{r.avgJam} jam</td>
                <td style={{
              padding: "7px 10px",
              color: r.telat ? T.warn : T.inkMuted
            }}>
                  {r.telat}
                </td>
                <td style={{
              padding: "7px 10px",
              ...FM,
              color: r.telat ? T.warn : T.inkMuted
            }}>
                  {r.telatJam} jam
                </td>
                <td style={{
              padding: "7px 10px",
              color: r.pulangCepat ? T.warn : T.inkMuted
            }}>
                  {r.pulangCepat}
                </td>
                <td style={{
              padding: "7px 10px",
              color: r.alpa ? T.bad : T.inkMuted
            }}>
                  {r.alpa}
                </td>
                <td style={{
              padding: "7px 10px",
              color: r.tidakSesuai ? T.bad : T.inkMuted
            }}>
                  {r.tidakSesuai == null ? "-" : r.tidakSesuai}
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginTop: 10
    }}>
        Simulasi kalkulasi otomatis dari data absen vs. master jadwal. Toleransi
        telat/pulang cepat: 15 menit.
      </div>
    </div>;
}

/* ---------------------------------------------------------
   MODUL 2 — LAPORAN ANAK TOKO
--------------------------------------------------------- */
const AREA_FOTO = ["Parkir", "Dine In / Ruang Tunggu", "Kasir", "Etalase", "Area Breeding", "Area Masak", "Area Preparing", "Area Storage", "Kamar Mandi"];
const OPENING_TOGGLES = [{
  key: "baterai",
  label: "Baterai HP & Tab Toko",
  options: [{
    value: "penuh",
    label: "Terisi Penuh"
  }, {
    value: "belum",
    label: "Belum Penuh"
  }]
}, {
  key: "lampu",
  label: "Kondisi Lampu",
  options: [{
    value: "mati",
    label: "Semua Mati"
  }, {
    value: "nyala",
    label: "Masih Menyala"
  }]
}, {
  key: "app",
  label: "Aplikasi Order Online",
  options: [{
    value: "on",
    label: "On"
  }, {
    value: "off",
    label: "Off"
  }]
}];
const CLOSING_TOGGLES = [{
  key: "baterai",
  label: "Baterai HP & Tab Toko",
  options: [{
    value: "tercharge",
    label: "Tercharge"
  }, {
    value: "belum",
    label: "Belum"
  }]
}, {
  key: "lampu",
  label: "Kondisi Lampu",
  options: [{
    value: "mati",
    label: "Semua Mati"
  }, {
    value: "nyala",
    label: "Masih Menyala"
  }]
}, {
  key: "app",
  label: "Aplikasi Order Online",
  options: [{
    value: "off",
    label: "Off"
  }, {
    value: "on",
    label: "On"
  }]
}];

/* ---------------------------------------------------------
   KALKULATOR SAMBAL CIPREK (mobile)
   Parameter anchor diatur per toko dari dashboard (Master Produksi → Sambal Ciprek).
   Rumusnya identik dengan yang di dashboard: interpolasi linier antar anchor tester.
--------------------------------------------------------- */
const CIPREK_SOP = [{
  bahanId: "frs_ca_01_001",
  nama: "Cabe",
  sop: 20
}, {
  bahanId: "frs_ba_01_005",
  nama: "Bawang Putih",
  sop: 2.5
}, {
  bahanId: "dry_gu_01_005",
  nama: "Gula",
  sop: 5
}, {
  bahanId: "dry_ga_01_006",
  nama: "Garam",
  sop: 5
}, {
  bahanId: "dry_sa_01_007",
  nama: "Sasa",
  sop: 2.5
}, {
  bahanId: "oil_mi_01_003",
  nama: "Minyak 1L",
  sop: 10
}];
const CIPREK_MAX_BATCH = 1000;
const CIPREK_MIN_REKOMENDASI = 100;
const CIPREK_CABE_PER_CUP = 20;

// Anchor hasil tester per toko — sumber resminya dari dashboard (Master Produksi → Sambal Ciprek).
// Nilai ini dipakai sebagai bawaan supaya app bisa langsung dipakai/disimulasikan.
const CIPREK_CONFIG_DEFAULT = {
  dtop_cipanengah: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 15, 20, 50],
      gula: [5, 12, 30, 73.5],
      garam: [5, 7, 15, 35.6],
      sasa: [2.5, 4, 15, 35.6],
      minyak_1l: [20, 60, 200, 500]
    }
  },
  dtop_baros: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 16, 22, 54],
      gula: [5, 11, 28, 68],
      garam: [5, 7, 16, 37],
      sasa: [2.5, 4, 14, 34],
      minyak_1l: [20, 60, 200, 500]
    }
  },
  dtop_lembursitu: {
    anchors: {
      cabe: [20, 120, 400, 1000],
      bawang_putih: [2.5, 14, 19, 47],
      gula: [5, 13, 33, 80],
      garam: [5, 6, 14, 33],
      sasa: [2.5, 4, 15, 36],
      minyak_1l: [20, 60, 200, 500]
    }
  }
  // DTOP Garuda sengaja kosong — toko baru harus tester dulu.
};
function interpolasiAnchorCiprek(cabe, a) {
  const [a20, a120, a400, a1000] = a;
  if (cabe <= 20) return a20 * (cabe / 20);
  if (cabe <= 120) return a20 + (cabe - 20) * (a120 - a20) / (120 - 20);
  if (cabe <= 400) return a120 + (cabe - 120) * (a400 - a120) / (400 - 120);
  return a400 + (cabe - 400) * (a1000 - a400) / (1000 - 400);
}
function hitungCiprekApp(inputCabe, anchorMap) {
  const cabe = Number(inputCabe) || 0;
  const valid = cabe > 0 && cabe <= CIPREK_MAX_BATCH;
  const rows = CIPREK_SOP.map(s => {
    const av = (anchorMap?.[s.bahanId] || [0, 0, 0, 0]).map(v => Number(v) || 0);
    const belumDiisi = av.every(v => v === 0);
    const qty = !valid || belumDiisi ? null : Math.round(interpolasiAnchorCiprek(cabe, av) * 10) / 10;
    return {
      ...s,
      qty
    };
  });
  return {
    rows,
    targetCup: cabe ? Math.floor(cabe / CIPREK_CABE_PER_CUP) : 0,
    melebihiBatch: cabe > CIPREK_MAX_BATCH,
    saranBatch: cabe > CIPREK_MAX_BATCH ? Math.ceil(cabe / CIPREK_MAX_BATCH) : 0,
    dibawahRekomendasi: cabe > 0 && cabe < CIPREK_MIN_REKOMENDASI,
    anchorBelumAda: rows.some(r => r.qty === null && valid),
    valid
  };
}

/* ---- Bagian Sambal Ciprek pada Base Preparation (dipakai sesi 1 & 2) ---- */
function CiprekSection({
  sesi,
  storeId,
  ciprekConfig,
  value,
  onChange
}) {
  const anchorMap = ciprekConfig?.[storeId]?.anchors || {};
  const v = value || {};
  const set = patch => onChange({
    ...v,
    ...patch
  });
  const hasil = hitungCiprekApp(v.jumlahCabe, anchorMap);
  const fotoLengkap = v.fotoTimbangan && v.fotoCup;
  const numIn = (val, onSet, ph) => <input type="number" value={val ?? ""} onChange={e => onSet(e.target.value)} placeholder={ph} style={{
    width: "100%",
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    padding: "9px 12px",
    ...FM,
    fontSize: 14,
    background: T.surfaceSunk
  }} className="ais-control" />;
  return <div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 4
    }}>
        Jumlah Cabe yang Dipakai (gr)
      </div>
      {numIn(v.jumlahCabe, x => set({
      jumlahCabe: x
    }), "Total berat cabe bersih")}
      <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      marginTop: 4,
      marginBottom: 12
    }}>
        Masukkan total berat cabe bersih yang akan dibuat sambal.
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
          Ditolak — maksimal {CIPREK_MAX_BATCH} gr per batch. Rasa &amp;
          kualitas tidak terjaga. Pecah menjadi <b>{hasil.saranBatch} batch</b>{" "}
          terpisah.
        </div>}
      {hasil.dibawahRekomendasi && <div style={{
      background: T.warnSoft,
      color: T.warn,
      borderRadius: 10,
      padding: "9px 12px",
      ...FI,
      fontSize: 12,
      marginBottom: 12
    }}>
          Di bawah rekomendasi minimal {CIPREK_MIN_REKOMENDASI} gr — tetap bisa
          dilanjut, tapi kurang efisien.
        </div>}
      {hasil.anchorBelumAda && <div style={{
      background: T.warnSoft,
      color: T.warn,
      borderRadius: 10,
      padding: "9px 12px",
      ...FI,
      fontSize: 12,
      marginBottom: 12
    }}>
          Parameter sambal untuk toko ini belum ditetapkan. Hubungi manajemen
          untuk penetapan anchor.
        </div>}

      {hasil.valid && !hasil.anchorBelumAda && <div style={{
      marginBottom: 14
    }}>
          <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 10
      }} className="ais-flex-layout">
            <div style={{
          background: T.goodSoft,
          color: T.good,
          borderRadius: 999,
          padding: "5px 12px",
          ...FI,
          fontWeight: 600,
          fontSize: 12
        }}>
              OK — lanjut hitung bahan
            </div>
            <div style={{
          background: T.accentSoft,
          color: T.accentDeep,
          borderRadius: 999,
          padding: "5px 12px",
          ...FI,
          fontWeight: 700,
          fontSize: 12
        }}>
              Target {hasil.targetCup} cup
            </div>
          </div>

          <div style={{
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        overflow: "hidden"
      }}>
            <table style={{
          width: "100%",
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12.5
        }}>
              <thead>
                <tr style={{
              background: T.surfaceSunk,
              textAlign: "left"
            }}>
                  {["Bahan", "Qty", "Satuan"].map(h => <th key={h} style={{
                padding: "8px 12px",
                fontSize: 10.5,
                color: T.inkMuted,
                textTransform: "uppercase"
              }}>
                      {h}
                    </th>)}
                </tr>
              </thead>
              <tbody>
                {hasil.rows.map(r => <tr key={r.bahanId} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                    <td style={{
                padding: "7px 12px"
              }}>{r.nama}</td>
                    <td style={{
                padding: "7px 12px",
                ...FM,
                fontWeight: 700
              }}>
                      {r.qty}
                    </td>
                    <td style={{
                padding: "7px 12px",
                color: T.inkMuted
              }}>
                      gr
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginTop: 6
      }}>
            Takar bahan sesuai tabel di atas. Hanya <b>cabe</b> yang otomatis
            masuk ke pemakaian Stok Bahan Baku — bahan lain direkap manual
            karena dipakai juga oleh produk lain.
          </div>
        </div>}

      {hasil.valid && !hasil.anchorBelumAda && <>
          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>
            Foto Hasil Produksi
          </div>
          <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginBottom: 14
      }} className="ais-responsive-grid">
            <PhotoSlot label="Hasil di Timbangan" value={v.fotoTimbangan} onChange={x => set({
          fotoTimbangan: x
        })} />
            <PhotoSlot label="Hasil Setelah di-Cup" value={v.fotoCup} onChange={x => set({
          fotoCup: x
        })} />
          </div>

          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 6
      }}>
            Hasil Aktual Setelah Produksi
          </div>
          {!fotoLengkap ? <div style={{
        background: T.surfaceSunk,
        borderRadius: 10,
        padding: "11px 13px",
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        marginBottom: 4
      }} className="ais-content-panel">
              Lengkapi kedua foto di atas untuk membuka pengisian hasil aktual.
            </div> : <div style={{
        background: T.surfaceSunk,
        borderRadius: 12,
        padding: 14
      }} className="ais-content-panel">
              <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12
        }} className="ais-responsive-grid">
                <div>
                  <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginBottom: 4
            }}>
                    Total Sambal Jadi (gr)
                  </div>
                  {numIn(v.totalJadi, x => set({
              totalJadi: x
            }), "gr")}
                </div>
                <div>
                  <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginBottom: 4
            }}>
                    Jumlah Cup / Porsi
                  </div>
                  {numIn(v.jumlahCup, x => set({
              jumlahCup: x
            }), "porsi")}
                </div>
              </div>
              <div>
                <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
                  Sisa Sambal (gr)
                </div>
                {numIn(v.sisaSambal, x => set({
            sisaSambal: x
          }), "gr")}
                <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            marginTop: 4
          }}>
                  Masukkan jumlah asli yang didapat. Sisa dipantau untuk menilai
                  efisiensi &amp; akurasi packing ke cup.
                </div>
              </div>
              {Number(v.jumlahCup) > 0 && hasil.targetCup > 0 && <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${T.line}`,
          ...FI,
          fontSize: 12
        }}>
                  Target {hasil.targetCup} cup · Tercapai <b>{v.jumlahCup}</b>{" "}
                  cup ·{" "}
                  <span style={{
            color: Number(v.jumlahCup) >= hasil.targetCup ? T.good : T.warn,
            fontWeight: 700
          }}>
                    {Number(v.jumlahCup) >= hasil.targetCup ? "Sesuai target" : `Kurang ${hasil.targetCup - Number(v.jumlahCup)} cup`}
                  </span>
                </div>}
            </div>}
        </>}
    </div>;
}

// Lengkap jika: cabe valid, anchor tersedia, kedua foto ada, dan hasil aktual terisi.
function ciprekComplete(v, storeId, ciprekConfig) {
  if (!v) return false;
  const h = hitungCiprekApp(v.jumlahCabe, ciprekConfig?.[storeId]?.anchors || {});
  if (!h.valid || h.anchorBelumAda) return false;
  return !!(v.fotoTimbangan && v.fotoCup && v.totalJadi !== "" && v.totalJadi != null && v.jumlahCup !== "" && v.jumlahCup != null && v.sisaSambal !== "" && v.sisaSambal != null);
}

// Payload tersimpan untuk satu sesi ciprek.
function ciprekPayload(v, storeId, ciprekConfig) {
  const h = hitungCiprekApp(v.jumlahCabe, ciprekConfig?.[storeId]?.anchors || {});
  return {
    jumlahCabe: Number(v.jumlahCabe) || 0,
    targetCup: h.targetCup,
    bahan: h.rows.map(r => ({
      bahanId: r.bahanId,
      nama: r.nama,
      qty: r.qty
    })),
    fotoTimbangan: v.fotoTimbangan,
    fotoCup: v.fotoCup,
    totalJadi: Number(v.totalJadi) || 0,
    jumlahCup: Number(v.jumlahCup) || 0,
    sisaSambal: Number(v.sisaSambal) || 0
  };
}
const _PR = [["AYM01ORI", "Dada Original", 12000, 1, 3, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-KA-01-001", "PKG-PL-01-003"]], ["AYM02ORI", "Paha Atas Original", 12000, 1, 3, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-KA-01-001", "PKG-PL-01-003"]], ["AYM03ORI", "Paha Bawah Original", 9000, 1, 3, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-KA-01-001", "PKG-PL-01-003"]], ["AYM04ORI", "Sayap Original", 8000, 1, 3, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-KA-01-001", "PKG-PL-01-003"]], ["AYM05ORI", "Kulit Original", 10000, 1, 3, ["AYM-KU-01-004", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-003", "PKG-ST-01-008", "PKG-PL-01-003"]], ["KTP01ORI", "King Top Original", 70000, 1, 1, ["AYM-AY-01-001", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-012", "PKG-KE-01-004", "PKG-PL-01-002"]], ["KTP02HOT", "King Top Sauce Hot", 78000, 1, 1, ["AYM-AY-01-001", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "SAU-SA-01-004", "PKG-DU-01-012", "PKG-CU-01-013", "PKG-KE-01-004", "PKG-PL-01-002"]], ["KTP03HOT", "King Top Spicy", 78000, 1, 1, ["AYM-AY-01-001", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-004", "SAU-BU-01-008", "PKG-DU-01-012", "PKG-CU-01-013", "PKG-KE-01-004", "PKG-PL-01-002"]], ["AYM06HOT", "Hotwing", 15000, 1, 3, ["AYM-HO-01-003", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM07MOZ", "Moza Hot Dada", 17500, 1, 1, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "DAI-KE-01-002", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM08MOZ", "Moza Hot Paha Atas", 17500, 1, 1, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "DAI-KE-01-002", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM09MOZ", "Moza Hot Paha Bawah", 0, 0, 1, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "DAI-KE-01-002", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM10MOZ", "Moza Hot Sayap", 0, 0, 1, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "DAI-KE-01-002", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM11HOT", "Dada Pedas", 15000, 1, 3, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM12HOT", "Paha Atas Pedas", 15000, 1, 3, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM13HOT", "Paha Bawah Pedas", 13000, 1, 3, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM14HOT", "Sayap Pedas", 12000, 1, 3, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "SAU-SA-01-006", "PKG-DU-01-011", "PKG-PL-01-003"]], ["AYM15CIP", "Ciprek Dada", 16000, 1, 3, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "PKG-DU-01-011", "PKG-PL-01-003", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["AYM16CIP", "Ciprek Paha Atas", 16000, 1, 3, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "PKG-DU-01-011", "PKG-PL-01-003", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["AYM17CIP", "Ciprek Paha Bawah", 13000, 1, 3, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "PKG-DU-01-011", "PKG-PL-01-003", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["AYM18CIP", "Ciprek Sayap", 12000, 1, 3, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "PKG-DU-01-011", "PKG-PL-01-003", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["SDS01NAS", "Nasi", 5000, 1, 3, ["DRY-BE-01-003", "PKG-KE-01-004"]], ["SDS02KEN", "Kentang", 7000, 1, 3, ["DRY-KE-01-002", "OIL-MI-01-003", "SAU-SA-01-003", "PKG-KE-01-006", "DRY-GA-01-006"]], ["SDS03SPA", "Spaghetti", 10000, 1, 3, ["DRY-SP-01-004", "PKG-PL-01-003", "PKG-MI-01-018", "PKG-PL-01-019", "DSP-GA-01-001"]], ["BGR01ORI", "Top Burger", 11000, 1, 1, ["BAK-RO-01-001", "PRC-DA-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002", "PKG-KE-01-005"]], ["BGR02CHE", "Top Cheese Burger", 14000, 1, 1, ["BAK-RO-01-001", "PRC-DA-01-002", "DAI-KE-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002", "PKG-DU-01-010", "PKG-KE-01-005"]], ["BGR03BIG", "Top Big Burger", 16000, 1, 1, ["BAK-RO-01-001", "PRC-DA-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002", "PKG-DU-01-010", "PKG-KE-01-005"]], ["BGR04BC", "Top Big Cheese Burger", 18000, 1, 1, ["BAK-RO-01-001", "PRC-DA-01-002", "DAI-KE-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002", "PKG-DU-01-010", "PKG-KE-01-005"]], ["BGR05TIN", "Mini Burger", 10000, 1, 2, ["BAK-RO-01-004", "PRC-DA-01-005", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-KE-01-005", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "OIL-ME-01-002"]], ["BGR06TS", "Topsiz", 9000, 1, 1, ["OIL-MI-01-001", "BAK-RO-01-002", "PRC-SO-01-003", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-KE-01-005", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002"]], ["DRK01MIL", "Milo", 6000, 1, 1, ["BEV-MI-01-001", "PKG-PL-01-003", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["DRK02NES", "Nestle Orange", 5000, 1, 1, ["BEV-NE-01-002", "PKG-PL-01-003", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["DRK03LEM", "Lemon Tea", 5000, 1, 1, ["BEV-LE-01-003", "PKG-PL-01-003", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["DRK04ICE", "Ice Cream", 5000, 1, 1, ["DES-IC-01-001", "DES-CU-01-002"]], ["PKG01SW", "Top 1 (Sayap)", 12000, 1, 3, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002"]], ["PKG02PB", "Top 2 (Paha Bawah)", 13000, 1, 3, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002"]], ["PKG03DD", "Top 3 (Dada)", 16000, 1, 3, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002"]], ["PKG04PA", "Top 3 (Paha Atas)", 16000, 1, 3, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002"]], ["PKG05SSW", "Super Top 1 (Sayap)", 17000, 1, 1, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "BEV-NE-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG06SPB", "Super Top 2 (Paha Bawah)", 18000, 1, 1, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "BEV-NE-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG07SDD", "Super Top 3 (Dada)", 21000, 1, 1, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "BEV-NE-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG08SPA", "Super Top 3 (Paha Atas)", 21000, 1, 1, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "BEV-NE-01-002", "SAU-SA-01-002", "SAU-SA-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG09SUP", "Super Top 4 (TopZis & Kentang)", 19000, 1, 1, ["OIL-MI-01-001", "BAK-RO-01-002", "PRC-SO-01-003", "DRY-KE-01-002", "BEV-NE-01-002", "SAU-SA-01-003", "SAU-SA-01-002", "SAU-MA-01-001", "PKG-KE-01-005", "PKG-KE-01-006", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "DRY-GA-01-006", "OIL-ME-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG10SUP", "Super Top 5 (BigBurger)", 21000, 1, 1, ["BAK-RO-01-001", "PRC-DA-01-002", "BEV-NE-01-002", "DAI-KE-01-001", "SAU-SA-01-002", "SAU-SA-01-003", "SAU-MA-01-001", "PKG-DU-01-010", "PKG-KE-01-005", "PKG-PL-01-003", "FRS-TO-01-002", "FRS-TI-01-003", "FRS-SE-01-004", "OIL-ME-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG11SUP", "Super Top 6 (HotWings)", 21000, 1, 1, ["AYM-HO-01-003", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "BEV-NE-01-002", "SAU-SA-01-006", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "PKG-GE-01-015", "PKG-SE-01-017", "PKG-LI-01-014"]], ["PKG12DD", "Ciprek 1 (Dada)", 21500, 1, 3, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["PKG13PA", "Ciprek 2 (Paha Atas)", 21500, 1, 3, ["AYM-PA-01-005", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003"]], ["PKG14PB", "Ciprek 3 (Paha Bawah)", 18500, 1, 1, ["AYM-PB-01-006", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003", "BEV-AI-01-004"]], ["PKG15SW", "Ciprek 4 (Sayap)", 17500, 1, 1, ["AYM-SW-01-007", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-BE-01-003", "PKG-DU-01-009", "PKG-KE-01-004", "PKG-PL-01-002", "FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003", "BEV-AI-01-004"]], ["STK01BS", "Beef Steak", 0, 0, 1, ["PRC-DA-01-002", "DRY-KE-01-002", "DRY-GA-01-006", "OIL-MI-01-003", "PKG-DU-01-011", "PKG-PL-01-019", "PKG-PL-01-003", "SAU-SA-01-007"]], ["STK02CS", "Chicken Steak", 0, 0, 1, ["AYM-DD-01-008", "DRY-TE-01-001", "OIL-MI-01-001", "DRY-KE-01-002", "DRY-GA-01-006", "OIL-MI-01-003", "PKG-DU-01-011", "PKG-PL-01-019", "PKG-PL-01-003", "SAU-SA-01-008"]], ["SDS04HOT", "Sambal Ciprek", 5000, 1, 3, ["FRS-CA-01-001", "FRS-BA-01-005", "DRY-GU-01-005", "DRY-GA-01-006", "DRY-SA-01-007", "OIL-MI-01-003", "PKG-CU-01-013"]], ["SDS05HOT", "Saos Hotwing", 4000, 1, 3, ["SAU-SA-01-006", "PKG-CU-01-013"]], ["DRK05MIN", "Air Mineral", 4000, 1, 1, ["BEV-AI-01-004"]], ["DRK06PUC", "Teh Pucuk", 4000, 1, 1, ["BEV-TE-01-005"]], ["EXT01TOM", "Extra Saus Tomat Sachet", 1000, 1, 3, ["SAU-SA-01-002"]], ["EXT02CAB", "Extra Saus Cabe Sachet", 1000, 1, 3, ["SAU-SA-01-003"]], ["EXT03DUS", "Extra Dus Nasi/Express", 2000, 1, 3, ["PKG-DU-01-009"]]];
const OUTLET_MAP = {
  1: ["resto"],
  2: ["express"],
  3: ["resto", "express"]
};
const PRODUCTS = _PR.map(([kode, name, price, aktif, outlet, bom]) => ({
  id: kode.toLowerCase(),
  kode,
  name,
  price,
  aktif: !!aktif,
  jenisToko: OUTLET_MAP[outlet],
  resep: bom.map(s => s.toLowerCase().replace(/-/g, "_"))
}));

// Produk yang dijual di toko tsb (menurut jenis tokonya).
function produkTokoIni(storeId) {
  const jenis = STORES.find(s => s.id === storeId)?.jenisToko || "resto";
  return PRODUCTS.filter(p => !p.jenisToko || p.jenisToko.includes(jenis));
}

// Bahan baku yang ada di inventory toko — diturunkan dari BOM produk yang dijual di sana.
// Bahan yang belum dipakai BOM manapun tetap ditampilkan agar stok pendukung tidak hilang.
function bahanTokoIni(storeId) {
  const jenis = STORES.find(s => s.id === storeId)?.jenisToko || "resto";
  const dipakai = new Set(PRODUCTS.filter(p => !p.jenisToko || p.jenisToko.includes(jenis)).flatMap(p => p.resep || []));
  const semuaBerBom = new Set(PRODUCTS.flatMap(p => p.resep || []));
  return BAHAN_BAKU.filter(b => dipakai.has(b.id) || !semuaBerBom.has(b.id));
}
const _BB = [["AYM-AY-01-001", "Ayam Utuh (ekor)"], ["AYM-AY-01-002", "Ayam Original (pack)"], ["AYM-HO-01-003", "Hotwings (porsi)"], ["AYM-KU-01-004", "Kulit Ayam (porsi)"], ["AYM-PA-01-005", "PA (Paha Atas) (ptg)"], ["AYM-PB-01-006", "PB (Paha Bawah) (ptg)"], ["AYM-SW-01-007", "SW (Sayap) (ptg)"], ["AYM-DD-01-008", "DD (Dada) (ptg)"], ["PRC-CH-01-001", "Chicken Patty (pcs)"], ["PRC-DA-01-002", "Daging Patty (pcs)"], ["PRC-SO-01-003", "Sosis Hotsis (pcs)"], ["PRC-DA-01-005", "Daging Patty Mini (pcs)"], ["DRY-TE-01-001", "Tepung Bumbu (gr)"], ["DRY-KE-01-002", "Kentang (gr)"], ["DRY-BE-01-003", "Beras (gr)"], ["DRY-SP-01-004", "Spaghetty (pcs)"], ["DRY-GU-01-005", "Gula Pasir (gr)"], ["DRY-GA-01-006", "Garam (gr)"], ["DRY-SA-01-007", "Sasa (gr)"], ["OIL-MI-01-001", "Minyak Goreng (gr)"], ["OIL-ME-01-002", "Mentega (gr)"], ["OIL-MI-01-003", "Minyak Goreng 1lt (ml)"], ["BAK-RO-01-001", "Roti Burger (pcs)"], ["BAK-RO-01-002", "Roti Hotsis (pcs)"], ["BAK-RO-01-004", "Roti Mini (pcs)"], ["DAI-KE-01-001", "Keju Slice (pcs)"], ["DAI-KE-01-002", "Keju Mozarella (gr)"], ["BEV-MI-01-001", "Milo (gr)"], ["BEV-NE-01-002", "Nestle Orange (gr)"], ["BEV-LE-01-003", "Lemon Tea (gr)"], ["BEV-AI-01-004", "Air Mineral (pcs)"], ["BEV-TE-01-005", "Teh Pucuk (pcs)"], ["SAU-MA-01-001", "Mayonaise (gr)"], ["SAU-SA-01-002", "Saus Tomat Sachet (pcs)"], ["SAU-SA-01-003", "Saus Cabe Sachet (pcs)"], ["SAU-SA-01-004", "Saus Keju (gr)"], ["SAU-SA-01-006", "Saus Hotwings (gr)"], ["SAU-SA-01-007", "Saus Beef Steak (pcs)"], ["SAU-SA-01-008", "Saus Chicken Steak (pcs)"], ["SAU-BU-01-008", "Bubuk Cabe (gr)"], ["FRS-CA-01-001", "Cabe (gr)"], ["FRS-TO-01-002", "Tomat (gr)"], ["FRS-TI-01-003", "Timun (gr)"], ["FRS-SE-01-004", "Selada (gr)"], ["FRS-BA-01-005", "Bawang Putih (gr)"], ["DES-IC-01-001", "Ice Cream (ml)"], ["DES-CU-01-002", "Cup Cone (pcs)"], ["PKG-KA-01-001", "Kantong Kertas (pcs)"], ["PKG-PL-01-002", "Plastik Besar (pcs)"], ["PKG-PL-01-003", "Plastik Kecil (pcs)"], ["PKG-KE-01-004", "Kertas Nasi (pcs)"], ["PKG-KE-01-005", "Kertas Burger (pcs)"], ["PKG-KE-01-006", "Kertas Kentang (pcs)"], ["PKG-KE-01-007", "Kertas Termal (pcs)"], ["PKG-ST-01-008", "Standing Pouch (pcs)"], ["PKG-DU-01-009", "Dus Nasi (pcs)"], ["PKG-DU-01-010", "Dus Burger (pcs)"], ["PKG-DU-01-011", "Dus Hotwing (pcs)"], ["PKG-DU-01-012", "Dus King (pcs)"], ["PKG-CU-01-013", "Cup Saos (pcs)"], ["PKG-LI-01-014", "Lid Cup (pcs)"], ["PKG-GE-01-015", "Gelas Cup (pcs)"], ["PKG-TU-01-016", "Tutup Gelas (pcs)"], ["PKG-SE-01-017", "Sedotan (pcs)"], ["PKG-MI-01-018", "Mika (pcs)"], ["PKG-PL-01-019", "Plastik A. Panas (pcs)"], ["PKG-PL-01-020", "Plastik Sampah (pcs)"], ["PKG-PL-01-021", "Plastik Jumbo (pcs)"], ["PKG-PL-01-022", "Plastik Clip (pcs)"], ["CLN-PE-01-001", "Pencuci Piring (pcs)"], ["CLN-DE-01-002", "Deterjen (pcs)"], ["CLN-HA-01-003", "Hand Soap (pack)"], ["CLN-PE-01-004", "Pembersih Kaca (pack)"], ["CLN-PE-01-005", "Pembersih Lantai (pack)"], ["DSP-GA-01-001", "Garpu (pcs)"], ["DSP-HA-01-002", "Hand Gloves (pcs)"], ["DSP-TI-01-003", "Tissue (pcs)"]];
const BAHAN_BAKU = _BB.map(([sku, name]) => ({
  id: sku.toLowerCase().replace(/-/g, "_"),
  sku,
  name
}));
const STAGES = [{
  key: "opening",
  label: "Opening",
  approval: false,
  shift: "1"
}, {
  key: "base_prep",
  label: "Base Preparation",
  approval: false,
  shift: "1"
}, {
  key: "etalase_0700",
  label: "Etalase 07:00",
  approval: false,
  time: "07:00",
  shift: "1"
}, {
  key: "etalase_1100",
  label: "Etalase 11:00",
  approval: false,
  time: "11:00",
  shift: "1"
}, {
  key: "sales_shift1",
  label: "Sales Shift 1",
  approval: false,
  shift: "1"
}, {
  key: "produksi_shift1",
  label: "Produksi Shift 1",
  approval: false,
  shift: "1"
}, {
  key: "etalase_1700",
  label: "Etalase 17:00",
  approval: false,
  time: "17:00",
  shift: "2"
}, {
  key: "base_prep_2",
  label: "Base Preparation 2",
  approval: false,
  shift: "2"
}, {
  key: "etalase_2000",
  label: "Etalase 20:00",
  approval: true,
  time: "20:00",
  shift: "2"
}, {
  key: "sales_shift2",
  label: "Sales Shift 2",
  approval: false,
  shift: "2"
}, {
  key: "produksi_shift2",
  label: "Produksi Shift 2",
  approval: false,
  shift: "2"
}, {
  key: "stok",
  label: "Stok Bahan Baku",
  approval: true,
  shift: "2"
}, {
  key: "closing",
  label: "Closing",
  approval: false,
  shift: "2"
}];
function requiredStagesForShift(shift) {
  if (shift === "1") return STAGES.filter(s => s.shift === "1").map(s => s.key);
  if (shift === "2") return STAGES.filter(s => s.shift === "2").map(s => s.key);
  return STAGES.map(s => s.key); // longshift / backup: tanggung jawab satu hari penuh
}

// Jam checkpoint etalase berikutnya setelah stage tertentu — dipakai sebagai batas waktu (deadline) laporan.
function nextEtalaseTime(stageKey) {
  const idx = STAGES.findIndex(s => s.key === stageKey);
  for (let i = idx + 1; i < STAGES.length; i++) {
    if (STAGES[i].key.startsWith("etalase") && STAGES[i].time) return STAGES[i].time;
  }
  return null;
}

// Laporan etalase yang belum diisi & sudah lewat jam checkpoint berikutnya dianggap terkunci (dianggap 0, tidak bisa diisi lagi).
function isEtalaseExpired(stage, now) {
  if (!stage.key.startsWith("etalase") || !stage.time) return false;
  const deadline = nextEtalaseTime(stage.key);
  if (!deadline) return false;
  return minutesOfDate(now) >= minutesOf(deadline);
}
function rupiah(n) {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}
function PhotoSlot({
  label,
  value,
  onChange
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (!file.type.startsWith('image/')) {
      setError("Pilih file foto yang didukung.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      const thumb = await captureToThumb(file);
      await onChange(thumb);
    } catch (e) {
      setError(e.message || "Foto belum berhasil dimuat.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return <div className="photo-slot"><button type="button" className={`photo-slot-button ${value ? 'has-photo' : ''}`} disabled={busy} onClick={() => fileRef.current?.click()}>{value ? <img src={value} alt={label} /> : <span className="photo-slot-glyph"><Camera size={23} /></span>}<span><strong>{busy ? 'Memuat foto…' : value ? 'Foto terlampir' : label}</strong><small>{value ? 'Ketuk untuk mengganti foto' : 'Ambil foto atau pilih dari perangkat'}</small></span><Plus size={16} /></button><input ref={fileRef} type="file" aria-label={`Unggah ${label}`} accept="image/*" capture="environment" onChange={handleFile} style={{
      display: 'none'
    }} />{error && <p className="capture-error" role="alert">{error}</p>}</div>;
}
function ToggleItem({
  label,
  value,
  onChange,
  options
}) {
  return <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid ${T.line}`
  }}>
      <span style={{
      ...FI,
      fontSize: 13,
      fontWeight: 500,
      color: T.ink
    }}>
        {label}
      </span>
      <div style={{
      display: "flex",
      gap: 4
    }} className="ais-flex-layout">
        {options.map(o => <button key={o.value} onClick={() => onChange(o.value)} style={{
        border: "none",
        borderRadius: 8,
        padding: "5px 10px",
        ...FI,
        fontWeight: 600,
        fontSize: 11.5,
        cursor: "pointer",
        background: value === o.value ? T.accentSoft : T.surfaceSunk,
        color: value === o.value ? T.accentDeep : T.inkMuted
      }} className="ais-button ais-button--default" aria-pressed={value === o.value}>
            {o.label}
          </button>)}
      </div>
    </div>;
}
function SubmitBtn({
  label = "Submit Laporan",
  disabled,
  onClick
}) {
  return <button disabled={disabled} onClick={onClick} style={{
    width: "100%",
    marginTop: 14,
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontFamily: "Manrope",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? T.line : T.accent,
    color: disabled ? T.inkMuted : "#fff"
  }} className="ais-button ais-button--primary">
      {label}
    </button>;
}

/* ---- Opening / Closing checklist form ---- */
function ChecklistForm({
  mode,
  onSubmit
}) {
  const [photos, setPhotos] = useState({});
  const [toggles, setToggles] = useState({});
  const toggleDefs = mode === "opening" ? OPENING_TOGGLES : CLOSING_TOGGLES;
  const complete = AREA_FOTO.every(a => photos[a]) && toggleDefs.every(t => toggles[t.key]);
  return <FormSurface title="Siapkan toko. Satu langkah lagi." subtitle="Periksa setiap area dan lengkapi bukti kondisi toko." code="CHECKLIST"><div>
      <SectionLabel>
        Foto Kondisi Area{" "}
        {mode === "opening" ? "Pagi" : "Malam (Setelah Cleaning)"}
      </SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        marginBottom: 16
      }} className="ais-responsive-grid">
        {AREA_FOTO.map(a => <PhotoSlot key={a} label={a} value={photos[a]} onChange={v => setPhotos({
          ...photos,
          [a]: v
        })} />)}
      </div>
      <SectionLabel>Checklist Tambahan</SectionLabel>
      {toggleDefs.map(t => <ToggleItem key={t.key} label={t.label} value={toggles[t.key]} options={t.options} onChange={v => setToggles({
        ...toggles,
        [t.key]: v
      })} />)}
      <SubmitBtn disabled={!complete} onClick={() => onSubmit({
        photos,
        toggles
      })} />
      {!complete && <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginTop: 8
      }}>
          Lengkapi semua foto & checklist untuk submit.
        </div>}
    </div></FormSurface>;
}

/* ---- Etalase form (07:00 / 11:00 / 17:00 / 20:00) ---- */
function EtalaseForm({
  timeKey,
  onSubmit
}) {
  const [photo, setPhoto] = useState(null);
  const [stok, setStok] = useState("");
  const [note, setNote] = useState("");
  const [ajukan, setAjukan] = useState("tidak");
  const [qtyGoreng, setQtyGoreng] = useState("");
  const isEvening = timeKey === "20:00";
  const complete = photo && stok !== "" && (!isEvening || ajukan === "tidak" || ajukan === "ya" && qtyGoreng !== "");
  return <FormSurface title="Kondisi etalase." subtitle="Catat kondisi dan jumlah aktual pada sesi ini." code="DISPLAY"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 12,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <PhotoSlot label={`Etalase ${timeKey}`} value={photo} onChange={setPhoto} />
        <div>
          <SectionLabel>Jumlah Ayam Matang di Etalase</SectionLabel>
          <input type="number" value={stok} onChange={e => setStok(e.target.value)} placeholder="Jumlah potong" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FM,
            fontSize: 14,
            background: T.surfaceSunk,
            marginBottom: 8
          }} className="ais-control" />
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan (opsional)" rows={2} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "8px 10px",
            ...FI,
            fontSize: 12.5,
            background: T.surfaceSunk,
            resize: "none"
          }} className="ais-control" />
        </div>
      </div>

      {isEvening && <div style={{
        background: T.warnSoft,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 4
      }}>
          <ToggleItem label="Ajukan Instruksi Goreng Tambahan?" value={ajukan} onChange={setAjukan} options={[{
          value: "tidak",
          label: "Tidak"
        }, {
          value: "ya",
          label: "Ya"
        }]} />
          {ajukan === "ya" && <div style={{
          marginTop: 8
        }}>
              <SectionLabel>Qty yang Diajukan (potong)</SectionLabel>
              <input type="number" value={qtyGoreng} onChange={e => setQtyGoreng(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FM,
            fontSize: 14,
            background: T.surface
          }} className="ais-control" />
              <div style={{
            ...FI,
            fontSize: 11,
            color: T.warn,
            marginTop: 6
          }}>
                Akan dikirim ke Admin Utama / Manajemen untuk approval.
              </div>
            </div>}
        </div>}
      <SubmitBtn disabled={!complete} onClick={() => onSubmit({
        photo,
        stok: Number(stok),
        note,
        ajukanGoreng: isEvening && ajukan === "ya",
        qtyGoreng: Number(qtyGoreng) || 0
      })} />
    </div></FormSurface>;
}

/* ---- Base Preparation (Sambal Ciprek, Saos Hotwing, Minyak) ---- */
/* ---- Base Preparation 2 (Shift 2): Sambal Ciprek 2, Saos Hotwing 2, Top Up Minyak 2 ---- */
function BasePrep2Form({
  storeId,
  topUp1Liter,
  minyakConfig,
  ciprekConfig,
  onSubmit
}) {
  const [ciprek, setCiprek] = useState({});
  const [saosFoto, setSaosFoto] = useState(null);
  const [saosCup, setSaosCup] = useState("");
  const [adaTopUp, setAdaTopUp] = useState(null); // null = belum dipilih
  const [sebelumCm, setSebelumCm] = useState("");
  const [topUpCm, setTopUpCm] = useState("");
  const sebelumLiter = sebelumCm !== "" ? cmKeLiterFryer(sebelumCm, minyakConfig) : 0;
  const topUp2Liter = topUpCm !== "" ? cmKeLiterTopUp(topUpCm, minyakConfig) : 0;
  const sesudahLiter = sebelumLiter + topUp2Liter;
  const totalTopUp = Math.round(((topUp1Liter || 0) + (adaTopUp === "ya" ? topUp2Liter : 0)) * 100) / 100;
  const baseComplete = ciprekComplete(ciprek, storeId, ciprekConfig) && saosFoto && saosCup !== "";
  const topUpComplete = adaTopUp === "tidak" || adaTopUp === "ya" && sebelumCm !== "" && topUpCm !== "";
  const complete = baseComplete && topUpComplete;
  const submit = () => onSubmit({
    sesi: 2,
    sambelCiprek: ciprekPayload(ciprek, storeId, ciprekConfig),
    saosHotwing: {
      foto: saosFoto,
      cup: Number(saosCup)
    },
    topUpMinyak2: {
      ada: adaTopUp === "ya",
      ...(adaTopUp === "ya" ? {
        sebelumCm: Number(sebelumCm),
        sebelumLiter: Math.round(sebelumLiter * 100) / 100,
        topUpCm: Number(topUpCm),
        topUp2Liter: Math.round(topUp2Liter * 100) / 100,
        sesudahLiter: Math.round(sesudahLiter * 100) / 100
      } : {}),
      topUp1Liter: topUp1Liter || 0,
      totalTopUp
    }
  });
  const numInput = (value, onChange, placeholder) => <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
    width: "100%",
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    padding: "9px 12px",
    ...FM,
    fontSize: 14,
    background: T.surfaceSunk
  }} className="ais-control" />;
  return <FormSurface title="Persiapan berikutnya." subtitle="Lengkapi bahan dan kebutuhan proses produksi." code="PREP 02"><div>
      <SectionLabel>Sambal Ciprek 2</SectionLabel>
      <div style={{
        marginBottom: 20
      }}>
        <CiprekSection sesi={2} storeId={storeId} ciprekConfig={ciprekConfig} value={ciprek} onChange={setCiprek} />
      </div>

      <SectionLabel>Saos Hotwing 2</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 12,
        marginBottom: 20
      }} className="ais-responsive-grid">
        <PhotoSlot label="Foto Saos" value={saosFoto} onChange={setSaosFoto} />
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Jumlah (cup)
          </div>
          {numInput(saosCup, setSaosCup, "Jumlah cup")}
        </div>
      </div>

      <SectionLabel>Top Up Minyak 2</SectionLabel>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 8
      }}>
        Apakah ada top up minyak kedua hari ini?
      </div>
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16
      }} className="ais-flex-layout">
        {[{
          v: "ya",
          l: "Ada Top Up"
        }, {
          v: "tidak",
          l: "Tidak Ada"
        }].map(o => <button key={o.v} onClick={() => setAdaTopUp(o.v)} style={{
          flex: 1,
          padding: "11px 10px",
          borderRadius: 12,
          cursor: "pointer",
          border: adaTopUp === o.v ? `1px solid ${T.accent}` : `1px solid ${T.line}`,
          background: adaTopUp === o.v ? T.accentSoft : T.surface,
          color: adaTopUp === o.v ? T.accentDeep : T.inkMuted,
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13
        }} className="ais-button ais-button--default" aria-pressed={adaTopUp === o.v}>
            {o.l}
          </button>)}
      </div>

      {adaTopUp === "ya" && <div style={{
        background: T.surfaceSunk,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16
      }} className="ais-content-panel">
          <div style={{
          marginBottom: 12
        }}>
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
              Minyak Fryer Sebelum Top Up (cm)
            </div>
            {numInput(sebelumCm, setSebelumCm, "cm")}
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 4
          }}>
              = (cm × {(minyakConfig || MINYAK_CONFIG_DEFAULT).literPerCm}) +{" "}
              {(minyakConfig || MINYAK_CONFIG_DEFAULT).konstanta} ={" "}
              <b style={{
              color: T.ink
            }}>{sebelumLiter.toFixed(2)}</b> L (auto
              calculated)
            </div>
          </div>

          <div style={{
          marginBottom: 12
        }}>
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
              Top Up 2 (cm)
            </div>
            {numInput(topUpCm, setTopUpCm, "cm")}
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginTop: 4
          }}>
              = cm × {(minyakConfig || MINYAK_CONFIG_DEFAULT).literPerCm} ={" "}
              <b style={{
              color: T.ink
            }}>{topUp2Liter.toFixed(2)}</b> L (auto
              calculated)
            </div>
          </div>

          <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          lineHeight: 1.9,
          borderTop: `1px solid ${T.line}`,
          paddingTop: 10
        }}>
            Minyak Fryer Setelah Top Up:{" "}
            <b style={{
            color: T.ink
          }}>{sesudahLiter.toFixed(2)}</b> L
          </div>
        </div>}

      {adaTopUp && <div style={{
        background: T.accentSoft,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 4
      }}>
          <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.accentDeep,
          lineHeight: 1.9
        }}>
            Top Up 1 (Base Prep pagi): <b>{(topUp1Liter || 0).toFixed(2)}</b> L
            <br />
            Top Up 2: <b>
              {(adaTopUp === "ya" ? topUp2Liter : 0).toFixed(2)}
            </b>{" "}
            L<br />
            <span style={{
            fontWeight: 700,
            fontSize: 13.5
          }}>
              Total Top Up: {totalTopUp.toFixed(2)} L
            </span>
          </div>
          <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          marginTop: 6
        }}>
            Total Top Up otomatis mengisi kolom "Pakai" Minyak Goreng di Stok
            Bahan Baku.
          </div>
        </div>}

      <SubmitBtn disabled={!complete} onClick={submit} />
    </div></FormSurface>;
}
function BasePrepForm({
  storeId,
  ds,
  reportLog,
  stockTransfers,
  stockOpname,
  minyakConfig,
  ciprekConfig,
  onSubmit
}) {
  const [ciprek, setCiprek] = useState({});
  const [saosFoto, setSaosFoto] = useState(null);
  const [saosCup, setSaosCup] = useState("");
  const autoMinyakBeku = computeStokAwalAuto(storeId, "oil_mi_01_001", ds, reportLog, stockTransfers, stockOpname);
  const [minyakBekuKg, setMinyakBekuKg] = useState(autoMinyakBeku != null ? String(autoMinyakBeku) : "");
  const [minyakDatangKg, setMinyakDatangKg] = useState("");
  const [minyakFryerCm, setMinyakFryerCm] = useState("");
  const [topUp1Cm, setTopUp1Cm] = useState("");
  const totalMinyakBekuKg = (Number(minyakBekuKg) || 0) + (Number(minyakDatangKg) || 0);
  const literMinyakFryer = minyakFryerCm !== "" ? cmKeLiterFryer(minyakFryerCm, minyakConfig) : 0;
  const totalStokAwalMinyak = totalMinyakBekuKg + literMinyakFryer;
  const topUp1Liter = topUp1Cm !== "" ? cmKeLiterTopUp(topUp1Cm, minyakConfig) : 0;
  const complete = ciprekComplete(ciprek, storeId, ciprekConfig) && saosFoto && saosCup !== "" && minyakBekuKg !== "" && minyakFryerCm !== "";
  const submit = () => onSubmit({
    sambelCiprek: ciprekPayload(ciprek, storeId, ciprekConfig),
    saosHotwing: {
      foto: saosFoto,
      cup: Number(saosCup)
    },
    minyak: {
      minyakBekuKg: Number(minyakBekuKg) || 0,
      minyakDatangKg: Number(minyakDatangKg) || 0,
      totalMinyakBekuKg,
      minyakFryerCm: Number(minyakFryerCm) || 0,
      literMinyakFryer: Math.round(literMinyakFryer * 100) / 100,
      totalStokAwalMinyak: Math.round(totalStokAwalMinyak * 100) / 100,
      topUp1Cm: Number(topUp1Cm) || 0,
      topUp1Liter: Math.round(topUp1Liter * 100) / 100
    }
  });
  return <FormSurface title="Awali dari persiapan." subtitle="Isi jumlah aktual dan kebutuhan bahan hari ini." code="PREP 01"><div>
      <SectionLabel>Sambal Ciprek</SectionLabel>
      <div style={{
        marginBottom: 20
      }}>
        <CiprekSection sesi={1} storeId={storeId} ciprekConfig={ciprekConfig} value={ciprek} onChange={setCiprek} />
      </div>

      <SectionLabel>Saos Hotwing</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 12,
        marginBottom: 20
      }} className="ais-responsive-grid">
        <PhotoSlot label="Foto Saos" value={saosFoto} onChange={setSaosFoto} />
        <div>
          <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Jumlah (cup)
          </div>
          <input type="number" value={saosCup} onChange={e => setSaosCup(e.target.value)} placeholder="Jumlah cup" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FM,
            fontSize: 14,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
      </div>

      <SectionLabel>A. Stok Awal Minyak (Shift 1)</SectionLabel>
      <div style={{
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8
      }}>
        <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4
        }}>
          Minyak Beku (Kg)
        </div>
        {autoMinyakBeku != null && <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
            Terkunci — otomatis sinkron dari Stok Awal bahan baku Minyak Goreng.
          </div>}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 8,
          alignItems: "center",
          marginBottom: 4
        }} className="ais-responsive-grid">
          {autoMinyakBeku != null ? <div style={{
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            ...FM,
            fontSize: 13,
            fontWeight: 700,
            background: T.surfaceSunk,
            textAlign: "center"
          }} className="ais-content-panel">
              {minyakBekuKg}
            </div> : <input type="number" value={minyakBekuKg} onChange={e => setMinyakBekuKg(e.target.value)} placeholder="Kg" style={{
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            ...FM,
            fontSize: 13,
            background: T.surface
          }} className="ais-control" />}
          <span style={{
            ...FI,
            fontSize: 13,
            textAlign: "center"
          }}>+</span>
          <input type="number" value={minyakDatangKg} onChange={e => setMinyakDatangKg(e.target.value)} placeholder="Minyak datang (Kg)" style={{
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            ...FM,
            fontSize: 13
          }} className="ais-control" />
        </div>
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 10
        }}>
          = {totalMinyakBekuKg.toFixed(2)} Kg (auto calculated)
        </div>

        <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4
        }}>
          Minyak Fryer — tinggi sebelum topup, pagi hari (cm)
        </div>
        <input type="number" value={minyakFryerCm} onChange={e => setMinyakFryerCm(e.target.value)} placeholder="cm" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "8px 10px",
          ...FM,
          fontSize: 13,
          marginBottom: 4
        }} className="ais-control" />
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 10
        }}>
          = (cm × {(minyakConfig || MINYAK_CONFIG_DEFAULT).literPerCm}) +{" "}
          {(minyakConfig || MINYAK_CONFIG_DEFAULT).konstanta} ={" "}
          {literMinyakFryer.toFixed(2)} L (auto calculated)
        </div>

        <div style={{
          borderTop: `1px solid ${T.line}`,
          paddingTop: 8,
          ...FI,
          fontWeight: 700,
          fontSize: 13
        }}>
          Total Stok Awal Minyak: {totalStokAwalMinyak.toFixed(2)} Kg{" "}
          <span style={{
            fontWeight: 400,
            color: T.inkMuted,
            fontSize: 11
          }}>
            (1 Kg = 1 L)
          </span>
        </div>
      </div>

      <SectionLabel>
        B. Top Up / Penambahan Minyak — Top Up 1 (maksimum 15cm)
      </SectionLabel>
      <div style={{
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16
      }}>
        <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4
        }}>
          Penambahan Tinggi Minyak (cm)
        </div>
        <input type="number" max={15} value={topUp1Cm} onChange={e => setTopUp1Cm(e.target.value)} placeholder="cm" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "8px 10px",
          ...FM,
          fontSize: 13,
          marginBottom: 4
        }} className="ais-control" />
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted
        }}>
          = cm × {(minyakConfig || MINYAK_CONFIG_DEFAULT).literPerCm} ={" "}
          {topUp1Liter.toFixed(2)} L (auto calculated)
        </div>
      </div>

      <SubmitBtn disabled={!complete} onClick={submit} />
    </div></FormSurface>;
}
const PENGELUARAN_ITEMS = ["Gas 3 Kg", "Gas 12 Kg", "Air Galon", "Es Batu", "Alat Dapur", "Chemical", "Sayur", "Bumbu Dapur", "Sampah", "Amal", "Parkir", "Bensin", "ATK", "Foto Copy", "Ops. Karyawan"];

/* ---- Sales report form (shift 1 / 2) ---- */
function SalesForm({
  shift,
  shift1Data,
  initial,
  storeId,
  onSubmit
}) {
  const produkList = produkTokoIni(storeId);
  const [qty, setQty] = useState(initial?.qty || {});
  const [pengeluaranItems, setPengeluaranItems] = useState(initial?.pengeluaranItems || {});
  const [omsetOnline, setOmsetOnline] = useState(initial?.omsetOnline ?? "");
  const [payment, setPayment] = useState(initial?.payment || {
    cash: "",
    qris: "",
    debit: "",
    gopay: ""
  });
  const isShift2 = shift === 2;
  const omsetKotor = produkList.reduce((sum, p) => sum + (Number(qty[p.id]) || 0) * p.price, 0);
  const pengeluaran = isShift2 ? PENGELUARAN_ITEMS.reduce((sum, item) => sum + (Number(pengeluaranItems[item]) || 0), 0) : 0;
  const omsetBersih = Math.max(0, omsetKotor - (Number(omsetOnline) || 0) - pengeluaran);
  const complete = produkList.some(p => Number(qty[p.id]) > 0);
  return <FormSurface title="Penjualan shift." subtitle="Lengkapi penjualan shift dengan angka yang sudah diperiksa." code="SALES"><div>
      <SectionLabel>1. Produk Terjual — Shift {shift}</SectionLabel>
      {produkList.map(p => <div key={p.id} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: `1px solid ${T.line}`
      }}>
          <div style={{
          ...FI,
          fontSize: 13
        }}>
            {p.name}{" "}
            <span style={{
            color: T.inkMuted,
            fontSize: 11.5
          }}>
              ({rupiah(p.price)})
            </span>
          </div>
          <input type="number" min="0" value={qty[p.id] || ""} onChange={e => setQty({
          ...qty,
          [p.id]: e.target.value
        })} style={{
          width: 70,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          ...FM,
          fontSize: 13,
          textAlign: "right"
        }} className="ais-control" />
        </div>)}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0 18px",
        ...FI,
        fontWeight: 700,
        fontSize: 14
      }}>
        <span>Omset Kotor (auto)</span>
        <span style={{
          fontFamily: "JetBrains Mono"
        }}>
          {rupiah(omsetKotor)}
        </span>
      </div>

      {isShift2 && <div>
          <SectionLabel>2. Pengeluaran Harian (Shift 1 & 2)</SectionLabel>
          {PENGELUARAN_ITEMS.map(item => <div key={item} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 0",
          borderBottom: `1px solid ${T.line}`
        }}>
              <div style={{
            ...FI,
            fontSize: 12.5
          }}>{item}</div>
              <input type="number" min="0" placeholder="Rp" value={pengeluaranItems[item] || ""} onChange={e => setPengeluaranItems({
            ...pengeluaranItems,
            [item]: e.target.value
          })} style={{
            width: 90,
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "6px 8px",
            ...FM,
            fontSize: 12.5,
            textAlign: "right"
          }} className="ais-control" />
            </div>)}
          <div style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 0 18px",
          ...FI,
          fontWeight: 700,
          fontSize: 14
        }}>
            <span>Total Pengeluaran (auto)</span>
            <span style={{
            fontFamily: "JetBrains Mono"
          }}>
              {rupiah(pengeluaran)}
            </span>
          </div>
        </div>}

      <SectionLabel>{isShift2 ? "3" : "2"}. Pembayaran</SectionLabel>
      <div style={{
        marginBottom: 8
      }}>
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
          Omset Penjualan Online
        </div>
        <input type="number" value={omsetOnline} onChange={e => setOmsetOnline(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "8px 10px",
          ...FM,
          fontSize: 13
        }} className="ais-control" />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 10
      }} className="ais-responsive-grid">
        {["cash", "qris", "debit", "gopay"].map(k => <div key={k}>
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4,
            textTransform: "capitalize"
          }}>
              {k}
            </div>
            <input type="number" value={payment[k]} onChange={e => setPayment({
            ...payment,
            [k]: e.target.value
          })} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 8px",
            ...FM,
            fontSize: 12.5
          }} className="ais-control" />
          </div>)}
      </div>

      <div style={{
        background: T.goodSoft,
        borderRadius: 12,
        padding: "12px 14px"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          ...FI,
          fontWeight: 700,
          fontSize: 14,
          color: T.good
        }}>
          <span>Omset Bersih (Cash)</span>
          <span style={{
            fontFamily: "JetBrains Mono"
          }}>
            {rupiah(omsetBersih)}
          </span>
        </div>
        {isShift2 && shift1Data && <div style={{
          display: "flex",
          justifyContent: "space-between",
          ...FI,
          fontWeight: 700,
          fontSize: 14,
          color: T.good,
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px solid ${T.good}33`
        }}>
            <span>Omset Bersih Full Day</span>
            <span style={{
            fontFamily: "JetBrains Mono"
          }}>
              {rupiah(omsetBersih + (shift1Data.omsetBersih || 0))}
            </span>
          </div>}
      </div>

      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginTop: 8
      }}>
        {initial ? "Perubahan akan tercatat sebagai penyesuaian (edited) dan tetap terlihat oleh semua yang berwenang." : "Laporan sales tidak memerlukan approval — jika ada kesalahan, Admin Utama (Eri) dapat mengedit langsung."}
      </div>
      <SubmitBtn label={initial ? "Simpan Penyesuaian" : "Submit Laporan"} disabled={!complete} onClick={() => onSubmit({
        qty,
        pengeluaranItems,
        pengeluaran,
        omsetOnline: Number(omsetOnline) || 0,
        payment,
        omsetKotor,
        omsetBersih
      })} />
    </div></FormSurface>;
}

/* ---- Produksi form ---- */
function ProduksiForm({
  shift,
  totalMinyakBekuKg,
  totalTopUp,
  minyakConfig,
  onSubmit
}) {
  const [batch, setBatch] = useState("");
  const [sisaDada, setSisaDada] = useState("");
  const [sisaPahaAtas, setSisaPahaAtas] = useState("");
  const [sisaPahaBawah, setSisaPahaBawah] = useState("");
  const [sisaSayap, setSisaSayap] = useState("");
  const [sisaHotwing, setSisaHotwing] = useState("");
  const [sisaKulit, setSisaKulit] = useState("");
  const [sisaCiprek, setSisaCiprek] = useState("");
  const [sisaSaosHotwing, setSisaSaosHotwing] = useState("");
  const [catatan, setCatatan] = useState("");
  const [minyakFryerAkhirCm, setMinyakFryerAkhirCm] = useState("");
  const [tangkaiCabe, setTangkaiCabe] = useState(""); // gr, hanya Shift 2 (dipakai Waste Calculation)

  const isShift2 = shift === 2;
  const minyakBekuAkhir = isShift2 ? Math.max((totalMinyakBekuKg || 0) - (totalTopUp || 0), 0) : null;
  const literMinyakFryerAkhir = isShift2 && minyakFryerAkhirCm !== "" ? cmKeLiterFryer(minyakFryerAkhirCm, minyakConfig) : 0;
  const totalStokAkhirMinyak = isShift2 ? minyakBekuAkhir + literMinyakFryerAkhir : null;
  const sisaAyamTotal = (Number(sisaDada) || 0) + (Number(sisaPahaAtas) || 0) + (Number(sisaPahaBawah) || 0) + (Number(sisaSayap) || 0);
  const complete = batch !== "" && sisaDada !== "" && sisaPahaAtas !== "" && sisaPahaBawah !== "" && sisaSayap !== "" && sisaHotwing !== "" && sisaKulit !== "" && (!isShift2 || minyakFryerAkhirCm !== "" && sisaCiprek !== "" && sisaSaosHotwing !== "" && tangkaiCabe !== "");
  const submit = () => onSubmit({
    batch: Number(batch),
    sisaAyamBreakdown: {
      dada: Number(sisaDada) || 0,
      pahaAtas: Number(sisaPahaAtas) || 0,
      pahaBawah: Number(sisaPahaBawah) || 0,
      sayap: Number(sisaSayap) || 0
    },
    sisaAyam: sisaAyamTotal,
    sisaHotwing: Number(sisaHotwing),
    sisaKulit: Number(sisaKulit),
    catatan,
    ...(isShift2 ? {
      sisaCiprekCup: Number(sisaCiprek),
      sisaSaosHotwingCup: Number(sisaSaosHotwing),
      tangkaiCabeGr: Number(tangkaiCabe) || 0
    } : {}),
    ...(isShift2 ? {
      minyakClosing: {
        minyakBekuAkhir: Math.round(minyakBekuAkhir * 100) / 100,
        minyakFryerAkhirCm: Number(minyakFryerAkhirCm) || 0,
        literMinyakFryerAkhir: Math.round(literMinyakFryerAkhir * 100) / 100,
        totalStokAkhirMinyak: Math.round(totalStokAkhirMinyak * 100) / 100
      }
    } : {})
  });
  return <FormSurface title="Produksi yang terukur." subtitle="Catat penggunaan bahan dan hasil produksi sesuai sesi." code="PRODUCTION"><div>
      <SectionLabel>Produksi — Shift {shift}</SectionLabel>
      <div style={{
        marginBottom: 10
      }}>
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
          Jumlah Batch Masak
        </div>
        <input type="number" value={batch} onChange={e => setBatch(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "9px 10px",
          ...FM,
          fontSize: 13
        }} className="ais-control" />
      </div>

      <div style={{
        ...FI,
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6
      }}>
        Sisa Matang Ayam Potong (per bagian)
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 6
      }} className="ais-responsive-grid">
        {[{
          label: "Dada",
          value: sisaDada,
          set: setSisaDada
        }, {
          label: "Paha Atas",
          value: sisaPahaAtas,
          set: setSisaPahaAtas
        }, {
          label: "Paha Bawah",
          value: sisaPahaBawah,
          set: setSisaPahaBawah
        }, {
          label: "Sayap",
          value: sisaSayap,
          set: setSisaSayap
        }].map(f => <div key={f.label}>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
              {f.label} (ptg)
            </div>
            <input type="number" value={f.value} onChange={e => f.set(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "9px 8px",
            ...FM,
            fontSize: 13,
            textAlign: "center"
          }} className="ais-control" />
          </div>)}
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0 14px",
        ...FI,
        fontWeight: 700,
        fontSize: 13
      }}>
        <span>Total Sisa Ayam (auto)</span>
        <span style={{
          fontFamily: "JetBrains Mono"
        }}>
          {sisaAyamTotal} ptg
        </span>
      </div>

      <div style={{
        ...FI,
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6
      }}>
        Sisa Matang Lainnya
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 10
      }} className="ais-responsive-grid">
        <div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Hotwing (porsi)
          </div>
          <input type="number" value={sisaHotwing} onChange={e => setSisaHotwing(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "9px 8px",
            ...FM,
            fontSize: 13,
            textAlign: "center"
          }} className="ais-control" />
        </div>
        <div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Kulit (porsi)
          </div>
          <input type="number" value={sisaKulit} onChange={e => setSisaKulit(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "9px 8px",
            ...FM,
            fontSize: 13,
            textAlign: "center"
          }} className="ais-control" />
        </div>
      </div>
      {isShift2 && <>
          <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6
        }}>
            Sisa Base Preparation (akhir hari)
          </div>
          <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 10
        }} className="ais-responsive-grid">
            <div>
              <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginBottom: 4
            }}>
                Sisa Sambal Ciprek (cup)
              </div>
              <input type="number" value={sisaCiprek} onChange={e => setSisaCiprek(e.target.value)} style={{
              width: "100%",
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "9px 8px",
              ...FM,
              fontSize: 13,
              textAlign: "center"
            }} className="ais-control" />
            </div>
            <div>
              <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted,
              marginBottom: 4
            }}>
                Sisa Saos Hotwing (cup)
              </div>
              <input type="number" value={sisaSaosHotwing} onChange={e => setSisaSaosHotwing(e.target.value)} style={{
              width: "100%",
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "9px 8px",
              ...FM,
              fontSize: 13,
              textAlign: "center"
            }} className="ais-control" />
            </div>
          </div>
          <div style={{
          marginBottom: 10
        }}>
            <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
              Tangkai Cabe (gr)
            </div>
            <input type="number" value={tangkaiCabe} onChange={e => setTangkaiCabe(e.target.value)} placeholder="gr" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "9px 8px",
            ...FM,
            fontSize: 13,
            textAlign: "center"
          }} className="ais-control" />
            <div style={{
            ...FI,
            fontSize: 10.5,
            color: T.inkMuted,
            marginTop: 4
          }}>
              Total berat tangkai cabe hari ini (dari sambal Ciprek Shift 1 +
              2). Isi 0 jika tidak ada. Dipakai untuk mengurangi selisih cabe di
              Waste Calculation.
            </div>
          </div>
        </>}
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 4
      }}>
        Catatan Kejadian (bahan rusak, komplain, produk busuk, dll)
      </div>
      <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={3} placeholder="Kosongkan jika tidak ada kejadian" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 10px",
        ...FI,
        fontSize: 13,
        resize: "none",
        marginBottom: isShift2 ? 16 : 0
      }} className="ais-control" />

      {isShift2 && <div>
          <SectionLabel>C. Stok Akhir Minyak (Shift 2)</SectionLabel>
          <div style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: 12,
          marginBottom: 14
        }}>
            <div style={{
            ...FI,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 4
          }}>
              Minyak Beku (Kg)
            </div>
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 10
          }}>
              (Stok Awal Minyak Beku − Jumlah Top Up) ={" "}
              <b style={{
              color: T.ink
            }}>{minyakBekuAkhir?.toFixed(2)}</b> Kg
              (auto calculated)
            </div>

            <div style={{
            ...FI,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 4
          }}>
              Minyak Fryer (cm)
            </div>
            <input type="number" value={minyakFryerAkhirCm} onChange={e => setMinyakFryerAkhirCm(e.target.value)} placeholder="cm" style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 10px",
            ...FM,
            fontSize: 13,
            marginBottom: 4
          }} className="ais-control" />
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 10
          }}>
              = (cm × {(minyakConfig || MINYAK_CONFIG_DEFAULT).literPerCm}) +{" "}
              {(minyakConfig || MINYAK_CONFIG_DEFAULT).konstanta} ={" "}
              {literMinyakFryerAkhir.toFixed(2)} L (auto calculated)
            </div>

            <div style={{
            borderTop: `1px solid ${T.line}`,
            paddingTop: 8,
            ...FI,
            fontWeight: 700,
            fontSize: 13
          }}>
              Total Stok Akhir Minyak: {totalStokAkhirMinyak?.toFixed(2)} Kg{" "}
              <span style={{
              fontWeight: 400,
              color: T.inkMuted,
              fontSize: 11
            }}>
                (1 Kg = 1 L)
              </span>
            </div>
          </div>
        </div>}

      <SubmitBtn disabled={!complete} onClick={submit} />
    </div></FormSurface>;
}

/* ---- Stok bahan baku form ---- */
function StokForm({
  storeId,
  ds,
  reportLog,
  stockTransfers,
  stockOpname,
  minyakPakaiAuto,
  minyakMasukAuto,
  cabePakaiAuto,
  onSubmit
}) {
  const bahanList = bahanTokoIni(storeId);
  const autoAwal = Object.fromEntries(bahanList.map(b => [b.id, computeStokAwalAuto(storeId, b.id, ds, reportLog, stockTransfers, stockOpname)]));
  const transferToday = Object.fromEntries(bahanList.map(b => [b.id, computeTransferNetToday(storeId, b.id, ds, stockTransfers)]));
  const [rows, setRows] = useState(Object.fromEntries(bahanList.map(b => [b.id, {
    awal: autoAwal[b.id] != null ? String(autoAwal[b.id]) : "",
    masuk: b.id === "oil_mi_01_001" ? String(minyakMasukAuto ?? 0) : "",
    pakai: b.id === "oil_mi_01_001" && minyakPakaiAuto != null ? String(minyakPakaiAuto) : b.id === "frs_ca_01_001" && cabePakaiAuto ? String(cabePakaiAuto) : ""
  }])));
  const update = (id, field, v) => setRows({
    ...rows,
    [id]: {
      ...rows[id],
      [field]: v
    }
  });
  const complete = BAHAN_BAKU.every(b => rows[b.id].awal !== "");
  const hasTransferToday = BAHAN_BAKU.some(b => transferToday[b.id].transferIn > 0 || transferToday[b.id].transferOut > 0);
  const akhirFor = b => {
    const r = rows[b.id];
    const t = transferToday[b.id];
    return (Number(r.awal) || 0) + (Number(r.masuk) || 0) - (Number(r.pakai) || 0) + t.transferIn - t.transferOut;
  };
  return <FormSurface title="Catat stok aktual." subtitle="Masukkan stok aktual sesuai kategori dan satuan bahan." code="STOCK"><div>
      <SectionLabel>Stok Bahan Baku</SectionLabel>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 8
      }}>
        Kolom "Awal" otomatis & terkunci dari Stok Akhir kemarin + Transfer
        In/Out + Adjustment Stok Opname kemarin (kalau ada histori). "Akhir"
        otomatis ikut menghitung Transfer Stok hari ini (kalau ada), supaya
        sinkron dengan Dashboard Inventory. Untuk Minyak Goreng: kolom "In"
        terkunci dari Minyak Datang di Base Preparation, kolom "Pakai" terkunci
        dari Top Up Minyak (kalau datanya sudah ada). Kolom yang terkunci tidak
        bisa diketik manual — kalau ada yang salah, ajukan edit lewat Elin.
      </div>
      {hasTransferToday && <div style={{
        ...FI,
        fontSize: 11,
        color: T.warn,
        marginBottom: 8
      }}>
          Ada Transfer Stok hari ini — sudah otomatis ditambahkan/dikurangkan ke
          kolom Akhir bahan terkait.
        </div>}
      <div style={{
        overflowX: "auto",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        WebkitOverflowScrolling: "touch"
      }}>
        <table style={{
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12,
          minWidth: 430
        }}>
          <thead>
            <tr style={{
              background: T.surfaceSunk,
              textAlign: "left"
            }}>
              <th style={{
                padding: "7px 8px",
                position: "sticky",
                left: 0,
                background: T.surfaceSunk,
                zIndex: 2,
                minWidth: 130
              }}>
                Bahan
              </th>
              <th style={{
                padding: "7px 8px",
                whiteSpace: "nowrap"
              }}>Awal</th>
              <th style={{
                padding: "7px 8px",
                whiteSpace: "nowrap"
              }}>In</th>
              <th style={{
                padding: "7px 8px",
                whiteSpace: "nowrap"
              }}>
                Pakai
              </th>
              <th style={{
                padding: "7px 8px",
                whiteSpace: "nowrap"
              }}>
                Akhir
              </th>
            </tr>
          </thead>
          <tbody>
            {bahanList.map(b => {
              const r = rows[b.id];
              const akhir = akhirFor(b);
              const t = transferToday[b.id];
              return <tr key={b.id} style={{
                borderTop: `1px solid ${T.line}`
              }}>
                  <td style={{
                  padding: "6px 8px",
                  fontWeight: 600,
                  position: "sticky",
                  left: 0,
                  background: T.surface,
                  zIndex: 1,
                  minWidth: 130
                }}>
                    {b.name}
                  </td>
                  {["awal", "masuk", "pakai"].map(f => {
                  const locked = f === "awal" && autoAwal[b.id] != null || b.id === "oil_mi_01_001" && f === "masuk" || b.id === "oil_mi_01_001" && f === "pakai" && minyakPakaiAuto != null || b.id === "frs_ca_01_001" && f === "pakai" && !!cabePakaiAuto;
                  return <td key={f} style={{
                    padding: "5px 6px"
                  }}>
                        {locked ? <div style={{
                      width: 56,
                      padding: "5px 6px",
                      ...FM,
                      fontSize: 12,
                      fontWeight: 700,
                      background: T.surfaceSunk,
                      borderRadius: 6,
                      textAlign: "center"
                    }} className="ais-content-panel">
                            {r[f]}
                          </div> : <input type="number" value={r[f]} onChange={e => update(b.id, f, e.target.value)} style={{
                      width: 56,
                      border: `1px solid ${T.line}`,
                      borderRadius: 6,
                      padding: "5px 6px",
                      ...FM,
                      fontSize: 12,
                      background: T.surface
                    }} className="ais-control" />}
                      </td>;
                })}
                  <td style={{
                  padding: "6px 8px",
                  ...FM,
                  fontWeight: 700
                }}>
                    {akhir}
                    {(t.transferIn > 0 || t.transferOut > 0) && <div style={{
                    ...FI,
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: T.inkMuted
                  }}>
                        {t.transferIn > 0 && `+${t.transferIn} transfer in`}
                        {t.transferIn > 0 && t.transferOut > 0 && " · "}
                        {t.transferOut > 0 && `-${t.transferOut} transfer out`}
                      </div>}
                  </td>
                </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginTop: 8
      }}>
        Laporan stok membutuhkan approval Admin Inventory (Elin) setelah
        disubmit.
      </div>
      <SubmitBtn disabled={!complete} onClick={() => {
        const payload = {};
        bahanList.forEach(b => {
          const r = rows[b.id];
          const t = transferToday[b.id];
          payload[b.id] = {
            awal: Number(r.awal) || 0,
            masuk: Number(r.masuk) || 0,
            pakai: Number(r.pakai) || 0,
            transferIn: t.transferIn,
            transferOut: t.transferOut,
            akhir: akhirFor(b)
          };
        });
        onSubmit(payload);
      }} />
    </div></FormSurface>;
}

/* ---- Read-only summary once a stage is submitted ---- */
const APPROVER_LABEL = {
  stok: "Admin Inventory (Elin)",
  etalase_2000: "Eri / Juhaeri / Kurnia"
};
function StageSummary({
  stageKey,
  data,
  approvalEntry,
  actions,
  stokEditInfo,
  expandedElin,
  opnameAdjustments,
  bahanList
}) {
  const t = new Date(data.submittedAt);
  const jam = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  return <div>
      <div style={{
      display: "flex",
      gap: 6,
      alignItems: "center",
      marginBottom: 4
    }} className="ais-flex-layout">
        <CheckCircle2 size={15} color={T.good} />
        <span style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>
          Disubmit pukul {jam} — input terkunci, tidak bisa diedit.
        </span>
      </div>
      {data.inputOleh && <div style={{
      display: "flex",
      gap: 6,
      alignItems: "center",
      marginBottom: 10
    }} className="ais-flex-layout">
          <User size={13} color={T.inkMuted} />
          <span style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>
            Diinput oleh: <b style={{
          color: T.ink
        }}>{data.inputOleh}</b>
          </span>
        </div>}
      {stageKey.startsWith("etalase") && <div style={{
      display: "flex",
      gap: 12,
      alignItems: "center"
    }} className="ais-flex-layout">
          {data.photo && <img src={data.photo} alt="etalase" style={{
        width: 60,
        height: 60,
        borderRadius: 8,
        objectFit: "cover"
      }} />}
          <div style={{
        ...FI,
        fontSize: 13
      }}>
            <div>
              Stok tercatat: <b>{data.stok}</b> potong
            </div>
            {data.note && <div style={{
          color: T.inkMuted,
          fontSize: 12
        }}>{data.note}</div>}
            {data.ajukanGoreng && <div style={{
          color: T.warn,
          fontSize: 12,
          marginTop: 3
        }}>
                Mengajukan goreng tambahan: {data.qtyGoreng} potong
              </div>}
          </div>
        </div>}

      {stageKey.startsWith("sales") && <div style={{
      ...FI,
      fontSize: 13
    }}>
          <div>
            Omset Kotor: <b>{rupiah(data.omsetKotor)}</b>
          </div>
          <div>
            Omset Bersih (Cash): <b>{rupiah(data.omsetBersih)}</b>
          </div>
          <div style={{
        color: T.inkMuted,
        fontSize: 12
      }}>
            Pengeluaran {rupiah(data.pengeluaran)} · Online{" "}
            {rupiah(data.omsetOnline)}
          </div>
          {data.pengeluaranItems && Object.values(data.pengeluaranItems).some(v => Number(v) > 0) && <div style={{
        color: T.inkMuted,
        fontSize: 11.5,
        marginTop: 4
      }}>
                Rincian:{" "}
                {Object.entries(data.pengeluaranItems).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k} ${rupiah(v)}`).join(", ")}
              </div>}
          {data.payment && <div style={{
        color: T.inkMuted,
        fontSize: 11.5,
        marginTop: 4
      }}>
              Pembayaran: Cash {rupiah(data.payment.cash)} · QRIS{" "}
              {rupiah(data.payment.qris)} · Debit {rupiah(data.payment.debit)} ·
              Gopay {rupiah(data.payment.gopay)}
            </div>}
          {data.editedBy && <div style={{
        marginTop: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: T.accentSoft,
        color: T.accentDeep,
        padding: "4px 9px",
        borderRadius: 999,
        ...FI,
        fontWeight: 600,
        fontSize: 11
      }}>
              <PenLine size={11} /> Diedit oleh {data.editedBy} ·{" "}
              {new Date(data.editedAt).toLocaleTimeString("id-ID").slice(0, 5)}
            </div>}
        </div>}

      {stageKey === "base_prep" && <div style={{
      ...FI,
      fontSize: 13
    }}>
          <div style={{
        display: "flex",
        gap: 20,
        marginBottom: 10
      }} className="ais-flex-layout">
            <div style={{
          display: "flex",
          gap: 8,
          alignItems: "center"
        }} className="ais-flex-layout">
              {data.sambelCiprek?.fotoTimbangan && <img src={data.sambelCiprek.fotoTimbangan} alt="timbangan" style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            objectFit: "cover"
          }} />}
              {data.sambelCiprek?.fotoCup && <img src={data.sambelCiprek.fotoCup} alt="cup" style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            objectFit: "cover"
          }} />}
              <div>
                Sambal Ciprek: <b>{data.sambelCiprek?.jumlahCup}</b> cup{" "}
                <span style={{
              color: T.inkMuted,
              fontSize: 12
            }}>
                  (cabe {data.sambelCiprek?.jumlahCabe} gr → target{" "}
                  {data.sambelCiprek?.targetCup} cup)
                </span>
              </div>
            </div>
          </div>
          <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 10
      }} className="ais-flex-layout">
            {data.saosHotwing?.foto && <img src={data.saosHotwing.foto} alt="saos" style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          objectFit: "cover"
        }} />}
            <div>
              Saos Hotwing: <b>{data.saosHotwing?.cup}</b> cup
            </div>
          </div>
          <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        lineHeight: 1.8
      }}>
            Minyak Beku:{" "}
            <b style={{
          color: T.ink
        }}>{data.minyak?.minyakBekuKg}</b> Kg +
            Minyak Datang:{" "}
            <b style={{
          color: T.ink
        }}>{data.minyak?.minyakDatangKg}</b> Kg ={" "}
            <b style={{
          color: T.ink
        }}>{data.minyak?.totalMinyakBekuKg}</b> Kg
            <br />
            Minyak Fryer:{" "}
            <b style={{
          color: T.ink
        }}>{data.minyak?.minyakFryerCm}</b> cm →{" "}
            <b style={{
          color: T.ink
        }}>{data.minyak?.literMinyakFryer}</b> L
            <br />
            <span style={{
          fontWeight: 700,
          color: T.ink
        }}>
              Total Stok Awal Minyak: {data.minyak?.totalStokAwalMinyak} Kg
            </span>
            <br />
            Top Up 1: <b style={{
          color: T.ink
        }}>
              {data.minyak?.topUp1Liter}
            </b>{" "}
            L
            {data.sambelCiprek?.jumlahCabe ? <>
                <br />
                Sambal: total jadi{" "}
                <b style={{
            color: T.ink
          }}>{data.sambelCiprek.totalJadi}</b> gr
                · sisa{" "}
                <b style={{
            color: T.ink
          }}>{data.sambelCiprek.sisaSambal}</b>{" "}
                gr
              </> : null}
          </div>
        </div>}

      {stageKey === "base_prep_2" && <div style={{
      ...FI,
      fontSize: 13
    }}>
          <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 8
      }} className="ais-flex-layout">
            {data.sambelCiprek?.fotoTimbangan && <img src={data.sambelCiprek.fotoTimbangan} alt="timbangan" style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          objectFit: "cover"
        }} />}
            {data.sambelCiprek?.fotoCup && <img src={data.sambelCiprek.fotoCup} alt="cup" style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          objectFit: "cover"
        }} />}
            <div>
              Sambal Ciprek 2: <b>{data.sambelCiprek?.jumlahCup}</b> cup{" "}
              <span style={{
            color: T.inkMuted,
            fontSize: 12
          }}>
                (cabe {data.sambelCiprek?.jumlahCabe} gr)
              </span>
            </div>
          </div>
          <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 10
      }} className="ais-flex-layout">
            {data.saosHotwing?.foto && <img src={data.saosHotwing.foto} alt="saos" style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          objectFit: "cover"
        }} />}
            <div>
              Saos Hotwing 2: <b>{data.saosHotwing?.cup}</b> cup
            </div>
          </div>
          <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        lineHeight: 1.8,
        borderTop: `1px dashed ${T.line}`,
        paddingTop: 8
      }}>
            {data.topUpMinyak2?.ada ? <>
                Fryer sebelum top up:{" "}
                <b style={{
            color: T.ink
          }}>{data.topUpMinyak2.sebelumCm}</b> cm
                →{" "}
                <b style={{
            color: T.ink
          }}>{data.topUpMinyak2.sebelumLiter}</b>{" "}
                L<br />
                Top Up 2:{" "}
                <b style={{
            color: T.ink
          }}>{data.topUpMinyak2.topUpCm}</b> cm →{" "}
                <b style={{
            color: T.ink
          }}>{data.topUpMinyak2.topUp2Liter}</b>{" "}
                L<br />
                Fryer setelah top up:{" "}
                <b style={{
            color: T.ink
          }}>
                  {data.topUpMinyak2.sesudahLiter}
                </b>{" "}
                L<br />
              </> : <>
                Tidak ada top up minyak ke-2.
                <br />
              </>}
            <span style={{
          fontWeight: 700,
          color: T.ink
        }}>
              Total Top Up: {data.topUpMinyak2?.totalTopUp} L
            </span>
          </div>
        </div>}

      {stageKey.startsWith("produksi") && <div style={{
      ...FI,
      fontSize: 13
    }}>
          <div>
            Batch masak: <b>{data.batch}</b>
          </div>
          <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        marginTop: 2
      }}>
            Sisa Ayam Total (auto):{" "}
            <b style={{
          color: T.ink
        }}>{data.sisaAyam}</b> ptg
          </div>
          {data.sisaAyamBreakdown && <div style={{
        color: T.inkMuted,
        fontSize: 11.5,
        marginTop: 1
      }}>
              Dada {data.sisaAyamBreakdown.dada} · Paha Atas{" "}
              {data.sisaAyamBreakdown.pahaAtas} · Paha Bawah{" "}
              {data.sisaAyamBreakdown.pahaBawah} · Sayap{" "}
              {data.sisaAyamBreakdown.sayap}
            </div>}
          <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        marginTop: 2
      }}>
            Hotwing: <b style={{
          color: T.ink
        }}>{data.sisaHotwing}</b> porsi ·
            Kulit: <b style={{
          color: T.ink
        }}>{data.sisaKulit}</b> porsi
          </div>
          {data.sisaCiprekCup != null && <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        marginTop: 2
      }}>
              Sisa Sambal Ciprek:{" "}
              <b style={{
          color: T.ink
        }}>{data.sisaCiprekCup}</b> cup · Saos
              Hotwing: <b style={{
          color: T.ink
        }}>{data.sisaSaosHotwingCup}</b>{" "}
              cup
            </div>}
          {data.tangkaiCabeGr != null && <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        marginTop: 2
      }}>
              Tangkai Cabe: <b style={{
          color: T.ink
        }}>{data.tangkaiCabeGr}</b>{" "}
              gr
            </div>}
          {data.catatan && <div style={{
        color: T.inkMuted,
        fontSize: 12,
        marginTop: 3
      }}>
              "{data.catatan}"
            </div>}
          {data.minyakClosing && <div style={{
        color: T.inkMuted,
        fontSize: 12.5,
        marginTop: 8,
        lineHeight: 1.8,
        borderTop: `1px dashed ${T.line}`,
        paddingTop: 8
      }}>
              Minyak Beku Akhir:{" "}
              <b style={{
          color: T.ink
        }}>
                {data.minyakClosing.minyakBekuAkhir}
              </b>{" "}
              Kg
              <br />
              Minyak Fryer:{" "}
              <b style={{
          color: T.ink
        }}>
                {data.minyakClosing.minyakFryerAkhirCm}
              </b>{" "}
              cm →{" "}
              <b style={{
          color: T.ink
        }}>
                {data.minyakClosing.literMinyakFryerAkhir}
              </b>{" "}
              L<br />
              <span style={{
          fontWeight: 700,
          color: T.ink
        }}>
                Total Stok Akhir Minyak:{" "}
                {data.minyakClosing.totalStokAkhirMinyak} Kg
              </span>
            </div>}
        </div>}

      {stageKey === "stok" && <div>
          <div style={{
        overflowX: "auto",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        WebkitOverflowScrolling: "touch"
      }}>
            <table style={{
          borderCollapse: "collapse",
          ...FI,
          fontSize: 12,
          minWidth: expandedElin ? 640 : 420
        }}>
              <thead>
                <tr style={{
              background: T.surfaceSunk,
              textAlign: "left"
            }}>
                  <th style={{
                padding: "6px 8px",
                position: "sticky",
                left: 0,
                background: T.surfaceSunk,
                zIndex: 2,
                minWidth: 130
              }}>
                    Bahan
                  </th>
                  <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                    Awal
                  </th>
                  <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                    In
                  </th>
                  {expandedElin && <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                      Transfer In
                    </th>}
                  {expandedElin && <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                      Transfer Out
                    </th>}
                  <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                    Pakai
                  </th>
                  {expandedElin && <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                      Stok Opname
                    </th>}
                  <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                    Akhir
                  </th>
                  <th style={{
                padding: "6px 8px",
                whiteSpace: "nowrap"
              }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {(bahanList || BAHAN_BAKU).map((b, i) => {
              const opnameAdj = opnameAdjustments?.[b.id];
              return <tr key={b.id} style={{
                borderTop: `1px solid ${T.line}`
              }}>
                      <td style={{
                  padding: "6px 8px",
                  position: "sticky",
                  left: 0,
                  background: T.surface,
                  zIndex: 1,
                  minWidth: 130
                }}>
                        {b.name}
                      </td>
                      <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>
                        {data[b.id]?.awal}
                      </td>
                      <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>
                        {data[b.id]?.masuk}
                      </td>
                      {expandedElin && <td style={{
                  padding: "6px 8px",
                  ...FM,
                  color: data[b.id]?.transferIn ? T.good : T.inkMuted
                }}>
                          {data[b.id]?.transferIn || 0}
                        </td>}
                      {expandedElin && <td style={{
                  padding: "6px 8px",
                  ...FM,
                  color: data[b.id]?.transferOut ? T.warn : T.inkMuted
                }}>
                          {data[b.id]?.transferOut || 0}
                        </td>}
                      <td style={{
                  padding: "6px 8px",
                  ...FM
                }}>
                        {data[b.id]?.pakai}
                      </td>
                      {expandedElin && <td style={{
                  padding: "6px 8px",
                  ...FM,
                  color: opnameAdj ? opnameAdj < 0 ? T.bad : T.good : T.inkMuted
                }}>
                          {opnameAdj ? `${opnameAdj > 0 ? "+" : ""}${opnameAdj}` : "-"}
                        </td>}
                      <td style={{
                  padding: "6px 8px",
                  ...FM,
                  fontWeight: 700
                }}>
                        {data[b.id]?.akhir}
                      </td>
                      <td style={{
                  padding: "6px 8px"
                }}>
                        {i === 0 && (data.editedBy ? <Badge tone="manajemen">Diedit</Badge> : stokEditInfo?.status === "pending" ? <Badge tone="warn">Menunggu</Badge> : stokEditInfo?.status === "rejected" ? <Badge tone="bad">Ditolak</Badge> : <span style={{
                    color: T.inkMuted
                  }}>-</span>)}
                      </td>
                    </tr>;
            })}
              </tbody>
            </table>
          </div>
          <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginTop: 6
      }}>
            Geser tabel ke samping untuk melihat kolom lainnya.
          </div>
          {expandedElin && <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginTop: 6
      }}>
              Kolom "Stok Opname" = penyesuaian dari selisih Stok Opname kemarin
              yang sudah masuk ke Awal hari ini.
            </div>}
          {data.editedBy && <div style={{
        marginTop: 8
      }}>
              <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: T.accentSoft,
          color: T.accentDeep,
          padding: "4px 9px",
          borderRadius: 999,
          ...FI,
          fontWeight: 600,
          fontSize: 11
        }}>
                <PenLine size={11} /> Diedit oleh {data.editedBy} ·{" "}
                {new Date(data.editedAt).toLocaleTimeString("id-ID").slice(0, 5)}
              </div>
              {data.editReason && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginTop: 4
        }}>
                  Alasan: "{data.editReason}"
                </div>}
            </div>}
          {!data.editedBy && stokEditInfo?.status === "pending" && <div style={{
        marginTop: 8,
        ...FI,
        fontSize: 11.5,
        color: T.warn
      }}>
              Permintaan edit "{stokEditInfo.deskripsi}" sedang menunggu review
              Elin. Alasan: "{stokEditInfo.alasan}"
            </div>}
          {!data.editedBy && stokEditInfo?.status === "rejected" && <div style={{
        marginTop: 8,
        ...FI,
        fontSize: 11.5,
        color: T.bad
      }}>
              Permintaan edit sebelumnya ditolak Elin
              {stokEditInfo.decidedNote ? `: "${stokEditInfo.decidedNote}"` : "."}
            </div>}
        </div>}

      {(stageKey === "opening" || stageKey === "closing") && <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 6
    }} className="ais-responsive-grid">
          {AREA_FOTO.map(a => data.photos?.[a] && <img key={a} src={data.photos[a]} alt={a} style={{
        width: "100%",
        aspectRatio: "1",
        borderRadius: 6,
        objectFit: "cover"
      }} />)}
        </div>}

      {approvalEntry && <div style={{
      marginTop: 10,
      padding: "8px 10px",
      borderRadius: 10,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600,
      background: approvalEntry.status === "approved" ? T.goodSoft : approvalEntry.status === "rejected" ? T.badSoft : T.warnSoft,
      color: approvalEntry.status === "approved" ? T.good : approvalEntry.status === "rejected" ? T.bad : T.warn
    }}>
          {approvalEntry.status === "pending" && `Menunggu approval ${APPROVER_LABEL[approvalEntry.type] || "Admin Utama"}.`}
          {approvalEntry.status === "approved" && `Disetujui${approvalEntry.decidedBy ? ` oleh ${approvalEntry.decidedBy}` : ""}${approvalEntry.finalQty != null ? ` — qty goreng final: ${approvalEntry.finalQty} potong` : ""}.`}
          {approvalEntry.status === "rejected" && `Ditolak${approvalEntry.decidedBy ? ` oleh ${approvalEntry.decidedBy}` : ""}.`}
        </div>}

      {actions && <div style={{
      marginTop: 10
    }}>{actions}</div>}
    </div>;
}

/* ---- Main store-side report timeline ---- */
function AjukanEditStokButton({
  storeId,
  tanggal,
  emp,
  stokEditRequests,
  setStokEditRequests,
  now,
  existing
}) {
  const [open, setOpen] = useState(false);
  const [deskripsi, setDeskripsi] = useState("");
  const [alasan, setAlasan] = useState("");
  if (existing?.status === "pending") {
    return <div style={{
      marginTop: 10,
      ...FI,
      fontSize: 12,
      color: T.warn
    }}>
        Permintaan edit sudah dikirim, menunggu review Elin.
      </div>;
  }
  if (!open) {
    return <button onClick={() => setOpen(true)} style={{
      marginTop: 10,
      display: "flex",
      alignItems: "center",
      gap: 5,
      border: `1px solid ${T.line}`,
      borderRadius: 9,
      padding: "7px 12px",
      background: "transparent",
      color: T.ink,
      ...FI,
      fontWeight: 600,
      fontSize: 12.5,
      cursor: "pointer"
    }} className="ais-button ais-button--primary ais-flex-layout">
        <PenLine size={13} /> Ajukan Edit
      </button>;
  }
  const complete = deskripsi.trim() && alasan.trim();
  const submit = async () => {
    await setStokEditRequests([...stokEditRequests, {
      id: `stokedit_${Date.now()}`,
      storeId,
      tanggal,
      deskripsi,
      alasan,
      status: "pending",
      requestedBy: emp.name,
      requestedById: emp.id,
      requestedAt: now.toISOString()
    }]);
    setOpen(false);
    setDeskripsi("");
    setAlasan("");
  };
  return <div style={{
    marginTop: 10,
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    padding: 10
  }}>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 4
    }}>
        Bagian yang ingin diedit
      </div>
      <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} rows={2} placeholder="Contoh: Pakai Minyak Goreng salah input" style={{
      width: "100%",
      border: `1px solid ${T.line}`,
      borderRadius: 8,
      padding: "8px 9px",
      ...FI,
      fontSize: 12.5,
      resize: "none",
      marginBottom: 8
    }} className="ais-control" />
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 4
    }}>
        Alasan
      </div>
      <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2} placeholder="Contoh: Salah catat, seharusnya 8 bukan 18" style={{
      width: "100%",
      border: `1px solid ${T.line}`,
      borderRadius: 8,
      padding: "8px 9px",
      ...FI,
      fontSize: 12.5,
      resize: "none",
      marginBottom: 10
    }} className="ais-control" />
      <div style={{
      display: "flex",
      gap: 8
    }} className="ais-flex-layout">
        <button onClick={submit} disabled={!complete} style={{
        flex: 1,
        border: "none",
        borderRadius: 8,
        padding: "8px 10px",
        background: complete ? T.manajemen : T.line,
        color: "#fff",
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: complete ? "pointer" : "not-allowed"
      }} className="ais-button ais-button--primary">
          Kirim Permintaan
        </button>
        <button onClick={() => setOpen(false)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "8px 12px",
        background: "transparent",
        color: T.inkMuted,
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer"
      }} className="ais-button ais-button--default">
          Batal
        </button>
      </div>
    </div>;
}

/* ---- Laporan Beban Toko (Token Listrik, PDAM, Pulsa & Internet) ---- */
const BEBAN_TABS = [{
  key: "token_listrik",
  label: "Token Listrik"
}, {
  key: "pdam",
  label: "PDAM"
}, {
  key: "pulsa_internet",
  label: "Pulsa & Internet"
}];

// Crew yang absen masuk di tanggal tsb — dipakai untuk dropdown "yang membeli/membayar".
function crewOnDuty(storeId, ds, log) {
  const ids = [...new Set(log.filter(r => r.date === ds && r.type === "clock_in" && r.store === storeId).map(r => r.empId))];
  const fromLog = EMPLOYEES.filter(e => ids.includes(e.id));
  if (fromLog.length) return fromLog;
  // fallback: kalau belum ada yang clock-in (mis. tanggal lampau tanpa data), tampilkan crew/SPV toko tsb
  return EMPLOYEES.filter(e => (e.group === "crew" || e.group === "parttime" || e.group === "spv" || e.group === "tl") && (e.store === storeId || (e.stores || []).includes(storeId)));
}
function BebanTokoForm({
  emp,
  now,
  bebanToko,
  setBebanToko,
  log
}) {
  const storeId = emp.store;
  const [tab, setTab] = useState("token_listrik");
  const [tanggal, setTanggal] = useState(dateStr(now));
  const [jumlah, setJumlah] = useState("");
  const [oleh, setOleh] = useState("");
  const [jenisPulsa, setJenisPulsa] = useState("pulsa");
  const [nomorHp, setNomorHp] = useState("");
  const petugas = crewOnDuty(storeId, tanggal, log);
  useEffect(() => {
    setOleh(petugas[0]?.id || "");
  }, [tanggal, tab]);
  const isPulsa = tab === "pulsa_internet";
  const needNomor = isPulsa && jenisPulsa === "pulsa";
  const complete = tanggal && Number(jumlah) > 0 && oleh && (!needNomor || nomorHp.trim().length >= 8);
  const labelJumlah = tab === "pdam" ? "Jumlah Bayar (Rp)" : "Jumlah Beli (Rp)";
  const labelTanggal = tab === "pdam" ? "Tanggal Bayar" : "Tanggal Beli";
  const labelOleh = tab === "pdam" ? "Crew yang Membayar" : "Crew yang Membeli";
  const submit = async () => {
    const person = petugas.find(p => p.id === oleh);
    const record = {
      id: `beban_${Date.now()}`,
      storeId,
      jenis: tab,
      tanggal,
      jumlah: Number(jumlah),
      olehId: oleh,
      olehNama: person?.name || "-",
      ...(isPulsa ? {
        subJenis: jenisPulsa,
        nomorHp: jenisPulsa === "pulsa" ? nomorHp.trim() : null
      } : {}),
      submittedAt: now.toISOString()
    };
    await setBebanToko([...(bebanToko || []), record]);
    setJumlah("");
    setNomorHp("");
  };
  const riwayat = (bebanToko || []).filter(b => b.storeId === storeId && b.jenis === tab).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return <FormSurface title="Biaya yang transparan." subtitle="Catat kebutuhan toko beserta nominal dan bukti pengeluaran." code="EXPENSE"><div>
      <div style={{
        display: "flex",
        gap: 6,
        marginBottom: 16,
        background: T.surfaceSunk,
        padding: 4,
        borderRadius: 10
      }} className="ais-flex-layout ais-content-panel">
        {BEBAN_TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
          flex: 1,
          border: "none",
          borderRadius: 8,
          padding: "8px 4px",
          cursor: "pointer",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 11.5,
          background: tab === t.key ? T.surface : "transparent",
          color: tab === t.key ? T.ink : T.inkMuted,
          boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
        }} className="ais-button ais-button--default" aria-pressed={tab === t.key}>
            {t.label}
          </button>)}
      </div>

      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 14,
        background: T.surfaceSunk,
        padding: "9px 11px",
        borderRadius: 10
      }} className="ais-content-panel">
        Laporan beban toko bersifat insidental — <b>tidak wajib harian</b> dan
        tidak memengaruhi syarat absen pulang crew.
      </div>

      {isPulsa && <div style={{
        marginBottom: 10
      }}>
          <SectionLabel>Jenis</SectionLabel>
          <Select value={jenisPulsa} onChange={setJenisPulsa} options={[{
          value: "pulsa",
          label: "Pulsa"
        }, {
          value: "internet",
          label: "Internet"
        }]} />
        </div>}

      {needNomor && <div style={{
        marginBottom: 10
      }}>
          <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
            Nomor HP Tujuan
          </div>
          <input value={nomorHp} onChange={e => setNomorHp(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="numeric" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "9px 10px",
          ...FM,
          fontSize: 13
        }} className="ais-control" />
        </div>}

      <div style={{
        marginBottom: 10
      }}>
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
          {labelTanggal}
        </div>
        <input type="date" max={dateStr(now)} value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "9px 10px",
          ...FI,
          fontSize: 13
        }} className="ais-control" />
      </div>

      <div style={{
        marginBottom: 10
      }}>
        <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
          {labelJumlah}
        </div>
        <input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "9px 10px",
          ...FM,
          fontSize: 13
        }} className="ais-control" />
      </div>

      <div style={{
        marginBottom: 6
      }}>
        <SectionLabel>{labelOleh}</SectionLabel>
        <Select value={oleh} onChange={setOleh} options={petugas.map(p => ({
          value: p.id,
          label: `${p.name} — ${p.jabatan || GROUP_LABEL[p.group]}`
        }))} />
      </div>
      <div style={{
        ...FI,
        fontSize: 10.5,
        color: T.inkMuted,
        marginBottom: 12
      }}>
        Pilihan mengikuti crew yang absen masuk di tanggal tersebut.
      </div>

      <SubmitBtn label="Simpan Laporan" disabled={!complete} onClick={submit} />

      <div style={{
        marginTop: 22
      }}>
        <SectionLabel>Riwayat ({riwayat.length})</SectionLabel>
        {riwayat.length === 0 && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>
            Belum ada laporan untuk jenis ini.
          </div>}
        {riwayat.map(r => <div key={r.id} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 8
        }}>
            <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
              <span style={{
              ...FM,
              fontSize: 12.5,
              fontWeight: 600
            }}>
                {r.tanggal}
              </span>
              <span style={{
              ...FM,
              fontSize: 13,
              fontWeight: 700
            }}>
                {rupiah(r.jumlah)}
              </span>
            </div>
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginTop: 3
          }}>
              {r.subJenis && <>
                  {r.subJenis === "pulsa" ? `Pulsa · ${r.nomorHp}` : "Internet"}{" "}
                  ·{" "}
                </>}
              Oleh {r.olehNama}
            </div>
          </div>)}
      </div>
    </div></FormSurface>;
}

/* ---- Profile Toko (untuk Akun Toko) ---- */
function ProfileTokoPage({
  emp,
  log,
  now
}) {
  const store = STORES.find(s => s.id === emp.store);
  const spvList = EMPLOYEES.filter(e => (e.group === "spv" || e.group === "tl") && (e.stores || [e.store]).includes(emp.store));
  const crewList = EMPLOYEES.filter(e => (e.group === "crew" || e.group === "parttime") && e.store === emp.store && e.status !== "nonaktif");
  const onDutyToday = crewOnDuty(emp.store, dateStr(now), log);
  const Row = ({
    label,
    value
  }) => <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "9px 0",
    borderBottom: `1px solid ${T.line}`
  }} className="ais-flex-layout">
      <span style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted,
      flexShrink: 0
    }}>
        {label}
      </span>
      <span style={{
      ...FI,
      fontSize: 13,
      fontWeight: 600,
      textAlign: "right"
    }}>
        {value}
      </span>
    </div>;
  return <div>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 16,
      padding: "16px 18px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 14
    }} className="ais-flex-layout ais-content-panel">
        <div style={{
        width: 46,
        height: 46,
        borderRadius: 12,
        background: T.accent,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }}>
          <Store size={22} />
        </div>
        <div>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 19
        }}>
            {store?.name || "-"}
          </div>
          <div style={{
          ...FI,
          fontSize: 12,
          color: T.inkMuted
        }}>
            Akun Toko (Device)
          </div>
        </div>
      </div>

      {store?.status === "mitra" && <div style={{
      background: T.warnSoft,
      color: T.warn,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 16,
      ...FI,
      fontSize: 12.5
    }}>
          <div style={{
        fontWeight: 700,
        marginBottom: 3
      }}>Toko Mitra</div>
          Akun ini hanya menyimpan titik koordinat absen. Tidak ada Laporan
          Toko, Beban Toko, maupun inventory — transfer stok dengan toko holding
          dicatat di sisi toko holding.
        </div>}

      <SectionLabel>Profil Toko</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "4px 16px",
      marginBottom: 20
    }} className="ais-content-panel">
        <Row label="Nama Toko" value={store?.name || "-"} />
        <Row label="Jenis" value={JENIS_TOKO_LABEL[store?.jenisToko] || "-"} />
        <Row label="Status" value={STORE_STATUS_LABEL[store?.status] || "-"} />
        <Row label="Dikelola" value={STORE_MANAGE_LABEL[store?.manage] || "-"} />
        <Row label="Alamat" value={store?.alamat || "Belum diisi"} />
        <Row label="Nomor Telepon" value={store?.telepon || "Belum diisi"} />
        <Row label="Titik Lokasi" value={store?.lat != null ? `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}` : "Belum ditandai"} />
        <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 0"
      }}>
          <span style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted
        }}>
            Radius Absen
          </span>
          <span style={{
          ...FI,
          fontSize: 13,
          fontWeight: 600
        }}>
            {store?.radius ?? "-"} meter
          </span>
        </div>
      </div>

      <SectionLabel>SPV Penanggung Jawab ({spvList.length})</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "10px 16px",
      marginBottom: 20
    }} className="ais-content-panel">
        {spvList.length === 0 && <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>
            Belum ada SPV yang menaungi toko ini.
          </div>}
        {spvList.map(s => <div key={s.id} style={{
        ...FI,
        fontSize: 13,
        fontWeight: 600,
        padding: "4px 0"
      }}>
            {s.name}{" "}
            <span style={{
          fontWeight: 400,
          color: T.inkMuted,
          fontSize: 12
        }}>
              · {s.jabatan}
            </span>
          </div>)}
      </div>

      <SectionLabel>Crew Toko ({crewList.length})</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "10px 16px"
    }} className="ais-content-panel">
        {crewList.length === 0 && <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }}>
            Belum ada crew terdaftar.
          </div>}
        {crewList.map(c => {
        const hadir = onDutyToday.some(p => p.id === c.id);
        return <div key={c.id} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 0"
        }}>
              <span style={{
            ...FI,
            fontSize: 13,
            fontWeight: 600
          }}>
                {c.name}{" "}
                <span style={{
              fontWeight: 400,
              color: T.inkMuted,
              fontSize: 12
            }}>
                  · {c.jabatan}
                </span>
              </span>
              {hadir && <Badge tone="good">Masuk Hari Ini</Badge>}
            </div>;
      })}
      </div>
    </div>;
}
function LaporanTokoForm({
  emp,
  now,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  stockTransfers,
  stockOpname,
  stokEditRequests,
  setStokEditRequests,
  minyakConfig,
  ciprekConfig
}) {
  const ds = dateStr(now);
  const storeId = emp.store;
  const key = `${storeId}_${ds}`;
  const data = reportLog[key] || {};
  const [openKey, setOpenKey] = useState(null);
  const workersOfStore = EMPLOYEES.filter(e => (e.group === "crew" || e.group === "spv" || e.group === "tl") && e.store === storeId);
  const [inputOleh, setInputOleh] = useState(workersOfStore[0]?.id || "");
  const findApproval = stageKey => approvalQueue.find(a => a.storeId === storeId && a.date === ds && a.type === stageKey);
  const statusOf = stage => {
    const d = data[stage.key];
    if (d) {
      if (stage.approval) {
        const ap = findApproval(stage.key);
        return ap?.status || "pending";
      }
      // Etalase: kalau disubmit tapi lewat toleransi 10 menit dari jadwalnya sendiri, tetap tampilkan status Terlambat.
      if (stage.key.startsWith("etalase") && stage.time) {
        const submitMin = minutesOfDate(new Date(d.submittedAt));
        if (submitMin > minutesOf(stage.time) + 10) return "telat";
      }
      return "selesai";
    }
    if (stage.key.startsWith("etalase") && stage.time) {
      if (isEtalaseExpired(stage, now)) return "kosong";
      if (minutesOfDate(now) > minutesOf(stage.time) + 10) return "telat";
      return "belum";
    }
    if (stage.time && minutesOfDate(now) > minutesOf(stage.time) + 10) return "telat";
    return "belum";
  };
  const submitStage = (stage, payload) => {
    const operatorName = workersOfStore.find(w => w.id === inputOleh)?.name || "-";
    const enriched = {
      ...payload,
      inputOleh: operatorName,
      inputOlehId: inputOleh,
      submittedAt: now.toISOString()
    };
    const nextData = {
      ...data,
      [stage.key]: enriched
    };
    setReportLog({
      ...reportLog,
      [key]: nextData
    });
    if (stage.approval) {
      setApprovalQueue([...approvalQueue, {
        id: `${key}_${stage.key}_${Date.now()}`,
        storeId,
        date: ds,
        type: stage.key,
        payload: enriched,
        status: "pending",
        requestedAt: now.toISOString()
      }]);
    }
    setOpenKey(null);
  };
  const STATUS_META = {
    selesai: {
      label: "Selesai",
      tone: "good"
    },
    approved: {
      label: "Disetujui",
      tone: "good"
    },
    pending: {
      label: "Menunggu Approval",
      tone: "warn"
    },
    rejected: {
      label: "Ditolak",
      tone: "bad"
    },
    telat: {
      label: "Terlambat",
      tone: "bad"
    },
    belum: {
      label: "Belum",
      tone: "manajemen"
    },
    kosong: {
      label: "Tidak Ada Laporan",
      tone: "bad"
    }
  };
  return <FormSurface title="Ritme kerja toko." subtitle="Ikuti tahapan laporan sesuai proses operasional hari ini." code="OPERATIONS"><div>
      <IdentityCard emp={emp} />
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 14,
        ...FI,
        fontSize: 12.5,
        color: T.inkMuted
      }} className="ais-flex-layout">
        <Store size={14} /> {storeName(storeId)} · {ds}
      </div>

      {STAGES.map(stage => {
        const st = statusOf(stage);
        const meta = STATUS_META[st];
        const isLocked = st === "kosong";
        const isOpen = openKey === stage.key && !isLocked;
        const submitted = !!data[stage.key];
        return <div key={stage.key} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          marginBottom: 8,
          overflow: "hidden",
          opacity: isLocked ? 0.75 : 1
        }}>
            <button onClick={() => !isLocked && setOpenKey(isOpen ? null : stage.key)} style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 14px",
            border: "none",
            background: isOpen ? T.surfaceSunk : T.surface,
            cursor: isLocked ? "default" : "pointer"
          }} className="ais-button ais-button--default" aria-pressed={isOpen}>
              <span style={{
              ...FI,
              fontWeight: 600,
              fontSize: 13.5,
              color: T.ink
            }}>
                {stage.label}
              </span>
              <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8
            }} className="ais-flex-layout">
                <Badge tone={meta.tone === "manajemen" ? "manajemen" : meta.tone}>
                  {meta.label}
                </Badge>
                {!isLocked && <ChevronDown size={15} color={T.inkMuted} style={{
                transform: isOpen ? "rotate(180deg)" : "none",
                transition: "transform .15s"
              }} />}
              </div>
            </button>
            {isLocked && <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${T.line}`,
            display: "flex",
            gap: 6,
            alignItems: "flex-start"
          }} className="ais-flex-layout">
                <Lock size={13} color={T.bad} style={{
              marginTop: 2,
              flexShrink: 0
            }} />
                <span style={{
              ...FI,
              fontSize: 11.5,
              color: T.bad
            }}>
                  Melewati batas jam checkpoint berikutnya (
                  {nextEtalaseTime(stage.key)}) — laporan dianggap tidak diisi
                  (0) dan form terkunci.
                </span>
              </div>}
            {isOpen && <div style={{
            padding: 14,
            borderTop: `1px solid ${T.line}`
          }}>
                {!submitted && <div style={{
              marginBottom: 14
            }}>
                    <SectionLabel>Diinput Oleh</SectionLabel>
                    <Select value={inputOleh} onChange={setInputOleh} options={workersOfStore.map(w => ({
                value: w.id,
                label: `${w.name} (${GROUP_LABEL[w.group]})`
              }))} />
                    <div style={{
                ...FI,
                fontSize: 11,
                color: T.inkMuted,
                marginTop: 5
              }}>
                      Dicatat untuk memudahkan tracking jika ada kesalahan
                      input.
                    </div>
                  </div>}
                {submitted ? <StageSummary stageKey={stage.key} data={data[stage.key]} bahanList={bahanTokoIni(storeId)} approvalEntry={stage.approval ? findApproval(stage.key) : null} stokEditInfo={stage.key === "stok" ? [...stokEditRequests].reverse().find(r => r.storeId === storeId && r.tanggal === ds) : null} actions={stage.key === "stok" ? <AjukanEditStokButton storeId={storeId} tanggal={ds} emp={emp} stokEditRequests={stokEditRequests} setStokEditRequests={setStokEditRequests} now={now} existing={[...stokEditRequests].reverse().find(r => r.storeId === storeId && r.tanggal === ds)} /> : null} /> : stage.key === "opening" ? <ChecklistForm mode="opening" onSubmit={p => submitStage(stage, p)} /> : stage.key === "closing" ? <ChecklistForm mode="closing" onSubmit={p => submitStage(stage, p)} /> : stage.key === "base_prep" ? <BasePrepForm storeId={storeId} ds={ds} reportLog={reportLog} stockTransfers={stockTransfers} stockOpname={stockOpname} minyakConfig={minyakConfig} ciprekConfig={ciprekConfig} onSubmit={p => submitStage(stage, p)} /> : stage.key === "base_prep_2" ? <BasePrep2Form storeId={storeId} topUp1Liter={data.base_prep?.minyak?.topUp1Liter || 0} minyakConfig={minyakConfig} ciprekConfig={ciprekConfig} onSubmit={p => submitStage(stage, p)} /> : stage.key.startsWith("etalase") ? <EtalaseForm timeKey={stage.time} onSubmit={p => submitStage(stage, p)} /> : stage.key === "sales_shift1" ? <SalesForm shift={1} storeId={storeId} onSubmit={p => submitStage(stage, p)} /> : stage.key === "sales_shift2" ? <SalesForm shift={2} storeId={storeId} shift1Data={data.sales_shift1} onSubmit={p => submitStage(stage, p)} /> : stage.key === "produksi_shift1" ? <ProduksiForm shift={1} minyakConfig={minyakConfig} onSubmit={p => submitStage(stage, p)} /> : stage.key === "produksi_shift2" ? <ProduksiForm shift={2} minyakConfig={minyakConfig} totalMinyakBekuKg={data.base_prep?.minyak?.totalMinyakBekuKg || 0} totalTopUp={data.base_prep_2?.topUpMinyak2?.totalTopUp ?? data.base_prep?.minyak?.topUp1Liter ?? 0} onSubmit={p => submitStage(stage, p)} /> : stage.key === "stok" ? <StokForm storeId={storeId} ds={ds} reportLog={reportLog} stockTransfers={stockTransfers} stockOpname={stockOpname} minyakPakaiAuto={data.base_prep_2?.topUpMinyak2?.totalTopUp ?? data.base_prep?.minyak?.topUp1Liter ?? null} minyakMasukAuto={data.base_prep?.minyak?.minyakDatangKg ?? 0} cabePakaiAuto={(data.base_prep?.sambelCiprek?.jumlahCabe || 0) + (data.base_prep_2?.sambelCiprek?.jumlahCabe || 0)} onSubmit={p => submitStage(stage, p)} /> : null}
              </div>}
          </div>;
      })}
    </div></FormSurface>;
}

/* ---- Manajemen / Direksi side: status grid + approval queue ---- */
/* ---- SPV side: monitoring read-only untuk toko sendiri ---- */

function LaporanMonitoring({
  emp,
  reportLog,
  approvalQueue,
  setApprovalQueue,
  now
}) {
  const ds = dateStr(now);
  return <div>
      <SectionLabel>Status Laporan Hari Ini ({ds})</SectionLabel>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 10
    }}>
        Aksi approve/reject laporan sekarang ada di tab <b>Approval</b> —
        halaman ini murni status.
      </div>
      <div style={{
      overflowX: "auto",
      marginBottom: 20
    }}>
        <table style={{
        width: "100%",
        borderCollapse: "collapse",
        ...FI,
        fontSize: 11,
        minWidth: 640
      }}>
          <thead>
            <tr style={{
            background: T.surfaceSunk,
            textAlign: "left"
          }}>
              <th style={{
              padding: "6px 8px"
            }}>Toko</th>
              {STAGES.map(s => <th key={s.key} style={{
              padding: "6px 6px",
              fontSize: 9.5,
              whiteSpace: "nowrap"
            }}>
                  {s.label}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {STORES_HOLDING.map(store => {
            const data = reportLog[`${store.id}_${ds}`] || {};
            return <tr key={store.id} style={{
              borderTop: `1px solid ${T.line}`
            }}>
                  <td style={{
                padding: "7px 8px",
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}>
                    {store.name}
                  </td>
                  {STAGES.map(s => {
                const submitted = !!data[s.key];
                const ap = s.approval && submitted ? approvalQueue.find(a => a.storeId === store.id && a.date === ds && a.type === s.key) : null;
                const color = !submitted ? T.line : ap?.status === "rejected" ? T.bad : ap?.status === "pending" ? T.warn : T.good;
                return <td key={s.key} style={{
                  padding: "7px 6px",
                  textAlign: "center"
                }}>
                        <span style={{
                    display: "inline-block",
                    width: 9,
                    height: 9,
                    borderRadius: 99,
                    background: color
                  }} />
                      </td>;
              })}
                </tr>;
          })}
          </tbody>
        </table>
      </div>
    </div>;
}
const APPROVAL_TYPE_LABEL = {
  stok: "Stok Bahan Baku",
  etalase_2000: "Etalase 20:00 — Instruksi Goreng"
};
function canApproveType(emp, type) {
  if (type === "etalase_2000") return ["eri", "juhaeri", "kurnia"].includes(emp.id);
  if (type === "stok") return emp.id === "elin";
  return false;
}
function ApprovalCard({
  item,
  onDecide,
  emp
}) {
  const [qty, setQty] = useState(item.payload?.qtyGoreng || 0);
  const label = APPROVAL_TYPE_LABEL[item.type];
  const canAct = canApproveType(emp, item.type);
  return <div style={{
    border: `1px solid ${T.line}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 8
  }}>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 6
    }}>
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 13.5
      }}>
          {storeName(item.storeId)}
        </div>
        <Badge tone="warn">{label}</Badge>
      </div>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 2
    }}>
        Laporan: {label}
      </div>
      <div style={{
      ...FI,
      fontSize: 12,
      color: T.inkMuted,
      marginBottom: 8
    }}>
        {item.date}
        {item.payload?.inputOleh ? ` · Diinput oleh ${item.payload.inputOleh}` : ""}
      </div>

      {item.type === "etalase_2000" && <div style={{
      marginBottom: 8
    }}>
          <div style={{
        ...FI,
        fontSize: 12.5,
        marginBottom: 6
      }}>
            Sisa etalase: <b>{item.payload.stok}</b> potong · Diajukan goreng:{" "}
            <b>{item.payload.qtyGoreng}</b> potong
          </div>
          {canAct && <>
              <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 4
        }}>
                Qty final (bisa disesuaikan)
              </div>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{
          width: 100,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "6px 8px",
          ...FM,
          fontSize: 13
        }} className="ais-control" />
            </>}
        </div>}
      {item.type === "stok" && <div style={{
      ...FI,
      fontSize: 12.5,
      marginBottom: 8,
      color: T.inkMuted
    }}>
          Lihat rincian di riwayat laporan toko.
        </div>}

      {canAct ? <div style={{
      display: "flex",
      gap: 8
    }} className="ais-flex-layout">
          <button onClick={() => onDecide(item, "approved", item.type === "etalase_2000" ? Number(qty) : undefined)} style={{
        flex: 1,
        border: "none",
        borderRadius: 9,
        padding: "8px 10px",
        background: T.good,
        color: "#fff",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer"
      }} className="ais-button ais-button--primary">
            Approve
          </button>
          <button onClick={() => onDecide(item, "rejected")} style={{
        flex: 1,
        border: `1px solid ${T.bad}`,
        borderRadius: 9,
        padding: "8px 10px",
        background: "transparent",
        color: T.bad,
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer"
      }} className="ais-button ais-button--danger">
            Reject
          </button>
        </div> : <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      fontStyle: "italic"
    }}>
          Menunggu approval {APPROVER_LABEL[item.type]} — Anda hanya dapat
          melihat.
        </div>}
    </div>;
}

/* ---- Aksi approve/reject ringkas dipakai di dalam StageSummary ---- */
function ApprovalInlineActions({
  item,
  onDecide
}) {
  const [qty, setQty] = useState(item.payload?.qtyGoreng || 0);
  return <div>
      {item.type === "etalase_2000" && <div style={{
      marginBottom: 8
    }}>
          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 4
      }}>
            Qty final (bisa disesuaikan)
          </div>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{
        width: 100,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        padding: "6px 8px",
        ...FM,
        fontSize: 13
      }} className="ais-control" />
        </div>}
      <div style={{
      display: "flex",
      gap: 8
    }} className="ais-flex-layout">
        <button onClick={() => onDecide("approved", item.type === "etalase_2000" ? Number(qty) : undefined)} style={{
        flex: 1,
        border: "none",
        borderRadius: 9,
        padding: "8px 10px",
        background: T.good,
        color: "#fff",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer"
      }} className="ais-button ais-button--primary">
          Approve
        </button>
        <button onClick={() => onDecide("rejected")} style={{
        flex: 1,
        border: `1px solid ${T.bad}`,
        borderRadius: 9,
        padding: "8px 10px",
        background: "transparent",
        color: T.bad,
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer"
      }} className="ais-button ais-button--danger">
          Reject
        </button>
      </div>
    </div>;
}

/* ---- Riwayat & Detail Laporan Toko — dipakai Eri, Direksi, dan SPV ---- */
function RiwayatLaporanToko({
  emp,
  allowedStores,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  now,
  canEditSales,
  stokEditRequests,
  stokEditLock,
  setStokEditLock
}) {
  const [store, setStore] = useState(allowedStores[0]);
  const [date, setDate] = useState(dateStr(now));
  const [editingStage, setEditingStage] = useState(null);
  const key = `${store}_${date}`;
  const data = reportLog[key] || {};
  const findApproval = stageKey => approvalQueue.find(a => a.storeId === store && a.date === date && a.type === stageKey);
  const decide = (stageKey, status, finalQty) => {
    const entry = findApproval(stageKey);
    if (!entry) return;
    setApprovalQueue(approvalQueue.map(a => a.id === entry.id ? {
      ...a,
      status,
      respondedAt: now.toISOString(),
      decidedBy: emp.name,
      ...(finalQty != null ? {
        finalQty
      } : {})
    } : a));
  };
  const saveSalesEdit = (stageKey, payload) => {
    setReportLog({
      ...reportLog,
      [key]: {
        ...data,
        [stageKey]: {
          ...data[stageKey],
          ...payload,
          editedBy: emp.name,
          editedAt: now.toISOString()
        }
      }
    });
    setEditingStage(null);
  };
  return <div>
      <div style={{
      display: "grid",
      gridTemplateColumns: allowedStores.length > 1 ? "1fr 1fr" : "1fr",
      gap: 10,
      marginBottom: 16
    }} className="ais-responsive-grid">
        {allowedStores.length > 1 && <div>
            <SectionLabel>Toko</SectionLabel>
            <Select value={store} onChange={setStore} options={allowedStores.map(id => ({
          value: id,
          label: storeName(id)
        }))} />
          </div>}
        <div>
          <SectionLabel>Tanggal</SectionLabel>
          <input type="date" max={dateStr(now)} value={date} onChange={e => setDate(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "9px 12px",
          ...FI,
          fontSize: 13.5,
          background: T.surfaceSunk
        }} className="ais-control" />
        </div>
      </div>

      {STAGES.map(stage => {
      const stageData = data[stage.key];
      const ap = stage.approval ? findApproval(stage.key) : null;
      const isEditingThis = editingStage === stage.key;
      const canEditThis = canEditSales && (stage.key === "sales_shift1" || stage.key === "sales_shift2") && stageData;
      const canActThis = stage.approval && ap?.status === "pending" && canApproveType(emp, stage.key);
      const stokLock = stage.key === "stok" ? getStokLock(stokEditLock, store, date) : null;
      const isDireksiApprover = emp.id === "kurnia" || emp.id === "juhaeri";
      const canApproveStokEdit = stokLock?.direksiStatus === "pending" && isDireksiApprover && !stokLock.direksiApprovals?.[emp.id];
      const approveStokEdit = () => {
        const key2 = `${store}_${date}`;
        const nextApprovals = {
          ...stokLock.direksiApprovals,
          [emp.id]: true
        };
        const bothApproved = nextApprovals.kurnia && nextApprovals.juhaeri;
        setStokEditLock({
          ...stokEditLock,
          [key2]: {
            ...stokLock,
            direksiApprovals: nextApprovals,
            direksiStatus: bothApproved ? "approved" : "pending"
          }
        });
      };
      return <div key={stage.key} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        marginBottom: 8,
        padding: 14
      }}>
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: stageData ? 10 : 0
        }}>
              <span style={{
            ...FI,
            fontWeight: 600,
            fontSize: 13.5
          }}>
                {stage.label}
              </span>
              {canEditThis && !isEditingThis && <button onClick={() => setEditingStage(stage.key)} style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            border: "none",
            background: "transparent",
            color: T.accentDeep,
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--default ais-flex-layout">
                  <PenLine size={13} /> Edit
                </button>}
            </div>
            {!stageData && <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted
        }}>
                Belum ada laporan untuk tanggal ini.
              </div>}
            {stage.key === "stok" && stageData && stokLock.direksiStatus === "pending" && <div style={{
          background: T.warnSoft,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 10
        }}>
                  <div style={{
            ...FI,
            fontSize: 12,
            fontWeight: 700,
            color: T.warn,
            marginBottom: 4
          }}>
                    Elin mengajukan edit ke-{stokLock.editCount + 1} — perlu
                    approval Kurnia & Juhaeri
                  </div>
                  <div style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: canApproveStokEdit ? 8 : 0
          }} className="ais-flex-layout">
                    <span style={{
              ...FI,
              fontSize: 11.5
            }}>
                      Kurnia:{" "}
                      <b>
                        {stokLock.direksiApprovals?.kurnia ? "Setuju" : "Menunggu"}
                      </b>
                    </span>
                    <span style={{
              ...FI,
              fontSize: 11.5
            }}>
                      Juhaeri:{" "}
                      <b>
                        {stokLock.direksiApprovals?.juhaeri ? "Setuju" : "Menunggu"}
                      </b>
                    </span>
                  </div>
                  {canApproveStokEdit && <button onClick={approveStokEdit} style={{
            border: "none",
            borderRadius: 8,
            padding: "7px 12px",
            background: T.warn,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
                      Setujui Edit
                    </button>}
                </div>}
            {stageData && isEditingThis ? <SalesForm shift={stage.key === "sales_shift1" ? 1 : 2} storeId={store} shift1Data={stage.key === "sales_shift2" ? data.sales_shift1 : undefined} initial={stageData} onSubmit={p => saveSalesEdit(stage.key, p)} /> : stageData ? <StageSummary stageKey={stage.key} data={stageData} bahanList={bahanTokoIni(store)} approvalEntry={ap} stokEditInfo={stage.key === "stok" ? [...stokEditRequests].reverse().find(r => r.storeId === store && r.tanggal === date) : null} actions={canActThis ? <ApprovalInlineActions item={{
          ...ap,
          payload: stageData
        }} onDecide={(status, finalQty) => decide(stage.key, status, finalQty)} /> : null} /> : null}
          </div>;
    })}
    </div>;
}

/* ---- Wrapper untuk SPV: identitas + catatan + riwayat detail (view only) ---- */
/* ---- Transfer Stok Antar Toko (khusus SPV) ---- */
function TransferStokForm({
  emp,
  now,
  stockTransfers,
  setStockTransfers
}) {
  const dedicatedStores = emp.stores || [emp.store];
  const [asalToko, setAsalToko] = useState(dedicatedStores[0]);
  const [tujuanToko, setTujuanToko] = useState(STORES.find(s => s.id !== dedicatedStores[0])?.id || STORES[0].id);
  // Pilihan bahan mengikuti inventory toko ASAL (sebelumnya memakai variabel `store` yang tidak ada → layar error).
  const bahanAsal = bahanTokoIni(asalToko);
  const bahanAwal = () => (bahanAsal[0] || BAHAN_BAKU[0]).id;
  const [items, setItems] = useState([{
    bahanId: bahanAwal(),
    qty: ""
  }]);
  const addItem = () => setItems([...items, {
    bahanId: bahanAwal(),
    qty: ""
  }]);
  const removeItem = idx => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => setItems(items.map((it, i) => i === idx ? {
    ...it,
    [field]: val
  } : it));
  const complete = asalToko && tujuanToko && asalToko !== tujuanToko && items.length > 0 && items.every(it => it.bahanId && Number(it.qty) > 0);
  const submit = async () => {
    const record = {
      id: `transfer_${Date.now()}`,
      tanggal: dateStr(now),
      asalToko,
      tujuanToko,
      items: items.map(it => ({
        bahanId: it.bahanId,
        bahanName: BAHAN_BAKU.find(b => b.id === it.bahanId)?.name,
        qty: Number(it.qty),
        hargaSatuan: null
      })),
      inputOleh: emp.name,
      inputOlehId: emp.id,
      submittedAt: now.toISOString(),
      status: "pending",
      konfirmasi: null
    };
    await setStockTransfers([...stockTransfers, record]);
    setItems([{
      bahanId: bahanAwal(),
      qty: ""
    }]);
  };
  return <FormSurface title="Transfer antar lokasi." subtitle="Tentukan lokasi tujuan, bahan, dan jumlah transfer." code="TRANSFER"><div>
      <SectionLabel>Transfer Out — Kirim Stok ke Toko Lain</SectionLabel>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 14
      }}>
        Toko Asal terbatas ke toko dedicated Anda. Toko Tujuan berlaku ke
        seluruh toko yang terdaftar di sistem. SPV toko tujuan akan konfirmasi
        penerimaan lewat tab Transfer In.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 16
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Toko Asal</SectionLabel>
          <Select value={asalToko} onChange={v => {
            setAsalToko(v);
            setItems([{
              bahanId: (bahanTokoIni(v)[0] || BAHAN_BAKU[0]).id,
              qty: ""
            }]);
            if (v === tujuanToko) setTujuanToko(STORES.find(s => s.id !== v)?.id || "");
          }} options={dedicatedStores.map(id => ({
            value: id,
            label: storeName(id)
          }))} />
        </div>
        <div>
          <SectionLabel>Toko Tujuan</SectionLabel>
          <Select value={tujuanToko} onChange={setTujuanToko} options={STORES.filter(s => s.id !== asalToko).map(s => ({
            value: s.id,
            label: s.name
          }))} />
        </div>
      </div>

      <SectionLabel>Bahan Baku & Qty</SectionLabel>
      {items.map((it, idx) => <div key={idx} style={{
        display: "flex",
        gap: 8,
        marginBottom: 8,
        alignItems: "center"
      }} className="ais-flex-layout">
          <div style={{
          flex: 1.6
        }}>
            <Select value={it.bahanId} onChange={v => updateItem(idx, "bahanId", v)} options={bahanAsal.map(b => ({
            value: b.id,
            label: b.name
          }))} />
          </div>
          <input type="number" value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="Qty" style={{
          width: 76,
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "9px 8px",
          ...FM,
          fontSize: 13,
          textAlign: "center"
        }} className="ais-control" />
          {items.length > 1 && <button onClick={() => removeItem(idx)} style={{
          border: "none",
          background: "transparent",
          color: T.bad,
          cursor: "pointer",
          padding: 6,
          flexShrink: 0
        }} className="ais-button ais-button--danger">
              <Trash2 size={16} />
            </button>}
        </div>)}
      <button onClick={addItem} style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: `1px dashed ${T.line}`,
        borderRadius: 10,
        padding: "8px 12px",
        background: "transparent",
        color: T.accentDeep,
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer",
        marginBottom: 18
      }} className="ais-button ais-button--default ais-flex-layout">
        <Plus size={14} /> Tambah Bahan Baku
      </button>

      <SubmitBtn label="Kirim Transfer Out" disabled={!complete} onClick={submit} />
    </div></FormSurface>;
}

/* ---- Transfer In: konfirmasi penerimaan oleh SPV toko tujuan ---- */
function TransferInConfirmForm({
  transfer,
  emp,
  stockTransfers,
  setStockTransfers,
  now,
  onBack
}) {
  const [qtyTerima, setQtyTerima] = useState(Object.fromEntries(transfer.items.map(it => [it.bahanId, String(it.qty)])));
  const [foto, setFoto] = useState(null);
  const complete = transfer.items.every(it => qtyTerima[it.bahanId] !== "") && foto;
  const submit = async () => {
    const konfirmasi = {
      items: transfer.items.map(it => ({
        bahanId: it.bahanId,
        qtyTerima: Number(qtyTerima[it.bahanId])
      })),
      foto,
      confirmedBy: emp.name,
      confirmedById: emp.id,
      confirmedAt: now.toISOString()
    };
    await setStockTransfers(stockTransfers.map(t => t.id === transfer.id ? {
      ...t,
      status: "confirmed",
      konfirmasi
    } : t));
    onBack();
  };
  return <FormSurface title="Barang tiba. Periksa kembali." subtitle="Konfirmasikan bahan dan jumlah yang benar-benar diterima." code="RECEIVING"><div>
      <button onClick={onBack} style={{
        border: "none",
        background: "transparent",
        color: T.accentDeep,
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 4
      }} className="ais-button ais-button--default ais-flex-layout">
        ← Kembali ke Daftar
      </button>
      <SectionLabel>Konfirmasi Transfer Masuk</SectionLabel>
      <div style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        marginBottom: 14
      }}>
        {storeName(transfer.asalToko)} → {storeName(transfer.tujuanToko)} ·{" "}
        {transfer.tanggal} · Dikirim oleh {transfer.inputOleh}
      </div>
      {transfer.items.map(it => <div key={it.bahanId} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8
      }}>
          <div style={{
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          marginBottom: 6
        }}>
            {it.bahanName}
          </div>
          <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center"
        }} className="ais-flex-layout">
            <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted
          }}>
              Dikirim: <b style={{
              color: T.ink
            }}>{it.qty}</b>
            </div>
            <div style={{
            flex: 1
          }} />
            <div>
              <div style={{
              ...FI,
              fontSize: 10.5,
              color: T.inkMuted,
              marginBottom: 3
            }}>
                Diterima
              </div>
              <input type="number" value={qtyTerima[it.bahanId]} onChange={e => setQtyTerima({
              ...qtyTerima,
              [it.bahanId]: e.target.value
            })} style={{
              width: 72,
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              padding: "6px 8px",
              ...FM,
              fontSize: 13,
              textAlign: "center"
            }} className="ais-control" />
            </div>
          </div>
        </div>)}
      <SectionLabel>Foto Bukti Terima</SectionLabel>
      <div style={{
        width: 130,
        marginBottom: 16
      }}>
        <PhotoSlot label="Upload Foto" value={foto} onChange={setFoto} />
      </div>
      <SubmitBtn label="Konfirmasi Transfer Masuk" disabled={!complete} onClick={submit} />
    </div></FormSurface>;
}
function TransferInConfirm({
  emp,
  stockTransfers,
  setStockTransfers,
  pengajuan,
  setPengajuan,
  now
}) {
  const dedicatedStores = emp.stores || [emp.store];
  const pending = stockTransfers.filter(t => dedicatedStores.includes(t.tujuanToko) && t.status === "pending").sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const [selectedId, setSelectedId] = useState(null);
  const selected = pending.find(t => t.id === selectedId);
  if (selected) {
    return <TransferInConfirmForm transfer={selected} emp={emp} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} now={now} onBack={() => setSelectedId(null)} />;
  }
  return <div>
      <SectionLabel>
        Transfer Masuk — Menunggu Konfirmasi ({pending.length})
      </SectionLabel>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Konfirmasi qty yang benar-benar diterima + foto bukti. Stok toko tujuan
        baru bertambah setelah dikonfirmasi.
      </div>
      {pending.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Tidak ada transfer masuk yang perlu dikonfirmasi.
        </div>}
      {pending.map(t => <button key={t.id} onClick={() => setSelectedId(t.id)} style={{
      width: "100%",
      textAlign: "left",
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      background: T.surface,
      cursor: "pointer"
    }} className="ais-button ais-button--default">
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
      }}>
            <span style={{
          ...FI,
          fontWeight: 700,
          fontSize: 13
        }}>
              {storeName(t.asalToko)} → {storeName(t.tujuanToko)}
            </span>
            <Badge tone="warn">Menunggu Konfirmasi</Badge>
          </div>
          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted
      }}>
            {t.tanggal} · {t.items.length} item · Dikirim oleh {t.inputOleh}
          </div>
        </button>)}
    </div>;
}
function TransferHistoryList({
  emp,
  stockTransfers
}) {
  const dedicatedStores = emp.stores || [emp.store];
  const relevant = stockTransfers.filter(t => dedicatedStores.includes(t.asalToko) || dedicatedStores.includes(t.tujuanToko)).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return <div style={{
    marginTop: 24
  }}>
      <SectionLabel>Riwayat Transfer ({relevant.length})</SectionLabel>
      {relevant.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Belum ada transfer stok.
        </div>}
      {relevant.map(t => {
      const arah = dedicatedStores.includes(t.asalToko) ? "keluar" : "masuk";
      return <div key={t.id} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 8
      }}>
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6
        }}>
              <div style={{
            ...FI,
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6
          }} className="ais-flex-layout">
                <ArrowLeftRight size={13} /> {storeName(t.asalToko)} →{" "}
                {storeName(t.tujuanToko)}
              </div>
              <div style={{
            display: "flex",
            gap: 6
          }} className="ais-flex-layout">
                <Badge tone={arah === "keluar" ? "warn" : "good"}>
                  {arah === "keluar" ? "Transfer Keluar" : "Transfer Masuk"}
                </Badge>
                <Badge tone={t.status === "confirmed" ? "good" : "warn"}>
                  {t.status === "confirmed" ? "Dikonfirmasi" : "Menunggu Konfirmasi"}
                </Badge>
              </div>
            </div>
            <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 6
        }}>
              {t.tanggal} · Dikirim oleh {t.inputOleh}
              {t.konfirmasi ? ` · Diterima oleh ${t.konfirmasi.confirmedBy}` : ""}
            </div>
            {t.items.map((it, i) => {
          const terima = t.konfirmasi?.items.find(k => k.bahanId === it.bahanId)?.qtyTerima;
          return <div key={i} style={{
            ...FI,
            fontSize: 12.5,
            color: T.ink
          }}>
                  {it.bahanName}: <b>{it.qty}</b>
                  {terima != null && terima !== it.qty ? <span style={{
              color: T.warn
            }}> (diterima {terima})</span> : terima != null ? " (diterima sesuai)" : ""}
                </div>;
        })}
          </div>;
    })}
    </div>;
}

/* ---- Pengajuan / Pengadaan (SPV mengajukan, Eri & Nana memproses) ---- */
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
function PengajuanSpvForm({
  emp,
  now,
  pengajuan,
  setPengajuan
}) {
  const dedicatedStores = emp.stores || [emp.store];
  const [storeId, setStoreId] = useState(dedicatedStores[0]);
  const [kategori, setKategori] = useState(PENGAJUAN_KATEGORI[0]);
  const [keterangan, setKeterangan] = useState("");
  const [foto, setFoto] = useState(null);
  const complete = storeId && kategori && keterangan.trim().length >= 5;
  const submit = async () => {
    const rec = {
      id: `pg_${Date.now()}`,
      tanggal: dateStr(now),
      storeId,
      kategori,
      keterangan: keterangan.trim(),
      foto,
      diajukanOleh: emp.name,
      diajukanOlehId: emp.id,
      status: "pending",
      riwayat: [],
      submittedAt: now.toISOString()
    };
    await setPengajuan([...(pengajuan || []), rec]);
    setKeterangan("");
    setFoto(null);
  };
  const milik = (pengajuan || []).filter(p => dedicatedStores.includes(p.storeId)).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return <FormSurface title="Kebutuhan tim, tersampaikan." subtitle="Rinci kebutuhan toko untuk ditinjau sesuai alur persetujuan." code="REQUEST"><div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 14,
        background: T.surfaceSunk,
        padding: "9px 12px",
        borderRadius: 10
      }} className="ais-content-panel">
        Ajukan kebutuhan atau laporkan temuan di toko. Pengajuan akan diproses
        oleh Eri/Nana dan statusnya bisa dipantau di sini.
      </div>

      <SectionLabel>Toko</SectionLabel>
      <div style={{
        marginBottom: 10
      }}>
        <Select value={storeId} onChange={setStoreId} options={dedicatedStores.map(id => ({
          value: id,
          label: storeName(id)
        }))} />
      </div>

      <SectionLabel>Kategori Pengajuan</SectionLabel>
      <div style={{
        marginBottom: 10
      }}>
        <Select value={kategori} onChange={setKategori} options={PENGAJUAN_KATEGORI.map(k => ({
          value: k,
          label: k
        }))} />
      </div>

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 4
      }}>
        Keterangan Aduan / Pengajuan
      </div>
      <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} rows={4} placeholder="Jelaskan kebutuhan atau temuan sedetail mungkin" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 10px",
        ...FI,
        fontSize: 13,
        resize: "none",
        marginBottom: 10
      }} className="ais-control" />

      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 6
      }}>
        Foto Temuan (opsional)
      </div>
      {foto ? <div style={{
        marginBottom: 12
      }}>
          <img src={foto} alt="temuan" style={{
          width: 110,
          height: 110,
          borderRadius: 10,
          objectFit: "cover",
          border: `1px solid ${T.line}`
        }} />
          <button onClick={() => setFoto(null)} style={{
          display: "block",
          marginTop: 6,
          border: "none",
          background: "transparent",
          color: T.bad,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          padding: 0
        }} className="ais-button ais-button--danger">
            Hapus Foto
          </button>
        </div> : <label style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px dashed ${T.line}`,
        borderRadius: 10,
        padding: "9px 14px",
        cursor: "pointer",
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        color: T.accentDeep,
        marginBottom: 12
      }}>
          <Camera size={14} /> Ambil / Pilih Foto
          <input type="file" accept="image/*" onChange={e => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => setFoto(r.result);
          r.readAsDataURL(f);
        }} style={{
          display: "none"
        }} className="ais-control" />
        </label>}

      <SubmitBtn label="Kirim Pengajuan" disabled={!complete} onClick={submit} />

      <div style={{
        marginTop: 24
      }}>
        <SectionLabel>Pengajuan Saya ({milik.length})</SectionLabel>
        {milik.length === 0 && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>
            Belum ada pengajuan.
          </div>}
        {milik.map(p => <PengajuanCard key={p.id} item={p} />)}
      </div>
    </div></FormSurface>;
}
function PengajuanCard({
  item,
  children
}) {
  const st = PENGAJUAN_STATUS[item.status] || PENGAJUAN_STATUS.pending;
  return <div style={{
    border: `1px solid ${T.line}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 10
  }}>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 4
    }} className="ais-flex-layout">
        <div>
          <div style={{
          ...FI,
          fontWeight: 700,
          fontSize: 13
        }}>
            {item.kategori}
          </div>
          <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted
        }}>
            {storeName(item.storeId)} · {item.tanggal} · {item.diajukanOleh}
          </div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.ink,
      marginTop: 4
    }}>
        {item.keterangan}
      </div>
      {item.foto && <img src={item.foto} alt="temuan" style={{
      width: 90,
      height: 90,
      borderRadius: 8,
      objectFit: "cover",
      border: `1px solid ${T.line}`,
      marginTop: 8
    }} />}
      {(item.riwayat || []).length > 0 && <div style={{
      marginTop: 10,
      paddingTop: 8,
      borderTop: `1px solid ${T.line}`
    }}>
          <div style={{
        ...FI,
        fontSize: 10,
        color: T.inkMuted,
        fontWeight: 700,
        textTransform: "uppercase",
        marginBottom: 3
      }}>
            Riwayat Proses
          </div>
          {item.riwayat.map((r, i) => <div key={i} style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        padding: "2px 0"
      }}>
              <b style={{
          color: T.ink
        }}>
                {PENGAJUAN_STATUS[r.status]?.label || r.status}
              </b>{" "}
              · {r.oleh} · {new Date(r.at).toLocaleDateString("id-ID")}
              {r.catatan ? ` — "${r.catatan}"` : ""}
            </div>)}
        </div>}
      {children}
    </div>;
}
function PengajuanProsesPanel({
  emp,
  now,
  pengajuan,
  setPengajuan
}) {
  const [filter, setFilter] = useState("pending");
  const [openId, setOpenId] = useState(null);
  const [status, setStatus] = useState("progress");
  const [catatan, setCatatan] = useState("");
  const list = (pengajuan || []).filter(p => filter === "all" ? true : filter === "aktif" ? ["pending", "ditunda", "progress"].includes(p.status) : p.status === filter).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const proses = async item => {
    const entry = {
      status,
      catatan: catatan.trim(),
      oleh: emp.name,
      at: now.toISOString()
    };
    await setPengajuan((pengajuan || []).map(p => p.id === item.id ? {
      ...p,
      status,
      riwayat: [...(p.riwayat || []), entry]
    } : p));
    setOpenId(null);
    setCatatan("");
    setStatus("progress");
  };
  const pendingCount = (pengajuan || []).filter(p => p.status === "pending").length;
  return <FormSurface title="Selesaikan kebutuhan tim." subtitle="Perbarui proses pengajuan dan kelengkapan tindak lanjut." code="FOLLOW UP"><div>
      <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 12,
        background: T.surfaceSunk,
        padding: "9px 12px",
        borderRadius: 10
      }} className="ais-content-panel">
        Aduan & pengajuan dari SPV. Setiap respon yang dipilih langsung terlihat
        oleh SPV pengaju.
        {pendingCount > 0 && <b style={{
          color: T.warn
        }}>
            {" "}
            {pendingCount} pengajuan baru menunggu diproses.
          </b>}
      </div>

      <div style={{
        marginBottom: 14
      }}>
        <Select value={filter} onChange={setFilter} options={[{
          value: "pending",
          label: "Menunggu Diproses"
        }, {
          value: "aktif",
          label: "Masih Berjalan"
        }, {
          value: "progress",
          label: "Progress"
        }, {
          value: "ditunda",
          label: "Ditunda"
        }, {
          value: "selesai",
          label: "Selesai"
        }, {
          value: "ditolak",
          label: "Ditolak"
        }, {
          value: "all",
          label: "Semua"
        }]} />
      </div>

      {list.length === 0 && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>
          Tidak ada pengajuan untuk filter ini.
        </div>}
      {list.map(item => <PengajuanCard key={item.id} item={item}>
          {openId !== item.id ? <button onClick={() => {
          setOpenId(item.id);
          setStatus("progress");
          setCatatan("");
        }} style={{
          marginTop: 10,
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "7px 12px",
          background: "transparent",
          color: T.accentDeep,
          ...FI,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer"
        }} className="ais-button ais-button--default">
              Proses Pengajuan
            </button> : <div style={{
          marginTop: 10
        }}>
              <SectionLabel>Respon</SectionLabel>
              <div style={{
            marginBottom: 8
          }}>
                <Select value={status} onChange={setStatus} options={[{
              value: "progress",
              label: "Progress"
            }, {
              value: "ditunda",
              label: "Ditunda"
            }, {
              value: "selesai",
              label: "Selesai"
            }, {
              value: "ditolak",
              label: "Ditolak"
            }]} />
              </div>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder={status === "progress" ? "Keterangan progress (wajib)" : "Catatan (opsional)"} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 10px",
            ...FI,
            fontSize: 12.5,
            resize: "none",
            marginBottom: 8
          }} className="ais-control" />
              <div style={{
            display: "flex",
            gap: 8
          }} className="ais-flex-layout">
                <button onClick={() => proses(item)} disabled={status === "progress" && !catatan.trim()} style={{
              flex: 1,
              border: "none",
              borderRadius: 9,
              padding: "9px 12px",
              background: status === "progress" && !catatan.trim() ? T.line : T.manajemen,
              color: "#fff",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: status === "progress" && !catatan.trim() ? "not-allowed" : "pointer"
            }} className="ais-button ais-button--primary">
                  Kirim Respon
                </button>
                <button onClick={() => setOpenId(null)} style={{
              border: `1px solid ${T.line}`,
              borderRadius: 9,
              padding: "9px 14px",
              background: "transparent",
              color: T.inkMuted,
              ...FI,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer"
            }} className="ais-button ais-button--default">
                  Batal
                </button>
              </div>
            </div>}
        </PengajuanCard>)}
    </div></FormSurface>;
}

/* ---- Snapshoot stok realtime untuk ROQ (SPV toko holding) ----
   Diisi pada TANGGAL CUTOFF ROQ (H-1 pengiriman) paling lambat 14.00. Lewat batas: input terkunci sampai besok,
   ROQ memakai sisa stok laporan H-1, dan Direksi mendapat notifikasi. Satuan Tepung Bumbu, Beras, Minyak = Kg. */
const SNAP_BATAS = "14:00";
const SNAP_KG = ["dry_te_01_001", "dry_be_01_003", "oil_mi_01_001"];
const SNAP_SKIP = ["aym_pa_01_005", "aym_pb_01_006", "aym_sw_01_007", "aym_dd_01_008"]; // potongan ayam: diorder sebagai Ayam Original
const snapSatuan = b => SNAP_KG.includes(b.id) ? "Kg" : (/\(([^)]+)\)\s*$/.exec(b.name) || [])[1] || "";
const snapNama = b => b.name.replace(/\s*\([^)]*\)\s*$/, "");

// Parameter ROQ per toko: ais-roq-param = { [storeId]: param }; format lama (satu parameter global) tetap terbaca.
const snapParamToko = (all, sid) => all && all[sid] && typeof all[sid] === "object" ? all[sid] : all && all.cycle != null ? all : null;
function SnapshootForm({
  emp,
  now,
  roqParam,
  roqSnapshots,
  setRoqSnapshots,
  roqIngatkan
}) {
  const holding = (emp.stores || [emp.store]).filter(id => id && !isMitraStore(id));
  const [store, setStore] = useState(holding[0]);
  const [qty, setQty] = useState({});
  const today = dateStr(now);
  const jam = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const paramToko = snapParamToko(roqParam, store);
  const batas = paramToko && paramToko.aturan && paramToko.aturan.snapshotBatas || SNAP_BATAS; // dari Master ROQ siklus ini
  const kirim = paramToko ? paramToko.tglKirim || addDays(today, 1) : null;
  const cutoff = kirim ? addDays(kirim, -1) : null;
  const isCutoff = !!cutoff && today === cutoff;
  const ingat = (roqIngatkan || []).filter(x => x.storeId === store && x.cutoff === cutoff).sort((a, b) => (b.at || "").localeCompare(a.at || ""))[0];
  const existing = (roqSnapshots || []).filter(x => x.storeId === store && x.tanggal === today).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))[0];
  const lewat = jam >= batas;
  const terlambat = isCutoff && lewat && !existing;
  const bisaIsi = isCutoff && !lewat;
  const list = store ? bahanTokoIni(store).filter(b => !SNAP_SKIP.includes(b.id)) : [];
  useEffect(() => {
    setQty(existing ? Object.fromEntries(Object.entries(existing.items || {}).map(([k, v]) => [k, String(v)])) : {}); /* eslint-disable-next-line */
  }, [store, existing?.submittedAt]);
  const lengkap = list.length > 0 && list.every(b => qty[b.id] !== undefined && qty[b.id] !== "");
  const submit = async () => {
    const rec = {
      id: `snap_${store}_${today}`,
      storeId: store,
      tanggal: today,
      items: Object.fromEntries(list.map(b => [b.id, Number(qty[b.id]) || 0])),
      namaBahan: Object.fromEntries(list.map(b => [b.id, snapNama(b)])),
      satuan: Object.fromEntries(list.map(b => [b.id, snapSatuan(b)])),
      inputOleh: emp.name,
      inputOlehId: emp.id,
      submittedAt: now.toISOString()
    };
    await setRoqSnapshots([...(roqSnapshots || []).filter(x => x.id !== rec.id), rec]);
  };
  if (!holding.length) return <FormSurface title="Potret persediaan." subtitle="Simpan kondisi stok sebagai dasar perencanaan kebutuhan." code="SNAPSHOT"><div>
        Snapshoot hanya untuk toko holding.
      </div></FormSurface>;
  const kotak = (bg, fg, children) => <div style={{
    background: bg,
    color: fg,
    borderRadius: 12,
    padding: "11px 13px",
    ...FI,
    fontSize: 12.5,
    marginBottom: 12,
    lineHeight: 1.55
  }}>
      {children}
    </div>;
  return <FormSurface title="Potret persediaan." subtitle="Simpan kondisi stok sebagai dasar perencanaan kebutuhan." code="SNAPSHOT"><div>
      <SectionLabel>Snapshoot Stok (ROQ)</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Tanggal
          </div>
          <div style={{
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 10px",
            ...FM,
            fontSize: 13,
            background: T.surfaceSunk
          }} className="ais-content-panel">
            {today}
          </div>
        </div>
        <div>
          <div style={{
            ...FI,
            fontSize: 11,
            color: T.inkMuted,
            marginBottom: 4
          }}>
            Toko
          </div>
          <Select value={store} onChange={setStore} options={holding.map(id => ({
            value: id,
            label: STORES.find(x => x.id === id)?.name || id
          }))} />
        </div>
      </div>
      {!paramToko && kotak(T.surfaceSunk, T.inkMuted, <>
            Jadwal ROQ untuk toko ini belum diatur admin. Snapshoot belum perlu
            diisi.
          </>)}
      {isCutoff && bisaIsi && !existing && ingat && kotak(T.badSoft, T.bad, <>
            <b>Diingatkan {ingat.oleh}</b> pukul{" "}
            {new Date(ingat.at).toTimeString().slice(0, 5)}: segera isi
            snapshoot stok sebelum pukul {batas}.
          </>)}
      {paramToko && !isCutoff && kotak(T.surfaceSunk, T.inkMuted, <>
            Snapshoot diisi pada <b>tanggal cutoff ROQ: {cutoff}</b>, paling
            lambat pukul {batas} (untuk pengiriman {kirim}). Hari ini tidak
            perlu diisi.
          </>)}
      {terlambat && kotak(T.badSoft, T.bad, <>
            <b>Anda terlambat mengisi snapshoot.</b>
            <br />
            Batas pengisian pukul {batas} sudah lewat. Input terkunci sampai
            besok, ROQ otomatis memakai sisa stok laporan H-1, dan Manajemen
            sudah menerima notifikasi.
          </>)}
      {isCutoff && bisaIsi && kotak(T.warnSoft, T.warn, <>
            Isi <b>stok aktual saat ini</b> untuk setiap bahan sebelum pukul{" "}
            {batas}.{" "}
            {existing ? `Sudah dikirim pukul ${new Date(existing.submittedAt).toTimeString().slice(0, 5)} — masih bisa diperbarui sampai ${batas}.` : ""}
          </>)}
      {isCutoff && lewat && existing && kotak(T.goodSoft, T.good, <>
            Snapshoot terkirim pukul{" "}
            {new Date(existing.submittedAt).toTimeString().slice(0, 5)} oleh{" "}
            {existing.inputOleh}. Sudah terkunci.
          </>)}
      {(bisaIsi || existing) && list.map(b => <div key={b.id} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "7px 0",
        borderBottom: `1px solid ${T.line}`
      }} className="ais-flex-layout">
            <div style={{
          ...FI,
          fontSize: 13
        }}>
              {snapNama(b)}{" "}
              <span style={{
            color: T.inkMuted,
            fontSize: 11.5
          }}>
                ({snapSatuan(b)})
              </span>
            </div>
            <input type="number" min="0" step="any" value={qty[b.id] ?? ""} disabled={!bisaIsi} onChange={e => setQty({
          ...qty,
          [b.id]: e.target.value
        })} style={{
          width: 90,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "7px 8px",
          ...FM,
          fontSize: 13,
          textAlign: "right",
          background: bisaIsi ? T.surface : T.surfaceSunk
        }} className="ais-control" />
          </div>)}
      {bisaIsi && <div style={{
        marginTop: 14
      }}>
          {!lengkap && <div style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          marginBottom: 8
        }}>
              Semua bahan wajib diisi (isi 0 bila habis).
            </div>}
          <SubmitBtn disabled={!lengkap} onClick={submit} />
        </div>}
    </div></FormSurface>;
}
function SpvLaporanRiwayat({
  emp,
  reportLog,
  approvalQueue,
  now,
  stockTransfers,
  setStockTransfers,
  stokEditRequests,
  stokEditLock,
  setStokEditLock,
  pengajuan,
  setPengajuan,
  roqParam,
  roqSnapshots,
  setRoqSnapshots,
  roqIngatkan
}) {
  const punyaHolding = (emp.stores || [emp.store]).some(id => id && !isMitraStore(id));
  const dedicatedStores = emp.stores || [emp.store];
  const [tab, setTab] = useState("riwayat");
  const [transferSubTab, setTransferSubTab] = useState("out");
  const pendingInCount = stockTransfers.filter(t => dedicatedStores.includes(t.tujuanToko) && t.status === "pending").length;
  return <div>
      <IdentityCard emp={emp} />
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 18,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 12
    }} className="ais-flex-layout ais-content-panel">
        {[{
        key: "riwayat",
        label: "Riwayat & Detail",
        icon: CalendarDays
      }, {
        key: "transfer",
        label: "Transfer Stok",
        icon: ArrowLeftRight
      }, {
        key: "pengajuan",
        label: "Pengajuan",
        icon: ClipboardList
      }, ...(punyaHolding ? [{
        key: "snapshot",
        label: "Snapshoot",
        icon: Store
      }] : [])].map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 9,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default ais-flex-layout" aria-pressed={tab === t.key}>
            <t.icon size={14} />
            {t.label}
            {t.key === "transfer" && pendingInCount > 0 && <span style={{
          background: T.bad,
          color: "#fff",
          borderRadius: 999,
          width: 16,
          height: 16,
          fontSize: 9.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700
        }}>
                {pendingInCount}
              </span>}
          </button>)}
      </div>

      {tab === "riwayat" && <div>
          <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.inkMuted,
        marginBottom: 14,
        background: T.surfaceSunk,
        padding: "9px 12px",
        borderRadius: 10
      }} className="ais-content-panel">
            SPV hanya memantau — input laporan dilakukan lewat Akun Toko (device
            toko). Pilih tanggal untuk melihat rincian laporan hari-hari
            sebelumnya.
          </div>
          <RiwayatLaporanToko emp={emp} allowedStores={dedicatedStores} reportLog={reportLog} setReportLog={() => {}} approvalQueue={approvalQueue} setApprovalQueue={() => {}} now={now} canEditSales={false} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} />
        </div>}

      {tab === "transfer" && <div>
          <div style={{
        display: "flex",
        gap: 6,
        marginBottom: 16,
        background: T.surfaceSunk,
        padding: 4,
        borderRadius: 10,
        width: 260
      }} className="ais-flex-layout ais-content-panel">
            {[{
          key: "out",
          label: "Transfer Out"
        }, {
          key: "in",
          label: `Transfer In${pendingInCount > 0 ? ` (${pendingInCount})` : ""}`
        }].map(t => <button key={t.key} onClick={() => setTransferSubTab(t.key)} style={{
          flex: 1,
          border: "none",
          borderRadius: 8,
          padding: "8px 6px",
          cursor: "pointer",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 12,
          background: transferSubTab === t.key ? T.surface : "transparent",
          color: transferSubTab === t.key ? T.ink : T.inkMuted,
          boxShadow: transferSubTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
        }} className="ais-button ais-button--default" aria-pressed={transferSubTab === t.key}>
                {t.label}
              </button>)}
          </div>
          {transferSubTab === "out" && <div>
              <TransferStokForm emp={emp} now={now} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} />
              <TransferHistoryList emp={emp} stockTransfers={stockTransfers} />
            </div>}
          {transferSubTab === "in" && <TransferInConfirm emp={emp} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} now={now} />}
        </div>}

      {tab === "pengajuan" && <PengajuanSpvForm emp={emp} now={now} pengajuan={pengajuan} setPengajuan={setPengajuan} />}

      {tab === "snapshot" && <SnapshootForm emp={emp} now={now} roqParam={roqParam} roqSnapshots={roqSnapshots} setRoqSnapshots={setRoqSnapshots} roqIngatkan={roqIngatkan} />}
    </div>;
}

/* ---- Wrapper untuk Eri & Direksi: ringkasan hari ini + riwayat lintas tanggal ---- */
/* ---- Stok Opname (Eri & Elin) ---- */
function computeStokAwalAuto(storeId, bahanId, ds, reportLog, stockTransfers, stockOpname) {
  const kemarin = addDays(ds, -1);
  const akhirKemarin = reportLog[`${storeId}_${kemarin}`]?.stok?.[bahanId]?.akhir;
  if (akhirKemarin == null) return null; // tidak ada histori kemarin, biarkan input manual

  // Transfer In cuma dihitung kalau sudah dikonfirmasi toko tujuan, pakai qty yang benar-benar diterima.
  const transferIn = stockTransfers.filter(t => t.tujuanToko === storeId && t.tanggal === kemarin && t.status === "confirmed").flatMap(t => t.konfirmasi?.items || []).filter(it => it.bahanId === bahanId).reduce((s, it) => s + it.qtyTerima, 0);
  // Transfer Out langsung mengurangi stok toko asal begitu dikirim, tidak menunggu konfirmasi.
  const transferOut = stockTransfers.filter(t => t.asalToko === storeId && t.tanggal === kemarin).flatMap(t => t.items).filter(it => it.bahanId === bahanId).reduce((s, it) => s + it.qty, 0);
  const adjustment = stockOpname.filter(o => o.storeId === storeId && o.tanggal === kemarin).flatMap(o => o.items).filter(it => it.bahanId === bahanId).reduce((s, it) => s + it.selisih, 0);
  return akhirKemarin + transferIn - transferOut + adjustment;
}

// Transfer Stok yang terjadi PADA HARI YANG SAMA harus ikut masuk ke Stok Akhir hari itu juga
// (bukan ditunda ke Stok Awal besok) — supaya konsisten dengan formula Ringkasan Stok di Dashboard Inventory.
function computeTransferNetToday(storeId, bahanId, ds, stockTransfers) {
  const transferIn = stockTransfers.filter(t => t.tujuanToko === storeId && t.tanggal === ds && t.status === "confirmed").flatMap(t => t.konfirmasi?.items || []).filter(it => it.bahanId === bahanId).reduce((s, it) => s + it.qtyTerima, 0);
  const transferOut = stockTransfers.filter(t => t.asalToko === storeId && t.tanggal === ds).flatMap(t => t.items).filter(it => it.bahanId === bahanId).reduce((s, it) => s + it.qty, 0);
  return {
    transferIn,
    transferOut
  };
}
function getStokLock(stokEditLock, storeId, tanggal) {
  return stokEditLock[`${storeId}_${tanggal}`] || {
    editCount: 0,
    direksiStatus: "none",
    direksiApprovals: {}
  };
}
function getRecordedStock(storeId, bahanId, reportLog) {
  const keys = Object.keys(reportLog).filter(k => k.startsWith(storeId + "_")).sort().reverse();
  for (const key of keys) {
    const stokData = reportLog[key]?.stok;
    if (stokData && stokData[bahanId]?.akhir != null) return stokData[bahanId].akhir;
  }
  return 0;
}
function fmtWaktuID(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString("id-ID")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function StokOpnamePage({
  emp,
  reportLog,
  stockOpname,
  setStockOpname,
  opnameStatus,
  setOpnameStatus,
  now
}) {
  const [store, setStore] = useState(STORES[0].id);
  const today = dateStr(now);
  const key = `${store}_${today}`;
  const statusData = opnameStatus[key] || {
    status: "empty",
    approvals: {}
  };
  const setStatus = next => setOpnameStatus({
    ...opnameStatus,
    [key]: {
      ...statusData,
      ...next
    }
  });
  const existingRecord = stockOpname.find(o => o.storeId === store && o.tanggal === today);
  const isSubmitterRole = emp.id === "eri" || emp.id === "elin";
  const isApprover = emp.id === "juhaeri" || emp.id === "kurnia";
  const canInput = isSubmitterRole && (statusData.status === "empty" || statusData.status === "unlocked");
  const [rows, setRows] = useState(() => bahanTokoIni(store).map(b => ({
    bahanId: b.id,
    aktual: "",
    keterangan: ""
  })));
  useEffect(() => {
    setRows(bahanTokoIni(store).map(b => ({
      bahanId: b.id,
      aktual: "",
      keterangan: ""
    })));
  }, [store]);
  const updateRow = (idx, field, val) => setRows(rows.map((r, i) => i === idx ? {
    ...r,
    [field]: val
  } : r));
  const computed = rows.map(r => {
    const bahan = BAHAN_BAKU.find(b => b.id === r.bahanId);
    const tercatat = getRecordedStock(store, r.bahanId, reportLog);
    const aktual = r.aktual === "" ? null : Number(r.aktual);
    const selisih = aktual == null ? null : aktual - tercatat;
    return {
      ...r,
      bahan,
      tercatat,
      aktual,
      selisih
    };
  });
  const complete = computed.every(r => r.aktual != null && (r.selisih >= 0 || r.keterangan.trim().length > 0));
  const submit = async () => {
    const wasEdit = statusData.status === "unlocked";
    const record = {
      id: existingRecord?.id || `opname_${Date.now()}`,
      storeId: store,
      tanggal: today,
      items: computed.map(r => ({
        bahanId: r.bahanId,
        bahanName: r.bahan.name,
        tercatat: r.tercatat,
        aktual: r.aktual,
        selisih: r.selisih,
        keterangan: r.keterangan
      })),
      inputOleh: emp.name,
      inputOlehId: emp.id,
      submittedAt: now.toISOString()
    };
    if (existingRecord) {
      await setStockOpname(stockOpname.map(o => o.id === existingRecord.id ? record : o));
    } else {
      await setStockOpname([...stockOpname, record]);
    }
    setStatus({
      status: "locked",
      submittedBy: statusData.submittedBy || emp.name,
      submittedAt: statusData.submittedAt || now.toISOString(),
      ...(wasEdit ? {
        editedBy: emp.name,
        editedAt: now.toISOString()
      } : {})
    });
    setRows(bahanTokoIni(store).map(b => ({
      bahanId: b.id,
      aktual: "",
      keterangan: ""
    })));
  };
  const requestEdit = () => setStatus({
    status: "edit_requested",
    editRequestedBy: emp.name,
    editRequestedAt: now.toISOString(),
    approvals: {}
  });
  const approveEdit = () => {
    const nextApprovals = {
      ...(statusData.approvals || {}),
      [emp.id]: true
    };
    const bothApproved = nextApprovals.kurnia && nextApprovals.juhaeri;
    setStatus({
      approvals: nextApprovals,
      status: bothApproved ? "unlocked" : "edit_requested"
    });
  };
  const riwayat = stockOpname.filter(o => o.storeId === store && o.tanggal !== today).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || "")).slice(0, 5);
  return <FormSurface title="Stok aktual. Gambaran utuh." subtitle="Lakukan pencatatan persediaan sesuai tahapan pemeriksaan." code="OPNAME"><div>
      <SectionLabel>Toko</SectionLabel>
      <div style={{
        marginBottom: 14
      }}>
        <Select value={store} onChange={setStore} options={STORES_HOLDING.map(s => ({
          value: s.id,
          label: s.name
        }))} />
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 16
      }}>
        Stok Tercatat diambil dari laporan stok toko terakhir (sesuai Dashboard
        &gt; Inventory &gt; Stok Akhir) — tidak dapat diedit di sini. Stok
        Opname hanya bisa dilakukan <b>1 kali per toko per hari</b>, oleh Eri
        atau Elin (siapa pun yang lebih dulu).
      </div>

      {statusData.status === "locked" && <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
        background: T.goodSoft,
        color: T.good,
        padding: "10px 14px",
        borderRadius: 12
      }} className="ais-flex-layout">
          <span style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600
        }}>
            Terkunci — disubmit oleh {statusData.submittedBy} pada{" "}
            {fmtWaktuID(statusData.submittedAt)}.
            {statusData.editedBy && ` Terakhir diedit oleh ${statusData.editedBy} pada ${fmtWaktuID(statusData.editedAt)}.`}
          </span>
          {isSubmitterRole && <button onClick={requestEdit} style={{
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          background: T.good,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 11.5,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0
        }} className="ais-button ais-button--primary">
              Ajukan Edit
            </button>}
        </div>}

      {statusData.status === "edit_requested" && <div style={{
        marginBottom: 14,
        background: T.warnSoft,
        color: T.warn,
        padding: "10px 14px",
        borderRadius: 12
      }}>
          <div style={{
          ...FI,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6
        }}>
            Menunggu approval Kurnia & Juhaeri untuk membuka edit (diajukan oleh{" "}
            {statusData.editRequestedBy}).
          </div>
          <div style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap"
        }} className="ais-flex-layout">
            <span style={{
            ...FI,
            fontSize: 11.5
          }}>
              Kurnia:{" "}
              <b>{statusData.approvals?.kurnia ? "Setuju" : "Menunggu"}</b>
            </span>
            <span style={{
            ...FI,
            fontSize: 11.5
          }}>
              Juhaeri:{" "}
              <b>{statusData.approvals?.juhaeri ? "Setuju" : "Menunggu"}</b>
            </span>
            {isApprover && !statusData.approvals?.[emp.id] && <button onClick={approveEdit} style={{
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            background: T.warn,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 11.5,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
                Setujui Buka Edit
              </button>}
          </div>
        </div>}

      {statusData.status === "unlocked" && isSubmitterRole && <div style={{
        marginBottom: 14,
        background: T.accentSoft,
        color: T.accentDeep,
        padding: "10px 14px",
        borderRadius: 12,
        ...FI,
        fontSize: 12,
        fontWeight: 600
      }}>
          Akses edit terbuka (disetujui Kurnia & Juhaeri) — silakan edit lalu
          submit ulang.
        </div>}

      {canInput ? <div>
          {computed.map((r, idx) => <div key={r.bahanId} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 10
        }}>
              <div style={{
            ...FI,
            fontWeight: 700,
            fontSize: 13.5,
            marginBottom: 8
          }}>
                {r.bahan.name}
              </div>
              <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: r.selisih < 0 ? 8 : 0
          }} className="ais-responsive-grid">
                <div>
                  <div style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted,
                marginBottom: 3
              }}>
                    Stok Tercatat
                  </div>
                  <div style={{
                ...FM,
                fontWeight: 700,
                fontSize: 14,
                color: T.ink,
                background: T.surfaceSunk,
                padding: "7px 9px",
                borderRadius: 8,
                textAlign: "center"
              }} className="ais-content-panel">
                    {r.tercatat}
                  </div>
                </div>
                <div>
                  <div style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted,
                marginBottom: 3
              }}>
                    Stok Aktual (Opname)
                  </div>
                  <input type="number" value={r.aktual ?? ""} onChange={e => updateRow(idx, "aktual", e.target.value)} style={{
                width: "100%",
                border: `1px solid ${T.line}`,
                borderRadius: 8,
                padding: "7px 9px",
                ...FM,
                fontSize: 14,
                textAlign: "center"
              }} className="ais-control" />
                </div>
                <div>
                  <div style={{
                ...FI,
                fontSize: 10.5,
                color: T.inkMuted,
                marginBottom: 3
              }}>
                    Selisih
                  </div>
                  <div style={{
                fontFamily: "JetBrains Mono",
                fontWeight: 700,
                fontSize: 14,
                textAlign: "center",
                padding: "7px 9px",
                borderRadius: 8,
                background: r.selisih == null ? T.surfaceSunk : r.selisih < 0 ? T.badSoft : r.selisih > 0 ? T.goodSoft : T.surfaceSunk,
                color: r.selisih == null ? T.inkMuted : r.selisih < 0 ? T.bad : r.selisih > 0 ? T.good : T.inkMuted
              }}>
                    {r.selisih == null ? "-" : `${r.selisih > 0 ? "+" : ""}${r.selisih}`}
                  </div>
                </div>
              </div>
              {r.selisih < 0 && <div>
                  <div style={{
              ...FI,
              fontSize: 10.5,
              color: T.bad,
              marginBottom: 3,
              fontWeight: 600
            }}>
                    Alasan / Keterangan (wajib)
                  </div>
                  <input value={r.keterangan} onChange={e => updateRow(idx, "keterangan", e.target.value)} placeholder="Jelaskan penyebab selisih…" style={{
              width: "100%",
              border: `1px solid ${T.bad}`,
              borderRadius: 8,
              padding: "7px 9px",
              ...FI,
              fontSize: 12.5
            }} className="ais-control" />
                </div>}
            </div>)}
          <SubmitBtn label={statusData.status === "unlocked" ? "Simpan & Kunci Kembali" : "Submit Stok Opname"} disabled={!complete} onClick={submit} />
        </div> : <div>
          {!existingRecord && <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted
        }}>
              Belum ada Stok Opname untuk toko & tanggal ini.
            </div>}
          {existingRecord && existingRecord.items.map(it => <div key={it.bahanId} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 8
        }}>
                <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
                  <span style={{
              ...FI,
              fontWeight: 700,
              fontSize: 13
            }}>
                    {it.bahanName}
                  </span>
                  <span style={{
              ...FM,
              fontWeight: 700,
              fontSize: 13,
              color: it.selisih < 0 ? T.bad : it.selisih > 0 ? T.good : T.inkMuted
            }}>
                    {it.selisih > 0 ? "+" : ""}
                    {it.selisih}
                  </span>
                </div>
                <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginTop: 2
          }}>
                  Tercatat {it.tercatat} → Aktual {it.aktual}
                </div>
                {it.keterangan && <div style={{
            ...FI,
            fontSize: 12,
            color: T.bad,
            marginTop: 3,
            fontStyle: "italic"
          }}>
                    "{it.keterangan}"
                  </div>}
              </div>)}
        </div>}

      {riwayat.length > 0 && <div style={{
        marginTop: 24
      }}>
          <SectionLabel>Riwayat Opname Toko Ini (Hari Sebelumnya)</SectionLabel>
          {riwayat.map(o => <div key={o.id} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 8
        }}>
              <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4
          }}>
                <span style={{
              ...FI,
              fontWeight: 700,
              fontSize: 12.5
            }}>
                  {o.tanggal}
                </span>
                <span style={{
              ...FI,
              fontSize: 11.5,
              color: T.inkMuted
            }}>
                  {o.inputOleh}
                </span>
              </div>
              {o.items.filter(it => it.selisih !== 0).map((it, i) => <div key={i} style={{
            ...FI,
            fontSize: 12,
            color: it.selisih < 0 ? T.bad : T.good
          }}>
                    {it.bahanName}: {it.selisih > 0 ? "+" : ""}
                    {it.selisih}
                    {it.keterangan ? ` — "${it.keterangan}"` : ""}
                  </div>)}
              {o.items.every(it => it.selisih === 0) && <div style={{
            ...FI,
            fontSize: 12,
            color: T.good
          }}>
                  Semua sesuai, tidak ada selisih.
                </div>}
            </div>)}
        </div>}
    </div></FormSurface>;
}
function LaporanTokoAdminView({
  emp,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  now,
  stokEditRequests,
  stokEditLock,
  setStokEditLock,
  stockTransfers,
  setStockTransfers,
  pengajuan,
  setPengajuan
}) {
  const [tab, setTab] = useState("ringkasan");
  const canEditSales = emp.id === "eri";
  const isEri = emp.id === "eri";
  return <div>
      <IdentityCard emp={emp} />
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 18,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 12,
      flexWrap: "wrap"
    }} className="ais-flex-layout ais-content-panel">
        {[{
        key: "ringkasan",
        label: "Ringkasan Hari Ini",
        icon: ClipboardList,
        show: true
      }, {
        key: "riwayat",
        label: "Riwayat & Detail",
        icon: CalendarDays,
        show: true
      }, {
        key: "transferstok",
        label: "Transfer Stok",
        icon: ArrowLeftRight,
        show: isEri
      }, {
        key: "pengajuan",
        label: "Pengajuan",
        icon: ClipboardList,
        show: emp.id === "eri" || emp.id === "nana"
      }].filter(t => t.show).map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: "1 1 30%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 9,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default ais-flex-layout" aria-pressed={tab === t.key}>
              <t.icon size={14} />
              {t.label}
            </button>)}
      </div>
      {tab === "ringkasan" && <LaporanMonitoring emp={emp} reportLog={reportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} now={now} />}
      {tab === "riwayat" && <RiwayatLaporanToko emp={emp} allowedStores={STORES_HOLDING.map(s => s.id)} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} now={now} canEditSales={canEditSales} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} />}
      {tab === "transferstok" && isEri && <TransferMonitoringEri stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} emp={emp} now={now} />}
      {tab === "pengajuan" && (emp.id === "eri" || emp.id === "nana") && <PengajuanProsesPanel emp={emp} now={now} pengajuan={pengajuan} setPengajuan={setPengajuan} />}
    </div>;
}

/* ---- Elin: review Stok Bahan Baku, terbatas tanggal kemarin saja ---- */
function StokReviewElin({
  emp,
  reportLog,
  setReportLog,
  approvalQueue,
  setApprovalQueue,
  stokEditRequests,
  setStokEditRequests,
  stokEditLock,
  setStokEditLock,
  stockOpname,
  now
}) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const ds = dateStr(yesterday);
  const [store, setStore] = useState(STORES[0].id);
  const [viewDate, setViewDate] = useState(ds);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const isYesterday = viewDate === ds;
  const key = `${store}_${viewDate}`;
  const data = reportLog[key]?.stok;
  const approvalEntry = approvalQueue.find(a => a.storeId === store && a.date === viewDate && a.type === "stok");
  const pendingEditReq = [...stokEditRequests].reverse().find(r => r.storeId === store && r.tanggal === viewDate && r.status === "pending");
  const lockInfo = getStokLock(stokEditLock, store, viewDate);
  const opnameDate = addDays(viewDate, -1);
  const bahanList = bahanTokoIni(store);
  const opnameAdjustments = Object.fromEntries(bahanList.map(b => [b.id, (stockOpname || []).filter(o => o.storeId === store && o.tanggal === opnameDate).flatMap(o => o.items).filter(it => it.bahanId === b.id).reduce((s, it) => s + it.selisih, 0)]));
  const canEditFreely = lockInfo.editCount === 0 || lockInfo.direksiStatus === "approved";
  useEffect(() => {
    if (editing && data) {
      const r = {};
      bahanList.forEach(b => {
        r[b.id] = {
          awal: data[b.id]?.awal ?? "",
          masuk: data[b.id]?.masuk ?? "",
          pakai: data[b.id]?.pakai ?? ""
        };
      });
      setRows(r);
    }
  }, [editing, store, viewDate]);
  useEffect(() => {
    setEditing(false);
  }, [viewDate, store]);
  const decide = status => {
    if (!approvalEntry || !isYesterday) return;
    setApprovalQueue(approvalQueue.map(a => a.id === approvalEntry.id ? {
      ...a,
      status,
      respondedAt: now.toISOString(),
      decidedBy: emp.name
    } : a));
  };
  const requestDireksiApproval = () => {
    if (!isYesterday) return;
    setStokEditLock({
      ...stokEditLock,
      [key]: {
        ...lockInfo,
        direksiStatus: "pending",
        direksiApprovals: {},
        requestedBy: emp.name,
        requestedAt: now.toISOString()
      }
    });
  };
  const approveEditRequest = () => {
    if (!canEditFreely || !isYesterday) return;
    if (pendingEditReq) {
      setStokEditRequests(stokEditRequests.map(r => r.id === pendingEditReq.id ? {
        ...r,
        status: "approved",
        decidedBy: emp.name,
        decidedAt: now.toISOString()
      } : r));
    }
    setEditing(true);
  };
  const rejectEditRequest = () => {
    if (!pendingEditReq || !isYesterday) return;
    setStokEditRequests(stokEditRequests.map(r => r.id === pendingEditReq.id ? {
      ...r,
      status: "rejected",
      decidedBy: emp.name,
      decidedAt: now.toISOString(),
      decidedNote: rejectNote
    } : r));
    setShowRejectBox(false);
    setRejectNote("");
  };
  const saveEdit = () => {
    if (!isYesterday) return;
    const payload = {};
    bahanList.forEach(b => {
      const r = rows[b.id];
      const transferIn = data[b.id]?.transferIn || 0;
      const transferOut = data[b.id]?.transferOut || 0;
      payload[b.id] = {
        awal: Number(r.awal) || 0,
        masuk: Number(r.masuk) || 0,
        pakai: Number(r.pakai) || 0,
        transferIn,
        transferOut,
        akhir: (Number(r.awal) || 0) + (Number(r.masuk) || 0) - (Number(r.pakai) || 0) + transferIn - transferOut
      };
    });
    setReportLog({
      ...reportLog,
      [key]: {
        ...reportLog[key],
        stok: {
          ...data,
          ...payload,
          editedBy: emp.name,
          editedAt: now.toISOString(),
          editReason: pendingEditReq?.alasan || ""
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
    // Submit edit otomatis menyatukan approval — tidak perlu klik Approve terpisah lagi setelah edit.
    if (approvalEntry && approvalEntry.status === "pending") {
      setApprovalQueue(approvalQueue.map(a => a.id === approvalEntry.id ? {
        ...a,
        status: "approved",
        respondedAt: now.toISOString(),
        decidedBy: emp.name
      } : a));
    }
    setEditing(false);
  };
  return <div>
      <IdentityCard emp={emp} />
      <div style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted,
      marginBottom: 14,
      background: T.surfaceSunk,
      padding: "9px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Anda bisa melihat laporan Stok Bahan Baku dari tanggal manapun, tapi{" "}
        <b>
          edit & review (approve/reject) hanya berlaku untuk tanggal kemarin (
          {ds})
        </b>{" "}
        — karena laporan diinput crew toko saat closing malam hari, di luar jam
        kerja manajemen. Tanggal lain hanya bisa dilihat.
      </div>
      <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 6
    }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Toko</SectionLabel>
          <Select value={store} onChange={setStore} options={STORES_HOLDING.map(s => ({
          value: s.id,
          label: s.name
        }))} />
        </div>
        <div>
          <SectionLabel>Tanggal</SectionLabel>
          <input type="date" max={ds} value={viewDate} onChange={e => setViewDate(e.target.value)} style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "9px 12px",
          ...FI,
          fontSize: 13.5,
          background: T.surfaceSunk
        }} className="ais-control" />
        </div>
      </div>
      {!isYesterday && <div style={{
      marginTop: 8,
      ...FI,
      fontSize: 11.5,
      color: T.warn
    }}>
          Mode lihat saja — tanggal ini bukan kemarin, jadi tidak bisa
          diedit/direview.
        </div>}

      {isYesterday && lockInfo.editCount > 0 && <div style={{
      marginTop: 14,
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted
    }}>
          Laporan ini sudah diedit {lockInfo.editCount}x. Edit berikutnya butuh
          approval Kurnia & Juhaeri.
        </div>}

      {isYesterday && !canEditFreely && lockInfo.direksiStatus === "none" && !editing && <div style={{
      marginTop: 10,
      background: T.warnSoft,
      borderRadius: 12,
      padding: "12px 14px"
    }}>
            <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.warn,
        fontWeight: 600,
        marginBottom: 8
      }}>
              Sudah pernah diedit {lockInfo.editCount}x — edit berikutnya harus
              disetujui Kurnia & Juhaeri dulu.
            </div>
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
      }} className="ais-button ais-button--primary">
              Ajukan Approval Manajemen
            </button>
          </div>}

      {isYesterday && !canEditFreely && lockInfo.direksiStatus === "pending" && !editing && <div style={{
      marginTop: 10,
      background: T.warnSoft,
      borderRadius: 12,
      padding: "12px 14px"
    }}>
            <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.warn,
        fontWeight: 600,
        marginBottom: 6
      }}>
              Menunggu approval Manajemen untuk edit berikutnya.
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        ...FI,
        fontSize: 11.5
      }} className="ais-flex-layout">
              <span>
                Kurnia:{" "}
                <b>
                  {lockInfo.direksiApprovals?.kurnia ? "Setuju" : "Menunggu"}
                </b>
              </span>
              <span>
                Juhaeri:{" "}
                <b>
                  {lockInfo.direksiApprovals?.juhaeri ? "Setuju" : "Menunggu"}
                </b>
              </span>
            </div>
          </div>}

      {isYesterday && pendingEditReq && !editing && <div style={{
      marginTop: 14,
      background: T.warnSoft,
      borderRadius: 12,
      padding: "12px 14px"
    }}>
          <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 13,
        color: T.warn,
        marginBottom: 4
      }}>
            Permintaan Edit dari {pendingEditReq.requestedBy}
          </div>
          <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.ink,
        marginBottom: 2
      }}>
            Bagian: "{pendingEditReq.deskripsi}"
          </div>
          <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.ink,
        marginBottom: 10
      }}>
            Alasan: "{pendingEditReq.alasan}"
          </div>
          {!canEditFreely ? <div style={{
        ...FI,
        fontSize: 11.5,
        color: T.bad
      }}>
              Belum bisa diproses — menunggu approval Manajemen untuk edit
              berikutnya (lihat di atas).
            </div> : !showRejectBox ? <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
              <button onClick={approveEditRequest} style={{
          flex: 1,
          border: "none",
          borderRadius: 8,
          padding: "8px 10px",
          background: T.good,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">
                Approve & Edit
              </button>
              <button onClick={() => setShowRejectBox(true)} style={{
          flex: 1,
          border: `1px solid ${T.bad}`,
          borderRadius: 8,
          padding: "8px 10px",
          background: "transparent",
          color: T.bad,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--danger">
                Reject
              </button>
            </div> : <div>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2} placeholder="Catatan penolakan (opsional)" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 8,
          padding: "8px 9px",
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
                <button onClick={rejectEditRequest} style={{
            flex: 1,
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            background: T.bad,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--danger">
                  Kirim Penolakan
                </button>
                <button onClick={() => setShowRejectBox(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "8px 12px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                  Batal
                </button>
              </div>
            </div>}
        </div>}

      <div style={{
      marginTop: 16
    }}>
        {!data && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>
            Belum ada laporan stok untuk tanggal ini di toko ini.
          </div>}
        {data && !editing && <StageSummary stageKey="stok" data={data} bahanList={bahanTokoIni(store)} approvalEntry={approvalEntry} stokEditInfo={pendingEditReq} expandedElin opnameAdjustments={opnameAdjustments} actions={isYesterday ? <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
                  {canEditFreely && <button onClick={() => setEditing(true)} style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "7px 12px",
          background: "transparent",
          color: T.ink,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default ais-flex-layout">
                      <PenLine size={13} /> Edit
                    </button>}
                  {approvalEntry?.status === "pending" && <>
                      <button onClick={() => decide("approved")} style={{
            flex: 1,
            border: "none",
            borderRadius: 9,
            padding: "7px 12px",
            background: T.good,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
                        Approve
                      </button>
                      <button onClick={() => decide("rejected")} style={{
            flex: 1,
            border: `1px solid ${T.bad}`,
            borderRadius: 9,
            padding: "7px 12px",
            background: "transparent",
            color: T.bad,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--danger">
                        Reject
                      </button>
                    </>}
                </div> : null} />}
        {data && editing && rows && <div>
            <div style={{
          overflowX: "auto",
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          marginBottom: 12,
          WebkitOverflowScrolling: "touch"
        }}>
              <table style={{
            borderCollapse: "collapse",
            ...FI,
            fontSize: 12,
            minWidth: 430
          }}>
                <thead>
                  <tr style={{
                background: T.surfaceSunk,
                textAlign: "left"
              }}>
                    <th style={{
                  padding: "6px 8px",
                  position: "sticky",
                  left: 0,
                  background: T.surfaceSunk,
                  zIndex: 2,
                  minWidth: 130
                }}>
                      Bahan
                    </th>
                    <th style={{
                  padding: "6px 6px",
                  whiteSpace: "nowrap"
                }}>
                      Awal
                    </th>
                    <th style={{
                  padding: "6px 6px",
                  whiteSpace: "nowrap"
                }}>
                      In
                    </th>
                    <th style={{
                  padding: "6px 6px",
                  whiteSpace: "nowrap"
                }}>
                      Pakai
                    </th>
                    <th style={{
                  padding: "6px 6px",
                  whiteSpace: "nowrap"
                }}>
                      Akhir
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bahanList.map(b => {
                const r = rows[b.id];
                const transferIn = data[b.id]?.transferIn || 0;
                const transferOut = data[b.id]?.transferOut || 0;
                const akhir = (Number(r.awal) || 0) + (Number(r.masuk) || 0) - (Number(r.pakai) || 0) + transferIn - transferOut;
                return <tr key={b.id} style={{
                  borderTop: `1px solid ${T.line}`
                }}>
                        <td style={{
                    padding: "6px 8px",
                    fontWeight: 600,
                    position: "sticky",
                    left: 0,
                    background: T.surface,
                    zIndex: 1,
                    minWidth: 130
                  }}>
                          {b.name}
                        </td>
                        {["awal", "masuk", "pakai"].map(f => <td key={f} style={{
                    padding: "4px 6px"
                  }}>
                            <input type="number" value={r[f]} onChange={e => setRows({
                      ...rows,
                      [b.id]: {
                        ...r,
                        [f]: e.target.value
                      }
                    })} style={{
                      width: 56,
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
                  }}>
                          {akhir}
                        </td>
                      </tr>;
              })}
                </tbody>
              </table>
            </div>
            <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
              <button onClick={saveEdit} style={{
            flex: 1,
            border: "none",
            borderRadius: 9,
            padding: "9px 12px",
            background: T.manajemen,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
                Simpan Penyesuaian
              </button>
              <button onClick={() => setEditing(false)} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "9px 14px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                Batal
              </button>
            </div>
          </div>}
      </div>
    </div>;
}

/* ---------------------------------------------------------
   MODUL 4 — APPROVAL DASHBOARD PENUH & ROLE PERMISSION
--------------------------------------------------------- */
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
    background: T.surfaceSunk,
    borderRadius: 12,
    padding: "10px 12px"
  }} className="ais-content-panel">
      <div style={{
      ...FM,
      fontWeight: 700,
      fontSize: 20,
      color: map[tone]
    }}>
        {value}
      </div>
      <div style={{
      ...FI,
      fontSize: 10.5,
      color: T.inkMuted,
      marginTop: 2
    }}>
        {label}
      </div>
    </div>;
}
function ApprovalHistoryRow({
  item
}) {
  const tone = item.status === "approved" ? "good" : "bad";
  return <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "9px 0",
    borderBottom: `1px solid ${T.line}`
  }}>
      <div>
        <div style={{
        ...FI,
        fontWeight: 600,
        fontSize: 13
      }}>
          {storeName(item.storeId)}{" "}
          <span style={{
          color: T.inkMuted,
          fontWeight: 500
        }}>
            · {APPROVAL_TYPE_LABEL[item.type]}
          </span>
        </div>
        <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted
      }}>
          {item.date} · diputuskan{" "}
          {item.respondedAt ? new Date(item.respondedAt).toLocaleTimeString("id-ID").slice(0, 5) : "-"}
          {item.decidedBy ? ` oleh ${item.decidedBy}` : ""}
          {item.payload?.inputOleh ? ` · Input: ${item.payload.inputOleh}` : ""}
        </div>
      </div>
      <Badge tone={tone}>
        {item.status === "approved" ? "Disetujui" : "Ditolak"}
      </Badge>
    </div>;
}
function ApprovalDashboard({
  emp,
  reportLog,
  approvalQueue,
  setApprovalQueue,
  now
}) {
  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");
  const ds = dateStr(now);

  // Approval Stok Bahan Baku sudah eksklusif ditangani Elin (lihat StokReviewElin), jadi tidak lagi
  // ditampilkan di tab Approval umum ini.
  const relevantQueue = approvalQueue.filter(a => a.type !== "stok");
  const decide = (item, status, finalQty) => {
    setApprovalQueue(approvalQueue.map(a => a.id === item.id ? {
      ...a,
      status,
      respondedAt: now.toISOString(),
      decidedBy: emp.name,
      ...(finalQty != null ? {
        finalQty
      } : {})
    } : a));
  };
  const pendingAll = relevantQueue.filter(a => a.status === "pending");
  const approvedToday = relevantQueue.filter(a => a.status === "approved" && a.respondedAt?.startsWith(ds));
  const rejectedToday = relevantQueue.filter(a => a.status === "rejected" && a.respondedAt?.startsWith(ds));
  const filtered = relevantQueue.filter(a => filterStore === "all" || a.storeId === filterStore).filter(a => filterStatus === "all" || a.status === filterStatus).filter(a => filterType === "all" || a.type === filterType).sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""));
  return <div>
      <SectionLabel>Ringkasan Approval</SectionLabel>
      <div style={{
      display: "flex",
      gap: 8,
      marginBottom: 18
    }} className="ais-flex-layout">
        <StatCard label="Menunggu" value={pendingAll.length} tone="warn" />
        <StatCard label="Disetujui Hari Ini" value={approvedToday.length} tone="good" />
        <StatCard label="Ditolak Hari Ini" value={rejectedToday.length} tone="bad" />
      </div>

      <SectionLabel>Filter</SectionLabel>
      <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 16
    }} className="ais-responsive-grid">
        <Select value={filterStore} onChange={setFilterStore} options={[{
        value: "all",
        label: "Semua Toko"
      }, ...STORES_HOLDING.map(s => ({
        value: s.id,
        label: s.name
      }))]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{
        value: "all",
        label: "Semua Status"
      }, {
        value: "pending",
        label: "Menunggu"
      }, {
        value: "approved",
        label: "Disetujui"
      }, {
        value: "rejected",
        label: "Ditolak"
      }]} />
        <Select value={filterType} onChange={setFilterType} options={[{
        value: "all",
        label: "Semua Jenis"
      }, ...Object.entries(APPROVAL_TYPE_LABEL).filter(([k]) => k !== "stok").map(([k, v]) => ({
        value: k,
        label: v
      }))]} />
      </div>

      <SectionLabel>Daftar ({filtered.length})</SectionLabel>
      {filtered.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Tidak ada data untuk filter ini.
        </div>}
      {filtered.map(item => item.status === "pending" ? <ApprovalCard key={item.id} item={item} onDecide={decide} emp={emp} /> : <ApprovalHistoryRow key={item.id} item={item} />)}
    </div>;
}

/* ---- Role & Akses ---- */
const PERMISSION_ROLES = ["Crew", "SPV", "Akun Toko", "Admin Utama", "Finance", "Admin Inventory", "Graphic Designer", "Direksi"]; // "Direksi" = kunci data; tampil sebagai PERMISSION_ROLE_LABEL
const PERMISSION_ROLE_LABEL = r => r === "Direksi" ? "Manajemen (akses penuh)" : r;
const PERMISSION_PAGES = ["Absensi", "Laporan Toko (Input)", "Laporan Toko (Approval)", "Master Jadwal", "Rekap Absen", "Laporan Harian"];
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
    SPV: "none",
    "Akun Toko": "none",
    "Admin Utama": "edit",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "edit"
  },
  "Rekap Absen": {
    Crew: "none",
    SPV: "none",
    "Akun Toko": "none",
    "Admin Utama": "view",
    Finance: "none",
    "Admin Inventory": "none",
    "Graphic Designer": "none",
    Direksi: "view"
  },
  "Laporan Harian": {
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
function PermissionCell({
  value,
  onChange,
  disabled
}) {
  const meta = PERMISSION_LEVELS.find(l => l.value === value) || PERMISSION_LEVELS[0];
  const idx = PERMISSION_LEVELS.findIndex(l => l.value === value);
  const cycle = () => !disabled && onChange(PERMISSION_LEVELS[(idx + 1) % PERMISSION_LEVELS.length].value);
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
  return <button onClick={cycle} disabled={disabled} style={{
    border: "none",
    borderRadius: 7,
    padding: "5px 7px",
    ...FI,
    fontWeight: 700,
    fontSize: 9.5,
    background: toneBg[meta.tone],
    color: toneColor[meta.tone],
    cursor: disabled ? "default" : "pointer",
    whiteSpace: "nowrap",
    width: "100%"
  }} className="ais-button ais-button--default">
      {meta.label}
    </button>;
}
function RolePermissionMatrix({
  canEdit
}) {
  const [matrix, setMatrix, loaded] = useStoredState("ais-permission-matrix", DEFAULT_PERMISSION_MATRIX);
  if (!loaded) return <div style={{
    ...FI,
    fontSize: 13,
    color: T.inkMuted,
    padding: 12
  }}>
        Memuat…
      </div>;
  const setCell = (page, role, value) => {
    setMatrix({
      ...matrix,
      [page]: {
        ...matrix[page],
        [role]: value
      }
    });
  };
  return <div>
      <SectionLabel>Matriks Akses Role x Halaman</SectionLabel>
      <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginBottom: 12
    }}>
        {canEdit ? "Klik sel untuk mengganti level akses (Tidak Ada → Lihat → Input → Lihat + Edit)." : "Hanya Admin Utama & Manajemen yang dapat mengubah matriks ini."}
      </div>
      <div style={{
      overflowX: "auto"
    }}>
        <table style={{
        borderCollapse: "collapse",
        ...FI,
        fontSize: 11,
        minWidth: 780
      }}>
          <thead>
            <tr>
              <th style={{
              padding: "6px 8px",
              textAlign: "left",
              background: T.surfaceSunk,
              position: "sticky",
              left: 0
            }}>
                Halaman
              </th>
              {PERMISSION_ROLES.map(r => <th key={r} style={{
              padding: "6px 6px",
              background: T.surfaceSunk,
              fontSize: 9.5,
              whiteSpace: "nowrap"
            }}>
                  {PERMISSION_ROLE_LABEL(r)}
                </th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_PAGES.map(page => <tr key={page} style={{
            borderTop: `1px solid ${T.line}`
          }}>
                <td style={{
              padding: "6px 8px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: T.surface,
              position: "sticky",
              left: 0
            }}>
                  {page}
                </td>
                {PERMISSION_ROLES.map(role => <td key={role} style={{
              padding: "4px 4px",
              minWidth: 78
            }}>
                    <PermissionCell value={matrix[page]?.[role] || "none"} disabled={!canEdit} onChange={v => setCell(page, role, v)} />
                  </td>)}
              </tr>)}
          </tbody>
        </table>
      </div>
      <div style={{
      display: "flex",
      gap: 10,
      marginTop: 12,
      flexWrap: "wrap"
    }} className="ais-flex-layout">
        {PERMISSION_LEVELS.map(l => <div key={l.value} style={{
        display: "flex",
        alignItems: "center",
        gap: 5
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
          fontSize: 11,
          color: T.inkMuted
        }}>
              {l.label}
            </span>
          </div>)}
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 12,
      background: T.surfaceSunk,
      padding: "9px 12px",
      borderRadius: 10
    }} className="ais-content-panel">
        Matriks ini merepresentasikan aturan akses yang sudah berlaku di
        prototype (mis. Crew hanya Input di Absensi, Graphic Designer terkunci
        setelah submit Laporan Manajemen). Di working app, matriks ini akan
        langsung mengontrol UI &amp; API secara otomatis.
      </div>
    </div>;
}
function ApprovalIjinTab({
  emp,
  ijinList,
  setIjinList,
  now
}) {
  const scope = emp.id === "eri" ? "non_manajemen" : emp.id === "kurnia" ? "manajemen" : null;
  return <div>
      {scope && <IjinApprovalSection emp={emp} ijinList={ijinList} setIjinList={setIjinList} now={now} scope={scope} />}
      <SectionLabel>Rekap Semua Pengajuan Ijin</SectionLabel>
      <IjinRecapTable ijinList={ijinList} />
    </div>;
}
function ApprovalPenuhTab({
  emp,
  reportLog,
  approvalQueue,
  setApprovalQueue,
  ijinList,
  setIjinList,
  now
}) {
  const canManage = emp.group === "direksi" || emp.group === "manajemen" && emp.isAdminUtama;
  const canSeeRole = emp.group === "direksi";
  const tabs = [{
    key: "laporan",
    label: "Laporan Toko",
    icon: ClipboardList
  }, {
    key: "ijin",
    label: "Ijin Kerja",
    icon: Users
  }, ...(canSeeRole ? [{
    key: "role",
    label: "Role & Akses",
    icon: Users
  }] : [])];
  const [tab, setTab] = useState("laporan");
  if (!canManage) {
    return <div>
        <IdentityCard emp={emp} />
        <div style={{
        background: T.badSoft,
        color: T.bad,
        padding: "14px 16px",
        borderRadius: 14,
        ...FI,
        fontWeight: 600,
        fontSize: 13.5,
        display: "flex",
        gap: 8,
        alignItems: "flex-start"
      }} className="ais-flex-layout">
          <Lock size={16} style={{
          marginTop: 1,
          flexShrink: 0
        }} />
          Modul Approval hanya bisa diakses Admin Utama & Manajemen.
        </div>
      </div>;
  }
  return <div>
      <IdentityCard emp={emp} />
      <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 18,
      background: T.surfaceSunk,
      padding: 4,
      borderRadius: 12
    }} className="ais-flex-layout ais-content-panel">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 9,
        padding: "8px 6px",
        cursor: "pointer",
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 12.5,
        background: tab === t.key ? T.surface : "transparent",
        color: tab === t.key ? T.ink : T.inkMuted,
        boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
      }} className="ais-button ais-button--default ais-flex-layout" aria-pressed={tab === t.key}>
            <t.icon size={14} />
            {t.label}
          </button>)}
      </div>
      {tab === "laporan" && <ApprovalDashboard emp={emp} reportLog={reportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} now={now} />}
      {tab === "ijin" && <ApprovalIjinTab emp={emp} ijinList={ijinList} setIjinList={setIjinList} now={now} />}
      {tab === "role" && canSeeRole && <RolePermissionMatrix canEdit={canSeeRole} />}
    </div>;
}

/* ---------------------------------------------------------
   MODUL TAMBAHAN — IJIN KERJA
--------------------------------------------------------- */
const LEAVE_TYPE_LABEL = {
  sakit: "Sakit",
  tidak_hadir: "Tidak Hadir",
  cuti: "Cuti Tahunan",
  tukar_shift: "Tukar Shift"
};
const ijinApprover = group => group === "manajemen" ? "Kurnia" : "Eri";
function daysBetweenInclusive(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000) + 1;
}
function sisaCutiFor(emp, ijinList) {
  if (emp.group !== "manajemen" || emp.cutiKuota == null) return null;
  const thisYear = new Date().getFullYear();
  const used = (ijinList || []).filter(i => i.empId === emp.id && i.jenis === "cuti" && i.status === "approved" && new Date(i.tanggalMulai).getFullYear() === thisYear).reduce((s, i) => s + daysBetweenInclusive(i.tanggalMulai, i.tanggalSelesai), 0);
  return Math.max(emp.cutiKuota - used, 0);
}
function SakitForm({
  now,
  onSubmit
}) {
  const minDate = addDays(dateStr(now), -3);
  const maxDate = dateStr(now);
  const [tanggal, setTanggal] = useState(maxDate);
  const [bukti, setBukti] = useState(null);
  const complete = tanggal && bukti;
  return <FormSurface title="Pengajuan izin sakit." subtitle="Lengkapi tanggal dan bukti sakit untuk diajukan ke atasan." code="SICK LEAVE"><div>
      <SectionLabel>Tanggal Sakit</SectionLabel>
      <input aria-label="Tanggal sakit" type="date" min={minDate} max={maxDate} value={tanggal} onChange={e => setTanggal(e.target.value)} style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 12px",
        ...FI,
        fontSize: 13.5,
        background: T.surfaceSunk
      }} className="ais-control" />
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        margin: "6px 0 14px"
      }}>
        Maksimal backdate 3 hari, tidak bisa untuk tanggal ke depan.
      </div>
      <SectionLabel>Bukti (Surat Dokter / Keterangan Sakit)</SectionLabel>
      <div style={{
        width: 110,
        marginBottom: 14
      }}>
        <PhotoSlot label="Upload Bukti" value={bukti} onChange={setBukti} />
      </div>
      <SubmitBtn label="Ajukan Ijin Sakit" disabled={!complete} onClick={() => onSubmit({
        tanggalMulai: tanggal,
        tanggalSelesai: tanggal,
        buktiFoto: bukti
      })} />
    </div></FormSurface>;
}
function TidakHadirForm({
  emp,
  now,
  onSubmit
}) {
  const minDate = addDays(dateStr(now), 1);
  const [mulai, setMulai] = useState(minDate);
  const [selesai, setSelesai] = useState(minDate);
  const maxSelesai = addDays(mulai, 1); // maksimal 2 hari (tanggal mulai + 1 hari lagi)
  const [alasan, setAlasan] = useState("");
  const needsBackupCrew = emp.group === "crew" || emp.group === "parttime";
  const needsBackupManajemen = emp.group === "manajemen";
  const crewBackupOptions = [...EMPLOYEES.filter(e => (e.group === "crew" || e.group === "parttime") && e.id !== emp.id && e.store === emp.store).map(e => ({
    ...e,
    tag: GROUP_LABEL[e.group]
  })), ...EMPLOYEES.filter(e => (e.group === "spv" || e.group === "tl") && (e.stores || [e.store]).includes(emp.store)).map(e => ({
    ...e,
    tag: e.group === "tl" ? "Team Leader" : "SPV Toko"
  }))];
  const [crewPengganti, setCrewPengganti] = useState(crewBackupOptions[0]?.id || "");
  const manajemenBackupOptions = EMPLOYEES.filter(e => e.group === "manajemen" && e.id !== emp.id);
  const [karyawanBackup, setKaryawanBackup] = useState(manajemenBackupOptions[0]?.id || "");
  useEffect(() => {
    if (selesai < mulai) setSelesai(mulai);else if (selesai > maxSelesai) setSelesai(maxSelesai);
  }, [mulai]);
  const jumlahHari = mulai && selesai ? daysBetweenInclusive(mulai, selesai) : 0;
  const complete = mulai && selesai && alasan.trim() && (!needsBackupCrew || crewPengganti) && (!needsBackupManajemen || karyawanBackup);
  return <FormSurface title="Rencanakan ketidakhadiran." subtitle="Pilih tanggal, jelaskan alasan, dan tentukan pengganti." code="TIME OFF"><div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 8
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Dari Tanggal</SectionLabel>
          <input aria-label="Tanggal mulai izin" type="date" min={minDate} value={mulai} onChange={e => setMulai(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
        <div>
          <SectionLabel>Sampai Tanggal</SectionLabel>
          <input aria-label="Tanggal selesai izin" type="date" min={mulai} max={maxSelesai} value={selesai} onChange={e => setSelesai(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
      </div>
      <div style={{
        ...FI,
        fontSize: 12.5,
        color: T.ink,
        fontWeight: 600,
        marginBottom: 6
      }}>
        Jumlah hari ijin: {jumlahHari} hari
      </div>
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        margin: "0 0 14px"
      }}>
        Pengajuan minimal H-1 sebelum ijin, maksimal ijin 2 hari.
        {needsBackupManajemen && " Untuk kebutuhan lebih dari 1 hari, Manajemen dapat mengajukan Cuti Tahunan."}
      </div>
      <SectionLabel>Alasan</SectionLabel>
      <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={3} placeholder="Jelaskan alasan tidak hadir…" style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 10px",
        ...FI,
        fontSize: 13,
        resize: "none",
        marginBottom: 14
      }} className="ais-control" />
      {needsBackupCrew && <div style={{
        marginBottom: 14
      }}>
          <SectionLabel>Crew Pengganti / Backup</SectionLabel>
          <Select value={crewPengganti} onChange={setCrewPengganti} options={crewBackupOptions.map(e => ({
          value: e.id,
          label: `${e.name} (${e.tag})`
        }))} />
        </div>}
      {needsBackupManajemen && <div style={{
        marginBottom: 14
      }}>
          <SectionLabel>Karyawan Backup</SectionLabel>
          <Select value={karyawanBackup} onChange={setKaryawanBackup} options={manajemenBackupOptions.map(e => ({
          value: e.id,
          label: `${e.name} (${e.jabatan})`
        }))} />
        </div>}
      <SubmitBtn label="Ajukan Tidak Hadir" disabled={!complete} onClick={() => onSubmit({
        tanggalMulai: mulai,
        tanggalSelesai: selesai,
        alasan,
        crewPengganti: needsBackupCrew ? EMPLOYEES.find(e => e.id === crewPengganti)?.name : null,
        karyawanBackup: needsBackupManajemen ? EMPLOYEES.find(e => e.id === karyawanBackup)?.name : null
      })} />
    </div></FormSurface>;
}
function CutiForm({
  emp,
  ijinList,
  now,
  onSubmit
}) {
  const minDate = addDays(dateStr(now), 14);
  const [mulai, setMulai] = useState(minDate);
  const [selesai, setSelesai] = useState(minDate);
  const complete = mulai && selesai && selesai >= mulai;
  const sisaCuti = sisaCutiFor(emp, ijinList);
  const diajukan = mulai && selesai && selesai >= mulai ? daysBetweenInclusive(mulai, selesai) : 0;
  const melebihiSisa = sisaCuti != null && diajukan > sisaCuti;
  return <FormSurface title="Ajukan cuti tahunan." subtitle="Pilih periode cuti sesuai saldo dan ketentuan yang berlaku." code="LEAVE"><div>
      {sisaCuti != null && <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
        background: T.goodSoft,
        color: T.good,
        padding: "10px 14px",
        borderRadius: 12
      }}>
          <span style={{
          ...FI,
          fontSize: 12.5,
          fontWeight: 600
        }}>
            Sisa Cuti Tahunan Anda
          </span>
          <span style={{
          ...FM,
          fontWeight: 700,
          fontSize: 15
        }}>
            {sisaCuti} hari
          </span>
        </div>}
      <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 12
      }}>
        Cuti tahunan wajib diajukan minimal 14 hari (H-14) sebelum tanggal
        mulai.
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 8
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Tanggal Mulai</SectionLabel>
          <input aria-label="Tanggal mulai cuti" type="date" min={minDate} value={mulai} onChange={e => {
            setMulai(e.target.value);
            if (selesai < e.target.value) setSelesai(e.target.value);
          }} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
        <div>
          <SectionLabel>Tanggal Selesai</SectionLabel>
          <input aria-label="Tanggal selesai cuti" type="date" min={mulai} value={selesai} onChange={e => setSelesai(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
      </div>
      {diajukan > 0 && <div style={{
        ...FI,
        fontSize: 12,
        color: melebihiSisa ? T.bad : T.inkMuted,
        marginBottom: 14,
        fontWeight: melebihiSisa ? 700 : 400
      }}>
          Mengajukan {diajukan} hari.
          {melebihiSisa ? " Melebihi sisa cuti yang tersedia." : ""}
        </div>}
      <SubmitBtn label="Ajukan Cuti Tahunan" disabled={!complete} onClick={() => onSubmit({
        tanggalMulai: mulai,
        tanggalSelesai: selesai
      })} />
    </div></FormSurface>;
}
function TukarShiftForm({
  emp,
  onSubmit
}) {
  const dedicatedStores = emp.stores || [emp.store];
  const crewOptions = EMPLOYEES.filter(e => e.group === "crew" && dedicatedStores.includes(e.store));
  const [crewId, setCrewId] = useState(crewOptions[0]?.id || "");
  const [tanggalAsal, setTanggalAsal] = useState("");
  const [shiftAsal, setShiftAsal] = useState("1");
  const [tanggalTukar, setTanggalTukar] = useState("");
  const [shiftTukar, setShiftTukar] = useState("1");
  const selectedCrewStore = EMPLOYEES.find(e => e.id === crewId)?.store;
  const penukarOptions = EMPLOYEES.filter(e => e.group === "crew" && e.store === selectedCrewStore && e.id !== crewId);
  const [crewPenukarId, setCrewPenukarId] = useState(penukarOptions[0]?.id || "");
  const [alasan, setAlasan] = useState("");
  useEffect(() => {
    const opts = EMPLOYEES.filter(e => e.group === "crew" && e.store === selectedCrewStore && e.id !== crewId);
    setCrewPenukarId(opts[0]?.id || "");
  }, [crewId]);
  const complete = crewId && tanggalAsal && tanggalTukar && crewPenukarId;
  if (crewOptions.length === 0) {
    return <FormSurface title="Atur ulang ritme kerja." subtitle="Pilih karyawan dan jadwal yang akan ditukar." code="SHIFT SWAP"><div>
        Tidak ada crew terdaftar di toko dedicated Anda.
      </div></FormSurface>;
  }
  return <FormSurface title="Atur ulang ritme kerja." subtitle="Pilih karyawan dan jadwal yang akan ditukar." code="SHIFT SWAP"><div>
      <SectionLabel>Crew yang Diajukan</SectionLabel>
      <div style={{
        marginBottom: 12
      }}>
        <Select value={crewId} onChange={setCrewId} options={crewOptions.map(e => ({
          value: e.id,
          label: `${e.name} — ${storeName(e.store)}`
        }))} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Tanggal Shift Asal</SectionLabel>
          <input aria-label="Tanggal shift asal" type="date" value={tanggalAsal} onChange={e => setTanggalAsal(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
        <div>
          <SectionLabel>Shift Asal</SectionLabel>
          <Select value={shiftAsal} onChange={setShiftAsal} options={["1", "2", "longshift", "backup"].map(s => ({
            value: s,
            label: SHIFT_LABELS[s]
          }))} />
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 12
      }} className="ais-responsive-grid">
        <div>
          <SectionLabel>Tanggal Ditukar Ke</SectionLabel>
          <input aria-label="Tanggal shift pengganti" type="date" value={tanggalTukar} onChange={e => setTanggalTukar(e.target.value)} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
        </div>
        <div>
          <SectionLabel>Shift Baru</SectionLabel>
          <Select value={shiftTukar} onChange={setShiftTukar} options={["1", "2", "longshift", "backup"].map(s => ({
            value: s,
            label: SHIFT_LABELS[s]
          }))} />
        </div>
      </div>
      <SectionLabel>Ditukar Dengan (Crew Penukar)</SectionLabel>
      <div style={{
        marginBottom: 12
      }}>
        {penukarOptions.length > 0 ? <Select value={crewPenukarId} onChange={setCrewPenukarId} options={penukarOptions.map(e => ({
          value: e.id,
          label: e.name
        }))} /> : <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted
        }}>
            Tidak ada crew lain di toko ini untuk ditukar.
          </div>}
      </div>
      <SectionLabel>Alasan (opsional)</SectionLabel>
      <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={2} style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "9px 10px",
        ...FI,
        fontSize: 13,
        resize: "none",
        marginBottom: 14
      }} className="ais-control" />
      <SubmitBtn label="Ajukan Tukar Shift" disabled={!complete} onClick={() => onSubmit({
        subjectEmpId: crewId,
        tanggalMulai: tanggalAsal,
        tanggalSelesai: tanggalAsal,
        shiftAsal,
        tanggalTukar,
        shiftTukar,
        crewPenukar: EMPLOYEES.find(e => e.id === crewPenukarId)?.name || "",
        alasan
      })} />
    </div></FormSurface>;
}
function IjinRow({
  item
}) {
  const tone = item.status === "approved" ? "good" : item.status === "rejected" ? "bad" : "warn";
  const label = item.status === "approved" ? "Disetujui" : item.status === "rejected" ? "Ditolak" : "Menunggu";
  return <div>
      <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      marginBottom: 4
    }} className="ais-flex-layout">
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 13.5
      }}>
          {item.empName}{" "}
          <span style={{
          color: T.inkMuted,
          fontWeight: 500
        }}>
            · {LEAVE_TYPE_LABEL[item.jenis]}
          </span>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div style={{
      ...FI,
      fontSize: 12,
      color: T.inkMuted
    }}>
        {item.tanggalMulai}
        {item.tanggalSelesai && item.tanggalSelesai !== item.tanggalMulai ? ` – ${item.tanggalSelesai}` : ""}
        {item.requestedByName && item.requestedById !== item.empId ? ` · Diajukan oleh ${item.requestedByName}` : ""}
      </div>
      {item.alasan && <div style={{
      ...FI,
      fontSize: 12,
      color: T.ink,
      marginTop: 5,
      fontStyle: "italic"
    }}>
          "{item.alasan}"
        </div>}
      {item.status === "rejected" && item.rejectReason && <div style={{
      ...FI,
      fontSize: 12,
      color: T.bad,
      marginTop: 5
    }}>
          Alasan penolakan:{" "}
          <span style={{
        fontStyle: "italic"
      }}>"{item.rejectReason}"</span>
        </div>}
      {item.crewPengganti && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginTop: 3
    }}>
          Pengganti: {item.crewPengganti}
        </div>}
      {item.jenis === "tukar_shift" && <div style={{
      ...FI,
      fontSize: 11.5,
      color: T.inkMuted,
      marginTop: 3
    }}>
          {SHIFT_LABELS[item.shiftAsal]} ({item.tanggalMulai}) →{" "}
          {SHIFT_LABELS[item.shiftTukar]} ({item.tanggalTukar}) dengan{" "}
          {item.crewPenukar}
        </div>}
      {item.buktiFoto && <img src={item.buktiFoto} alt="bukti" style={{
      width: 56,
      height: 56,
      borderRadius: 8,
      objectFit: "cover",
      marginTop: 6
    }} />}
      {item.decidedBy && <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginTop: 5
    }}>
          Diputuskan oleh {item.decidedBy}
        </div>}
    </div>;
}
function IjinKerjaSubmit({
  emp,
  ijinList,
  setIjinList,
  now
}) {
  const jenisOptions = emp.group === "manajemen" ? ["sakit", "tidak_hadir", "cuti"] : ["sakit", "tidak_hadir"];
  const [jenis, setJenis] = useState(jenisOptions[0]);
  const [notice, setNotice] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const sending = useRef(false);
  const pushIjin = async payload => {
    if (sending.current) return;
    const item = {
      id: `ijin_${crypto.randomUUID()}`,
      jenis,
      empId: emp.id,
      empName: emp.name,
      group: emp.group,
      requestedById: emp.id,
      requestedByName: emp.name,
      ...payload,
      status: "pending",
      submittedAt: now.toISOString()
    };
    if (duplicateRequest(ijinList, item)) {
      setNotice("Pengajuan yang sama sudah ada. Periksa riwayat pengajuan Anda.");
      return;
    }
    sending.current = true;
    try {
      await setIjinList([...ijinList, item]);
      setNotice("Pengajuan berhasil dikirim. Status: menunggu persetujuan.");
      setFormVersion(v => v + 1);
    } finally {
      sending.current = false;
    }
  };
  const pushTukarShift = async payload => {
    if (sending.current) return;
    const subject = EMPLOYEES.find(e => e.id === payload.subjectEmpId);
    if (!subject) return;
    const item = {
      id: `ijin_${crypto.randomUUID()}`,
      jenis: "tukar_shift",
      empId: subject.id,
      empName: subject.name,
      group: subject.group,
      requestedById: emp.id,
      requestedByName: emp.name,
      ...payload,
      status: "pending",
      submittedAt: now.toISOString()
    };
    if (duplicateRequest(ijinList, item)) {
      setNotice("Pengajuan yang sama sudah ada. Periksa riwayat pengajuan Anda.");
      return;
    }
    sending.current = true;
    try {
      await setIjinList([...ijinList, item]);
      setNotice("Pengajuan berhasil dikirim. Status: menunggu persetujuan.");
      setFormVersion(v => v + 1);
    } finally {
      sending.current = false;
    }
  };
  return <div>
      <SectionLabel>Ajukan Ijin Kerja</SectionLabel>
      {notice && <div role="status" style={{
      padding: 12,
      borderRadius: 10,
      marginBottom: 14,
      background: T.accentSoft,
      color: T.accentDeep,
      fontSize: 12,
      lineHeight: 1.6
    }}>{notice}</div>}
      <div style={{
      marginBottom: 14
    }}>
        <Select value={jenis} onChange={setJenis} options={jenisOptions.map(j => ({
        value: j,
        label: LEAVE_TYPE_LABEL[j]
      }))} />
      </div>
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Disetujui oleh: <b>{ijinApprover(emp.group)}</b>
      </div>
      {jenis === "sakit" && <SakitForm key={formVersion} now={now} onSubmit={pushIjin} />}
      {jenis === "tidak_hadir" && <TidakHadirForm key={formVersion} emp={emp} now={now} onSubmit={pushIjin} />}
      {jenis === "cuti" && <CutiForm key={formVersion} emp={emp} ijinList={ijinList} now={now} onSubmit={pushIjin} />}

      {(emp.group === "spv" || emp.group === "tl") && <div style={{
      marginTop: 28,
      paddingTop: 20,
      borderTop: `1px solid ${T.line}`
    }}>
          <SectionLabel>Ajukan Tukar Shift untuk Crew</SectionLabel>
          <div style={{
        ...FI,
        fontSize: 11,
        color: T.inkMuted,
        marginBottom: 14
      }}>
            Hanya SPV yang dapat mengajukan tukar shift untuk crew di toko
            dedicated-nya.
          </div>
          <TukarShiftForm key={formVersion} emp={emp} onSubmit={pushTukarShift} />
        </div>}
    </div>;
}
function IjinKerjaOwnHistory({
  emp,
  ijinList
}) {
  const mine = ijinList.filter(i => i.empId === emp.id || i.requestedById === emp.id).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return <div style={{
    marginTop: 28
  }}>
      <SectionLabel>Riwayat Pengajuan Saya ({mine.length})</SectionLabel>
      {mine.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Belum ada pengajuan.
        </div>}
      {mine.map(item => <div key={item.id} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8
    }}>
          <IjinRow item={item} />
        </div>)}
    </div>;
}
function IjinApprovalSection({
  emp,
  ijinList,
  setIjinList,
  now,
  scope
}) {
  const pending = ijinList.filter(i => i.status === "pending" && (scope === "manajemen" ? i.group === "manajemen" : i.group !== "manajemen")).sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const approve = item => {
    setIjinList(ijinList.map(i => i.id === item.id ? {
      ...i,
      status: "approved",
      decidedBy: emp.name,
      decidedAt: now.toISOString()
    } : i));
  };
  const submitReject = item => {
    if (!rejectReason.trim()) return;
    setIjinList(ijinList.map(i => i.id === item.id ? {
      ...i,
      status: "rejected",
      decidedBy: emp.name,
      decidedAt: now.toISOString(),
      rejectReason: rejectReason.trim()
    } : i));
    setRejectingId(null);
    setRejectReason("");
  };
  return <div style={{
    marginBottom: 28
  }}>
      <SectionLabel>Menunggu Approval Ijin ({pending.length})</SectionLabel>
      {pending.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Tidak ada pengajuan yang menunggu.
        </div>}
      {pending.map(item => <div key={item.id} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8
    }}>
          <IjinRow item={item} />
          {rejectingId !== item.id ? <div style={{
        display: "flex",
        gap: 8,
        marginTop: 10
      }} className="ais-flex-layout">
              <button onClick={() => approve(item)} style={{
          flex: 1,
          border: "none",
          borderRadius: 9,
          padding: "8px 10px",
          background: T.good,
          color: "#fff",
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">
                Approve
              </button>
              <button onClick={() => {
          setRejectingId(item.id);
          setRejectReason("");
        }} style={{
          flex: 1,
          border: `1px solid ${T.bad}`,
          borderRadius: 9,
          padding: "8px 10px",
          background: "transparent",
          color: T.bad,
          ...FI,
          fontWeight: 600,
          fontSize: 12.5,
          cursor: "pointer"
        }} className="ais-button ais-button--danger">
                Reject
              </button>
            </div> : <div style={{
        marginTop: 10
      }}>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Alasan penolakan (wajib diisi)…" style={{
          width: "100%",
          border: `1px solid ${T.line}`,
          borderRadius: 9,
          padding: "8px 10px",
          ...FI,
          fontSize: 12.5,
          resize: "none",
          marginBottom: 8
        }} className="ais-control" />
              <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
                <button onClick={() => submitReject(item)} disabled={!rejectReason.trim()} style={{
            flex: 1,
            border: "none",
            borderRadius: 9,
            padding: "8px 10px",
            background: rejectReason.trim() ? T.bad : T.line,
            color: "#fff",
            fontFamily: "DM Sans",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: rejectReason.trim() ? "pointer" : "not-allowed"
          }} className="ais-button ais-button--danger">
                  Kirim Penolakan
                </button>
                <button onClick={() => {
            setRejectingId(null);
            setRejectReason("");
          }} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 9,
            padding: "8px 12px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                  Batal
                </button>
              </div>
            </div>}
        </div>)}
    </div>;
}
function IjinRecapTable({
  ijinList
}) {
  const [filterStatus, setFilterStatus] = useState("all");
  const sorted = [...ijinList].filter(i => filterStatus === "all" || i.status === filterStatus).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return <div>
      <div style={{
      marginBottom: 14
    }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
        border: `1px solid ${T.line}`,
        borderRadius: 9,
        padding: "7px 10px",
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
      {sorted.length === 0 && <div style={{
      ...FI,
      fontSize: 13,
      color: T.inkMuted
    }}>
          Belum ada pengajuan ijin.
        </div>}
      {sorted.map(item => <div key={item.id} style={{
      border: `1px solid ${T.line}`,
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8
    }}>
          <IjinRow item={item} />
        </div>)}
    </div>;
}
function IjinDireksiView({
  emp,
  ijinList,
  setIjinList,
  now
}) {
  return <div>
      <IdentityCard emp={emp} />
      <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 14
    }}>
        Approval pengajuan ijin sekarang ada di tab <b>Approval</b>. Halaman ini
        menampilkan rekap saja.
      </div>
      <SectionLabel>Rekap Semua Pengajuan Ijin</SectionLabel>
      <IjinRecapTable ijinList={ijinList} />
    </div>;
}
function IjinKerjaPage({
  emp,
  ijinList,
  setIjinList,
  now
}) {
  if (emp.group === "toko_device") {
    return <div>
        <IdentityCard emp={emp} />
        <div style={{
        ...FI,
        fontSize: 13.5,
        color: T.inkMuted,
        padding: 16,
        textAlign: "center"
      }}>
          Modul Ijin Kerja tidak berlaku untuk Akun Toko.
        </div>
      </div>;
  }
  if (emp.group === "direksi") {
    return <IjinDireksiView emp={emp} ijinList={ijinList} setIjinList={setIjinList} now={now} />;
  }
  return <div>
      <IdentityCard emp={emp} />
      {emp.id === "eri" && <div style={{
      ...FI,
      fontSize: 11,
      color: T.inkMuted,
      marginBottom: 14
    }}>
          Approval pengajuan ijin sekarang ada di tab <b>Approval</b>.
        </div>}
      <IjinKerjaSubmit emp={emp} ijinList={ijinList} setIjinList={setIjinList} now={now} />
      <IjinKerjaOwnHistory emp={emp} ijinList={ijinList} />
    </div>;
}

/* ---------------------------------------------------------
   ROOT APP
--------------------------------------------------------- */
function UbahPasswordSection({
  emp,
  passwordMeta,
  setPasswordMeta,
  now
}) {
  const meta = passwordMeta?.[emp.id] || {
    lastChangedAt: null,
    everChanged: false
  };
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const COOLDOWN_DAYS = 90;
  let sisaHari = 0;
  if (meta.lastChangedAt) {
    const next = new Date(meta.lastChangedAt);
    next.setDate(next.getDate() + COOLDOWN_DAYS);
    sisaHari = Math.max(Math.ceil((next - now) / 86400000), 0);
  }
  const bisaUbah = !meta.lastChangedAt || sisaHari === 0;
  const belumPernahUbah = !meta.everChanged;
  const submit = async () => {
    setSuccess("");
    if (!oldPw || !newPw || !confirmPw) {
      setError("Semua kolom wajib diisi.");
      return;
    }
    if (oldPw !== (meta.currentPassword || "0000")) {
      setError("Password lama salah.");
      return;
    }
    if (newPw.length < 4) {
      setError("Password baru minimal 4 karakter.");
      return;
    }
    if (newPw === oldPw) {
      setError("Password baru tidak boleh sama dengan password lama.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setError("");
    await setPasswordMeta({
      ...passwordMeta,
      [emp.id]: {
        currentPassword: newPw,
        lastChangedAt: now.toISOString(),
        everChanged: true
      }
    });
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    setOpen(false);
    setSuccess("Password berhasil diubah.");
  };
  return <div style={{
    marginBottom: 22
  }}>
      <SectionLabel>Keamanan Akun</SectionLabel>

      {belumPernahUbah && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      background: T.warnSoft,
      color: T.warn,
      padding: "11px 13px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600,
      marginBottom: 10
    }} className="ais-flex-layout">
          <AlertTriangle size={15} style={{
        marginTop: 1,
        flexShrink: 0
      }} />
          Anda masih memakai password bawaan. Sebaiknya segera ubah password
          Anda.
        </div>}

      {success && <div style={{
      display: "flex",
      gap: 8,
      alignItems: "center",
      background: T.goodSoft,
      color: T.good,
      padding: "11px 13px",
      borderRadius: 12,
      ...FI,
      fontSize: 12.5,
      fontWeight: 600,
      marginBottom: 10
    }} className="ais-flex-layout">
          <CheckCircle2 size={15} /> {success}
        </div>}

      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "14px 16px"
    }} className="ais-content-panel">
        {!open ? <div>
            <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          marginBottom: bisaUbah ? 12 : 0
        }}>
              {meta.lastChangedAt ? `Terakhir diubah: ${new Date(meta.lastChangedAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
          })}.` : "Password belum pernah diubah."}
              {!bisaUbah && ` Bisa diubah lagi dalam ${sisaHari} hari (dibatasi 1x per 3 bulan).`}
            </div>
            {bisaUbah ? <button onClick={() => {
          setOpen(true);
          setError("");
          setSuccess("");
        }} style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "9px 14px",
          background: "transparent",
          color: T.ink,
          ...FI,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer"
        }} className="ais-button ais-button--default ais-flex-layout">
                <Lock size={14} /> Ubah Password
              </button> : <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          ...FI,
          fontSize: 12,
          color: T.inkMuted
        }} className="ais-flex-layout">
                <Lock size={13} /> Ubah password terkunci sementara.
              </div>}
          </div> : <div>
            <div style={{
          ...FI,
          fontSize: 11,
          color: T.inkMuted,
          marginBottom: 10
        }}>
              Setelah diubah, password baru bisa diganti lagi setelah 3 bulan.
            </div>
            {[{
          label: "Password Lama",
          value: oldPw,
          set: setOldPw
        }, {
          label: "Password Baru",
          value: newPw,
          set: setNewPw
        }, {
          label: "Konfirmasi Password Baru",
          value: confirmPw,
          set: setConfirmPw
        }].map(f => <div key={f.label} style={{
          marginBottom: 10
        }}>
                <div style={{
            ...FI,
            fontSize: 11.5,
            color: T.inkMuted,
            marginBottom: 4
          }}>
                  {f.label}
                </div>
                <input type="password" value={f.value} onChange={e => {
            f.set(e.target.value);
            setError("");
          }} style={{
            width: "100%",
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "9px 12px",
            ...FI,
            fontSize: 13.5,
            background: T.surfaceSunk
          }} className="ais-control" />
              </div>)}
            {error && <div style={{
          ...FI,
          fontSize: 12,
          color: T.bad,
          marginBottom: 10
        }}>
                {error}
              </div>}
            <div style={{
          display: "flex",
          gap: 8
        }} className="ais-flex-layout">
              <button onClick={submit} style={{
            flex: 1,
            border: "none",
            borderRadius: 10,
            padding: "10px",
            background: T.manajemen,
            color: "#fff",
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }} className="ais-button ais-button--primary">
                Simpan Password Baru
              </button>
              <button onClick={() => {
            setOpen(false);
            setOldPw("");
            setNewPw("");
            setConfirmPw("");
            setError("");
          }} style={{
            border: `1px solid ${T.line}`,
            borderRadius: 10,
            padding: "10px 14px",
            background: "transparent",
            color: T.inkMuted,
            ...FI,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                Batal
              </button>
            </div>
          </div>}
      </div>
    </div>;
}
function ProfilePage({
  emp,
  log,
  schedule,
  ijinList,
  now,
  passwordMeta,
  setPasswordMeta,
  workHours
}) {
  const hariTerlambat = countLateDaysThisMonth(emp, log, schedule, workHours);
  const sisaCuti = sisaCutiFor(emp, ijinList);
  const fmtTanggal = ds => ds ? new Date(ds + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }) : "-";

  // Status sanksi — SP berlaku 3 bulan lalu otomatis clear; teguran bersifat permanen.
  const sanksiList = seedSanksiApp().filter(s => s.empId === emp.id).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const sanksiAktif = sanksiList.filter(s => {
    const meta = SANKSI_TYPES_APP[s.jenis];
    if (!meta.durasiHari) return true;
    const expiry = new Date(s.tanggal + "T00:00:00");
    expiry.setDate(expiry.getDate() + meta.durasiHari);
    return now <= expiry;
  });
  const sisaSanksiHari = s => {
    const meta = SANKSI_TYPES_APP[s.jenis];
    if (!meta.durasiHari) return null;
    const expiry = new Date(s.tanggal + "T00:00:00");
    expiry.setDate(expiry.getDate() + meta.durasiHari);
    return Math.max(Math.ceil((expiry - now) / 86400000), 0);
  };
  const riwayatIjin = (ijinList || []).filter(i => i.empId === emp.id).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  const InfoRow = ({
    label,
    value,
    valueColor
  }) => <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "9px 0",
    borderBottom: `1px solid ${T.line}`
  }}>
      <span style={{
      ...FI,
      fontSize: 12.5,
      color: T.inkMuted
    }}>{label}</span>
      <span style={{
      ...FI,
      fontSize: 13,
      fontWeight: 600,
      color: valueColor || T.ink,
      textAlign: "right"
    }}>
        {value}
      </span>
    </div>;
  return <div>
      <IdentityCard emp={emp} subtitleOverride={empLocationLabel(emp) ? `${emp.jabatan || GROUP_LABEL[emp.group]} - ${empLocationLabel(emp)}` : undefined} />

      <div style={{
      display: "grid",
      gridTemplateColumns: sisaCuti != null ? "1fr 1fr" : "1fr",
      gap: 10,
      marginBottom: 22
    }} className="ais-responsive-grid">
        <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: "14px 16px"
      }} className="ais-content-panel">
          <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4
        }}>
            Terlambat Bulan Ini
          </div>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 24,
          color: hariTerlambat > 0 ? T.bad : T.good
        }}>
            {hariTerlambat} hari
          </div>
        </div>
        {sisaCuti != null && <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: "14px 16px"
      }} className="ais-content-panel">
            <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4
        }}>
              Sisa Cuti Tahunan
            </div>
            <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 24
        }}>
              {sisaCuti} hari
            </div>
          </div>}
      </div>

      <SectionLabel>Data Kepegawaian</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "4px 16px",
      marginBottom: 22
    }} className="ais-content-panel">
        <InfoRow label="Jabatan" value={emp.jabatan || GROUP_LABEL[emp.group]} />
        <InfoRow label="Tanggal Bergabung" value={fmtTanggal(emp.joinDate)} />
        <InfoRow label="Masa Kerja" value={formatMasaKerjaApp(emp.joinDate)} />
        <InfoRow label="Status Kontrak" value={STATUS_KONTRAK_LABEL[emp.statusKontrak] || "-"} />
        {emp.statusKontrak === "kontrak" && <InfoRow label="Kontrak Berakhir" value={fmtTanggal(emp.kontrakEnd)} />}
        <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 0"
      }}>
          <span style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted
        }}>
            Lokasi Kerja
          </span>
          <span style={{
          ...FI,
          fontSize: 13,
          fontWeight: 600,
          textAlign: "right"
        }}>
            {empLocationLabel(emp) || "-"}
          </span>
        </div>
      </div>

      <SectionLabel>Status Sanksi</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 22
    }} className="ais-content-panel">
        {sanksiAktif.length === 0 ? <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        ...FI,
        fontSize: 13,
        color: T.good,
        fontWeight: 600
      }} className="ais-flex-layout">
            <CheckCircle2 size={16} /> Tidak ada sanksi aktif.
          </div> : <div>
            <div style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 10
        }} className="ais-flex-layout">
              {sanksiAktif.map(s => {
            const sisa = sisaSanksiHari(s);
            return <div key={s.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: s.jenis.startsWith("sp") ? T.badSoft : T.warnSoft,
              color: s.jenis.startsWith("sp") ? T.bad : T.warn,
              padding: "5px 10px",
              borderRadius: 999,
              ...FI,
              fontWeight: 600,
              fontSize: 11.5
            }} className="ais-flex-layout">
                    {SANKSI_TYPES_APP[s.jenis].label}
                    {sisa != null && <span style={{
                fontWeight: 400
              }}>
                        · sisa {sisa} hari
                      </span>}
                  </div>;
          })}
            </div>
            {sanksiList.map(s => <div key={s.id} style={{
          ...FI,
          fontSize: 11.5,
          color: T.inkMuted,
          paddingTop: 6,
          borderTop: `1px solid ${T.line}`
        }}>
                {SANKSI_TYPES_APP[s.jenis].label} · {fmtTanggal(s.tanggal)}
                {s.keterangan ? ` — "${s.keterangan}"` : ""}
              </div>)}
          </div>}
      </div>

      <SectionLabel>Riwayat Pengajuan Ijin ({riwayatIjin.length})</SectionLabel>
      <div style={{
      marginBottom: 22
    }}>
        {riwayatIjin.length === 0 && <div style={{
        ...FI,
        fontSize: 13,
        color: T.inkMuted
      }}>
            Belum ada pengajuan ijin.
          </div>}
        {riwayatIjin.map(item => <div key={item.id} style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: "11px 14px",
        marginBottom: 8
      }} className="ais-content-panel">
            <IjinRow item={item} />
          </div>)}
      </div>

      <div style={{
      padding: 16,
      background: T.surfaceSunk,
      borderRadius: 12,
      color: T.inkMuted,
      fontSize: 12,
      lineHeight: 1.7
    }} className="ais-content-panel">
        Akun ini menggunakan NIK dan password demo untuk evaluasi. Perubahan password tersedia setelah autentikasi server dihubungkan.
      </div>
    </div>;
}
function JadwalSayaPage({
  emp,
  schedule,
  now
}) {
  const tomorrow = addDays(dateStr(now), 1);
  const shiftBesok = shiftOn(schedule, emp.id, tomorrow);
  const period = currentPayrollPeriod(now);
  const today = dateStr(now);
  const fmtShort = ds => new Date(ds + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  const totalMasuk = period.dates.filter(ds => {
    const s = shiftOn(schedule, emp.id, ds);
    return s && s !== "off";
  }).length;
  const totalLibur = period.dates.filter(ds => shiftOn(schedule, emp.id, ds) === "off").length;
  return <div>
      <IdentityCard emp={emp} subtitleOverride={empLocationLabel(emp) ? `${emp.jabatan || GROUP_LABEL[emp.group]} - ${empLocationLabel(emp)}` : undefined} />

      <SectionLabel>Jadwal Besok — {fmtShort(tomorrow)}</SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 22,
      display: "flex",
      alignItems: "center",
      gap: 10
    }} className="ais-flex-layout ais-content-panel">
        <CalendarDays size={20} color={T.accentDeep} />
        <div style={{
        ...FI,
        fontWeight: 700,
        fontSize: 15
      }}>
          {shiftBesok ? SHIFT_LABELS[shiftBesok] || shiftBesok : "Belum Dijadwalkan"}
        </div>
      </div>

      <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 22
    }} className="ais-responsive-grid">
        <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: "14px 16px"
      }} className="ais-content-panel">
          <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4
        }}>
            Hari Masuk
          </div>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 24
        }}>
            {totalMasuk} hari
          </div>
        </div>
        <div style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        padding: "14px 16px"
      }} className="ais-content-panel">
          <div style={{
          ...FI,
          fontSize: 10.5,
          color: T.inkMuted,
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4
        }}>
            Hari Libur
          </div>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 24
        }}>
            {totalLibur} hari
          </div>
        </div>
      </div>

      <SectionLabel>
        Jadwal Periode Ini ({period.start} – {period.end})
      </SectionLabel>
      <div style={{
      background: T.surface,
      border: `1px solid ${T.line}`,
      borderRadius: 14,
      overflow: "hidden"
    }} className="ais-content-panel">
        {period.dates.map((ds, i) => {
        const shift = shiftOn(schedule, emp.id, ds);
        const isToday = ds === today;
        return <div key={ds} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "9px 14px",
          borderTop: i > 0 ? `1px solid ${T.line}` : "none",
          background: isToday ? T.accentSoft : "transparent"
        }}>
              <span style={{
            ...FI,
            fontSize: 12.5,
            fontWeight: isToday ? 700 : 500,
            color: isToday ? T.accentDeep : T.ink
          }}>
                {fmtShort(ds)}
                {isToday ? " · Hari ini" : ""}
              </span>
              <Badge tone={!shift || shift === "off" ? "manajemen" : "good"}>
                {shift ? SHIFT_LABELS[shift] || shift : "-"}
              </Badge>
            </div>;
      })}
      </div>
    </div>;
}

/* ---------------------------------------------------------
   PENGUNCIAN PERANGKAT — cegah titip absen lewat HP orang lain
   Satu akun hanya bisa login di satu perangkat terdaftar. Perangkat pertama
   yang berhasil login otomatis jadi perangkat terdaftar. Ganti HP harus
   di-reset oleh manajemen dari dashboard.
--------------------------------------------------------- */

// Sidik jari perangkat dari ciri khas browser. Penyimpanan artifact terikat ke akun,
// bukan ke perangkat, jadi ID acak yang disimpan tidak bisa membedakan HP.
// Di aplikasi native nanti diganti ID perangkat resmi (Android ID / iOS identifierForVendor).
function sidikJariPerangkat() {
  try {
    const n = typeof navigator !== "undefined" ? navigator : {};
    const s = typeof screen !== "undefined" ? screen : {};
    const bagian = [n.userAgent || "", n.language || "", n.platform || "", n.hardwareConcurrency || "", n.maxTouchPoints || "", s.width || "", s.height || "", s.colorDepth || "", (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "") || ""].join("|");
    // hash FNV-1a 32-bit — ringkas & deterministik
    let h = 0x811c9dc5;
    for (let i = 0; i < bagian.length; i++) {
      h ^= bagian.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return "DV-" + (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  } catch (e) {
    return "DV-UNKNOWN";
  }
}
function labelPerangkat() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : "Perangkat";
  const br = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : "Browser";
  return `${os} · ${br}`;
}

// Yang dikunci: staf lapangan & akun toko — kelompok yang absen di toko.
// Manajemen & Direksi tidak dikunci karena wajar memakai lebih dari satu perangkat.
const GRUP_DIKUNCI = new Set(["crew", "parttime", "spv", "tl", "toko_device"]);
const perluKunciPerangkat = emp => !!emp && GRUP_DIKUNCI.has(emp.group);
function LoginScreen({
  empId,
  setEmpId,
  onLogin,
  passwordMeta,
  deviceBinding,
  setDeviceBinding,
  deviceLoaded
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const groups = ["direksi", "manajemen", "toko_device", "crew", "parttime", "spv", "tl"];
  const submit = async () => {
    // Jangan izinkan login sebelum data perangkat terdaftar selesai dimuat —
    // kalau tidak, akun yang sudah terkunci di HP lain bisa terdaftar ulang di HP ini.
    if (!deviceLoaded) {
      setError("Memuat data perangkat, coba lagi sebentar.");
      return;
    }
    const expected = passwordMeta?.[empId]?.currentPassword || "0000";
    if (password !== expected) {
      setError("Password salah.");
      return;
    }
    const emp = EMPLOYEES.find(e => e.id === empId);
    if (perluKunciPerangkat(emp)) {
      const kini = sidikJariPerangkat();
      const terdaftar = deviceBinding?.[empId];
      if (!terdaftar) {
        // Login pertama: perangkat ini otomatis didaftarkan.
        await setDeviceBinding({
          ...(deviceBinding || {}),
          [empId]: {
            deviceId: kini,
            label: labelPerangkat(),
            boundAt: new Date().toISOString()
          }
        });
      } else if (terdaftar.deviceId !== kini) {
        setError(`Akun ini terdaftar di perangkat lain (${terdaftar.label}). Untuk ganti HP, minta manajemen mereset perangkat dari dashboard.`);
        return;
      }
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
      maxWidth: 380,
      background: T.surface,
      borderRadius: 20,
      padding: 26,
      border: `1px solid ${T.line}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
    }} className="ais-content-panel">
        <div style={{
        textAlign: "center",
        marginBottom: 22
      }}>
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 24,
          color: T.accentDeep,
          letterSpacing: 0.3
        }}>
            Welcome to AIS
          </div>
          <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          marginTop: 2
        }}>
            ACK Integrated System
          </div>
        </div>

        <SectionLabel>Username</SectionLabel>
        <div style={{
        marginBottom: 16
      }}>
          <Select value={empId} onChange={setEmpId} options={groups.flatMap(g => EMPLOYEES.filter(e => e.group === g).map(e => ({
          value: e.id,
          label: e.jabatan ? `${e.name} — ${e.jabatan}` : `${e.name} — ${GROUP_LABEL[g]}`
        })))} />
        </div>

        <SectionLabel>Password</SectionLabel>
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
        marginBottom: 10
      }}>
          Prototype — password default "0000" (bisa diubah lewat menu Profile).
        </div>
        <button onClick={() => setShowForgot(true)} style={{
        border: "none",
        background: "transparent",
        color: T.accentDeep,
        ...FI,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer",
        padding: 0,
        marginBottom: 14,
        textDecoration: "underline"
      }} className="ais-button ais-button--default">
          Lupa password?
        </button>
        {error && <div style={{
        ...FI,
        fontSize: 12,
        color: T.bad,
        marginBottom: 12
      }}>
            {error}
          </div>}

        <button onClick={submit} style={{
        width: "100%",
        border: "none",
        borderRadius: 10,
        padding: "12px",
        background: T.accent,
        color: "#fff",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer"
      }} className="ais-button ais-button--default">
          Login
        </button>
      </div>

      {showForgot && <div onClick={() => setShowForgot(false)} style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24
    }}>
          <div onClick={e => e.stopPropagation()} style={{
        width: "100%",
        maxWidth: 320,
        background: T.surface,
        borderRadius: 16,
        padding: 22,
        textAlign: "center"
      }} className="ais-content-panel">
            <div style={{
          width: 46,
          height: 46,
          borderRadius: 999,
          background: T.accentSoft,
          color: T.accentDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px"
        }}>
              <Lock size={20} />
            </div>
            <div style={{
          ...FI,
          fontSize: 13.5,
          color: T.ink,
          lineHeight: 1.6,
          marginBottom: 18
        }}>
              Mohon hubungi manajemen untuk mereset password.
            </div>
            <button onClick={() => setShowForgot(false)} style={{
          width: "100%",
          border: "none",
          borderRadius: 10,
          padding: "11px",
          background: T.accent,
          color: "#fff",
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">
              Mengerti
            </button>
          </div>
        </div>}
    </div>;
}
function InactiveAccountScreen({
  emp,
  onBack
}) {
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
      <div style={{
      width: "100%",
      maxWidth: 380,
      background: T.surface,
      borderRadius: 20,
      padding: 28,
      border: `1px solid ${T.line}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      textAlign: "center"
    }} className="ais-content-panel">
        <div style={{
        width: 52,
        height: 52,
        borderRadius: 999,
        background: T.badSoft,
        color: T.bad,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px"
      }}>
          <Lock size={24} />
        </div>
        <div style={{
        ...FB,
        fontWeight: 700,
        fontSize: 18,
        marginBottom: 8
      }}>
          Akun Tidak Aktif
        </div>
        <div style={{
        ...FI,
        fontSize: 13.5,
        color: T.inkMuted,
        lineHeight: 1.6,
        marginBottom: 20
      }}>
          Mohon maaf, akun kamu ({emp.name}) sudah tidak aktif. Mohon
          konfirmasikan ke manajemen.
        </div>
        <button onClick={onBack} style={{
        width: "100%",
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "11px",
        background: "transparent",
        color: T.ink,
        fontFamily: "DM Sans",
        fontWeight: 600,
        fontSize: 13.5,
        cursor: "pointer"
      }} className="ais-button ais-button--default">
          Kembali ke Login
        </button>
      </div>
    </div>;
}
function PinLocationScreen({
  store,
  onSaved
}) {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [coords, setCoords] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const getLocation = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocation tidak tersedia di device ini.");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(pos => {
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      setStatus("idle");
    }, () => {
      setStatus("error");
      setErrorMsg("Gagal mengambil lokasi. Pastikan izin lokasi device diaktifkan.");
    });
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
      <div style={{
      width: "100%",
      maxWidth: 380,
      background: T.surface,
      borderRadius: 20,
      padding: 26,
      border: `1px solid ${T.line}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
    }} className="ais-content-panel">
        <div style={{
        textAlign: "center",
        marginBottom: 18
      }}>
          <MapPin size={26} color={T.accentDeep} style={{
          marginBottom: 8
        }} />
          <div style={{
          ...FB,
          fontWeight: 700,
          fontSize: 18
        }}>
            Aktivasi Lokasi Toko
          </div>
          <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          marginTop: 4
        }}>
            Toko <b>{store.name}</b> belum punya titik lokasi di Master Data.
            Titik lokasi ini yang jadi acuan validasi jarak absen crew di toko
            ini.
          </div>
        </div>

        {coords ? <div style={{
        background: T.surfaceSunk,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        ...FM,
        fontSize: 12.5,
        textAlign: "center"
      }} className="ais-content-panel">
            Lat: {coords.lat.toFixed(6)}
            <br />
            Lng: {coords.lng.toFixed(6)}
          </div> : <div style={{
        ...FI,
        fontSize: 12,
        color: T.inkMuted,
        textAlign: "center",
        marginBottom: 16
      }}>
            Pastikan Anda sedang berada di lokasi toko, lalu tekan tombol di
            bawah.
          </div>}

        {status === "error" && <div style={{
        ...FI,
        fontSize: 12,
        color: T.bad,
        marginBottom: 12,
        textAlign: "center"
      }}>
            {errorMsg}
          </div>}

        {!coords ? <button onClick={getLocation} disabled={status === "loading"} style={{
        width: "100%",
        border: "none",
        borderRadius: 10,
        padding: "12px",
        background: status === "loading" ? T.line : T.accent,
        color: "#fff",
        fontFamily: "DM Sans",
        fontWeight: 700,
        fontSize: 13.5,
        cursor: status === "loading" ? "not-allowed" : "pointer"
      }} className="ais-button ais-button--default">
            {status === "loading" ? "Mengambil lokasi…" : "Ambil Lokasi Saat Ini"}
          </button> : <div style={{
        display: "flex",
        gap: 8
      }} className="ais-flex-layout">
            <button onClick={() => onSaved(coords)} style={{
          flex: 1,
          border: "none",
          borderRadius: 10,
          padding: "12px",
          background: T.good,
          color: "#fff",
          fontFamily: "DM Sans",
          fontWeight: 700,
          fontSize: 13.5,
          cursor: "pointer"
        }} className="ais-button ais-button--primary">
              Simpan & Lanjut
            </button>
            <button onClick={() => setCoords(null)} style={{
          border: `1px solid ${T.line}`,
          borderRadius: 10,
          padding: "12px 16px",
          background: "transparent",
          color: T.inkMuted,
          fontFamily: "DM Sans",
          fontWeight: 600,
          fontSize: 13.5,
          cursor: "pointer"
        }} className="ais-button ais-button--default">
              Ulangi
            </button>
          </div>}
      </div>
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
  1: "Shift 1",
  2: "Shift 2",
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
    if (v?.status === "unlocked" && u.id === (v.unlockedById || "eri")) add({
      id: `pnlu_${k}_${v.unlockedAt || v.editRequestedAt}`,
      jenis: "reminder",
      judul: "PnL sudah dibuka — submit & kunci kembali",
      detail: `${storeNm(sid)} · ${bulan}`,
      waktu: v.unlockedAt || v.editRequestedAt,
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
      judul: "Tugas khusus dari Manajemen",
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
    const batasToko = sid => paramToko(sid) && paramToko(sid).aturan && paramToko(sid).aturan.snapshotBatas || "14:00";
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
      const batas = batasToko(sid);
      if (u.peran === "spv" && (u.storeIds || []).includes(sid)) {
        if (jamKini < batas) {
          add({
            id: `snap_${sid}_${cutoff}`,
            jenis: "reminder",
            judul: `Isi snapshoot stok sebelum ${batas.replace(":", ".")}`,
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
            detail: `${storeNm(sid)} · batas pukul ${batas.replace(":", ".")} hari ini`,
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
            }}>
                  Notifikasi
                </div>
                <div style={{
              ...FI,
              fontSize: 11,
              color: T.inkMuted
            }}>
                  {belum.length} belum dibaca · {approvalCount} menunggu
                  approval Anda
                </div>
              </div>
              {belum.length > 0 && <button onClick={() => onMarkRead(belum.map(n => n.id))} style={{
            border: "none",
            background: "transparent",
            color: T.accentDeep,
            ...FI,
            fontWeight: 600,
            fontSize: 11.5,
            cursor: "pointer"
          }} className="ais-button ais-button--default">
                  Tandai semua dibaca
                </button>}
            </div>
            {items.length === 0 && <div style={{
          ...FI,
          fontSize: 12.5,
          color: T.inkMuted,
          padding: 24,
          textAlign: "center"
        }}>
                Tidak ada notifikasi.
              </div>}
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
            }}>
                    {NOTIF_JENIS[j].label} ({list.length})
                  </div>
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
                  }}>
                            {n.judul}
                          </span>
                          <span style={{
                    display: "block",
                    ...FI,
                    fontSize: 11.5,
                    color: T.inkMuted,
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                            {n.detail}
                          </span>
                          <span style={{
                    display: "block",
                    ...FI,
                    fontSize: 10.5,
                    color: T.inkMuted,
                    marginTop: 2
                  }}>
                            {notifWaktuRelatif(n.waktu, nowIso)}
                          </span>
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
        }}>
            Terjadi kesalahan saat menampilkan halaman
          </div>
          <div style={{
          fontSize: 12.5,
          color: "#767C86",
          marginBottom: 12
        }}>
            Data Anda aman. Mohon screenshot pesan di bawah ini dan kirim ke tim
            pengembang.
          </div>
          <div style={{
          fontFamily: "monospace",
          fontSize: 11.5,
          background: "#F5F3EC",
          borderRadius: 10,
          padding: 10,
          wordBreak: "break-word",
          marginBottom: 6
        }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          {stack && <div style={{
          fontFamily: "monospace",
          fontSize: 10.5,
          color: "#767C86",
          wordBreak: "break-word",
          marginBottom: 12
        }}>
              {stack}
            </div>}
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
        }} className="ais-button ais-button--default">
            Coba Lagi
          </button>
        </div>
      </div>;
  }
}
export default function App({
  identity,
  initialModule
}) {
  return <AisErrorBoundary>
      <AppInti identity={identity} initialModule={initialModule} />
    </AisErrorBoundary>;
}
function AppInti({
  identity,
  initialModule
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const [log, setLog, logLoaded] = useStoredState("ais-attendance-log", []);
  const [schedule, setSchedule, schedLoaded] = useStoredState("ais-schedule", {});
  const [reportLog, setReportLog, reportLoaded] = useStoredState("ais-report-log", {});
  const [approvalQueue, setApprovalQueue, approvalLoaded] = useStoredState("ais-approval-queue", []);
  const [laporanManajemen, setLaporanManajemen, laporanManajemenLoaded] = useStoredState("ais-laporan-manajemen", {});
  const [customTasks, setCustomTasks, customTasksLoaded] = useStoredState("ais-custom-tasks", []);
  const [masterTask,, masterTaskLoaded] = useStoredState("ais-master-task", DEFAULT_MASTER_TASK);
  // Data tambahan khusus notifikasi (ditulis dashboard, dibaca di sini)
  const [notifRead, setNotifRead] = useStoredState("ais-notif-read", {});
  const [jadwalStatusN] = useStoredState("ais-jadwal-status", {});
  const [wasteBandingN] = useStoredState("ais-waste-banding", []);
  const [sanksiListN] = useStoredState("ais-sanksi-list", []);
  const [salesEditLockN] = useStoredState("ais-sales-edit-lock", {});
  const [opnameEditLockN] = useStoredState("ais-opname-edit-lock", {});
  const [pnlStatusN] = useStoredState("ais-pnl-status", {});
  const [roqParam] = useStoredState("ais-roq-param", null);
  const [roqSnapshots, setRoqSnapshots] = useStoredState("ais-roq-snapshot", []);
  const [roqOrdersN] = useStoredState("ais-roq-orders", []);
  const [roqIngatkan] = useStoredState("ais-roq-ingatkan", [], 30000); // dibaca ulang tiap 30 detik
  const [ijinList, setIjinList, ijinLoaded] = useStoredState("ais-ijin-kerja", []);
  const [stockTransfersRaw, setStockTransfers, transfersLoaded] = useStoredState("ais-stock-transfers", []);
  // Pengaman: catatan transfer yang tidak lengkap (tanpa daftar item) tidak boleh menjatuhkan halaman.
  const stockTransfers = useMemo(() => (Array.isArray(stockTransfersRaw) ? stockTransfersRaw : []).filter(Boolean).map(t => Array.isArray(t.items) ? t : {
    ...t,
    items: []
  }), [stockTransfersRaw]);
  const [stockOpname, setStockOpname, opnameLoaded] = useStoredState("ais-stock-opname", []);
  const [opnameStatus, setOpnameStatus, opnameStatusLoaded] = useStoredState("ais-stock-opname-status", {});
  const [stokEditRequests, setStokEditRequests, stokEditLoaded] = useStoredState("ais-stok-edit-requests", []);
  const [stokEditLock, setStokEditLock, stokEditLockLoaded] = useStoredState("ais-stok-edit-lock", {});
  const [storeLocations, setStoreLocations, storeLocLoaded] = useStoredState("ais-store-locations", {});
  const [bebanToko, setBebanToko, bebanLoaded] = useStoredState("ais-beban-toko", []);
  const [pengajuan, setPengajuan, pengajuanLoaded] = useStoredState("ais-pengajuan", []);
  const [minyakConfig, setMinyakConfig, minyakCfgLoaded] = useStoredState("ais-minyak-config", MINYAK_CONFIG_DEFAULT);
  const [workHours, setWorkHours, workHoursLoaded] = useStoredState("ais-work-hours", WORK_HOURS_DEFAULT);
  const [deviceBinding, setDeviceBinding, deviceLoaded] = useStoredState("ais-device-binding", {});
  const [ciprekConfig, setCiprekConfig, ciprekCfgLoaded] = useStoredState("ais-ciprek-config", CIPREK_CONFIG_DEFAULT);
  const [passwordMeta, setPasswordMeta, passwordMetaLoaded] = useStoredState("ais-password-meta", {});
  const [purchaseReports, setPurchaseReports, purchaseLoaded] = useStoredState("ais-purchase-reports", []);
  const [purchaseStatus, setPurchaseStatus, purchaseStatusLoaded] = useStoredState("ais-purchase-status", {});
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (logLoaded && schedLoaded && reportLoaded && approvalLoaded && !seeded) {
      setSeeded(true);
      if (log.length === 0 && Object.keys(schedule).length === 0) {
        const seed = seedHistory();
        // Attendance events are created only through the baseline-checked addRecord path.
        setSchedule(seed.schedule);
      }
      // Regenerate seluruh jendela 5 hari sekaligus (bukan cuma isi yang kosong) supaya rantai
      // Stok Awal/Akhir antar hari selalu konsisten satu sama lain, walau seeding ini jalan
      // berkali-kali di sesi berbeda (jendela "5 hari ke belakang" ikut geser tiap hari berjalan).
      // Data yang sudah diedit Elin tetap dilindungi, tidak ditimpa.
      // Regenerate seluruh jendela 5 hari setiap kali app dimuat (bukan cuma kalau ada yang kosong),
      // supaya rantai Stok Awal/Akhir antar hari selalu konsisten — termasuk memperbaiki data lama
      // yang sempat tidak nyambung karena jendela "5 hari ke belakang" bergeser antar sesi testing.
      // Data yang sudah diedit Elin tetap dilindungi, tidak ditimpa.
      const stokSeed = seedReportLogStok();
      const merged = {
        ...reportLog
      };
      let changed = false;
      Object.keys(stokSeed.reportLog).forEach(k => {
        const existing = merged[k]?.stok;
        const isSimOrMissing = !existing || existing.inputOleh === "Simulasi (Data Awal)";
        const alreadyEdited = existing?.editedBy;
        const alreadyMatches = existing && BAHAN_BAKU.every(b => existing[b.id]?.awal === stokSeed.reportLog[k].stok[b.id].awal && existing[b.id]?.akhir === stokSeed.reportLog[k].stok[b.id].akhir);
        if (isSimOrMissing && !alreadyEdited && !alreadyMatches) {
          merged[k] = {
            ...merged[k],
            stok: stokSeed.reportLog[k].stok
          };
          changed = true;
        }
      });
      if (changed) setReportLog(merged);
      const missingApproval = stokSeed.approvalEntries.filter(e => !approvalQueue.some(a => a.id === e.id));
      if (missingApproval.length > 0) setApprovalQueue([...approvalQueue, ...missingApproval]);
    }
  }, [logLoaded, schedLoaded, reportLoaded, approvalLoaded, seeded]);
  const [empId, setEmpId] = useState(identity.id);
  const emp = EMPLOYEES.find(e => e.id === empId) || EMPLOYEES[0];
  const [activeModule, setActiveModule] = useState(initialModule || "absensi");
  const [loggedIn, setLoggedIn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const addRecord = async rec => {
    if (rec.empId !== identity.id) throw new Error("Identitas attendance tidak sesuai akun.");
    const baseline = await getBaseline(identity.id);
    const checked = assertAttendanceBaseline(rec, baseline);
    await setLog([...log, checked]);
  };
  const dataReady = logLoaded && schedLoaded && reportLoaded && approvalLoaded && laporanManajemenLoaded && customTasksLoaded && masterTaskLoaded && ijinLoaded && transfersLoaded && opnameLoaded && opnameStatusLoaded && purchaseLoaded && purchaseStatusLoaded && stokEditLoaded && stokEditLockLoaded && storeLocLoaded && passwordMetaLoaded && bebanLoaded && pengajuanLoaded && minyakCfgLoaded && ciprekCfgLoaded && workHoursLoaded && deviceLoaded;
  if (!loggedIn) {
    return <LoginScreen empId={empId} setEmpId={setEmpId} passwordMeta={passwordMeta} deviceBinding={deviceBinding} setDeviceBinding={setDeviceBinding} deviceLoaded={deviceLoaded} onLogin={() => {
      const allowed = allowedModuleMenu(emp);
      setActiveModule(allowed.includes("absensi") ? "absensi" : allowed[0] || "absensi");
      setLoggedIn(true);
    }} />;
  }
  if (emp.status === "nonaktif") {
    return <InactiveAccountScreen emp={emp} onBack={() => setLoggedIn(false)} />;
  }
  const empStore = emp.group === "toko_device" ? STORES.find(s => s.id === emp.store) : null;
  const empStoreLoc = empStore ? storeLocations[empStore.id] || (empStore.lat != null ? {
    lat: empStore.lat,
    lng: empStore.lng
  } : null) : null;
  if (empStore && !empStoreLoc) {
    return <PinLocationScreen store={empStore} onSaved={coords => setStoreLocations({
      ...storeLocations,
      [empStore.id]: coords
    })} />;
  }

  // Notifikasi personal karyawan yang login (approval yang menjadi tugasnya, pengingat, dan hasil keputusan)
  const notifPeran = emp.group === "direksi" ? "direksi" : ["eri", "nana", "elin"].includes(emp.id) ? emp.id : emp.group === "manajemen" ? "manajemen" : emp.group === "spv" || emp.group === "tl" ? "spv" : emp.group === "toko_device" ? "toko" : "crew";
  const nowIsoN = now.toISOString();
  let notifItems = [];
  try {
    notifItems = hitungNotifikasi({
      id: emp.id,
      name: emp.name,
      peran: notifPeran,
      storeIds: (emp.stores || [emp.store]).filter(Boolean),
      emp
    }, {
      approvalQueue,
      stokEditRequests,
      stokEditLock,
      opnameEditLock: opnameEditLockN,
      salesEditLock: salesEditLockN,
      pnlStatus: pnlStatusN,
      purchaseStatus,
      ijinList,
      pengajuan,
      stockTransfers,
      jadwalStatus: jadwalStatusN,
      wasteBanding: wasteBandingN,
      customTasks,
      masterTask,
      laporanManajemen,
      sanksiList: sanksiListN,
      employees: EMPLOYEES,
      stores: STORES,
      schedule,
      reportLog,
      stockOpnameReports: stockOpname,
      roqParam: roqParam || {},
      roqSnapshots,
      roqOrders: roqOrdersN,
      roqIngatkan
    }, nowIsoN);
  } catch (e) {
    console.error("notifikasi gagal dihitung", e);
  }
  const notifReadSaya = notifRead[emp.id] || {};
  const tandaiNotif = ids => {
    const at = new Date().toISOString();
    setNotifRead({
      ...notifRead,
      [emp.id]: {
        ...notifReadSaya,
        ...Object.fromEntries(ids.map(id => [id, at]))
      }
    });
  };
  const bukaNotif = n => {
    const m = n.tujuan?.app;
    if (m && allowedModuleMenu(emp).includes(m)) setActiveModule(m);
  };
  return <div style={{
    background: T.bg,
    minHeight: "100%",
    ...FI,
    color: T.ink
  }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        select:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 1px; }
      `}</style>

      <div className="ais-mobile-scene">
        {/* MAIN CARD */}
        <div style={{
        background: T.surface,
        borderRadius: 18,
        padding: 18,
        border: `1px solid ${T.line}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }} className="ais-content-panel">
          {!dataReady ? <div style={{
          ...FI,
          fontSize: 13,
          color: T.inkMuted,
          padding: 20,
          textAlign: "center"
        }}>
              Memuat data…
            </div> : activeModule === "beban" ? <BebanTokoForm emp={emp} now={now} bebanToko={bebanToko} setBebanToko={setBebanToko} log={log} /> : activeModule === "profile" && emp.group === "toko_device" ? <ProfileTokoPage emp={emp} log={log} now={now} /> : activeModule === "profile" ? <ProfilePage emp={emp} log={log} schedule={schedule} ijinList={ijinList} now={now} passwordMeta={passwordMeta} setPasswordMeta={setPasswordMeta} workHours={workHours} /> : activeModule === "jadwal" ? <JadwalSayaPage emp={emp} schedule={schedule} now={now} /> : activeModule === "absensi" ? emp.group === "direksi" ? <AdminUtamaCard emp={emp} log={log} schedule={schedule} addRecord={addRecord} workHours={workHours} personalAbsen={false} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} reportLog={reportLog} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} now={now} /> : emp.group === "manajemen" && emp.isAdminUtama ? <AdminUtamaCard emp={emp} log={log} schedule={schedule} addRecord={addRecord} workHours={workHours} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} reportLog={reportLog} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} now={now} /> : emp.jabatan === "Finance" ? <AdminUtamaCard emp={emp} log={log} schedule={schedule} addRecord={addRecord} workHours={workHours} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} purchaseReports={purchaseReports} setPurchaseReports={setPurchaseReports} purchaseStatus={purchaseStatus} setPurchaseStatus={setPurchaseStatus} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} reportLog={reportLog} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} now={now} visibleTabs={["absensi", "rekap", "pembelian"]} /> : emp.group === "manajemen" ? <ManajemenCard emp={emp} log={log} addRecord={addRecord} workHours={workHours} showIdentity={false} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} /> : emp.group === "crew" || emp.group === "parttime" ? <CrewCard emp={emp} log={log} reportLog={reportLog} addRecord={addRecord} schedule={schedule} workHours={workHours} /> : emp.group === "spv" || emp.group === "tl" ? <SpvCard emp={emp} log={log} reportLog={reportLog} addRecord={addRecord} schedule={schedule} now={now} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} laporanManajemen={laporanManajemen} setLaporanManajemen={setLaporanManajemen} customTasks={customTasks} masterTask={masterTask} setCustomTasks={setCustomTasks} workHours={workHours} /> : <div style={{
          ...FI,
          fontSize: 13.5,
          color: T.inkMuted,
          padding: 16,
          textAlign: "center"
        }}>
                <IdentityCard emp={emp} />
                Akun Toko adalah device bersama, tidak melakukan absen personal.
                Gunakan tab <b>Laporan Toko</b>.
              </div> : activeModule === "laporan" ? emp.group === "toko_device" ? <LaporanTokoForm emp={emp} now={now} minyakConfig={minyakConfig} ciprekConfig={ciprekConfig} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} stockTransfers={stockTransfers} stockOpname={stockOpname} stokEditRequests={stokEditRequests} setStokEditRequests={setStokEditRequests} /> : emp.group === "spv" || emp.group === "tl" ? <SpvLaporanRiwayat emp={emp} reportLog={reportLog} approvalQueue={approvalQueue} now={now} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} pengajuan={pengajuan} setPengajuan={setPengajuan} roqParam={roqParam} roqSnapshots={roqSnapshots} setRoqSnapshots={setRoqSnapshots} roqIngatkan={roqIngatkan} /> : emp.group === "crew" || emp.group === "parttime" ? <div>
                <IdentityCard emp={emp} />
                <div style={{
            background: T.badSoft,
            color: T.bad,
            padding: "14px 16px",
            borderRadius: 14,
            ...FI,
            fontWeight: 600,
            fontSize: 13.5,
            display: "flex",
            gap: 8,
            alignItems: "flex-start"
          }} className="ais-flex-layout">
                  <Lock size={16} style={{
              marginTop: 1,
              flexShrink: 0
            }} />
                  Crew tidak memiliki akses input laporan toko. Laporan hanya
                  bisa diinput lewat Akun Toko (device toko).
                </div>
              </div> : emp.group === "direksi" || emp.group === "manajemen" && emp.isAdminUtama ? <LaporanTokoAdminView emp={emp} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} now={now} stokEditRequests={stokEditRequests} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} stockTransfers={stockTransfers} setStockTransfers={setStockTransfers} pengajuan={pengajuan} setPengajuan={setPengajuan} /> : emp.jabatan === "Admin Inventory" ? <StokReviewElin emp={emp} reportLog={reportLog} setReportLog={setReportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} stokEditRequests={stokEditRequests} setStokEditRequests={setStokEditRequests} stokEditLock={stokEditLock} setStokEditLock={setStokEditLock} stockOpname={stockOpname} now={now} /> : <div>
                <IdentityCard emp={emp} />
                <div style={{
            ...FI,
            fontSize: 13.5,
            color: T.inkMuted,
            padding: 16,
            textAlign: "center"
          }}>
                  Modul Laporan Toko tidak berlaku untuk role ini.
                </div>
              </div> : activeModule === "opname" ? emp.id === "eri" || emp.id === "elin" || emp.group === "direksi" ? <div>
                <IdentityCard emp={emp} />
                <StokOpnamePage emp={emp} reportLog={reportLog} stockOpname={stockOpname} setStockOpname={setStockOpname} opnameStatus={opnameStatus} setOpnameStatus={setOpnameStatus} now={now} />
              </div> : <div>
                <IdentityCard emp={emp} />
                <div style={{
            ...FI,
            fontSize: 13.5,
            color: T.inkMuted,
            padding: 16,
            textAlign: "center"
          }}>
                  Modul Stok Opname tidak tersedia untuk akun Anda.
                </div>
              </div> : activeModule === "ijin" ? <IjinKerjaPage emp={emp} ijinList={ijinList} setIjinList={setIjinList} now={now} /> : <ApprovalPenuhTab emp={emp} reportLog={reportLog} approvalQueue={approvalQueue} setApprovalQueue={setApprovalQueue} ijinList={ijinList} setIjinList={setIjinList} now={now} />}
        </div>

        <div style={{
        textAlign: "center",
        marginTop: 16,
        ...FI,
        fontSize: 11,
        color: T.inkMuted
      }}>
          Data tersimpan lokal untuk keperluan prototype — bukan basis data
          produksi.
        </div>
      </div>
    </div>;
}
export { EMPLOYEES, STORES, allowedModuleMenu };
export { sidikJariPerangkat, labelPerangkat, perluKunciPerangkat };
