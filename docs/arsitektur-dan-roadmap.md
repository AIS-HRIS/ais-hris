# Catatan proses dan rekomendasi implementasi

## Proses yang diambil dari sumber

| Proses | Aturan sumber yang dipertahankan |
| --- | --- |
| Identitas personal | Crew, Part Time, SPV/TL, manajemen, Direksi, dan device toko berbeda fungsi |
| Data karyawan dan role | Hanya akses `all` untuk Juhaeri/Kurnia; Admin Utama tidak memperoleh menu ini |
| Jadwal | SPV/TL menginput pada toko yang dinaungi; Admin Utama melakukan approval, bukan mengubah grid toko |
| Toko mitra | Tidak masuk inventory/laporan holding; device toko mitra hanya menandai koordinat |
| Laporan toko | Akun toko menginput; crew tidak mendapat input laporan personal |
| Izin | Jenis cuti, sakit, tidak hadir, dan tukar shift beserta validasi serta approver sumber |
| Inventory/Finance | Alur submit, lock/unlock dan approval per modul dipertahankan |
| Periode gaji | Acuan 21 bulan sebelumnya sampai 20 bulan terpilih mengikuti sumber; bukan payroll baru |

Dalam sumber ada detail hardcode berdasarkan ID, jabatan, dan toko. Pemetaan ini dipertahankan untuk evaluasi; pemilik proses harus memvalidasi daftar approver sebelum migrasi ke engine kebijakan.

## Tambahan portal

Ringkasan yang dapat difilter per lokasi, tren kehadiran dari data contoh, kontrak jatuh tempo, pencarian modul, akses cepat, instalasi PWA, navigasi mobile dan CSV. Jumlah hadir ditampilkan sebagai jumlah orang dengan catatan kehadiran dan persentase terhadap anggota tim dalam cakupan; **bukan tingkat kehadiran terhadap jadwal wajib**. Angka belum hadir tidak boleh langsung digunakan sebagai indikator alpa. Dashboard tidak menyimpulkan pelanggaran dari data kosong.

## Arsitektur produksi yang direkomendasikan

1. **Identity service**: NIK unik dari master karyawan, password hash Argon2id, rate limiting, status akun, rotasi sesi, reset password sekali pakai, cookie HttpOnly Secure SameSite, dan CSRF untuk mutasi. Jangan menyimpan password atau hash verifikasinya dalam bundle/browser. Bila memakai Sites, hubungkan identitas platform ke keanggotaan karyawan terverifikasi; login NIK contoh saat ini bukan pemetaan identitas tersebut.
2. **API + kebijakan**: cek permission dan store scope di setiap endpoint, berdasarkan ID role stabil. Semua pemilihan objek harus diverifikasi terhadap scope pengguna. Buat izin terpisah read/create/edit/submit/approve/reject/unlock/export. Perubahan role perlu versioning dan pencatatan.
3. **Database relasional**: employees, employee_accounts, roles, permissions, account_roles, role_permissions, stores, employee_assignments, shifts, schedules, attendance_events, leave_requests, leave_balances, workflow_steps, approval_decisions, stock_transactions, purchases, audit_events. Constraint NIK unik, saldo cuti, idempotency key dan state version wajib ditegakkan server.
4. **Workflow engine**: Draft → Submitted → Pending approver sesuai matriks sumber → Approved/Rejected. Pengajuan yang approved terkunci; perubahan membutuhkan permintaan unlock dan alasan. Penolakan menyimpan alasan; pembuat pengajuan tidak meng-approve permohonan sendiri kecuali proses yang disahkan secara eksplisit membolehkan.
5. **Transaksi atomik**: approval izin memperbarui saldo cuti dan jadwal dalam transaksi yang sama. Transfer stok mendebit/mengkredit dua lokasi dalam satu transaksi. Gunakan optimistic locking agar approver bersamaan tidak menimpa keputusan.
6. **Absensi**: waktu server, kamera dan GPS nyata; geofence dihitung server berdasarkan koordinat valid dengan akurasi dan toleransi yang disahkan. Jika lokasi/kamera gagal, buat permintaan koreksi; jangan menciptakan bukti hadir sintetis. Fallback simulasi yang diwarisi hanya untuk demo.
7. **PWA operasional**: pada produksi, shell dan aset boleh offline; token/data HR tidak dicache bebas. Jika diperlukan antrean offline, gunakan IndexedDB terisolasi akun, idempotency key, expiry, status belum tersinkron dan conflict UI. Approval, payroll dan mutasi stok tetap memerlukan verifikasi server.
8. **Dokumen dan audit**: object storage privat, signed URLs, pembatasan unggahan, retensi sesuai kebijakan organisasi; audit event dibuat server untuk semua mutasi dan ekspor. Jangan menggunakan log localStorage sebagai bukti audit.

## Tahapan rollout

| Tahap | Hasil yang perlu disetujui pemilik proses | Indikator keberhasilan |
| --- | --- | --- |
| UAT desain ini | Uji semua peran dan alur dengan data contoh | Seluruh skenario kritis diselesaikan tanpa perpindahan akun tidak sah |
| Fondasi backend | Akun NIK, scope API, database dan audit | Request objek lintas role/toko ditolak di server |
| Pilot HRIS | Absensi, jadwal, izin dan kontrak pada satu toko | Rekonsiliasi jadwal–kehadiran–izin, selisih diselesaikan |
| Pilot operasional | Stok, pembelian, transfer dan approval | Stok dan keputusan approval konsisten saat akses bersamaan |
| Rollout bertahap | Semua toko dan akun terverifikasi | Tingkat adopsi, waktu proses approval, keberhasilan sinkronisasi |

Rekomendasi untuk manajemen: prioritaskan validitas master karyawan, pemetaan atasan dan jadwal sebelum menilai produktivitas. Ukur median/P90 waktu approval, persentase pengajuan dikembalikan, keterlambatan berdasarkan jadwal wajib, dan kelengkapan laporan. Tetapkan baseline dari data produksi terverifikasi; jangan menetapkan target dari angka demo.
