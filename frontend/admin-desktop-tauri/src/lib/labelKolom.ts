/** Label kolom tabel ditulis di kode (sumber kebenaran tunggal, tanpa query).
 *  Yang belum diberi label tetap terbaca rapi karena nama kolomnya
 *  di-humanize otomatis lewat {@link labelKolom}. */

/** Singkatan yang tetap kapital saat nama kolom di-humanize. */
const AKRONIM = new Set([
  'nip', 'nipp', 'nis', 'nism', 'nisn', 'npsn', 'nss', 'npwp', 'ktp', 'kk',
  'kkb', 'psb', 'pdf', 'id', 'url', 'api', 'skhun', 'sks', 'kb', 'mb',
  'nik', 'ptk', 'bpjs', 'rt', 'rw', 'hp', 'npa', 'json', 'pos', 'sk', 'gws',
  'jk',
]);

/** Bentuk label yang masih berupa kode kolom: huruf kecil + angka + `_`. */
const POLA_KODE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** `santri_baru` → `Santri Baru`, `nip` → `NIP`, `k1` → `K1`. */
function kapitalkanKata(kata: string): string {
  if (AKRONIM.has(kata)) return kata.toUpperCase();
  return kata.charAt(0).toUpperCase() + kata.slice(1);
}

/** Nama tampilan sebuah kolom tabel.
 *
 *  Dua bentuk label diterima:
 *  - label prosa (`Jenis Dokumen`) → dipakai apa adanya;
 *  - nama kolom mentah (`nama_lengkap`) → di-humanize otomatis supaya tidak
 *    pernah tampil apa adanya di header.
 *
 *  Bentuk `tabel.kolom` sudah tidak dipakai lagi — label ditulis prosa
 *  langsung di tiap halaman. String bertitik yang lolos ke sini dikembalikan
 *  apa adanya agar kesalahan penulisannya langsung terlihat. */
export function labelKolom(teks: string | null | undefined): string {
  const mentah = (teks ?? '').trim();
  if (mentah === '') return '';

  if (!POLA_KODE.test(mentah)) return mentah;

  // Kolom boolean diawali `is_`: tampilkan nama state-nya saja, bukan "Is ...".
  const inti = mentah.startsWith('is_') ? mentah.slice(3) : mentah;
  return inti.split('_').map(kapitalkanKata).join(' ');
}

/** Bersihkan peta nama header kustom: hanya kolom yang ada + teks tak kosong
 *  (maks 60 karakter, ikut batas API). */
export function bersihLabel(
  mentah: Record<string, string> | null | undefined,
  fieldKeys: Set<string>,
): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(mentah ?? {})) {
    const t = v.trim().slice(0, 60);
    if (fieldKeys.has(k) && t !== '') hasil[k] = t;
  }
  return hasil;
}

/** Bandingkan peta nama header tanpa peduli urutan kunci. */
export function kanonLabel(o: Record<string, string>): string {
  return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}