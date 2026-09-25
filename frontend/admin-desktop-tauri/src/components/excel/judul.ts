/** Judul tampilan khusus per tableKey (di luar itu: dari key, kapital di awal). */
const JUDUL_TABEL: Record<string, string> = {
  santri: 'Santri',
  keanggotaan: 'Keanggotaan',
  users: 'Pengguna',
  tahun_ajaran: 'Tahun Ajaran',
  lembaga: 'Lembaga',
  kelas: 'Kelas',
  riwayat_belajar: 'Riwayat Belajar',
  daftar_kelas: 'Daftar Kelas',
  kenaikan_santri_genap: 'Santri Semester Genap',
  mi_md_mi: 'MI Only',
  mi_md_md: 'MD Semua',
  mi_md_beda: 'Perbandingan Kelas',
  mutasi_arsip: 'Arsip Mutasi',
  kelulusan_alumni: 'Alumni',
  pengajuan_biodata: 'Pengajuan Biodata',
  psb: 'PSB',
  pegawai: 'Pegawai',
  dokumen_wajib: 'Dokumen Wajib',
  kamus_label_kolom: 'Kamus Label',
};

/** Judul header tabel: pemetaan khusus, atau kapitalisasi tableKey. */
export function judulTabel(tableKey: string): string {
  const khusus = JUDUL_TABEL[tableKey];
  if (khusus) return khusus;
  const teks = tableKey.replace(/[_-]+/g, ' ').trim();
  return teks ? `${teks.charAt(0).toUpperCase()}${teks.slice(1)}` : 'Tabel';
}
