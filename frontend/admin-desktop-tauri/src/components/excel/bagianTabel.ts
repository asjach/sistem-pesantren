/** Registri BAGIAN tabel — potongan tabel yang bisa disembunyikan seluruhnya.
 *
 *  Beda dari `filterTabel.ts` (= kontrol toolbar yang menyaring data) dan dari
 *  preset kolom (= kolom mana yang tampil): di sini yang dimatikan adalah
 *  potongan tabel itu sendiri, bukan isi/filternya.
 *
 *  Daftar ini dipakai dua sisi:
 *  - **Tabel** (`ExcelTable`) → menentukan bagian mana yang dirender.
 *  - **Kelola Tabel** (`TabBagianTabel`, tab Umum) → menyajikan sakelar per
 *    bagian.
 *
 *  Kunci disimpan di `toolbar_preset.visibilitas` yang SAMA dengan filter
 *  toolbar (satu peta JSON per tabel), jadi TIDAK perlu migrasi. Writer wajib
 *  merge lewat `gabungVisibilitas`/`buangKunciVisibilitas` — `simpanToolbarPreset`
 *  menimpa SATU PETA utuh, jadi menulis sebagian tanpa merge akan menghapus
 *  penanda milik fitur lain (mis. filter yang sedang disembunyikan).
 *
 *  Bawaannya semua tampil: tabel yang belum pernah disetel berperilaku persis
 *  seperti dahulu. */

export type KunciBagianTabel =
  /** Bilah judul tabel: judul + info tengah + kontrol toolbar (filter,
   *  Urutkan, Kolom) + tombol aksi utama. */
  | 'bilah_judul'
  /** Pil info ringkasan di tengah bilah judul (cuma bagian dalam bilah
   *  judul — tak ada artinya saat bilah judulnya sendiri disembunyikan). */
  | 'info_tengah'
  /** Baris kepala kolom grid. */
  | 'header_kolom'
  /** Rel/filter di kiri grid (mis. rel Tingkat/Kelas). */
  | 'rel_filter'
  /** Kaki tabel: paginasi + tombol Pengaturan tabel/Tinggi baris/Tambah/Edit. */
  | 'kaki_tabel';

export interface ItemBagianTabel {
  kunci: KunciBagianTabel;
  label: string;
  /** Keterangan singkat untuk baris di dialog Kelola Tabel. */
  ket: string;
  /** Sakelar tak ada artinya kalau tabel ini tak punya bagian tersebut —
   *  disembunyikan dari dialog biar tak ada sakelar yang mati. */
  tersedia?: (info: InfoBagianTabel) => boolean;
}

/** Kemampuan tabel yang menentukan bagian mana yang nyata ada. Kaki tabel tak
 *  masuk: `ExcelTable` selalu merendaknya (tombol Tinggi baris selalu ada),
 *  jadi sakelarnya selalu berarti. */
export interface InfoBagianTabel {
  /** Bilah judul dirender (judul/filter/kontrol toolbar ada). */
  adaBilahJudul: boolean;
  /** Ada info tengah di bilah judul. */
  adaInfoTengah: boolean;
  /** Tabel punya rel/filter di kiri grid (`rail`). */
  adaRelFilter: boolean;
}

export const BAGIAN_TABEL: readonly ItemBagianTabel[] = [
  {
    kunci: 'bilah_judul',
    label: 'Bilah judul (judul + toolbar)',
    ket: 'Baris paling atas: nama tabel, info tengah, filter, tombol Urutkan/Kolom, dan tombol aksi utama',
    tersedia: (i) => i.adaBilahJudul,
  },
  {
    kunci: 'info_tengah',
    label: 'Info tengah di bilah judul',
    ket: 'Pil ringkasan di tengah judul (jumlah baris, ringkasan nilai, dan sejenisnya)',
    tersedia: (i) => i.adaInfoTengah && i.adaBilahJudul,
  },
  {
    kunci: 'header_kolom',
    label: 'Header kolom (kepala kolom)',
    ket: 'Baris nama kolom di atas grid — disembunyikan berarti tabel tanpa kepala kolom',
  },
  {
    kunci: 'rel_filter',
    label: 'Rel filter di kiri grid',
    ket: 'Rel/filter tingkat-kelas yang menempel di kiri tabel (bila halaman memakai rel)',
    tersedia: (i) => i.adaRelFilter,
  },
  {
    kunci: 'kaki_tabel',
    label: 'Kaki tabel (pager + tombol)',
    ket: 'Baris paling bawah: paginasi, tombol Pengaturan tabel, Tinggi baris, Tambah, dan Edit',
  },
];

/** Bawaan saat info tabel tak diketahui — dipakai jalur Kelola Tabel dari
 *  TopBar (dialog dibuka tanpa tabel di belakang, jadi tak ada grid yang bisa
 *  ditanyakan). Hanya bagian yang pasti ada di tabel mana pun yang ditawarkan;
 *  info tengah & rel filter disembunyikan supaya tak ada sakelar yang mati. */
export const BAGIAN_INFO_BEKAL: InfoBagianTabel = {
  adaBilahJudul: true,
  adaInfoTengah: false,
  adaRelFilter: false,
};

/** Bagian yang benar-benar bisa dimatikan pada tabel ini (bagian yang tak ada
 *  di halaman ini disembunyikan dari dialog — sakelar mati hanya membingungkan).
 *  Header kolom & kaki tabel selalu masuk: dua-duanya ada di semua tabel. */
export function bagianTersedia(info: InfoBagianTabel): ItemBagianTabel[] {
  return BAGIAN_TABEL.filter((b) => b.tersedia?.(info) ?? true);
}

/** Tampil kecuali benar-benar disembunyikan (`false`). Absen = bawaan tampil,
 *  jadi tabel yang belum pernah disetel berperilaku persis seperti dahulu. */
export function bagianAktif(
  visibilitas: Record<string, boolean>,
  kunci: KunciBagianTabel,
): boolean {
  return visibilitas[kunci] !== false;
}