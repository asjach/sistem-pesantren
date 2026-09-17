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
}: AntreanSimpanOpts<T>) {
  const queueRef = useRef<Map<string, Record<string, string | null>>>(new Map());
  const drainingRef = useRef(false);
  /** Baris yang sukses tersimpan pada siklus drain berjalan. */
  const savedRef = useRef<{ id: string; keys: string[] }[]>([]);

  /** Simpan satu baris; ditolak validasi / gagal API → nilai kembali + toast. */
  const saveRow = useCallback(async (idKey: string, flds: Record<string, string | null>) => {
    const domain = rowsRef.current.find((r) => String(r.id) === idKey);
    if (!domain) {
      dropDraftRef.current(idKey, Object.keys(flds));
      return;
    }
    for (const f of fieldsRef.current) {
      if (flds[f.key] !== undefined && f.validate) {
        const blocked = f.validate(flds[f.key]);
        if (blocked) {
          dropDraftRef.current(idKey, Object.keys(flds));
          toast.error(blocked);
          return;
        }
      }
    }
    try {
      await onCommitRef.current(domain.id, flds);
      savedRef.current.push({ id: idKey, keys: Object.keys(flds) });
    } catch (e) {
      dropDraftRef.current(idKey, Object.keys(flds));
      toast.error(`Gagal menyimpan. ${errorMessage(e)}`);
    }
  }, [rowsRef, fieldsRef, onCommitRef, dropDraftRef]);

  /** Proses antrean berurutan; satu reload server + satu toast setelah antrean
   *  habis (bukan per baris) dan hanya bila memang ada yang tersimpan. */
  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.size > 0) {
        const [idKey, flds] = [...queueRef.current.entries()][0];
        queueRef.current.delete(idKey);
        await saveRow(idKey, flds);
      }
      const tersimpan = savedRef.current.length;
      if (tersimpan > 0) {
        try {
          await onSavedRef.current();
        } catch {
          // Reload gagal: draft sukses tetap dibuang (data sudah tersimpan di server).
        }
        for (const s of savedRef.current) dropDraftRef.current(s.id, s.keys);
        savedRef.current = [];
        toast.success(tersimpan === 1 ? 'Perubahan tersimpan.' : `${tersimpan} baris tersimpan.`);
      }
    } finally {
      drainingRef.current = false;
    }
    // Ada perubahan baru saat reload berjalan → proses lagi.
    if (queueRef.current.size > 0) void drain();
  }, [saveRow, onSavedRef, dropDraftRef]);

  /** Antrean simpan per baris: perubahan beruntun di baris yang sama digabung. */
  const enqueueSave = useCallback((idKey: string, flds: Record<string, string | null>) => {
    const prev = queueRef.current.get(idKey) ?? {};
    queueRef.current.set(idKey, { ...prev, ...flds });
    void drain();
  }, [drain]);

  return { enqueueSave, drain };
}
