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
  maxLength?: number;
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
  /** Sumber kolom database: mengikat kolom grid ke kamus label
   *  (nama header, perataan, lebar, tooltip, format, kontrol urut global).
   *  `null` = kolom sengaja tidak terikat kamus. */
  sumber?: { tabel: string; kolom: string } | null;
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
  /** Pilihan khusus baris input (mode Input) — mis. kolom mengikuti tabel terpilih. */
  choicesInput?: ExcelChoice[];
  /** Enter saat mengedit baris input = simpan baris (mode Input).
   *  Kembalikan true bila baris boleh pindah ke bawah (kolom wajib lengkap). */
  onEnter?: (columnIndex: number) => boolean;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
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
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
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
