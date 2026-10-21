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
  /** Bila ada: sel yang gagal validasi dilewati, sel lain tetap disimpan,
   *  dan pemanggil diberi tahu (mis. untuk toast nama + mapel). */
  onInvalidRef?: MutableRefObject<((info: { id: string | number; key: string; pesan: string }) => void) | undefined>;
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
  onInvalidRef,
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

        }
        for (const s of savedRef.current) dropDraftRef.current(s.id, s.keys);
        savedRef.current = [];
        toast.success(tersimpan === 1 ? 'Perubahan tersimpan.' : `${tersimpan} baris tersimpan.`);
      }
    } finally {
      drainingRef.current = false;
    }

    if (queueRef.current.size > 0) void drain();
  }, [saveRow, onSavedRef, dropDraftRef]);

  /** Antrean simpan per baris: perubahan beruntun di baris yang sama digabung.
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

    const prev = queueRef.current.get(idKey) ?? {};
    queueRef.current.set(idKey, { ...prev, ...valid });
    if (autoDrain) void drain();
  }, [autoDrain, drain, fieldsRef, dropDraftRef, onInvalidRef, rowsRef]);

  return { enqueueSave, flush: drain };
}
