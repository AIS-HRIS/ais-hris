# Hasil pengujian — 8 November 2026, WIB

## Lulus

- Build distribusi Vinext/Vite selesai, setelah perbaikan akhir dan pemuatan modul secara bertahap.
- Pemeriksaan TypeScript tanpa error pada entry aplikasi dan konfigurasi yang dicakup tsconfig; modul JS lama tidak diperiksa penuh sebagai tipe ketat.
- Test otomatis untuk NIK unik, batas menu per role, larangan menu master karyawan/role untuk Admin Utama, larangan laporan toko bagi Crew, toko mitra, dan pemeliharaan data tersimpan saat bootstrap.
- Test tanggal WIB, tidak menulis password ketika bootstrap, PWA manifest standalone dan ikon wajib.
- Test duplikasi permohonan, resubmit setelah rejected, dan perbedaan tanggal/pemohon.
- Test approver: Eri non-manajemen; Kurnia manajemen; Juhaeri tidak otomatis memperoleh hak keputusan; self-approval dan keputusan ulang setelah final ditolak oleh aturan klien.
- Browser: login Direksi, Crew, Admin Utama, SPV, dan Akun Toko.
- Browser: formulir izin Crew tersimpan dan muncul pada Admin Utama di browser/origin yang sama; approval mengubah status dan mencatat Eri. Pengujian menggunakan permohonan bertanda "Uji UAT redesign AIS — data contoh."
- Browser: akun SPV Jafar hanya mendapat filter DTOP Cipanengah dan DTOP Lembursitu, periode 14 hari bekerja, daftar permohonan tim tidak menyediakan tombol keputusan.
- Browser: beranda Akun Toko menampilkan akses laporan dan profil/lokasi.
- Browser: tampilan desktop 1440 × 1000 serta mobile 390 × 844. Lebar dokumen mobile = lebar viewport, tidak ada overflow horizontal halaman utama.
- Browser: tidak ada error konsol pada akhir pemeriksaan.

## Batas verifikasi

- Pemasangan PWA pada perangkat fisik, kondisi offline sesungguhnya, kamera/GPS nyata, dan permission perangkat belum diuji.
- Data serta login demo tidak membuktikan keamanan atau ketepatan bisnis produksi.
- Seluruh halaman warisan tersedia menurut role, tetapi tidak semua variasi transaksi dan approval diuji satu per satu.
- Publikasi privat tidak dilakukan: peninjauan persetujuan otomatis menolak pengiriman source eksternal sebelum ada izin pengguna yang eksplisit.

Tangkapan layar berada pada `outputs/ais-dashboard-desktop.png` dan `outputs/ais-dashboard-mobile.png`.
