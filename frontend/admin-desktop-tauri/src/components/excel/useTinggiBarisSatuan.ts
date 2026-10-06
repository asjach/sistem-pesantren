import { useCallback, useRef, type RefObject } from 'react';
import { hitungTinggiBaris } from './tinggiBaris';
import { measureTextWidth } from './measure';
import { INPUT_ROW_ID } from './helpers';
import type { ExcelField, GridRow } from './types';

interface Props {
  /** Wadah grid; dipakai membaca style terhitung untuk mengukur teks. */
  wrapRef: RefObject<HTMLDivElement>;
  /** Tinggi baris dasar menurut kerapatan tema. */
  effectiveH: number;
  /** Ukuran font efektif tabel (px). */
  effectiveFont: number;
  visibleFields: ExcelField[];
  widths: Record<string, number>;
  autoWidths: Record<string, number>;
  syncAutoWidths: Record<string, number>;
  /** Tinggi manual per baris (hasil seret batas bawah). */
  tinggiBarisManual: Record<string, number>;
  /** Baris membesar mengikuti isinya (tabel halaman, bukan tabel kompak). */
  barisIkutIsi: boolean;
  /** Batas baris tabel kompak; ada = tinggi variabel dimatikan. */
  maxRows?: number;
}

/**
 * Tinggi satu baris (dari baris GRID yang sudah berformat teks): manual
 * (seret hanya baris itu) → ikut isi (baris ini membesar bila teksnya
 * membungkus) → tinggi dasar kerapatan. Baris yang isinya muat tetap.
 *
 * Catatan: yang diterima DSG adalah `gridValue` (kunci = kolom, nilai =
 * teks terformat), BUKAN baris domain — jadi `getValues` tidak boleh
 * dipanggil lagi di sini.
 *
 * Mode ikut isi hanya untuk tabel halaman; tabel kompak `maxRows`
 * menghitung tinggi dari jumlah baris tetap sehingga tinggi variabel akan
 * membuat perkiraan itsinya meleset.
 *
 * Pengukuran lebar teks menyentuh DOM, jadi di-cache per teks dan tinggi
 * akhir per baris. Kegagalan pengukuran tidak boleh menjatuhkan grid.
 */
export function useTinggiBarisSatuan({
  wrapRef,
  effectiveH,
  effectiveFont,
  visibleFields,
  widths,
  autoWidths,
  syncAutoWidths,
  tinggiBarisManual,
  barisIkutIsi,
  maxRows,
}: Props): (rowData: GridRow) => number {
  const cacheLebarTeks = useRef(new Map<string, number>());
  const cacheTinggiBaris = useRef(new Map<string, number>());
  return useCallback((rowData: GridRow): number => {
    const rowKey = String(rowData.id);
    const manual = tinggiBarisManual[rowKey];
    if (manual !== undefined) return manual;
    if (!barisIkutIsi || maxRows !== undefined || rowKey === INPUT_ROW_ID) return effectiveH;

    try {
      const style = wrapRef.current ? getComputedStyle(wrapRef.current) : null;
      if (!style) return effectiveH;

      const teks: string[] = [];
      const lebarKolom: number[] = [];
      for (const f of visibleFields) {
        if (f.kind === 'toggle') continue;
        const isi = rowData[f.key];
        if (isi === null || isi === undefined || isi === '') continue;
        teks.push(String(isi));
        lebarKolom.push(widths[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150);
      }
      if (teks.length === 0) return effectiveH;

      const sig = `${rowKey}|${effectiveFont}|${effectiveH}|${lebarKolom.join(',')}|${teks.join('\u0001')}`;
      const tersimpan = cacheTinggiBaris.current.get(sig);
      if (tersimpan !== undefined) return tersimpan;

      const lebarTeks = teks.map((t) => {
        const kunci = `${effectiveFont}|${t}`;
        const ada = cacheLebarTeks.current.get(kunci);
        if (ada !== undefined) return ada;
        const baru = measureTextWidth(t, style);
        if (cacheLebarTeks.current.size > 2000) cacheLebarTeks.current.clear();
        cacheLebarTeks.current.set(kunci, baru);
        return baru;
      });
      const tinggi = hitungTinggiBaris({ lebarTeks, lebarKolom, fontPx: effectiveFont, minH: effectiveH });
      if (cacheTinggiBaris.current.size > 1000) cacheTinggiBaris.current.clear();
      cacheTinggiBaris.current.set(sig, tinggi);
      return tinggi;
    } catch {
      // Pengukuran gagal (mis. DOM belum siap) → tinggi dasar.
      return effectiveH;
    }
  }, [tinggiBarisManual, barisIkutIsi, maxRows, effectiveH, effectiveFont, visibleFields, widths, autoWidths, syncAutoWidths]);
}
