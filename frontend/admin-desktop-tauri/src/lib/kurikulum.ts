/** Kunci pembanding nama mapel — aturannya SAMA dengan server
 *  (`KurikulumController::kunciNamaMapel`: `mb_strtolower(trim())`), supaya
 *  pencocokan nama di klien tak berbeda hasil dengan pencocokan di sana. */
export function kunciNamaMapel(nama: string | null | undefined): string {
  return (nama ?? '').trim().toLowerCase();
}

/** Kumpulan kunci nama mapel yang SUDAH ada (mis. isi tabel `mata_pelajaran`),
 *  dipakai menyembunyikan entri kamus yang sudah masuk ke tabel itu. */
export function kumpulanKunciNama(daftar: readonly { nama_mapel: string }[]): Set<string> {
  return new Set(daftar.map((m) => kunciNamaMapel(m.nama_mapel)));
}
