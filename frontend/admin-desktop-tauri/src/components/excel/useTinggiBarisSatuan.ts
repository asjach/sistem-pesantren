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
  /** Tinggi manual per baris (sisa setelan lama; kini diatur lewat Kelola Tabel). */
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
  /** Gaya terhitung dibaca sekali per kombinasi font/tinggi (bukan per baris),
   *  beserta faktor line-height & padding sel NYATA dari DOM — bukan konstanta
   *  tebakan. Tanpa ini estimasi bungkus teks meleset dari render DSG
   *  (dulu: asumsi 1.35 vs warisan body 1.45, padding mati 16px), sehingga
   *  tinggi baris goyang tiap data berubah dan memicu remount yang kentara. */
  const gayaRef = useRef<{
    kunci: string;
    gaya: CSSStyleDeclaration | null;
    faktorBaris: number;
    padX: number;
  }>({ kunci: '', gaya: null, faktorBaris: 1.45, padX: 16 });
  return useCallback((rowData: GridRow): number => {
    const rowKey = String(rowData.id);
    const manual = tinggiBarisManual[rowKey];
    if (manual !== undefined) return manual;
    if (!barisIkutIsi || maxRows !== undefined || rowKey === INPUT_ROW_ID) return effectiveH;

    try {
      const kunciGaya = `${effectiveFont}|${effectiveH}`;
      if (gayaRef.current.kunci !== kunciGaya || gayaRef.current.gaya === null) {
        const gaya = wrapRef.current ? getComputedStyle(wrapRef.current) : null;
        // Faktor warisan dari elemen yang sama tempat line-height dihitung
        // (line-height unitless 1.45 terhitung jadi px) — bukan dari
        // effectiveFont yang basisnya beda (font body vs font tabel).
        let faktorBaris = 1.45;
        let padX = 16;
        try {
          if (gaya) {
            const fs = parseFloat(gaya.fontSize);
            const lh = parseFloat(gaya.lineHeight);
            if (Number.isFinite(fs) && fs > 0 && Number.isFinite(lh) && lh > 0) {
              faktorBaris = lh / fs;
            }
          }
          const sel = wrapRef.current?.querySelector<HTMLElement>(
            '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)',
          );
          if (sel) {
            const cs = getComputedStyle(sel);
            padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
          }
        } catch {
          // Gagal baca DOM → pakai bawaan aman di atas.
        }
        gayaRef.current = { kunci: kunciGaya, gaya, faktorBaris, padX };
      }
      const style = gayaRef.current.gaya;
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

      const sig = `${rowKey}|${effectiveFont}|${effectiveH}|${gayaRef.current.faktorBaris.toFixed(3)}|${gayaRef.current.padX}|${lebarKolom.join(',')}|${teks.join('\u0001')}`;
      const tersimpan = cacheTinggiBaris.current.get(sig);
      if (tersimpan !== undefined) return tersimpan;

      const lebarTeks = teks.map((t) => {
        const kunci = `${effectiveFont}|${t}`;
        const ada = cacheLebarTeks.current.get(kunci);
        if (ada !== undefined) return ada;
        const baru = measureTextWidth(t, style);
        if (cacheLebarTeks.current.size > 20000) cacheLebarTeks.current.clear();
        cacheLebarTeks.current.set(kunci, baru);
        return baru;
      });
      const tinggi = hitungTinggiBaris({
        lebarTeks,
        lebarKolom,
        fontPx: effectiveFont,
        minH: effectiveH,
        lineHeight: gayaRef.current.faktorBaris,
        padX: gayaRef.current.padX,
      });
      if (cacheTinggiBaris.current.size > 10000) cacheTinggiBaris.current.clear();
      cacheTinggiBaris.current.set(sig, tinggi);
      return tinggi;
    } catch {
      // Pengukuran gagal (mis. DOM belum siap) → tinggi dasar.
      return effectiveH;
    }
  }, [tinggiBarisManual, barisIkutIsi, maxRows, effectiveH, effectiveFont, visibleFields, widths, autoWidths, syncAutoWidths]);
}
