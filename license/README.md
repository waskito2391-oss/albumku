# Server lisensi ALBUMKU (Google Sheet + Apps Script)

Aturan: **1 email = 1 komputer**. Email harus terdaftar di sheet; saat aktivasi pertama, ID komputer dicatat otomatis.

## Pasang (sekali saja)

1. Buka Google Sheet lisensi → menu **Ekstensi → Apps Script**.
2. Hapus isi `Code.gs` di editor, tempel isi file [`Code.gs`](Code.gs) dari folder ini.
3. Simpan (Ctrl+S).
4. Di toolbar pilih fungsi **setup** → **Jalankan** → izinkan akses. Sheet `Lisensi` beserta judul kolom akan dibuat.
5. **Terapkan → Deployment baru** → jenis **Aplikasi web**:
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   
   Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
6. Tempel URL tadi di `src-tauri/src/license.rs`, baris `const URL: &str = "";` → `const URL: &str = "https://script.google.com/macros/s/.../exec";`
7. Build aplikasi seperti biasa (`npm run tauri build`).
8. Ubah berbagi Google Sheet menjadi **Dibatasi** (Apps Script tetap jalan atas nama pemilik). Jangan biarkan "siapa saja yang memiliki link", karena daftar email pembeli bisa terlihat.

> Saat `Code.gs` diubah: **Terapkan → Kelola deployment → Edit (ikon pensil) → Versi: Versi baru → Terapkan**. URL tetap sama.

## Kolom sheet `Lisensi`

| Kolom | Isi | Diisi oleh |
|---|---|---|
| A Email | email pembeli | kamu |
| B Nama | nama pembeli (opsional) | kamu |
| C ID Komputer | ID komputer yang terkunci | otomatis |
| D Status | kosong / `aktif` = boleh, `nonaktif` / `blokir` = ditolak | kamu |
| E Tanggal Aktivasi | waktu aktivasi pertama | otomatis |
| F Terakhir Dipakai | waktu cek terakhir | otomatis |
| G Versi App | versi ALBUMKU yang dipakai | otomatis |
| H Catatan | bebas | kamu |
| I Jumlah Pindah | berapa kali pembeli logout untuk pindah komputer | otomatis |

## Sehari-hari

- **Pembeli baru**: tambah baris, isi Email (dan Nama).
- **Pindah komputer**: pembeli klik menu email di kanan atas aplikasi → **Logout dari komputer ini**, lalu aktivasi di komputer baru. Kolom **C** kosong otomatis dan kolom **I** bertambah.
- **Komputer lama rusak / install ulang Windows** (tidak sempat logout): kosongkan kolom **C** baris pembeli itu secara manual.
- **Blokir**: isi kolom **D** dengan `nonaktif`. Berlaku saat aplikasi dibuka berikutnya.

## Perilaku di aplikasi

- Lisensi dicek ke server setiap aplikasi dibuka.
- Tanpa internet, aplikasi tetap bisa dipakai **7 hari** sejak cek terakhir yang berhasil.
- Selama `URL` masih kosong: build pengembangan (`npm run tauri dev`) tidak mengecek lisensi, build rilis menolak dengan pesan "Server lisensi belum diatur".
