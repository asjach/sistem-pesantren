import type { ReactNode } from 'react';

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

/** Seleksi blok gaya spreadsheet (indeks baris/kolom numerik). */
export interface GridSelection {
  min: { row: number; col: number };
  max: { row: number; col: number };
}

/** Data menu yang diekstrak dari elemen aksi (tanpa menyarangkan tombol asli). */
export interface AksiMenu {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  konfirmasi?: { title: string; description: string; confirmLabel?: string; onConfirm: () => void };
}
