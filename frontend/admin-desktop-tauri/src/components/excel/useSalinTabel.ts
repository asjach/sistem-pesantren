import { type KamusKolomAttr } from '@/api/kamusLabel';
import { copyText, toTSV } from '@/lib/clipboard';
import { formatNilai } from '@/lib/nilaiTampil';
import { toast } from 'sonner';

import type { ExcelField, GridRow, GridSelection } from './types';

/** Ref mutable yang selalu terisi (dipakai untuk cermin nilai terbaru). */
interface LiveRef<T> {
  current: T;
}

export interface SalinTabelOptions<T extends { id: string | number }> {
  hideCheckbox: boolean;
  hideActions: boolean;
  /** Kolom tampil saat ini (dibaca terkini saat event salin). */
  visibleFieldsRef: LiveRef<ExcelField[]>;
  fieldsRef: LiveRef<ExcelField[]>;
  rowsRef: LiveRef<T[]>;
  /** Baris grid aktif (termasuk draft & baris input). */
  gridValueRef: LiveRef<GridRow[]>;
  /** Baris grid per id — sumber `displayOf`. */
  gridByIdRef: LiveRef<Map<string, GridRow>>;
  checkedIdsRef: LiveRef<Set<T['id']>>;
  /** Blok seleksi spreadsheet (untuk salin blok & resize multi-kolom). */
  rangeRef: LiveRef<GridSelection | null>;
  /** Atribut kamus per key kolom (format tampil). */
  attrByKey: Map<string, KamusKolomAttr>;
  /** Nama tampil kolom (closure render terkini). */
  labelKolom: (key: string, bawaan: string) => string;
}

/**
 * Perintah salin ExcelTable (menu konteks + ribbon + Ctrl/Cmd+C): salin
 * baris/sel/kolom, salin blok seleksi atau baris tercentang sebagai TSV,
 * serta pemetaan indeks→key kolom grid (`gridColumnKeys`,
 * `selectedColumnKeys` — dipakai juga untuk resize multi-kolom) dan
 * `displayOf` (teks tampil draft-merged dengan format kamus). Semua fungsi
 * sengaja dibuat ulang tiap render (bukan useCallback) — semantik sama
 * dengan kode asli di ExcelTable.
 */
export function useSalinTabel<T extends { id: string | number }>({
  hideCheckbox,
  hideActions,
  visibleFieldsRef,
  fieldsRef,
  rowsRef,
  gridValueRef,
  gridByIdRef,
  checkedIdsRef,
  rangeRef,
  attrByKey,
  labelKolom,
}: SalinTabelOptions<T>) {
  /** Urutan id kolom grid (tanpa gutter) — untuk memetakan indeks seleksi. */
  function gridColumnKeys(): string[] {
    return [
      ...(hideCheckbox ? [] : ['check']),
      ...visibleFieldsRef.current.map((f) => f.key),
      ...(hideActions ? [] : ['__aksi']),
    ];
  }

  /** Kolom-kolom yang sedang terseleksi, kolom checkbox dikecualikan karena
   *  lebarnya tetap. Dipakai untuk resize serentak seperti Excel: pilih
   *  beberapa kolom → ubah lebar salah satunya → semuanya jadi sama lebar. */
  function selectedColumnKeys(): string[] {
    const r = rangeRef.current;
    if (!r || r.max.col <= r.min.col) return [];
    const keys = gridColumnKeys();
    const out: string[] = [];
    for (let c = r.min.col; c <= r.max.col; c++) {
      const k = keys[c];
      if (k && k !== 'check') out.push(k);
    }
    return out;
  }

  /** Teks tampil sebuah sel (draft-merged, dengan format kamus bila ada). */
  function displayOf(id: string | number, key: string): string {
    const v = gridByIdRef.current.get(String(id))?.[key];
    if (v == null) return '';
    const format = attrByKey.get(key)?.format;
    return format ? formatNilai(String(v), format) : String(v);
  }

  /** Salin satu baris (kolom terlihat) sebagai TSV. */
  async function salinBarisCtx(id: T['id']) {
    const header = visibleFieldsRef.current.map((f) => labelKolom(f.key, f.label));
    const body = [visibleFieldsRef.current.map((f) => displayOf(id, f.key))];
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success('Baris disalin (TSV).');
    else toast.error('Gagal menyalin.');
  }

  /** Salin nilai satu sel. */
  async function salinSelCtx(id: T['id'], key: string) {
    const ok = await copyText(displayOf(id, key));
    if (ok) toast.success('Nilai sel disalin.');
    else toast.error('Gagal menyalin.');
  }

  /** Salin seluruh kolom (label header + nilai semua baris) sebagai TSV. */
  async function salinKolomCtx(key: string) {
    const f = fieldsRef.current.find((x) => x.key === key);
    if (!f) return;
    const header = [labelKolom(key, f.label)];
    const body = rowsRef.current.map((r) => [displayOf(r.id, key)]);
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success(`${body.length} baris kolom disalin (TSV).`);
    else toast.error('Gagal menyalin.');
  }

  /** Tulis TSV + toast; true bila ada yang ditulis. */
  async function tulisTSV(header: string[], body: string[][], pesan: string): Promise<boolean> {
    if (body.length === 0) return false;
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success(pesan);
    else toast.error('Gagal menyalin.');
    return ok;
  }

  /** Salin (ribbon/Ctrl+C): baris tercentang menang di atas blok seleksi. */
  async function onCopy() {
    const rows = rowsRef.current;
    const checkedIds = checkedIdsRef.current;
    const checkedRows = rows.filter((r) => checkedIds.has(r.id));
    let header: string[];
    let body: string[][];
    if (checkedRows.length > 0) {
      header = visibleFieldsRef.current.map((f) => labelKolom(f.key, f.label));
      body = checkedRows.map((r) => visibleFieldsRef.current.map((f) => displayOf(r.id, f.key)));
    } else if (rangeRef.current) {
      const tulisan = susunBlok(rangeRef.current);
      if (!tulisan) return;
      ({ header, body } = tulisan);
    } else {
      return;
    }
    const n = checkedRows.length > 0 ? checkedRows.length : body.length;
    await tulisTSV(header, body, `${n} baris disalin (TSV, siap tempel ke Excel).`);
  }

  /** Susun header + body blok seleksi; null bila blok kosong/bukan data. */
  function susunBlok(range: GridSelection): { header: string[]; body: string[][] } | null {
    const gridValue = gridValueRef.current;
    const r0 = Math.max(0, Math.min(range.min.row, range.max.row));
    const r1 = Math.min(gridValue.length - 1, Math.max(range.min.row, range.max.row));
    const keys = gridColumnKeys();
    const picked: { key: string; label: string }[] = [];
    for (let c = Math.min(range.min.col, range.max.col); c <= Math.max(range.min.col, range.max.col); c++) {
      const k = keys[c];
      if (!k || k === 'check' || k === '__aksi') continue;
      const f = visibleFieldsRef.current.find((v) => v.key === k);
      if (f) picked.push({ key: f.key, label: labelKolom(f.key, f.label) });
    }
    if (r1 < r0 || picked.length === 0) return null;
    const body: string[][] = [];
    for (let r = r0; r <= r1; r++) {
      const g = gridValue[r];
      if (!g) continue;
      body.push(picked.map((p) => displayOf(g.id, p.key)));
    }
    if (body.length === 0) return null;
    return { header: picked.map((p) => p.label), body };
  }

  /** Pratinjau sinkron teks yang akan disalin (tanpa efek samping):
   *  TSV baris tercentang / blok seleksi, atau satu nilai sel tunggal.
   *  Null bila tak ada yang bisa disalin — dipakai agar handler Ctrl/Cmd+C
   *  desktop bisa menulis clipboardData sinkron sebelum tulis async plugin. */
  function teksSalinan(): string | null {
    const rows = rowsRef.current;
    const checkedIds = checkedIdsRef.current;
    const checkedRows = rows.filter((r) => checkedIds.has(r.id));
    if (checkedRows.length > 0) {
      const header = visibleFieldsRef.current.map((f) => labelKolom(f.key, f.label));
      const body = checkedRows.map((r) => visibleFieldsRef.current.map((f) => displayOf(r.id, f.key)));
      return toTSV(header, body);
    }
    const range = rangeRef.current;
    if (!range) return null;
    const tulisan = susunBlok(range);
    if (!tulisan) return null;
    const tunggal = range.min.col === range.max.col && range.min.row === range.max.row;
    if (tunggal) return tulisan.body[0]?.[0] ?? '';
    return toTSV(tulisan.header, tulisan.body);
  }

  /** Salin fisik untuk intersepsi Ctrl/Cmd+C desktop: clipboard ditulis via
   *  plugin (bukan clipboardData webview yang tak andal). Semantik = DSG:
   *  baris tercentang / blok multi-sel sebagai TSV, sel tunggal tanpa
   *  header. True = tertulis (pemanggil wajib preventDefault). */
  async function salinFisik(): Promise<boolean> {
    const teks = teksSalinan();
    if (teks == null) return false;
    const rows = rowsRef.current;
    const checkedIds = checkedIdsRef.current;
    const checkedRows = rows.filter((r) => checkedIds.has(r.id));
    if (checkedRows.length > 0) {
      const header = visibleFieldsRef.current.map((f) => labelKolom(f.key, f.label));
      const body = checkedRows.map((r) => visibleFieldsRef.current.map((f) => displayOf(r.id, f.key)));
      return tulisTSV(header, body, `${checkedRows.length} baris disalin (TSV, siap tempel ke Excel).`);
    }
    const range = rangeRef.current;
    const tulisan = range ? susunBlok(range) : null;
    if (!tulisan || !range) return false;
    const tunggal = range.min.col === range.max.col && range.min.row === range.max.row;
    if (tunggal) {
      const ok = await copyText(teks);
      if (ok) toast.success('Nilai sel disalin.');
      else toast.error('Gagal menyalin.');
      return ok;
    }
    return tulisTSV(tulisan.header, tulisan.body, `${tulisan.body.length} baris disalin (TSV, siap tempel ke Excel).`);
  }

  return {
    gridColumnKeys,
    selectedColumnKeys,
    displayOf,
    salinBarisCtx,
    salinSelCtx,
    salinKolomCtx,
    onCopy,
    salinFisik,
    teksSalinan,
  };
}
