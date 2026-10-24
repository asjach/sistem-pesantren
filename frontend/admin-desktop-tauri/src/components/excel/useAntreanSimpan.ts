import { useCallback, useRef, type MutableRefObject } from 'react';
import { errorMessage } from '@/api/client';
import { toast } from 'sonner';
import type { ExcelField } from './types';

export interface AntreanSimpanOpts<T extends { id: string | number }> {
  rowsRef: MutableRefObject<T[]>;
  fieldsRef: MutableRefObject<ExcelField[]>;
  onCommitRef: MutableRefObject<(id: T['id'], fields: Record<string, string | null>) => Promise<void>>;
  onSavedRef: MutableRefObject<() => Promise<void> | void>;
  dropDraftRef: MutableRefObject<(idKey: string, keys: string[]) => void>;
  /** false = tahan antrean sampai `flush()` (mis. simpan saat keluar Mode Ubah). */
  autoDrain?: boolean;
  /** true = kegagalan validasi/API mempertahankan draft dan antrean untuk
   *  dicoba ulang. Dipakai Leger agar hasil parsial tidak hilang. */
  pertahankanGagal?: boolean;
  /** Bila ada: sel yang gagal validasi dilewati, sel lain tetap disimpan,
   *  dan pemanggil diberi tahu (mis. untuk toast nama + mapel). */
  onInvalidRef?: MutableRefObject<((info: { id: string | number; key: string; pesan: string }) => void) | undefined>;
}

export interface HasilFlush {
  sukses: boolean;
  tersimpan: number;
  gagal: number;
  pesan?: string;
}

export interface AksiDraftTabel {
  adaDraft: () => boolean;
  flush: () => Promise<HasilFlush>;
  buang: () => void;
}

interface EntriAntrean<T extends { id: string | number }> {
  fields: Record<string, string | null>;
  commit: (id: T['id'], fields: Record<string, string | null>) => Promise<void>;
}

/**
 * Antrean simpan sel tabel: perubahan beruntun pada baris yang sama digabung,
 * diproses berurutan, lalu satu `onSaved()` + satu toast setelah antrean habis.
 * Validasi field gagal / API error → draft baris dibuang (nilai kembali).
 */
export function useAntreanSimpan<T extends { id: string | number }>({
  rowsRef,
  fieldsRef,
  onCommitRef,
  onSavedRef,
  dropDraftRef,
  autoDrain = true,
  pertahankanGagal = false,
  onInvalidRef,
}: AntreanSimpanOpts<T>) {
  const queueRef = useRef<Map<string, EntriAntrean<T>>>(new Map());
  const drainingRef = useRef(false);
  /** Baris yang sukses tersimpan pada siklus drain berjalan. */
  const savedRef = useRef<{ id: string; keys: string[] }[]>([]);

  /** Simpan satu baris; kegagalan dikembalikan agar `flush()` bisa eksplisit.
   *  Bila `pertahankanGagal`, draft dan antrean tidak dibuang. */
  const saveRow = useCallback(async (
    idKey: string,
    entri: EntriAntrean<T>,
  ): Promise<{ ok: boolean; pesan?: string }> => {
    const flds = entri.fields;
    const domain = rowsRef.current.find((r) => String(r.id) === idKey);
    if (!domain) {
      dropDraftRef.current(idKey, Object.keys(flds));
      return { ok: false, pesan: 'Baris tidak ditemukan.' };
    }
    for (const f of fieldsRef.current) {
      if (flds[f.key] !== undefined && f.validate) {
        const blocked = f.validate(flds[f.key]);
        if (blocked) {
          if (!pertahankanGagal) {
            dropDraftRef.current(idKey, Object.keys(flds));
            toast.error(blocked);
          }
          return { ok: false, pesan: blocked };
        }
      }
    }
    try {
      await entri.commit(domain.id, flds);
      savedRef.current.push({ id: idKey, keys: Object.keys(flds) });
      return { ok: true };
    } catch (e) {
      const pesan = `Gagal menyimpan. ${errorMessage(e)}`;
      if (!pertahankanGagal) {
        dropDraftRef.current(idKey, Object.keys(flds));
        toast.error(pesan);
      }
      return { ok: false, pesan };
    }
  }, [rowsRef, fieldsRef, dropDraftRef, pertahankanGagal]);

  /** Proses antrean berurutan; satu reload server + satu toast setelah antrean
   *  habis (bukan per baris) dan hanya bila memang ada yang tersimpan. */
  const drain = useCallback(async (): Promise<HasilFlush> => {
    if (drainingRef.current) {
      return { sukses: false, tersimpan: 0, gagal: 0, pesan: 'Sedang menyimpan.' };
    }
    drainingRef.current = true;
    let hasil: HasilFlush = { sukses: true, tersimpan: 0, gagal: 0 };
    try {
      let gagal = 0;
      let pesan: string | undefined;
      while (queueRef.current.size > 0) {
        const [idKey, entri] = [...queueRef.current.entries()][0];
        queueRef.current.delete(idKey);
        const simpan = await saveRow(idKey, entri);
        if (!simpan.ok) {
          gagal++;
          pesan = simpan.pesan ?? pesan;
          if (pertahankanGagal) {
            // Kembalikan entri agar tombol coba ulang hanya mengirim yang gagal.
            queueRef.current.set(idKey, entri);
            break;
          }
        }
      }
      const tersimpan = savedRef.current.length;
      if (tersimpan > 0) {
        try {
          await onSavedRef.current();
        } catch {
          // Simpan sudah sukses; gagal reload tidak membatalkan hasilnya.
        }
        for (const s of savedRef.current) dropDraftRef.current(s.id, s.keys);
        savedRef.current = [];
        toast.success(tersimpan === 1 ? 'Perubahan tersimpan.' : `${tersimpan} baris tersimpan.`);
      }
      if (gagal > 0) {
        toast.error(pesan ?? 'Sebagian nilai gagal disimpan.');
      }
      hasil = { sukses: gagal === 0, tersimpan, gagal, pesan };
    } finally {
      drainingRef.current = false;
    }

    // Jangan otomatis mengulang kegagalan yang sengaja dipertahankan.
    if (!pertahankanGagal && queueRef.current.size > 0) void drain();

    return hasil;
  }, [saveRow, onSavedRef, dropDraftRef, pertahankanGagal]);

  /** Antrean simpan per baris: perubahan beruntun di baris yang sama digabung.
   *  Callback commit diambil saat edit diantrekan agar konteks asal (mis.
   *  kegiatan evaluatif/semester Leger) tidak berubah saat flush tertunda.
   *  Validasi dilakukan di sini agar nilai tidak sah langsung ditolak (draft
   *  kembali), bukan baru saat antrean di-flush ketika keluar mode. Bila
   *  `onInvalidRef` tersedia, hanya sel yang gagal yang dilewati; sel valid
   *  pada baris yang sama tetap disimpan. */
  const enqueueSave = useCallback((idKey: string, flds: Record<string, string | null>) => {
    const valid: Record<string, string | null> = {};
    const invalid: { key: string; pesan: string }[] = [];

    for (const [key, value] of Object.entries(flds)) {
      const field = fieldsRef.current.find((f) => f.key === key);
      const blocked = field?.validate?.(value) ?? null;
      if (blocked) invalid.push({ key, pesan: blocked });
      else valid[key] = value;
    }

    if (invalid.length > 0) {
      if (onInvalidRef?.current) {
        const domain = rowsRef.current.find((r) => String(r.id) === idKey);
        const id = domain?.id ?? idKey;
        for (const item of invalid) {
          onInvalidRef.current({ id, key: item.key, pesan: item.pesan });
        }
        dropDraftRef.current(idKey, invalid.map((item) => item.key));
      } else {
        dropDraftRef.current(idKey, Object.keys(flds));
        toast.error(invalid[0].pesan);
        return;
      }
    }

    if (Object.keys(valid).length === 0) return;

    const prev = queueRef.current.get(idKey);
    queueRef.current.set(idKey, {
      fields: { ...(prev?.fields ?? {}), ...valid },
      // Pertahankan commit pertama untuk baris yang sudah antre: callback itu
      // membawa konteks asal edit.
      commit: prev?.commit ?? onCommitRef.current,
    });
    if (autoDrain) void drain();
  }, [autoDrain, drain, fieldsRef, dropDraftRef, onCommitRef, onInvalidRef, rowsRef]);

  const batalkanAntrean = useCallback(() => {
    queueRef.current.clear();
    savedRef.current = [];
  }, []);

  return { enqueueSave, flush: drain, batalkanAntrean };
}
