# Ma'had Tahfidz Al-Qur'an — UIN Sunan Gunung Djati Bandung

Website publik ma'had: profil, Mahasantri of the Month, dashboard, peringkat, kegiatan, jadwal, prestasi, galeri, dan agenda.

- `index.html` — halaman utama (HTML/CSS/JS statis, tanpa build).
- `assets/` — logo dan foto.
- `ApiPublik.gs` — kode Apps Script untuk endpoint `?api=publik` yang menyuplai data live dari Dashboard Tahfidz.

Data live diambil dari `KONFIG.EXEC_URL` di `index.html`. Sebelum endpoint aktif, halaman menampilkan data contoh.
