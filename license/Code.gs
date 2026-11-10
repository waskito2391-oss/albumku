/**
 * Server lisensi ALBUMKU (Google Apps Script, menempel di Google Sheet).
 *
 * Aturan: 1 email = 1 komputer.
 *  - Email harus terdaftar di sheet (kolom A).
 *  - Saat pertama aktivasi, ID komputer dicatat di kolom C.
 *  - Komputer lain dengan email yang sama ditolak.
 *  - Pindah komputer: pembeli klik "Logout" di aplikasi (kolom C dikosongkan otomatis,
 *    kolom I bertambah), atau admin mengosongkan kolom C secara manual.
 *  - Blokir: isi kolom D dengan "nonaktif".
 *
 * Cara pasang: lihat license/README.md
 */

const SHEET_NAME = 'Lisensi';
const HEADERS = ['Email', 'Nama', 'ID Komputer', 'Status', 'Tanggal Aktivasi', 'Terakhir Dipakai', 'Versi App', 'Catatan', 'Jumlah Pindah'];
const COL = { email: 0, name: 1, machine: 2, status: 3, activated: 4, lastSeen: 5, version: 6, moves: 8 };
const BLOCKED = ['nonaktif', 'blokir', 'off', 'expired'];

/** Jalankan sekali dari editor untuk membuat sheet "Lisensi" beserta judul kolomnya. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('C:C').setNumberFormat('@');
}

function doGet(e) {
  const p = (e && e.parameter) || {};

  const email = String(p.email || '').trim().toLowerCase();
  const machine = String(p.machine || '').trim().toUpperCase();
  const version = String(p.v || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ ok: false, code: 'bad_email', message: 'Format email tidak valid.' });
  if (!machine) return reply({ ok: false, code: 'bad_machine', message: 'ID komputer tidak terbaca.' });

  // kunci supaya dua aktivasi bersamaan tidak saling menimpa
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sh) return reply({ ok: false, code: 'server', message: 'Sheet "' + SHEET_NAME + '" belum dibuat. Jalankan setup().' });
    const rows = sh.getDataRange().getValues();
    let r = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][COL.email]).trim().toLowerCase() === email) {
        r = i;
        break;
      }
    }
    if (r < 0) return reply({ ok: false, code: 'not_registered', message: 'Email ini belum terdaftar sebagai pemilik lisensi.' });

    const row = rows[r];
    const line = r + 1;
    const saved = String(row[COL.machine] || '').trim().toUpperCase();

    // logout: lepas lisensi dari komputer ini supaya bisa diaktifkan di komputer lain.
    // Hanya komputer yang terdaftar yang boleh melepas.
    if (p.action === 'release') {
      if (saved && saved !== machine) return reply({ ok: false, code: 'other_machine', message: 'Lisensi ini terdaftar di komputer lain, tidak bisa dilepas dari sini.' });
      if (saved) {
        sh.getRange(line, COL.machine + 1).setValue('');
        sh.getRange(line, COL.moves + 1).setValue((Number(row[COL.moves]) || 0) + 1);
      }
      sh.getRange(line, COL.lastSeen + 1).setValue(new Date());
      return reply({ ok: true, code: 'released', message: 'Lisensi dilepas dari komputer ini. Sekarang bisa diaktifkan di komputer lain.' });
    }

    const status = String(row[COL.status] || '').trim().toLowerCase();
    if (BLOCKED.indexOf(status) >= 0) return reply({ ok: false, code: 'disabled', message: 'Lisensi untuk email ini sedang dinonaktifkan.' });

    const now = new Date();
    if (!saved) {
      sh.getRange(line, COL.machine + 1).setValue(machine);
      sh.getRange(line, COL.activated + 1).setValue(now);
      if (!status) sh.getRange(line, COL.status + 1).setValue('aktif');
    } else if (saved !== machine) {
      return reply({ ok: false, code: 'other_machine', message: 'Email ini sudah dipakai di komputer lain. Logout dulu di komputer lama (menu email di kanan atas), atau hubungi admin.' });
    }
    sh.getRange(line, COL.lastSeen + 1).setValue(now);
    if (version) sh.getRange(line, COL.version + 1).setValue(version);
    return reply({ ok: true, code: 'ok', name: String(row[COL.name] || ''), message: 'Lisensi aktif.' });
  } finally {
    lock.releaseLock();
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
