import type { MouseEvent, ReactNode } from 'react';

/** Tipe bersama komponen tabel (dipisah dari ExcelTable agar file utama ringkas). */

export interface ExcelChoice {
  value: string;
  label: string;
}

export interface ExcelField {
  key: string;
  label: string;
  /** Lebar cadangan bila pengukuran konten gagal; lebar normal mengikuti AutoFit. */
  width?: number;
  /** Kolom static: isi kartu hover untuk tiap baris (mis. rincian panjang
   *  yang tak muat di lebar kolom). Ada nilainya = sel dibungkus HoverCard. */
  kartuHover?: (rowData: GridRow) => ReactNode;
  /** text/select bisa diedit saat mode Edit aktif; static selalu baca-saja;
   *  toggle = switch ON/OFF yang langsung tersimpan (nilai 'ya'/'tidak'). */
  kind: 'text' | 'select' | 'static' | 'toggle';
  /** Toggle yang hidup tanpa Mode Edit (tetap tersimpan langsung);
   *  mis. kolom is_active referensi yang dikelola lewat aksi baris. */
  toggleTanpaEdit?: boolean;
  /** Select yang hidup tanpa Mode Edit (tetap tersimpan langsung);
   *  tetap digerbang `canEdit` halaman — pengguna tanpa izin tetap baca-saja. */
  selectTanpaEdit?: boolean;
  /** Boleh toggle per baris (id grid) — mis. baris global butuh konteks
   *  lembaga. Null/absen = semua boleh (selain baris input). */
  bolehToggle?: (id: string | number) => boolean;
  choices?: ExcelChoice[];
  /** Pilihan dropdown khusus per baris (mis. sel matriks jadwal: tiap baris
   *  hanya menawarkan mapel yang belum terpakai). Absen = pakai `choices`. */
  choicesForRow?: (id: string | number) => ExcelChoice[];
  /** Gerbang select per baris: false = sel terkunci (mis. baris istirahat
   *  pada matriks jadwal). Absen = semua baris boleh dipilih. */
  bolehSelect?: (id: string | number) => boolean;
  maxLength?: number;
  /** Klik sel teks baca-saja (mis. buka dialog editor). Absen = perilaku
   *  bawaan (klik ganda menyalakan Mode Ubah lalu membuka editor sel). */
  onCellClick?: (id: string | number) => void;
  /** Isi sel statis dengan ReactNode kustom (mis. dua baris mapel + guru). */
  renderCell?: (rowData: GridRow) => ReactNode;
  /** Baris-baris yang benar-benar digambar dalam satu sel — dipakai AutoFit
   *  untuk mengukur lebar kolom.
   *
   *  WAJIB diisi begitu `renderCell` menggambar isinya di lebih dari satu
   *  baris. Nilai grid-nya tetap satu string (dipakai salin TSV), jadi tanpa
   *  ini AutoFit mengukurnya sebagai SATU baris dan kolom jadi jauh lebih
   *  lebar dari yang benar-benar terpakai (mapel di atas guru di bawah
   *  terukur seolah bersebelahan). Lebar diambil dari baris yang TERLEBAR,
   *  bukan penjumlahan. */
  barisSel?: (baris: { id: string | number }) => BarisSel[];
  /** Kelas CSS tambahan untuk sel (mis. pewarnaan mapel/guru di jadwal). */
  cellClass?: (rowData: GridRow) => string | undefined;
  /** Kembalikan pesan galat bila nilai tidak valid, atau null bila OK. */
  validate?: (value: string | null) => string | null;
  /** Wajib diisi pada mode Input (ditandai warna di header + sel baris input). */
  required?: boolean;
  /** Kolom static yang tetap bisa DIISI saat mode Input (mis. kode/nik yang
   *  belum ada saat membuat record). Baris biasa tetap baca-saja. */
  inputKind?: 'text' | 'select';
  /** Pilihan dropdown untuk inputKind 'select' (bila beda dari `choices`).
   *  Boleh fungsi atas nilai baris input — mis. kolom mengikuti tabel terpilih. */
  inputChoices?: ExcelChoice[] | ((draft: Record<string, string | null>) => ExcelChoice[]);
  /** Format isi sel: `angka` (pemisah ribuan id-ID), `tanggal` (dd/mm/yyyy),
   *  atau `ya_tidak` (Ya/Tidak). Kosong = tampil apa adanya. Berlaku juga
   *  saat pengukuran lebar kolom supaya isi tidak terpotong. */
  format?: 'angka' | 'tanggal' | 'ya_tidak' | null;
}

/** Satu baris teks di dalam sel yang digambar multi-baris. */
export interface BarisSel {
  teks: string;
  /** Ukuran huruf px. Isi wajib bila `renderCell` memakai kelas ukuran
   *  sendiri (mis. `text-[10px]`) — kalau absen, ukuran huruf sel yang
   *  dipakai, sehingga baris kecil jadi overestimate. */
  ukuran?: number;
}

/** Baris grid: id + checklist + nilai string per field. */
export interface GridRow {
  id: string | number;
  checked: boolean;
  [key: string]: string | boolean | number | null;
}

/** Data kolom centang (columnData bawaan keyColumn; tidak dipakai). */
export interface CheckColData {
  key: string;
  original?: unknown;
}

/** Seleksi blok gaya spreadsheet (indeks baris/kolom numerik). */
export interface GridSelection {
  min: { row: number; col: number };
  max: { row: number; col: number };
}

/** Status "pilih semua" lewat context agar klik checkbox tidak membangun ulang
 *  definisi kolom DSG (kolom tetap stabil, hanya header ini yang re-render). */
export interface CheckAllState {
  ids: readonly (string | number)[];
  checked: ReadonlySet<string | number>;
  setChecked: (s: Set<string | number>) => void;
}

export interface TextColData {
  fieldKey: string;
  maxLength?: number;
  /** Enter saat mengedit baris input = simpan baris (mode Input).
   *  Kembalikan true bila baris boleh pindah ke bawah (kolom wajib lengkap). */
  onEnter?: (columnIndex: number) => boolean;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
}

export interface SelectColData {
  fieldKey: string;
  choices: ExcelChoice[];
  /** Pilihan per baris; menang atas `choices` untuk baris data. */
  choicesForRow?: (id: string | number) => ExcelChoice[];
  /** False = sel baris ini terkunci (nilai tetap tampil, tidak bisa dibuka). */
  bolehSelect?: (id: string | number) => boolean;
  /** Teks opsi kosong saat nilai sel belum ada di daftar pilihan (mis.
   *  "Pilih jenis…"). Bawaannya `Pilih…`. Opsi kosong ini wajib ada supaya
   *  pilihan pertama yang sebenarnya jadi perubahan saat dipilih — tanpa itu
   *  browser menampilkannya seolah sudah terpilih sehingga klik pertama
   *  tidak menghasilkan apa-apa. */
  placeholder?: string;
  /** Pilihan khusus baris input (mode Input) — mis. kolom mengikuti tabel terpilih. */
  choicesInput?: ExcelChoice[];
  /** Enter saat mengedit baris input = simpan baris (mode Input).
   *  Kembalikan true bila baris boleh pindah ke bawah (kolom wajib lengkap). */
  onEnter?: (columnIndex: number) => boolean;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
  /** Fokuskan kembali sel ini (baris `id`) setelah daftar select ditutup.
   *  Dipakai sel Select Radix: memilih opsi di panel portal (atau menekan
   *  Escape) berarti klik/key yang terjadi di LUAR grid, sehingga DSG
   *  menganggapnya "klik luar" lalu menghapus sel aktif. Tanpa pemulih ini,
   *  tombol panah/Enter tak lagi memindahkan sel setelah nilai diganti. */
  fokuskanSel?: (id: string | number) => void;
}

export interface ToggleColData {
  fieldKey: string;
  /** Label kolom (untuk aria). */
  label: string;
  /** Gerbang izin halaman; false = switch selalu nonaktif. */
  bisaEdit: boolean;
}

export interface StaticColData {
  fieldKey: string;
  /** Isi kartu hover sel — absen = sel teks polos tanpa kartu. */
  kartuHover?: (rowData: GridRow) => ReactNode;
  /** Isi sel kustom; absen = teks polos dari nilai field. */
  render?: (rowData: GridRow) => ReactNode;
  /** Klik sel (bila disediakan). */
  onClick?: (id: string | number) => void;
  /** Klik 2× sel (menyalakan Mode Ubah). */
  onDblClick?: () => void;
}

export interface ActionsColData {
  render: (id: string | number) => ReactNode;
  /** True bila kapasitas aksi tabel pernah melebihi 3 (high-water mark) —
   *  seluruh baris memakai dropdown hamburger walau aksi baris ini ≤ 3. */
  ringkas: boolean;
}

/** Data menu yang diekstrak dari elemen aksi (tanpa menyarangkan tombol asli). */
export interface AksiMenu {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  konfirmasi?: { title: string; description: string; confirmLabel?: string; onConfirm: () => void };
}
