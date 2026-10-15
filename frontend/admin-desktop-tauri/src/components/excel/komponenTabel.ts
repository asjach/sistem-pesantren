/** Registri KOMPONEN tabel — sakelar tampil/sembunyi per komponen, dikelompokkan.
 *
 *  Semua sakelar disimpan di `toolbar_preset.visibilitas` (satu peta JSON per
 *  tabel), jadi TIDAK perlu migrasi dan tak perlu endpoint baru.
 *
 *  Writer WAJIB merge: `simpanToolbarPreset` menimpa SATU PETA utuh, jadi kunci
 *  komponen yang tak ikut ditulis ikut hilang. Helper merge-nya hidup di
 *  `filterTabel.ts` (`gabungVisibilitas` / `buangKunciVisibilitas`) — dipakai
 *  bersama oleh semua sakelar tabel ini.
 *
 *  Bawaannya semua tampil: peta kosong = perilaku seperti biasa, jadi tabel yang
 *  belum pernah disetel tak berubah sama sekali.
 *
 *  Cakupan sakelar ini adalah komponen yang DIMILIKI TABEL. Kontrol milik
 *  halaman yang diselipkan lewat `awalanToolbar`/`akhirToolbar`/`renderBulkActions`
 *  sengaja tak punya sakelar — menyembunyikannya berarti menyembunyikan kontrol
 *  halaman yang tak punya tempat disetel di dialog ini.
 *
 *  `kolom_centang`/`kolom_aksi` berbeda: halaman memang tak memaksa
 *  menyembunyikannya, jadi super_admin boleh — dan tabel yang punya aksi
 *  massal jadi kehilangan jalan ke aksi itu. Itu konsekuensi yang disetujui,
 *  bukan bug yang dicegah. */

export type KunciKomponenTabel =
  // — Bilah judul —
  /** Teks nama tabel di bilah judul. */
  | 'judul_tabel'
  /** Pil info ringkasan di tengah bilah judul. */
  | 'info_tengah'
  /** Seluruh slot filter milik tabel di bilah judul (dropdown halaman). */
  | 'filter'
  /** Kotak "Cari" milik tabel ini (hanya bila halaman mendaftarkannya). */
  | 'cari'
  /** Dropdown status/keaktifan di slot filter (hanya bila didaftarkan). */
  | 'keaktifan'
  /** Dropdown preset "Urutkan". */
  | 'urutan'
  /** Dropdown preset "Kolom". */
  | 'kolom'
  /** Tombol aksi utama di kanan bilah judul (Tambah & sejenisnya). */
  | 'tombol_aksi'
  /** Gerigi "Pengaturan tabel" — paling kanan di bilah judul (pintu dialog
   *  Kelola Tabel dari tabel ini; dulunya berada di kaki tabel). */
  | 'tombol_pengaturan'
  // — Kepala tabel —
  /** Baris nama kolom di atas grid. */
  | 'header_kolom'
  /** Rel/filter tingkat-kelas yang menempel di kiri grid. */
  | 'rel_filter'
  // — Kolom tetap (mengapit grid) —
  /** Kolom centang baris (memilih baris untuk aksi massal). */
  | 'kolom_centang'
  /** Kolom Aksi di kanan tiap baris. */
  | 'kolom_aksi'
  // — Kaki tabel —
  /** Pager + jumlah baris per halaman. */
  | 'pager'
  /** Tombol "Tambah baris" (mode Input). */
  | 'tombol_tambah'
  /** Tombol "Edit" (mode Edit). */
  | 'tombol_edit';

export interface ItemKomponenTabel {
  kunci: KunciKomponenTabel;
  label: string;
  /** Komponen tak ada di tabel ini → sakelarnya tak ditampilkan. Sakelar mati
   *  hanya membingungkan (bikin orang mengira sakelarnya tak berfungsi). */
  tersedia?: (info: InfoKomponenTabel) => boolean;
}

export interface GrupKomponenTabel {
  /** Id grup (dipakai `id` elemen section, snake_case). */
  id: string;
  label: string;
  items: readonly ItemKomponenTabel[];
}

export const GRUP_KOMPONEN_TABEL: readonly GrupKomponenTabel[] = [
  {
    id: 'bilah_judul',
    label: 'Bilah judul',
    items: [
      { kunci: 'judul_tabel', label: 'Judul tabel', tersedia: (i) => i.adaBilahJudul },
      { kunci: 'info_tengah', label: 'Info tengah', tersedia: (i) => i.infoTengah && i.adaBilahJudul },
      { kunci: 'filter', label: 'Filter tabel', tersedia: (i) => i.filter },
      { kunci: 'cari', label: 'Pencarian tabel', tersedia: (i) => i.cari },
      { kunci: 'keaktifan', label: 'Keaktifan / Status', tersedia: (i) => i.keaktifan },
      { kunci: 'urutan', label: 'Urutan', tersedia: (i) => i.urut },
      { kunci: 'kolom', label: 'Kolom', tersedia: (i) => i.kolom },
      { kunci: 'tombol_aksi', label: 'Tombol aksi utama', tersedia: (i) => i.tombolAksi },
      { kunci: 'tombol_pengaturan', label: 'Tombol Pengaturan tabel' },
    ],
  },
  {
    id: 'kepala_tabel',
    label: 'Kepala tabel',
    items: [
      { kunci: 'header_kolom', label: 'Header kolom (kepala kolom)' },
      { kunci: 'rel_filter', label: 'Rel filter di kiri grid', tersedia: (i) => i.relFilter },
    ],
  },
  {
    id: 'kolom_tetap',
    label: 'Kolom tetap',
    items: [
      {
        kunci: 'kolom_centang',
        label: 'Kolom centang',
        // Sakelar tak ditampilkan kalau HALAMAN sudah memaksa sembunyi lewat
        // prop `hideCheckbox` (TabelRingkas, tabel baca-saja).
        tersedia: (i) => i.kolomCentang,
      },
      {
        kunci: 'kolom_aksi',
        label: 'Kolom Aksi',
        tersedia: (i) => i.kolomAksi,
      },
    ],
  },
  {
    id: 'kaki_tabel',
    label: 'Kaki tabel',
    items: [
      { kunci: 'pager', label: 'Pager / jumlah baris', tersedia: (i) => i.pager },
      { kunci: 'tombol_tambah', label: 'Tombol tambah baris', tersedia: (i) => i.tombolTambah },
      { kunci: 'tombol_edit', label: 'Tombol Edit', tersedia: (i) => i.tombolEdit },
    ],
  },
];

/** Kemampuan tabel yang menentukan komponen mana yang benar-benar ada.
 *  Dihitung `ExcelTable` dari props-nya lalu dikirim ke dialog Kelola Tabel. */
export interface InfoKomponenTabel {
  /** Tabel ini punya bilah judul sama sekali (judul/filter/kontrol toolbar). */
  adaBilahJudul: boolean;
  /** Ada info tengah di bilah judul (prop `tengah`). */
  infoTengah: boolean;
  /** Ada slot filter tabel di bilah judul (prop `filter`). */
  filter: boolean;
  /** Halaman mendaftarkan kotak Cari tabel (slot filter berlabel "Cari"). */
  cari: boolean;
  /** Halaman mendaftarkan dropdown status/keaktifan. */
  keaktifan: boolean;
  /** Ada dropdown Urutkan (prop `onUrut`). */
  urut: boolean;
  /** Ada dropdown Kolom (bukan `hidePreset`). */
  kolom: boolean;
  /** Ada tombol aksi utama (prop `addButton`). */
  tombolAksi: boolean;
  /** Tabel punya rel/filter di kiri grid (prop `rail`). */
  relFilter: boolean;
  /** Halaman TIDAK memaksa sembunyikan kolom centang (prop `hideCheckbox`). */
  kolomCentang: boolean;
  /** Halaman TIDAK memaksa sembunyikan kolom Aksi (prop `hideActions`). */
  kolomAksi: boolean;
  /** Ada pager di kaki tabel (prop `pager`). */
  pager: boolean;
  /** Tombol tambah baris tersedia (prop `onCreateRow` + halaman boleh tambah). */
  tombolTambah: boolean;
  /** Tombol Edit tersedia (halaman boleh edit). */
  tombolEdit: boolean;
}

/** Bawaan saat info tabel tak diketahui — dipakai jalur Kelola Tabel dari
 *  TopBar (dialog dibuka tanpa tabel di belakang, jadi tak ada grid yang bisa
 *  ditanyakan). Hanya komponen yang praktis selalu ada yang ditawarkan. */
export const KOMPONEN_INFO_BEKAL: InfoKomponenTabel = {
  adaBilahJudul: true,
  infoTengah: false,
  filter: false,
  cari: false,
  keaktifan: false,
  urut: true,
  kolom: true,
  tombolAksi: false,
  relFilter: false,
  kolomCentang: true,
  kolomAksi: true,
  pager: false,
  tombolTambah: false,
  tombolEdit: false,
};

/** Setiap grup beserta komponen yang tersedia padanya. Grup yang tak punya satu
 *  pun komponen tak dirender sama sekali (mis. "Kepala tabel" pada tabel tanpa
 *  rel filter tetap muncul karena header kolom selalu ada). */
export function grupTersedia(
  info: InfoKomponenTabel,
): { grup: GrupKomponenTabel; items: ItemKomponenTabel[] }[] {
  return GRUP_KOMPONEN_TABEL
    .map((grup) => ({ grup, items: grup.items.filter((b) => b.tersedia?.(info) ?? true) }))
    .filter(({ items }) => items.length > 0);
}

/** Semua kunci komponen yang boleh ditulis/dibuang pada tabel ini — bukan
 *  semua kunci server, karena peta `visibilitas` juga menyimpan penanda versi
 *  lama (`info`/`urut`) yang tak lagi dihasilkan FE. */
export function kunciTersedia(info: InfoKomponenTabel): KunciKomponenTabel[] {
  return grupTersedia(info).flatMap(({ items }) => items.map((b) => b.kunci));
}

/** Tampil kecuali benar-benar disembunyikan (`false`). */
export function komponenAktif(
  visibilitas: Record<string, boolean>,
  kunci: KunciKomponenTabel,
): boolean {
  return visibilitas[kunci] !== false;
}

/** Adakah SATU pun komponen grup yang masih tampil? Dipakai tabel untuk
 *  kontainer-nya sendiri: bilah judul yang seluruh isinya mati tak perlu
 *  dirender (dan sebaliknya). */
export function grupAdaYangTampil(
  visibilitas: Record<string, boolean>,
  kunciGrup: readonly KunciKomponenTabel[],
): boolean {
  return kunciGrup.some((k) => komponenAktif(visibilitas, k));
}