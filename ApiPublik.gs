/**
 * API PUBLIK — Website Ma'had Tahfidz
 * ------------------------------------------------------------
 * File baru di proyek Apps Script "Dashboard Tahfidz".
 * Endpoint: <URL /exec>?api=publik
 *
 * Yang DIBUKA ke publik:
 *   - peringkat 10 besar (semua, putra, putri) dan apresiasi bulanan
 *   - angka agregat dashboard ma'had: kehadiran, capaian, nilai, sebaran
 *     predikat, putra/putri, per angkatan, per halaqah
 *   - pengumuman & agenda
 * Yang TIDAK dibuka: password, email, token, daftar "perlu perhatian",
 * jumlah zona merah, dan nilai per santri di luar 10 besar.
 *
 * PASANG:
 * 1. Tambahkan file ini (File > + > Script, beri nama ApiPublik).
 * 2. Di fungsi doGet(e) yang sudah ada, tambahkan baris ini PALING ATAS:
 *
 *      if (e && e.parameter && e.parameter.api === 'publik') return apiPublik_(e);
 *
 * 3. Jalankan sekali fungsi pasangPemicuPublik() dari editor (pilih di
 *    dropdown fungsi > Jalankan > izinkan). Ini membuat data ringkasan
 *    disegarkan tiap 10 menit walau tidak ada yang membuka dashboard.
 * 4. Deploy > Kelola deployment > ikon pensil > Versi: "Versi baru" > Deploy.
 *    (URL /exec tetap sama, akses tetap "Siapa saja".)
 * 5. Tes di browser: <URL /exec>?api=publik  → harus keluar JSON.
 */

var API_PUBLIK_CACHE_DETIK = 60;   // jawaban API disimpan 1 menit
var API_PUBLIK_TOP = 10;           // jumlah peringkat per kelompok

function apiPublik_(e) {
  var cache = CacheService.getScriptCache();
  var kunci = 'apiPublik_v2';
  var paksa = e && e.parameter && e.parameter.segar === '1';
  var simpan = paksa ? null : cache.get(kunci);
  if (simpan) return keluarJson_(simpan);

  var teks;
  try {
    teks = JSON.stringify(susunDataPublik_());
  } catch (err) {
    return keluarJson_(JSON.stringify({ ok: false, pesan: String(err && err.message || err) }));
  }
  try { cache.put(kunci, teks, API_PUBLIK_CACHE_DETIK); } catch (e2) { /* > 100 KB: lewati cache */ }
  return keluarJson_(teks);
}

/** Ambil data; jika ringkasan dashboard sudah basi, segarkan dulu lalu ambil ulang. */
function ambilSegar_(fn) {
  var r = fn();
  if (typeof r === 'string') r = JSON.parse(r);
  if (r && r.basi && typeof dashSegarkan === 'function') {
    try {
      dashSegarkan();
      r = fn();
      if (typeof r === 'string') r = JSON.parse(r);
    } catch (e) { /* pakai data yang ada */ }
  }
  return r || {};
}

function susunDataPublik_() {
  var r = ambilSegar_(function () { return dashPeringkat(''); });   // menu "Peringkat"
  var m = {};
  try { m = ambilSegar_(function () { return dashMahad(''); }); } catch (e) { m = {}; } // menu "Ma'had"

  var daftar = r.daftar || [];
  var pengh = r.pengh || {};

  function ringkas(s) {
    return { n: s.n, h: s.h, g: s.g, ang: s.ang, xp: s.xp, rank: s.rank, pr: s.pr,
             hadir: s.pct, cap: s.cap, nilai: s.avg, pred: s.pred };
  }
  var putra = daftar.filter(function (s) { return s.g === 'L'; }).slice(0, API_PUBLIK_TOP).map(ringkas);
  var putri = daftar.filter(function (s) { return s.g === 'P'; }).slice(0, API_PUBLIK_TOP).map(ringkas);

  // foto hanya untuk 3 besar bulan ini (jika dashboard menyediakannya)
  var foto = {};
  if (r.foto && pengh.terbaik) {
    pengh.terbaik.slice(0, 3).forEach(function (t) {
      var f = r.foto['s:' + String(t.n).toLowerCase()];
      if (f) foto[t.n] = f;
    });
  }

  // halaqah: gabungan EXP (Peringkat) + kehadiran/capaian/nilai (Ma'had)
  var statHal = {};
  (m.halaqah || []).forEach(function (x) { statHal[x.k] = x; });
  var prevHal = {};
  ((m.prev && m.prev.halaqah) || []).forEach(function (x) { prevHal[x.k] = x; });
  var halaqah = (pengh.halaqah || m.halXp || []).map(function (x) {
    var s = statHal[x.h] || {}, p = prevHal[x.h] || {};
    return { h: x.h, rank: x.rank, avgXp: x.avgXp, n: x.n,
             hadir: s.pct, cap: s.cap, nilai: s.avg, capLalu: p.cap };
  });

  var jml = m.jml || {}, pj = (m.prev && m.prev.jml) || {};
  var dashboard = {
    periode: (m.periode && m.periode.l) || '',
    pembanding: (m.prev && m.prev.l) || '',
    rata: m.rata || null,
    rataLalu: (m.prev && m.prev.rata) || null,
    komposisi: m.komposisi || null,                    // H / I / A (jumlah sesi)
    predikat: m.predikat || null,
    predikatLalu: (m.prev && m.prev.predikat) || null,
    gender: m.gender || null,                          // P / L: pct, cap, avg, n
    angkatan: m.angkatan || [],                        // k = tahun masuk (2 digit)
    jumlah: { aktif: jml.aktif, putra: jml.L, putri: jml.P,
              capaian75: jml.c75, capaian50: jml.c50, hadirPenuh: jml.full, tanpaAlpa: jml.tanpaAlpa },
    jumlahLalu: { capaian75: pj.c75, capaian50: pj.c50, hadirPenuh: pj.full, tanpaAlpa: pj.tanpaAlpa }
  };

  var pengumuman = [];
  try {
    var p = dashPengumuman();
    if (typeof p === 'string') p = JSON.parse(p);
    pengumuman = (p || []).map(function (x) {
      return { jenis: x.j, judul: x.t, tempat: x.x, mulai: x.s, selesai: x.e };
    });
  } catch (e) { /* abaikan */ }

  var rata = m.rata || {};
  return {
    ok: true,
    diperbarui: Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss"),
    bulan: pengh.cur || '',
    bulanLalu: pengh.prv || '',
    stat: {
      santri: r.nA || jml.aktif || daftar.length,
      halaqah: halaqah.length,
      hadir: rata.pct, capaian: rata.cap, nilai: rata.avg
    },
    terbaik: pengh.terbaik || [],
    naik: pengh.naik || [],
    setoran: pengh.setoran || [],
    halaqah: halaqah,
    hadirPenuh: (r.kehadiran || []).filter(function (k) { return k.pct >= 100; })
      .map(function (k) { return { n: k.n, h: k.h, hadir: k.hadir, total: k.total }; }),
    peringkat: { semua: daftar.slice(0, API_PUBLIK_TOP).map(ringkas), putra: putra, putri: putri },
    dashboard: dashboard,
    foto: foto,
    pengumuman: pengumuman
  };
}

function keluarJson_(teks) {
  return ContentService.createTextOutput(teks).setMimeType(ContentService.MimeType.JSON);
}

/** Dipanggil pemicu waktu: menyegarkan ringkasan dashboard & cache API. */
function segarkanPublik() {
  if (typeof dashSegarkan === 'function') { try { dashSegarkan(); } catch (e) {} }
  try {
    var teks = JSON.stringify(susunDataPublik_());
    CacheService.getScriptCache().put('apiPublik_v2', teks, API_PUBLIK_CACHE_DETIK);
  } catch (e) {}
}

/** Jalankan SEKALI dari editor untuk memasang pemicu tiap 10 menit. */
function pasangPemicuPublik() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'segarkanPublik') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('segarkanPublik').timeBased().everyMinutes(10).create();
}
