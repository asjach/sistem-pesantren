/** Format tanggal tampilan: dd-mm-yyyy (menerima ISO date/datetime). */
export function tanggal(v: string | null | undefined): string {
  if (!v) return '-';
  const iso = v.slice(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/* ---------- Kalender: nama bulan & hari ---------- */

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

export const NAMA_BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

/** Nama hari dengan MINGGU di indeks 0 — sejajar `Date#getDay()`. */
export const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
] as const;

/** Header kolom kalender: minggu dulu (urutan hari versi `id-ID`). */
export const NAMA_HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

/** Rentang tahun yang dianggap sah (di luar ini = salah ketik). */
const TAHUN_MIN = 1900;
const TAHUN_MAX = 2200;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/* ---------- Tanggal: ISO ⇄ bagian angka ---------- */

/** ISO hari ini menurut zona waktu LOKAL (bukan UTC) — `YYYY-MM-DD`. */
export function hariIniIso(): string {
  return new Date().toLocaleDateString('sv-SE');
}

/** Jumlah hari satu bulan (1–12); `bulan` di luar rentang = 0. */
export function jumlahHari(tahun: number, bulan: number): number {
  if (bulan < 1 || bulan > 12) return 0;
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/** Indeks hari minggu tanggal 1 (0 = Minggu) — offset kolom pertama grid. */
export function hariPertamaBulan(tahun: number, bulan: number): number {
  return new Date(Date.UTC(tahun, bulan - 1, 1)).getUTCDay();
}

/** Pecah ISO `YYYY-MM-DD` (datetime dipotong) jadi angkanya; `null` bila tak
 *  sah — termasuk tanggal yang tak ada di kalender (mis. 31 Februari). */
export function pecahIso(iso: string | null | undefined): { tahun: number; bulan: number; hari: number } | null {
  if (iso == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m === null) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  const hari = Number(m[3]);
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return { tahun, bulan, hari };
}

/** Rakit ISO `YYYY-MM-DD` dari angka; `null` bila tanggalnya tak ada. */
export function rakitIso(tahun: number, bulan: number, hari: number): string | null {
  if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) return null;
  if (hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return `${String(tahun).padStart(4, '0')}-${pad2(bulan)}-${pad2(hari)}`;
}

/** Geser bulan sejumlah langkah (mis. `-1`) → `{ tahun, bulan }`. */
export function geserBulan(tahun: number, bulan: number, langkah: number): { tahun: number; bulan: number } {
  const total = tahun * 12 + (bulan - 1) + langkah;
  return { tahun: Math.floor(total / 12), bulan: ((total % 12) + 12) % 12 + 1 };
}

/* ---------- Kotak tanggal: teks `dd/mm/yyyy` ⇄ nilai ISO ---------- */

/** Nilai ISO → teks kotak `dd/mm/yyyy`. Nilai yang bukan ISO dibiarkan apa
 *  adanya supaya isian lama/aneh tak diam-diam dikosongkan. */
export function tanggalKeTampilan(nilai: string): string {
  const p = pecahIso(nilai);
  return p === null ? nilai : `${pad2(p.hari)}/${pad2(p.bulan)}/${p.tahun}`;
}

/** Teks kotak `dd/mm/yyyy` → ISO; `''` bila belum lengkap atau tanggalnya tak
 *  ada di kalender. Inilah satu-satunya nilai yang dipakai aplikasi. */
export function tanggalDariTampilan(teks: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(teks.trim());
  if (m === null) return '';
  return rakitIso(Number(m[3]), Number(m[2]), Number(m[1])) ?? '';
}

/** Teks kotak sudah lengkap `dd/mm/yyyy` (terlepas sah atau tidak)? */
export function tanggalLengkap(teks: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(teks.trim());
}

/** Mask ketikan kotak tanggal: hanya digit, "/" disisipkan setelah dd & mm.
 *
 *  Tempelan ISO ("2026-10-12", mis. dari Excel atau DB) dibaca sebagai ISO —
 *  tanpa ini, digitnya akan dimask jadi "20/26/1012". */
export function maskTanggal(teks: string): string {
  const iso = /^\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(teks);
  if (iso !== null) return `${pad2(Number(iso[3]))}/${pad2(Number(iso[2]))}/${iso[1]}`;
  const digit = teks.replace(/\D/g, '').slice(0, 8);
  if (digit.length <= 2) return digit;
  if (digit.length <= 4) return `${digit.slice(0, 2)}/${digit.slice(2)}`;
  return `${digit.slice(0, 2)}/${digit.slice(2, 4)}/${digit.slice(4)}`;
}
