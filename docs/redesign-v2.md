# Redesign form dan mobile — 8 November 2026

## Perubahan antarmuka

Arah visual AIS memakai krem, charcoal dan oranye brand dengan penomoran utilitas, garis pembatas, form yang lebih terarah, serta menu mobile sebagai direktori pekerjaan. Portal mobile tidak memakai sidebar atau drawer. Seluruh menu yang diperbolehkan untuk role ada di Home; Pengajuan pada bottom navigation mengarah ke modul yang relevan untuk peran tersebut. Akun Toko menggunakan Laporan sesuai kewenangannya, bukan attendance personal.

Sebanyak 40 komponen form dengan 44 variasi return memakai struktur baru, termasuk data karyawan/toko/bahan/produk, tugas, jam kerja, persiapan/produksi, sales, stok/opname, pembelian, transfer, izin/cuti, tukar shift dan pengajuan. Tombol, field, grid dan tabel pada modul lain mengikuti sistem tampilan yang sama; filter laporan tetap berada pada halaman laporannya.

## Baseline attendance

1. Akun membuka Attendance.
2. Jika belum ada baseline yang valid untuk ID karyawan tersebut, workflow absensi tidak dimount.
3. Pengguna membuka kamera depan, mengambil foto, meninjau hasil dan menyimpannya.
4. Simpan baru dianggap berhasil setelah transaksi IndexedDB selesai. Gagal kamera/penyimpanan menampilkan pesan dan tidak membuka proses absensi.
5. Selfie harian, verifikasi waktu, lokasi dan aturan kerja mengikuti modul sumber.
6. Saat menyimpan aktivitas, identitas akun dan baseline diperiksa ulang. Rekaman disertai referensi baseline; tidak ada pencocokan wajah otomatis.

Foto diambil langsung di perangkat dan disimpan lokal. QA tidak mengambil foto pribadi atau memberikan izin kamera tanpa tindakan pengguna. Foto baseline belum disetujui HR dan belum dipakai sebagai bukti verifikasi biometrik produksi.

## Pemeriksaan

- Test otomatis menolak attendance tanpa baseline, baseline akun lain, sumber upload, Blob kosong, dimensi tidak valid, dan foto terlalu besar; referensi baseline pada catatan tidak bisa diganti oleh payload pemanggil.
- Browser akun Crew: gerbang baseline tampil dan workflow attendance berjumlah nol sebelum enrollment; sidebar dan hamburger berjumlah nol.
- Browser mobile: semua menu Direksi tersedia dari Home dan dapat dicari; form karyawan terbuka sebagai halaman fokus.
- Browser: pengajuan izin Crew tetap menyediakan jenis dan approver yang sama dengan sumber, dengan form baru.
- Capture nyata, enrollment foto pribadi, liveness/face matching dan sinkronisasi lintas perangkat belum diuji atau diimplementasikan.

Hasil visual berada pada `outputs/redesign-v2/`.

## Penyempurnaan validasi dan bukti

- Area foto bukti/dokumen menjadi kontrol yang dapat diakses lewat keyboard, menampilkan status foto dan menangani file yang gagal dibaca. Format thumbnail lama dipertahankan agar kompatibel dengan laporan tersimpan.
- Input tanggal izin/cuti mendapat label aksesibilitas yang eksplisit. Pada form tidak hadir Crew, tombol kirim tetap nonaktif sebelum alasan dilengkapi dan tanggal minimum tetap H-1 seperti sumber.
- Pembacaan GPS menggunakan lokasi aktual dengan `maximumAge: 0` dan timeout 15 detik. GPS tidak tersedia, izin ditolak, dan koordinat invalid menghasilkan error; tidak menghasilkan lokasi sintetis. Pengaturan simulasi dekat/jauh diganti keterangan GPS aktual.
- Catatan attendance tidak lagi ditambahkan otomatis oleh seed mobile; penambahan baru melalui pemeriksaan baseline. Data contoh lama yang sudah tersimpan tidak dihapus.
- Pemeriksaan browser pada akhir perubahan: nol sidebar dan nol tombol pembuka navigasi pada mode mobile, nol workflow attendance sebelum baseline, serta tidak ada error konsol pada halaman izin.
- Test otomatis tambahan mencakup lokasi aktual, izin GPS ditolak, GPS tidak tersedia, dan koordinat tidak valid.

## Verifikasi akhir

Build distribusi akhir selesai tanpa error. Pemeriksaan TypeScript dan test workspace/baseline/GPS lulus. Preview lokal tetap aktif pada port 5173. Foto nyata dan face matching belum diuji; tidak ada source yang diunggah pada perubahan ini.
