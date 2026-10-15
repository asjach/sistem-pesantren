/** Registri FILTER toolbar ExcelTable.
 *
 *  Filter di sini artinya kontrol toolbar yang berfungsi menyaring/mengubah
 *  tampilan DATA tabel — bukan tombol aksi (Tambah/Hapus), bukan pencarian
 *  topBar (yang live di level halaman dan mencakup semua tabel), dan bukan
 *  filter lingkup lembaga/TA/semester/tingkat/kelas (itu registrasi sendiri,
 *  lihat `VisibilitasFilter` + `pengaturan_tabel`).
 *
 *  Daftar ini dipakai dua sisi:
 *  - **Tabel** (`ExcelTable`) → memutuskan filter mana yang BENAR-BENAR ada,
 *    lalu menyembunyikan yang dimatikan lewat `toolbar_preset.visibilitas`.
 *  - **Kelola Tabel** (`TabFilterToolbar`) → menyajikan sakelar per filter.
 *
 *  Kunci disimpan di `toolbar_preset.visibilitas` (peta kontrol → boolean;
 *  absen/`true` = tampil, `false` = sembunyi), jadi TIDAK perlu migrasi. */

export type KunciFilterToolbar = 'cari' | 'urutan' | 'kolom' | 'keaktifan';

export interface ItemFilterToolbar {
  kunci: KunciFilterToolbar;
  label: string;
  /** Keterangan singkat untuk baris di dialog Kelola Tabel. */
  ket: string;
}

export const FILTER_TOOLBAR: readonly ItemFilterToolbar[] = [
  {
    kunci: 'cari',
    label: 'Pencarian tabel',
    ket: 'Kotak Cari milik tabel ini saja — beda dari pencarian topBar yang mencakup semua tabel halaman',
  },
  {
    kunci: 'urutan',
    label: 'Urutan',
    ket: 'Dropdown preset "Urutkan" pada bilah judul tabel (urut naik/turun per kolom)',
  },
  {
    kunci: 'kolom',
    label: 'Kolom',
    ket: 'Dropdown preset "Kolom" pada bilah judul tabel (kolom mana yang tampil)',
  },
  {
    kunci: 'keaktifan',
    label: 'Keaktifan / Status',
    ket: 'Dropdown Status/Keaktifan pada slot filter tabel (mis. Status santri, Status pegawai, Tipe kamus)',
  },
];

/** Filter yang tersedia pada sebuah tabel — tabel tanpa `onUrut` tak punya
 *  dropdown Urutkan, tabel dengan `hidePreset` tak punya Kolom. Yang tak
 *  tersedia tidak muncul di Kelola Tabel supaya tak ada sakelar yang mati. */
export function filterToolbarTersedia(opts: {
  adaUrut: boolean;
  adaKolom: boolean;
  adaCari?: boolean;
  adaKeaktifan?: boolean;
}): KunciFilterToolbar[] {
  const ada: [KunciFilterToolbar, boolean][] = [
    ['cari', opts.adaCari ?? false],
    ['urutan', opts.adaUrut],
    ['kolom', opts.adaKolom],
    ['keaktifan', opts.adaKeaktifan ?? false],
  ];
  return ada.filter(([, v]) => v).map(([k]) => k);
}

/** Tampil kecuali benar-benar disembunyikan (`false`). Absen = bawaan tampil,
 *  jadi tabel yang belum pernah disetel berperilaku persis seperti dahulu. */
export function filterAktif(visibilitas: Record<string, boolean>, kunci: KunciFilterToolbar): boolean {
  return visibilitas[kunci] !== false;
}

/** Gabungkan peta visibilitas dari server dengan sakelar section (kunci →
 *  boolean): yang `false` ditulis, yang `true` DIHAPUS (absen = tampil) supaya
 *  peta tak menumpuk penanda `true` yang tak perlu, dan kunci milik fitur lain
 *  tetap utuh — `simpanToolbarPreset` menimpa SATU PETA utuh, jadi penulisan
 *  sebagian tanpa merge akan menghapus yang tak ikut ditulis. */
export function gabungVisibilitas(
  server: Record<string, boolean>,
  nilai: Record<string, boolean>,
): Record<string, boolean> {
  const gabung: Record<string, boolean> = { ...server };
  for (const [k, v] of Object.entries(nilai)) {
    if (v === false) gabung[k] = false;
    else delete gabung[k];
  }
  return gabung;
}

/** Peta server tanpa kunci milik fitur ini (dipakai aksi "kembalikan ke
 *  bawaan": hapus penanda fitur ini, kunci lain dibiarkan). Kunci dibatasi
 *  `string` karena peta `visibilitas` dipakai bersama filter toolbar DAN bagian
 *  tabel (`bagianTabel.ts`) — keduanya menimpa peta yang sama. */
export function buangKunciVisibilitas(
  server: Record<string, boolean>,
  kunci: readonly string[],
): Record<string, boolean> {
  const gabung: Record<string, boolean> = { ...server };
  for (const k of kunci) delete gabung[k];
  return gabung;
}
