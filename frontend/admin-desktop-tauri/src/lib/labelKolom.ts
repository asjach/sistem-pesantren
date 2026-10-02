/** Label kolom tabel ditulis di kode (sumber kebenaran tunggal, tanpa query).
 *  Yang belum diberi label tetap terbaca rapi karena nama kolomnya
 *  di-humanize otomatis lewat {@link labelKolom}. */

/** Singkatan yang tetap kapital saat nama kolom di-humanize. */
const AKRONIM = new Set([
  'nip', 'nis', 'nism', 'nisn', 'npsn', 'npwp', 'ktp', 'kk', 'kkb', 'psb',
  'pdf', 'id', 'url', 'api', 'skhun', 'sks', 'kb', 'mb',
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
 *  Label berawalan nama tabel (`santri.nama_lengkap`) dipangkas jadi nama
 *  kolomnya saja lalu di-humanize — dipakai halaman yang mengambil kolom
 *  milik tabel lain. */
export function labelKolom(teks: string | null | undefined): string {
  const mentah = (teks ?? '').trim();
  if (mentah === '') return '';

  const dasar = /^[a-z0-9_]+\.([a-z0-9_]+)$/.exec(mentah)?.[1] ?? mentah;
  if (!POLA_KODE.test(dasar)) return dasar;

  return dasar.split('_').map(kapitalkanKata).join(' ');
}