// Reference data and business policies extracted from the supplied AIS modules.

export const STORES = [
  {
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
    telepon: "0266-221001",
  },
  {
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
    telepon: "0266-221002",
  },
  {
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
    telepon: "0266-221003",
  },
  {
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
    telepon: "0266-221005",
  },
  {
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
    telepon: "0266-221006",
  },
  {
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
    telepon: "0266-221007",
  },
  {
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
    telepon: "0266-221008",
  },
  {
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
    telepon: "0266-221009",
  },
];

export const EMPLOYEES = [
  {
    id: "eri",
    name: "Eri",
    jabatan: "Admin Utama",
    group: "manajemen",
    store: null,
    joinDate: "2022-03-01",
    statusKontrak: "tetap",
    cutiKuota: 12,
    isAdminUtama: true,
  },
  {
    id: "nana",
    name: "Nana",
    jabatan: "Finance",
    group: "manajemen",
    store: null,
    joinDate: "2022-08-15",
    statusKontrak: "tetap",
    cutiKuota: 12,
  },
  {
    id: "elin",
    name: "Elin",
    jabatan: "Admin Inventory",
    group: "manajemen",
    store: null,
    joinDate: "2023-01-10",
    statusKontrak: "kontrak",
    kontrakEnd: "2026-12-31",
    cutiKuota: 12,
  },
  {
    id: "rizky",
    name: "Rizky",
    jabatan: "Graphic Designer",
    group: "manajemen",
    store: null,
    joinDate: "2024-02-01",
    statusKontrak: "kontrak",
    kontrakEnd: "2027-01-31",
    cutiKuota: 12,
  },
  {
    id: "galuh",
    name: "Galuh",
    jabatan: "Crew",
    group: "crew",
    store: "dtop_baros",
    joinDate: "2023-05-02",
    statusKontrak: "tetap",
  },
  {
    id: "hilman",
    name: "Hilman",
    jabatan: "Team Leader",
    group: "tl",
    store: "dtop_baros",
    stores: ["dtop_baros"],
    joinDate: "2023-09-18",
    statusKontrak: "kontrak",
    kontrakEnd: "2026-09-18",
  },
  {
    id: "revy",
    name: "Revy",
    jabatan: "Crew",
    group: "crew",
    store: "dtop_lembursitu",
    joinDate: "2024-06-10",
    statusKontrak: "kontrak",
    kontrakEnd: "2026-12-10",
  },
  {
    id: "hadi",
    name: "Hadi",
    jabatan: "Part Time",
    group: "parttime",
    store: "dtop_baros",
    joinDate: "2025-01-20",
    statusKontrak: "parttime",
  },
  {
    id: "jafar_sodik",
    name: "Jafar Sodik",
    jabatan: "SPV Jr",
    group: "spv",
    store: "dtop_cipanengah",
    stores: ["dtop_cipanengah", "dtop_lembursitu"],
    joinDate: "2022-11-01",
    statusKontrak: "tetap",
  },
  {
    id: "sahrul",
    name: "Sahrul",
    jabatan: "SPV Jr",
    group: "spv",
    store: "dtop_purabaya",
    stores: ["dtop_purabaya", "dtop_sagaranten"],
    joinDate: "2023-03-14",
    statusKontrak: "kontrak",
    kontrakEnd: "2026-09-14",
  },
  {
    id: "endin",
    name: "Endin",
    jabatan: "SPV Jr",
    group: "spv",
    store: "dtop_mangkalaya",
    stores: ["dtop_mangkalaya", "dtop_cikembar"],
    joinDate: "2024-02-05",
    statusKontrak: "tetap",
  },
  {
    id: "juhaeri",
    name: "Juhaeri",
    jabatan: "Manajemen",
    group: "direksi",
    store: null,
    joinDate: "2020-01-01",
    statusKontrak: "tetap",
  },
  {
    id: "kurnia",
    name: "Kurnia",
    jabatan: "Manajemen",
    group: "direksi",
    store: null,
    joinDate: "2020-01-01",
    statusKontrak: "tetap",
  },
  {
    id: "toko_dtop_baros",
    name: "Akun Toko — DTOP Baros",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_baros",
  },
  {
    id: "toko_dtop_cipanengah",
    name: "Akun Toko — DTOP Cipanengah",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_cipanengah",
  },
  {
    id: "toko_dtop_lembursitu",
    name: "Akun Toko — DTOP Lembursitu",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_lembursitu",
  },
  {
    id: "toko_dtop_jubleg",
    name: "Akun Toko — DTOP Jubleg",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_jubleg",
  },
  {
    id: "toko_dtop_purabaya",
    name: "Akun Toko — DTOP Purabaya",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_purabaya",
  },
  {
    id: "toko_dtop_sagaranten",
    name: "Akun Toko — DTOP Sagaranten",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_sagaranten",
  },
  {
    id: "toko_dtop_mangkalaya",
    name: "Akun Toko — DTOP Mangkalaya",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_mangkalaya",
  },
  {
    id: "toko_dtop_cikembar",
    name: "Akun Toko — DTOP Cikembar",
    jabatan: "Device Toko",
    group: "toko_device",
    store: "dtop_cikembar",
  },
];

export const isMitraStore = (id) =>
  STORES.find((s) => s.id === id)?.status === "mitra";

export function hanyaMitra(emp) {
  const ids = emp.stores || (emp.store ? [emp.store] : []);
  return ids.length > 0 && ids.every((id) => isMitraStore(id));
}

export function allowedModuleMenu(emp) {
  // Akun toko mitra hanya menyimpan titik koordinat absen — tanpa laporan apa pun.
  if (emp.group === "toko_device") {
    return isMitraStore(emp.store)
      ? ["profile"]
      : ["profile", "laporan", "beban"];
  }
  if (emp.group === "crew" || emp.group === "parttime")
    return ["profile", "absensi", "ijin", "jadwal"];
  if (emp.group === "spv" || emp.group === "tl") {
    // SPV yang semua tokonya mitra: tidak ada laporan toko maupun laporan kerja harian.
    if (hanyaMitra(emp)) return ["profile", "absensi", "ijin", "jadwal"];
    return [
      "profile",
      "absensi",
      "absensi_harian",
      "laporan",
      "ijin",
      "jadwal",
    ];
  }
  if (emp.group === "direksi")
    return [
      "profile",
      "absensi",
      "absensi_harian",
      "laporan",
      "opname",
      "ijin",
      "approval",
    ];
  if (emp.group === "manajemen") {
    if (emp.id === "eri")
      return [
        "profile",
        "absensi",
        "absensi_harian",
        "laporan",
        "opname",
        "ijin",
        "approval",
      ];
    if (emp.id === "elin")
      return [
        "profile",
        "absensi",
        "absensi_harian",
        "laporan",
        "opname",
        "ijin",
      ];
    return ["profile", "absensi", "absensi_harian", "ijin"];
  }
  return ["profile", "absensi"];
}

export const GRUP_DIKUNCI = new Set(["crew", "parttime", "spv", "tl", "toko_device"]);

export const perluKunciPerangkat = (emp) => !!emp && GRUP_DIKUNCI.has(emp.group);

export function sidikJariPerangkat() {
  try {
    const n = typeof navigator !== "undefined" ? navigator : {};
    const s = typeof screen !== "undefined" ? screen : {};
    const bagian = [
      n.userAgent || "",
      n.language || "",
      n.platform || "",
      n.hardwareConcurrency || "",
      n.maxTouchPoints || "",
      s.width || "",
      s.height || "",
      s.colorDepth || "",
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "") || "",
    ].join("|");
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

export function labelPerangkat() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac/i.test(ua)
          ? "Mac"
          : "Perangkat";
  const br = /Chrome/i.test(ua)
    ? "Chrome"
    : /Safari/i.test(ua)
      ? "Safari"
      : /Firefox/i.test(ua)
        ? "Firefox"
        : "Browser";
  return `${os} · ${br}`;
}

export const SEED_EMPLOYEES = [
  { id: "eri", name: "Eri", jabatan: "Admin Utama", group: "manajemen", store: null, stores: null, status: "aktif", joinDate: "2022-03-01", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: 12 },
  { id: "nana", name: "Nana", jabatan: "Finance", group: "manajemen", store: null, stores: null, status: "aktif", joinDate: "2022-08-15", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: 12 },
  { id: "elin", name: "Elin", jabatan: "Admin Inventory", group: "manajemen", store: null, stores: null, status: "aktif", joinDate: "2023-01-10", statusKontrak: "kontrak", kontrakEnd: "2026-12-31", cutiKuota: 12 },
  { id: "rizky", name: "Rizky", jabatan: "Graphic Designer", group: "manajemen", store: null, stores: null, status: "aktif", joinDate: "2024-02-01", statusKontrak: "kontrak", kontrakEnd: "2027-01-31", cutiKuota: 12 },
  { id: "galuh", name: "Galuh", jabatan: "Crew", group: "crew", store: "dtop_baros", stores: null, status: "aktif", joinDate: "2023-05-02", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: null },
  { id: "hilman", name: "Hilman", jabatan: "Team Leader", group: "tl", store: "dtop_baros", stores: ["dtop_baros"], status: "aktif", joinDate: "2023-09-18", statusKontrak: "kontrak", kontrakEnd: "2026-09-18", cutiKuota: null },
  { id: "revy", name: "Revy", jabatan: "Crew", group: "crew", store: "dtop_lembursitu", stores: null, status: "aktif", joinDate: "2024-06-10", statusKontrak: "kontrak", kontrakEnd: "2026-12-10", cutiKuota: null },
  { id: "hadi", name: "Hadi", jabatan: "Part Time", group: "parttime", store: "dtop_baros", stores: null, status: "aktif", joinDate: "2025-01-20", statusKontrak: "parttime", kontrakEnd: null, cutiKuota: null },
  { id: "jafar_sodik", name: "Jafar Sodik", jabatan: "SPV Jr", group: "spv", store: "dtop_cipanengah", stores: ["dtop_cipanengah", "dtop_lembursitu"], status: "aktif", joinDate: "2022-11-01", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: null },
  { id: "sahrul", name: "Sahrul", jabatan: "SPV Jr", group: "spv", store: "dtop_purabaya", stores: ["dtop_purabaya", "dtop_sagaranten"], status: "aktif", joinDate: "2023-03-14", statusKontrak: "kontrak", kontrakEnd: "2026-09-14", cutiKuota: null },
  { id: "endin", name: "Endin", jabatan: "SPV Jr", group: "spv", store: "dtop_mangkalaya", stores: ["dtop_mangkalaya", "dtop_cikembar"], status: "aktif", joinDate: "2024-02-05", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: null },
  { id: "juhaeri", name: "Juhaeri", jabatan: "Direksi", group: "direksi", store: null, stores: null, status: "aktif", joinDate: "2020-01-01", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: null },
  { id: "kurnia", name: "Kurnia", jabatan: "Manajer Operasional", group: "direksi", store: null, stores: null, status: "aktif", joinDate: "2020-01-01", statusKontrak: "tetap", kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_baros", name: "Akun Toko — DTOP Baros", jabatan: "Device Toko", group: "toko_device", store: "dtop_baros", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_cipanengah", name: "Akun Toko — DTOP Cipanengah", jabatan: "Device Toko", group: "toko_device", store: "dtop_cipanengah", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_lembursitu", name: "Akun Toko — DTOP Lembursitu", jabatan: "Device Toko", group: "toko_device", store: "dtop_lembursitu", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_jubleg", name: "Akun Toko — DTOP Jubleg", jabatan: "Device Toko", group: "toko_device", store: "dtop_jubleg", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_purabaya", name: "Akun Toko — DTOP Purabaya", jabatan: "Device Toko", group: "toko_device", store: "dtop_purabaya", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_sagaranten", name: "Akun Toko — DTOP Sagaranten", jabatan: "Device Toko", group: "toko_device", store: "dtop_sagaranten", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_mangkalaya", name: "Akun Toko — DTOP Mangkalaya", jabatan: "Device Toko", group: "toko_device", store: "dtop_mangkalaya", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
  { id: "toko_dtop_cikembar", name: "Akun Toko — DTOP Cikembar", jabatan: "Device Toko", group: "toko_device", store: "dtop_cikembar", stores: null, status: "aktif", joinDate: null, statusKontrak: null, kontrakEnd: null, cutiKuota: null },
];

export const SEED_STORES = [
  // status: "holding" = toko penuh (semua modul) · "mitra" = hanya absen & transfer, tanpa inventory/laporan
  // manage: "spv" | "tl" | "admin" — menentukan ke siapa approval, ijin, dan tukar shift diajukan
  { id: "dtop_baros", name: "DTOP Baros", jenisToko: "resto", status: "holding", manage: "tl", pjId: "hilman", lat: -6.9200, lng: 107.6050, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Baros, Sukabumi", telepon: "0266-221001", activatedAt: "2026-01-05T07:00:00" },
  { id: "dtop_cipanengah", name: "DTOP Cipanengah", jenisToko: "resto", status: "holding", manage: "spv", pjId: "jafar_sodik", lat: -6.9300, lng: 107.6200, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Cipanengah, Sukabumi", telepon: "0266-221002", activatedAt: "2026-01-05T07:00:00" },
  { id: "dtop_lembursitu", name: "DTOP Lembursitu", jenisToko: "resto", status: "holding", manage: "spv", pjId: "jafar_sodik", lat: -6.9400, lng: 107.5900, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Lembursitu, Sukabumi", telepon: "0266-221003", activatedAt: "2026-01-05T07:00:00" },
  { id: "dtop_jubleg", name: "DTOP Jubleg", jenisToko: "express", status: "holding", manage: "admin", pjId: "eri", lat: -6.9150, lng: 107.6300, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Jubleg, Sukabumi", telepon: "0266-221005", activatedAt: "2026-02-01T07:00:00" },
  { id: "dtop_purabaya", name: "DTOP Purabaya", jenisToko: "resto", status: "holding", manage: "spv", pjId: "sahrul", lat: -6.9500, lng: 106.9800, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Purabaya, Sukabumi", telepon: "0266-221006", activatedAt: "2026-03-01T07:00:00" },
  { id: "dtop_sagaranten", name: "DTOP Sagaranten", jenisToko: "resto", status: "mitra", manage: "spv", pjId: "sahrul", lat: -7.1200, lng: 106.7800, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Sagaranten, Sukabumi", telepon: "0266-221007", activatedAt: "2026-04-01T07:00:00" },
  { id: "dtop_mangkalaya", name: "DTOP Mangkalaya", jenisToko: "resto", status: "mitra", manage: "spv", pjId: "endin", lat: -6.9600, lng: 106.9200, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Mangkalaya, Sukabumi", telepon: "0266-221008", activatedAt: "2026-04-15T07:00:00" },
  { id: "dtop_cikembar", name: "DTOP Cikembar", jenisToko: "resto", status: "mitra", manage: "spv", pjId: "endin", lat: -6.9800, lng: 106.8600, radius: 10, transitLimitMinutes: 30, alamat: "Jl. Cikembar, Sukabumi", telepon: "0266-221009", activatedAt: "2026-05-01T07:00:00" },
];

export const DASHBOARD_USERS = [
  { id: "eri", name: "Eri", jabatan: "Admin Utama", access: "admin_utama" },
  { id: "juhaeri", name: "Juhaeri", jabatan: "Direksi", access: "all" },
  { id: "kurnia", name: "Kurnia", jabatan: "Manajer Operasional", access: "all" },
  { id: "nana", name: "Nana", jabatan: "Finance", access: "nana" },
  { id: "elin", name: "Elin", jabatan: "Admin Inventory", access: "elin" },
  { id: "jafar_sodik", name: "Jafar Sodik", jabatan: "SPV Jr", access: "spv" },
  { id: "sahrul", name: "Sahrul", jabatan: "SPV Jr", access: "spv" },
  { id: "endin", name: "Endin", jabatan: "SPV Jr", access: "spv" },
  { id: "hilman", name: "Hilman", jabatan: "Team Leader", access: "spv" },
];

export const ACCESS_MAP = {
  all: {
    overview: "edit", karyawan_master: "edit", karyawan_sanksi: "edit", karyawan_role: "edit",
    produksi_toko: "edit", produksi_bahan: "edit", produksi_produk: "edit", produksi_resep: "edit", produksi_produksi: "edit", produksi_task: "edit",
    absensi_jadwal: "edit", absensi_rekap: "edit", absensi_ijin: "edit",
    laporan_sales: "edit", laporan_pengeluaran: "edit", laporan_beban: "edit", laporan_pengajuan: "view", laporan_produksi: "edit", laporan_pembelian: "edit", laporan_opname: "edit", laporan_transfer: "edit", laporan_kerja_harian: "view", laporan_waste: "edit", laporan_pnl: "edit", laporan_approval: "edit",
    inventory_ringkasan: "edit", inventory_rekap: "edit",
    roq: "edit", laporan_roq: "view",
  },
  admin_utama: {
    overview: "edit", karyawan_sanksi: "edit",
    produksi_toko: "edit", produksi_bahan: "edit", produksi_produk: "edit", produksi_resep: "edit", produksi_produksi: "edit",
    absensi_jadwal: "edit", absensi_rekap: "edit", absensi_ijin: "edit",
    laporan_sales: "edit", laporan_pengeluaran: "edit", laporan_beban: "edit", laporan_pengajuan: "edit", laporan_produksi: "edit", laporan_pembelian: "edit", laporan_opname: "edit", laporan_transfer: "edit", laporan_waste: "edit", laporan_pnl: "edit", laporan_approval: "edit",
    inventory_ringkasan: "edit", inventory_rekap: "edit",
    roq: "edit", laporan_roq: "view",
    // karyawan_master & karyawan_role sengaja tidak disebut — hak akses penuh Master Karyawan & Role hanya Direksi (Juhaeri & Kurnia)
    // absensi_jadwal "edit" untuk Eri = APPROVAL jadwal toko yang disubmit SPV (grid toko tidak bisa diubah Eri)
    // laporan_pembelian & laporan_opname sengaja "view" — input aslinya hanya lewat mobile app
    // laporan_kerja_harian sengaja tidak disebut — halaman ini khusus Direksi
  },
  nana: { overview: "view", absensi_jadwal: "view", absensi_rekap: "view", laporan_sales: "view", laporan_pengeluaran: "view", laporan_beban: "view", laporan_pengajuan: "edit", laporan_pembelian: "edit", laporan_opname: "edit", laporan_pnl: "view" },
  elin: { overview: "view", laporan_waste: "edit", produksi_bahan: "edit", inventory_ringkasan: "edit", inventory_rekap: "edit", roq: "edit", laporan_roq: "view", laporan_opname: "edit", laporan_approval: "edit" },
  // SPV/TL: jadwal toko yang dinaungi (input + submit ke Eri), sanksi & laporan hanya lihat, semuanya dibatasi ke toko sendiri.
  spv: { overview: "view", karyawan_sanksi: "view", absensi_jadwal: "edit", absensi_rekap: "view", laporan_produksi: "view", laporan_opname: "view", laporan_sales: "view", laporan_pengeluaran: "view", laporan_waste: "view" },
};

export const NAV_GROUPS = [
  { key: "overview", label: "Overview",  single: true },
  { key: "karyawan", label: "Karyawan",  pages: [
      { key: "karyawan_master", label: "Master Data Karyawan" },
      { key: "karyawan_sanksi", label: "Data Sanksi" },
      { key: "karyawan_role", label: "Role & Akses" },
    ] },
  { key: "produksi", label: "Master Data",  pages: [
      { key: "produksi_toko", label: "Master Toko" },
      { key: "produksi_bahan", label: "Master Bahan Baku" },
      { key: "produksi_produk", label: "Master Produk" },
      { key: "produksi_resep", label: "Master Resep / BOM" },
      { key: "produksi_produksi", label: "Master Produksi" },
      { key: "produksi_task", label: "Master Task Karyawan" },
    ] },
  { key: "absensi", label: "Absensi",  pages: [
      { key: "absensi_jadwal", label: "Master Jadwal" },
      { key: "absensi_rekap", label: "Rekap Absensi" },
      { key: "absensi_ijin", label: "Ijin Kerja" },
    ] },
  { key: "laporan", label: "Laporan",  pages: [
      { key: "laporan_approval", label: "Approval Laporan" },
      { key: "laporan_produksi", label: "Rekap Produksi" },
      { key: "laporan_pembelian", label: "Rekap Pembelian Bahan Baku" },
      { key: "laporan_opname", label: "Rekap Stok Opname" },
      { key: "laporan_transfer", label: "Rekap Transfer Stok" },
      { key: "laporan_sales", label: "Rekap Sales" },
      { key: "laporan_pengeluaran", label: "Rekap Pengeluaran" },
      { key: "laporan_beban", label: "Rekap Beban Toko" },
      { key: "laporan_pengajuan", label: "Rekap Pengajuan" },
      { key: "laporan_kerja_harian", label: "Rekap Daily Task" },
      { key: "laporan_waste", label: "Waste Calculation" },
      { key: "laporan_roq", label: "Laporan ROQ" },
      { key: "laporan_pnl", label: "PnL (Profit & Loss)" },
    ] },
  { key: "inventory", label: "Inventory",  pages: [
      { key: "inventory_ringkasan", label: "Ringkasan Stok" },
      { key: "inventory_rekap", label: "Rekap per Variabel" },
      { key: "roq", label: "ROQ" },
    ] },
];

export const pad = (n) => String(n).padStart(2, "0");

export const uid = () => Math.random().toString(36).slice(2, 9);

export function seedAttendanceAndSchedule() {
  const schedule = {};
  const attendance = [];
  const today = new Date();
  const shiftWorkers = SEED_EMPLOYEES.filter((e) => e.group === "crew" || e.group === "spv" || e.group === "tl" || e.group === "parttime");
  const officeWorkers = SEED_EMPLOYEES.filter((e) => e.group === "manajemen");

  for (let back = 27; back >= 1; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const isSunday = d.getDay() === 0;

    shiftWorkers.forEach((w, idx) => {
      if (isSunday && idx % 4 === 0) return; // sebagian libur minggu
      const shiftPool = w.id === "sahrul" ? ["M", "1", "2"] : w.group === "parttime" ? ["1", "2"] : ["1", "2", "L"];
      const shift = shiftPool[(back + idx) % shiftPool.length];
      schedule[`${w.id}_${ds}`] = shift;
      const isAlpa = (back % 9 === 0) && idx % 3 === 0;
      if (isAlpa) return;
      const late = (back % 6 === 0) && idx % 2 === 0;
      const early = (back % 7 === 0) && idx % 2 === 1;
      const telatMenit = late ? 16 + ((back + idx) % 5) * 7 : 0;
      attendance.push({ empId: w.id, date: ds, shift, telat: late, telatMenit, pulangCepat: early, jamKerja: 7.5 - (early ? 1.2 : 0) });
    });

    if (!isSunday) {
      officeWorkers.forEach((w, idx) => {
        const isAlpa = (back % 11 === 0) && idx % 3 === 0;
        if (isAlpa) return;
        const late = (back % 8 === 0) && idx % 2 === 0;
        const early = (back % 10 === 0) && idx % 2 === 1;
        const telatMenit = late ? 18 + ((back + idx) % 4) * 6 : 0;
        attendance.push({ empId: w.id, date: ds, shift: "kantor", telat: late, telatMenit, pulangCepat: early, jamKerja: 9 - (early ? 1 : 0) });
      });
    }
  }
  return { schedule, attendance };
}

export function seedIjinKerja() {
  const today = new Date();
  const ds = (offset) => { const d = new Date(today); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  return [
    { id: uid(), jenis: "sakit", empId: "hilman", empName: "Hilman", group: "crew", requestedById: "hilman", requestedByName: "Hilman", tanggalMulai: ds(-1), tanggalSelesai: ds(-1), status: "approved", submittedAt: ds(-1), decidedBy: "Eri", decidedAt: ds(-1) },
    { id: uid(), jenis: "tidak_hadir", empId: "galuh", empName: "Galuh", group: "crew", requestedById: "galuh", requestedByName: "Galuh", tanggalMulai: ds(2), tanggalSelesai: ds(2), alasan: "Acara keluarga", crewPengganti: "Hadi", status: "pending", submittedAt: ds(0) },
    { id: uid(), jenis: "cuti", empId: "nana", empName: "Nana", group: "manajemen", requestedById: "nana", requestedByName: "Nana", tanggalMulai: ds(35), tanggalSelesai: ds(38), status: "pending", submittedAt: ds(0) },
    { id: uid(), jenis: "tukar_shift", empId: "revy", empName: "Revy", group: "crew", requestedById: "sahrul", requestedByName: "Sahrul", tanggalMulai: ds(3), tanggalSelesai: ds(3), shiftAsal: "1", tanggalTukar: ds(4), shiftTukar: "2", crewPenukar: "Hadi", status: "pending", submittedAt: ds(0) },
  ];
}

export function seedApprovalQueue() {
  const today = new Date();
  const ds = (back) => { const d = new Date(today); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  return [
    { id: uid(), storeId: "dtop_baros", date: ds(0), type: "etalase_2000", status: "pending", payload: { stok: 6, qtyGoreng: 20, inputOleh: "Galuh" }, requestedAt: new Date().toISOString() },
    { id: uid(), storeId: "dtop_cipanengah", date: ds(0), type: "stok", status: "pending", payload: { inputOleh: "Hilman" }, requestedAt: new Date().toISOString() },
    { id: uid(), storeId: "dtop_lembursitu", date: ds(1), type: "stok", status: "approved", payload: { inputOleh: "Revy" }, requestedAt: ds(1), respondedAt: ds(1), decidedBy: "Elin" },
    { id: uid(), storeId: "dtop_baros", date: ds(2), type: "etalase_2000", status: "rejected", payload: { stok: 3, qtyGoreng: 15, inputOleh: "Galuh" }, requestedAt: ds(2), respondedAt: ds(2), decidedBy: "Eri" },
  ];
}
