import { useEffect, useRef } from 'react';

import { errorMessage } from '@/api/client';
import { toast } from 'sonner';

import { INPUT_ROW_ID } from './helpers';
import type { ExcelField, GridRow } from './types';

/** Ref mutable yang selalu terisi (dipakai untuk cermin nilai terbaru). */
interface LiveRef<T> {
  current: T;
}

/** Drafts: id baris → field → nilai. */
type Drafts = Record<string, Record<string, string | null>>;

export interface BarisInputOptions<T extends { id: string | number }> {
  /** Buat record baru dari baris input (absen = mode Input tidak aktif). */
  onCreateRow: ((fields: Record<string, string | null>) => Promise<void>) | undefined;
  /** Kolom tampil saat ini (validasi mengikuti kolom terlihat). */
  visibleFieldsRef: LiveRef<ExcelField[]>;
  /** Nilai awal tampilan kolom statis baris input (dari halaman). */
  inputRowValues?: Record<string, string | null>;
  /** Drafts grid (dibaca & ditulis untuk baris INPUT_ROW_ID). */
  setDrafts: React.Dispatch<React.SetStateAction<Drafts>>;
  /** Halaman masih memuat (kursor menunggu reload selesai). */
  loading: boolean;
  /** Baris grid tampil — untuk mencari indeks baris input. */
  gridValueRef: LiveRef<GridRow[]>;
  /** Ref API grid DSG (setActiveCell untuk memindahkan kursor). */
  gridRef: LiveRef<{ setActiveCell: (arg: { col: number; row: number }) => void } | null>;
}

/**
 * Logika baris input ExcelTable (mode Input): draft baris input ditulis dari
 * `handleChange`, validasi wajib + validator kolom (`periksaInput`), simpan
 * via `onCreateRow` halaman (`simpanInput` — draft dibersihkan hanya bila
 * sukses; toast sukses tanggung jawab halaman), Enter pada baris input
 * (`enterInputRow` — kursor boleh turun bila valid), dan pemindahan kursor
 * kembali ke baris input setelah reload (`pindahKeInput` via efek).
 */
export function useBarisInput<T extends { id: string | number }>({
  onCreateRow,
  visibleFieldsRef,
  inputRowValues,
  setDrafts,
  loading,
  gridValueRef,
  gridRef,
}: BarisInputOptions<T>) {
  /** Nilai TERBARU baris input (ditulis handleChange) — dipakai saat Enter
   *  agar simpan tidak membaca state yang belum ter-flush. */
  const inputDraftRef = useRef<Record<string, string | null>>({});
  /** Indeks kolom yang ditinggalkan & penanda kursor harus turun ke baris input. */
  const inputKolomRef = useRef(0);
  const pindahKeInputRef = useRef(false);

  /** Periksa baris input tanpa efek samping: nilai, kolom kurang, pesan. */
  function periksaInput() {
    const d = inputDraftRef.current;
    const flds: Record<string, string | null> = {};
    const kurang: string[] = [];
    let pesan: string | null = null;
    for (const f of visibleFieldsRef.current) {
      if (f.kind === 'static' && !f.inputKind) continue;
      const raw = d[f.key] ?? inputRowValues?.[f.key] ?? null;
      const v = raw == null || String(raw).trim() === '' ? null : String(raw);
      flds[f.key] = v;
      if (f.required && v === null) {
        kurang.push(f.label);
        continue;
      }
      if (v !== null && f.validate) {
        const blocked = f.validate(v);
        if (blocked && pesan === null) pesan = blocked;
      }
    }
    return { flds, kurang, pesan, valid: kurang.length === 0 && pesan === null };
  }

  /** Simpan baris input → buat record baru via onCreateRow halaman. Validasi
   *  field wajib + validator kolom dulu; draft dibersihkan hanya bila sukses
   *  (toast sukses menjadi tanggung jawab halaman). */
  async function simpanInput() {
    if (!onCreateRow) return;
    const { flds, kurang, pesan, valid } = periksaInput();
    if (!valid) {
      // Kolom wajib belum lengkap → tidak ada yang disimpan.
      if (pesan) toast.error(pesan);
      else toast.error('Kolom wajib harus diisi terlebih dahulu.', { description: kurang.join(', ') });
      return;
    }
    try {
      await onCreateRow(flds);
      inputDraftRef.current = {};
      // Kursor pindah ke baris bawah (baris input) setelah data dimuat.
      pindahKeInputRef.current = true;
      setDrafts((prev) => {
        if (!(INPUT_ROW_ID in prev)) return prev;
        const next = { ...prev };
        delete next[INPUT_ROW_ID];
        return next;
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Enter pada baris input: simpan bila kolom wajib lengkap. Kembalikan true
   *  bila kursor boleh turun ke baris bawah (baris input berikutnya). */
  function enterInputRow(columnIndex: number): boolean {
    if (!onCreateRow) return false;
    inputKolomRef.current = columnIndex;
    const { valid } = periksaInput();
    void simpanInput();
    return valid;
  }

  /** Setelah simpan sukses: pindahkan kursor ke baris input (baris di bawah
   *  data yang baru dibuat) begitu daftar selesai dimuat. */
  useEffect(() => {
    if (!pindahKeInputRef.current || loading) return;
    const idx = gridValueRef.current.findIndex((r) => String(r.id) === INPUT_ROW_ID);
    if (idx < 0) return;
    pindahKeInputRef.current = false;
    gridRef.current?.setActiveCell({ col: inputKolomRef.current, row: idx });
  });

  /** Ref handler yang selalu memanggil versi terbaru enterInputRow. */
  const inputEnterRef = useRef(enterInputRow);
  inputEnterRef.current = enterInputRow;
  /** Ref handler tombol simpan baris input (kolom Aksi). */
  const inputAksiRef = useRef<() => void>(() => {});
  inputAksiRef.current = () => void simpanInput();

  return {
    /** Draft baris input (ditulis handleChange, dibaca periksaInput). */
    inputDraftRef,
    /** Enter pada baris input (dipakai TextCell/SelectCell columnData). */
    inputEnterRef,
    /** Tombol simpan di kolom Aksi baris input. */
    inputAksiRef,
    simpanInput,
  };
}
