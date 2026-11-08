# AIS People — redesign HRIS & Operations

Portal evaluasi fungsional berdasarkan dua file React yang disediakan. Warna brand utama #DD7A0F, #EEEBE2, #20242B, dan #1F3A5F dipertahankan. File asli di direktori induk tidak diubah.

**Status: prototipe interaktif untuk UAT, belum HRIS produksi.** Login NIK, pembatasan menu, dan penyimpanan data bekerja pada browser. Jangan memasukkan data karyawan nyata. Versi GitHub Pages menjalankan frontend demo dengan penyimpanan browser; belum terhubung ke backend produksi.

## Menjalankan

Gunakan Node.js >=22.13 (direkomendasikan Node 24) dan npm yang memakai runtime tersebut.

```sh
npm run install:ci
npm run dev
npm run build
npm run test:workspace
```

Preview: http://localhost:5173. Buka **Pilih akun** di halaman login untuk mengisi akun demo. Password demo seluruh akun: `Ais2026!`. NIK contoh diterbitkan sebagai nomor simulasi, bukan NIK master atau NIK kependudukan.

| Peran | NIK contoh |
| --- | --- |
| Admin Utama / Eri | 20260001 |
| Finance / Nana | 20260002 |
| Admin Inventory / Elin | 20260003 |
| Graphic Designer / Rizky | 20260004 |
| Crew / Galuh | 20260005 |
| Team Leader / Hilman | 20260006 |
| Crew / Revy | 20260007 |
| Part Time / Hadi | 20260008 |
| SPV / Jafar Sodik | 20260009 |
| SPV / Sahrul | 20260010 |
| SPV / Endin | 20260011 |
| Direksi / Juhaeri | 20260012 |
| Manajer Operasional / Kurnia | 20260013 |
| Akun Toko / Baros | 20260014 |

## Yang tersedia

- Login NIK dan password **demo**, sesi pada tab, logout terpusat, menu sesuai role.
- Dashboard sesuai role, lokasi yang dinaungi, filter lokasi, tren kehadiran 7/14 hari, kontrak berakhir 30 hari, pengajuan terbaru, notifikasi dari data yang sama.
- Pencarian modul (Cmd/Ctrl K), ekspor CSV dalam cakupan filter, navigasi desktop dan mobile.
- Integrasi modul admin dan mobile dari sumber awal: jadwal dan approval, izin/cuti/tukar shift, absensi kamera/lokasi, produksi, stok, transfer, sales, pembelian, ROQ, PnL, master karyawan dan sanksi.
- Adapter penyimpanan bersama untuk modul admin dan mobile pada **origin dan browser yang sama**.
- PWA manifest, ikon 192/512 dan maskable, install prompt/fallback iOS, service worker dan halaman offline. Offline reload menampilkan halaman koneksi; aplikasi penuh tidak diprecache. Tidak ada sinkronisasi lintas perangkat atau background submit.
- Log aktivitas portal untuk masuk/keluar dan ekspor. Log ini lokal dan bisa diubah oleh pengguna, bukan audit trail yang tahan manipulasi.

## MVVM

- `src/models/workspace.js`: repository penyimpanan, akun contoh, kebijakan menu dan adapter sumber lama.
- `src/viewmodels/useWorkspace.js`: sesi, state filter, navigasi, metrik sesuai scope dan aksi PWA.
- `src/views/Workspace.jsx`: presentasi login, dashboard, shell, panduan dan aktivitas.
- `src/legacy`: port modul awal yang tetap mempertahankan perhitungan, formulir dan transisi proses. Bagian ini **belum sepenuhnya direfaktor ke MVVM**; pemisahan MVVM diterapkan pada portal baru, dengan adapter untuk migrasi bertahap.
- `public`: PWA manifest, service worker, ikon dan fallback offline.

## Batas pengujian dan kesiapan produksi

Login browser dapat dilewati oleh orang yang mengubah kode/state; RBAC menu bukan otorisasi API. Pengubahan master role pada modul sumber masih berupa matriks acuan dan belum mengubah kebijakan otorisasi server. Sejumlah modul sumber memakai data simulasi, lokasi fallback simulasi, dan aturan berbasis nama akun. Tidak ada endpoint payroll produksi, reset password server, push notification atau database bersama. Semua ini perlu diganti sebelum rollout.

Bootstrap data contoh hanya dijalankan jika key belum ada. Modul warisan juga memiliki seed internal yang dipertahankan dari referensi. Ekspor ringkasan adalah daftar karyawan dalam filter, bukan ekspor seluruh transaksi.

Rencana backend dan catatan proses: [docs/arsitektur-dan-roadmap.md](docs/arsitektur-dan-roadmap.md).

Referensi PWA: [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [MDN offline](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation). Pemisahan tanggung jawab MVVM: [Microsoft](https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm).

## Perbaikan alur setelah UAT

- Pencegahan pengajuan identik yang masih pending/approved, feedback pengiriman dan reset form setelah berhasil.
- Approval izin dashboard diselaraskan ke mobile: Eri untuk non-manajemen, Kurnia untuk manajemen; nama pengambil keputusan dicatat. Tidak ada self-approval atau pengulangan keputusan final.
- Rekap absensi SPV disaring ke cakupan karyawannya.
- SPV/TL mendapat daftar pengajuan tim dalam cakupan sebagai tampilan baca; hak keputusan tidak ditambahkan.
- Beranda Akun Toko berbeda dari beranda karyawan, dengan akses laporan dan lokasi yang sesuai toko holding/mitra.
- Modul lama dimuat saat dibuka untuk mengurangi beban halaman awal.

## Redesign kedua — form dan mobile

- 40 komponen form (44 variasi tampilan) memakai `FormSurface`, dengan struktur judul, field, petunjuk, unggahan, dan aksi yang konsisten. Field dan grid di modul sumber juga diperbarui agar sesuai layar mobile.
- Mobile tidak merender sidebar, drawer, atau hamburger. Home menampilkan seluruh menu sesuai role, pencarian dan kategori; bottom navigation menyediakan Home, Attendance/Laporan, Pengajuan (bila berhak), dan Akun.
- Form master karyawan tampil sebagai halaman fokus. Pengaturan perangkat menjadi disclosure yang tertutup secara default.
- `src/models/baseline.js` menyimpan foto baseline per ID karyawan dalam IndexedDB. `src/viewmodels/useBaseline.js` menangani state dan error, sedangkan `AttendanceExperience` menangani enrollment kamera → review → simpan.
- Absensi tidak membuka workflow sebelum foto baseline tersedia. `PunchButton` mengecek ulang baseline sebelum kamera harian dibuka, dan `addRecord` mengecek baseline sesuai identitas akun sebelum menyimpan. Catatan absensi baru menyertakan ID dan versi baseline.
- Enrollment tidak menyediakan unggah file sebagai pengganti kamera depan. Foto dokumen/laporan pada form operasional tetap memakai unggahan terpisah.
- GPS simulasi tidak diterima oleh proses attendance baru. Validasi jadwal, jam server, radius dan selfie harian pada sumber tetap berlaku.

Foto baseline saat ini tersimpan **lokal pada perangkat**, tidak disinkron ke server dan tidak melakukan pencocokan atau pengenalan wajah otomatis. Foto baseline yang terdaftar belum membuktikan identitas orang yang mengambilnya; verifikasi wajah, liveness, peninjauan HR dan otorisasi server memerlukan integrasi produksi. Pengujian menggunakan Blob sintetis dan pemeriksaan UI; kamera pribadi tidak diaktifkan selama QA.


## Analisa dan organisasi perusahaan

- Menu **Analisa** menggantikan Ringkasan manajemen. Analisa menjadi halaman awal desktop untuk akun manajemen; Home menjadi direktori layanan. Mobile tetap masuk ke Home dengan semua menu yang diizinkan.
- Analisa mencakup kehadiran dan jadwal, pengajuan, kontrak (hanya HR/Direksi), kelengkapan laporan toko, opname, transaksi penjualan/pengeluaran/pembelian, serta kapasitas organisasi. Kategori dan indikator mengikuti izin modul awal. PnL, COGS, waste, ROQ dan rincian transaksi ditautkan ke modul sumber yang berhak diakses; laba tidak dihitung dengan mengurangi pembelian dari penjualan.
- Filter 7/30/90 hari dan lokasi, ekspor CSV indikator sesuai scope, prioritas review dengan bukti dan tindak lanjut, serta definisi/kualitas data tersedia di halaman Analisa. Angka kehadiran dideduplikasi per karyawan-tanggal. Jadwal tanpa catatan tidak otomatis dinyatakan alpa; hari ini dan shift kosong/libur dikecualikan dari review jadwal yang sudah lewat. Ketepatan waktu hanya memakai catatan dengan status diketahui. Nilai nol dibedakan dari data yang belum tersedia.
- Organisasi menyediakan profil perusahaan, unit berinduk, posisi berinduk, penempatan satu karyawan per posisi utama, posisi kosong, direktori, dan bagan posisi. Unit awal dikelompokkan dari jabatan contoh dan **berstatus draf**; hubungan atasan belum diasumsikan. Direksi dapat menyusun dan menandai struktur telah ditinjau. Mengedit struktur mengembalikan status draf.
- Hak kelola organisasi: Direksi (`access=all`). Admin Utama membaca seluruh perusahaan. SPV/TL membaca tim sesuai lokasi dan jalur atasannya. Finance/Inventory membaca unit sendiri dan jalur atasan. Karyawan membaca posisi sendiri dan jalur atasan. Akun toko bersama tidak mendapat modul organisasi. Proyeksi organisasi tidak memuat data kontrak/cuti/sanksi. Pengubahan posisi bukan pengubahan role atau kewenangan approval.
- Struktur disimpan lokal di `ais-organization-v1`, dengan validasi siklus, referensi unit/atasan, karyawan ganda, dan revisi untuk mendeteksi perubahan tab lain.
- Baseline cukup sekali per akun pada perangkat/browser ini. Penyimpanan menahan baseline valid yang sudah ada, termasuk bila enrollment terpanggil ulang. Attendance berikutnya membaca baseline yang sama dan mengambil **selfie harian baru**; halaman attendance tidak menyediakan daftar ulang baseline. Menghapus penyimpanan atau berganti perangkat tetap memerlukan enrollment karena belum ada sinkronisasi server.

MVVM fitur baru: `src/models/analytics.js`, `src/viewmodels/useAnalytics.js`, `src/views/AnalyticsPage.jsx`; `src/models/organization.js`, `src/viewmodels/useOrganization.js`, `src/views/OrganizationPage.jsx`.

Validasi tambahan: `npm run test:analytics` memeriksa scope role/lokasi, deduplikasi data, nol vs data kosong, definisi jadwal, validasi struktur, dan enrollment baseline yang tidak menimpa foto awal. Seluruh RBAC dan persistence ini masih berada di browser demo; otorisasi API/database belum tersedia.


## Contoh struktur ideal

Demo baru langsung mempunyai hubungan atasan-bawahan dan hierarki unit, berlabel **Contoh Struktur Ideal** serta tetap draf. Pada data demo lama yang belum mempunyai hubungan atasan, Direksi dapat memilih **Isi contoh ideal**. Aksi ini mempertahankan penempatan, profil perusahaan, posisi tambahan dan hubungan atasan yang sudah terisi; bukan reset struktur.

- Juhaeri / Direksi memimpin Kurnia / Manajer Operasional, Eri / Admin Utama (People & Administration), Nana / Finance, dan Rizky / Creative.
- Kurnia memimpin Elin / Inventory, Jafar Sodik, Sahrul, Endin / SPV, dan Hilman / Team Leader.
- Galuh dan Hadi melapor ke Hilman; Revy melapor ke Jafar Sodik berdasarkan penanggung jawab lokasi pada master toko.
- Unit Inventory berada di bawah Operasional; People/Admin, Finance, Creative dan Operasional berada di bawah Direksi. Contoh ini menempatkan pengawasan keuangan langsung pada Direksi untuk memisahkan pengawasan dari pelaksanaan operasional.

Bagan membuka level pertama, menyediakan tombol jumlah bawahan pada setiap cabang, serta **Buka semua cabang / Ringkas bagan**. Di mobile tampil sebagai pohon vertikal. Hubungan struktural ini tidak mengubah role, penugasan toko, atau aturan approval.

### Level dan bagan organisasi dinamis

Struktur mempunyai katalog level berurutan: DIR → DIV → DEP → UNIT → SECTION → TEAM → FRONTLINE. Setiap simpul organisasi menyimpan `levelId` dan `parentId`; setiap posisi menyimpan `unitId` penempatannya, sehingga level posisi mengikuti simpul tersebut. `position.parentId` tetap menjadi hubungan pelaporan posisi yang terpisah dari hierarki simpul. Bagan organisasi dibangun secara rekursif dari data, bukan judul jabatan atau urutan tampilan.

Direksi dapat menambah/menamai level, menyisipkan level di tengah, mengubah urutan, menghapus level yang belum digunakan, membuat simpul dan mengubah induknya, serta menempatkan posisi. Validator menolak siklus, induk dengan level setara/lebih rendah, level tidak dikenal, kode level ganda, dan penghapusan level terpakai. Cabang boleh melewati level yang tidak diperlukan. Perubahan urutan yang membuat struktur terbalik ditolak tanpa menyimpan perubahan.

Contoh operasional mempunyai jalur tujuh level yang tersambung hingga toko: Direksi → Operasional Toko → Operasi Jaringan → Area Sukabumi → Cluster → Team toko → Frontline toko. Simpul Departemen/Unit tanpa posisi tidak dibuatkan nama pejabat fiktif. Posisi asli, karyawan, dan jalur pelaporannya tetap dipertahankan. Pada data versi lama, metadata level diturunkan dari kedalaman simpul tanpa mengubah penempatan, atasan, profil perusahaan atau revisi; tombol **Lengkapi demo 7 level** menambahkan cabang demo berdasarkan master toko dan memperinci penempatan yang sebelumnya hanya memakai simpul Operasional umum. Penempatan pada simpul khusus tidak ditimpa.

Tampilan menyediakan Bagan organisasi, Jalur atasan, Direktori posisi, dan Level organisasi. Cabang dapat dibuka, difokuskan, atau dicari; breadcrumb mengikuti jalur induk tersimpan. Mobile menggunakan pohon vertikal dan navigasi bawah. Cakupan data tetap mengikuti role akun dan hanya menyertakan simpul/jalur atasan yang diperlukan. Struktur tidak mengubah role keamanan atau alur approval. Penyimpanan dan pembatasan akses ini masih demonstrasi di perangkat, bukan otorisasi server produksi.

Pemeriksaan: `npm run test:analytics` mencakup jalur tujuh level, migrasi data lama, katalog dinamis, penempatan khusus, validasi urutan/siklus, dan pembatasan cakupan akses.

## GitHub Pages

Pada layar di bawah 768 px, tabel menggunakan kartu vertikal dengan label per kolom dan tombol **Lihat rincian** untuk informasi tambahan. Tombol edit, pilihan baris, dan detail bertingkat memakai data serta handler yang sama dengan tabel desktop. Daftar karyawan menampilkan NIK yang konsisten dengan akun demo dan mendukung pencarian nama, NIK, atau jabatan. NIK tersimpan pada record dihormati; record baru tanpa NIK menampilkan **Belum ditetapkan**. `npm run test:records` memeriksa pemetaan kolom bertingkat, kontrol tunggal, detail, dan konsistensi NIK.

Demo dapat dibuka melalui https://ais-hris.github.io/ais-hris/ setelah workflow **Deploy AIS People to GitHub Pages** selesai. Di Settings → Pages, pilih sumber **GitHub Actions**. Setiap push ke `main` menjalankan pengujian, membangun frontend, dan menerbitkan `dist-pages`. Build server/Worker yang sudah ada tetap tersedia melalui `npm run build`.

```sh
npm run build:pages
npm run test:pages
npm run preview:pages
```

Preview hasil statis: http://localhost:4173/ais-hris/. Entry Pages menggunakan view dan model aplikasi yang sama. Alamat aset, manifest, service worker, ikon dan halaman offline mendukung subdirektori repository. Penerbitan Pages tidak menyediakan API, database server atau sinkronisasi data; penyimpanan demo tetap lokal di browser pada origin GitHub Pages, terpisah dari localhost.

### Keandalan clock-in

Preflight attendance memeriksa baseline dan waktu jaringan melalui model `attendancePreflight.js`. Waktu diambil dari header Date respons HTTPS pada origin aplikasi; Age CDN ikut diperhitungkan. Ini acuan jam demo, bukan pencatatan atau otorisasi server produksi. Jika jaringan/waktu tidak tersedia atau jam perangkat melewati toleransi 120 detik, attendance ditolak dengan pesan yang dapat dicoba kembali. Tidak ada fallback GPS atau baseline simulasi.

Tombol selalu melepas status loading ketika preflight gagal. Status dibedakan menjadi pemeriksaan baseline, pemeriksaan waktu, pencarian GPS, dan penyimpanan. Permintaan waktu, pemeriksaan baseline dan GPS mempunyai batas tunggu; kamera yang tidak siap menampilkan petunjuk dan tetap bisa ditutup. `npm run test:attendance` menguji error jaringan, jam menyimpang, baseline kosong, proses yang tidak memberi respons, serta retry.
