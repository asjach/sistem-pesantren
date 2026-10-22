/**
 * Stub jsdom untuk react-datasheet-grid: DSG asli merender kolom dengan lebar
 * inline berbasis pengukuran DOM nyata; di jsdom semua lebar 0 sehingga perekaman
 * widthCache mengunci 0 dan grid tidak stabil. Stub merender struktur minimal
 * (header + sel isi) memakai komponen kolom yang disuntik ExcelTable, sehingga
 * CellProps (component/columnData) tetap ikut teruji. Kolom beku kanan
 * (stickyRightColumn, dipakai kolom Aksi) ikut dirender. Baris data meniru
 * struktur DSG untuk konteks menu: kelas `dsg-row`, `style.top` ber-padding
 * tinggi header, dan sel gutter `.dsg-cell-gutter` bernomor baris.
 */
import { forwardRef } from 'react';
import type { Column } from 'react-datasheet-grid';

/** Tipe kolom yang diterima stub; `Column` DSG dipakai bila tersedia, tetapi
 *  tes yang men-mock modul DSG membuat tipenya kosong — bentuk lokal ini
 *  menjaga properti yang stub memang baca tetap terdeklarasi. */
type KolomMasuk = Partial<Column<GridRow, unknown>> & KolomStub;

import { cn } from '@/lib/utils';
import type { GridRow, GridSelection } from './types';

/** Props yang dipakai stub dari Column DSG. Diekspor supaya berkas tes yang
 *  men-mock modul DSG tetap bisa memeriksa properti kolom tanpa bergantung
 *  pada tipe modul yang di-mock (yang jadi kosong saat di-mock). */
export interface KolomStub {
  id?: string;
  key?: string;
  /** Lebar basis kolom yang dipakai DSG (px). */
  basis?: number;
  title?: React.ReactNode;
  component?: (props: {
    rowData: GridRow;
    columnData: unknown;
    disabled?: boolean;
  }) => React.ReactNode;
  /** DSG asli menerima boolean ATAU fungsi per baris; stub wajib
   *  mengevaluasinya sebelum diteruskan ke sel. */
  disabled?: boolean | ((opts: { rowData: GridRow }) => boolean);
  columnData?: unknown;
}

/** Render satu sel: komponen kolom (isi baris) atau judul (baris header).
 *  Sel header diberi `dsg-cell-header` seperti DSG asli supaya deteksi area
 *  klik kanan (header vs baris) ikut teruji. */
function renderKolom(kolom: KolomStub, row: GridRow | null) {
  const Comp = kolom.component;
  const header = row == null;
  const disabled = row != null
    ? (typeof kolom.disabled === 'function' ? kolom.disabled({ rowData: row }) : kolom.disabled)
    : undefined;
  const isi = Comp && row != null
    ? <Comp rowData={row} columnData={kolom.columnData} disabled={disabled} />
    : kolom.title;
  return <div className={cn('dsg-cell', header && 'dsg-cell-header')}>{isi}</div>;
}

/** Jembatan untuk tes: stub tak merender grid interaktif, jadi callback sel
 *  aktif DSG dititipkan di sini agar tes bisa meniru klik baris. */
export const dsgStub = {
  aktifSel: null as ((opts: { cell: { row: number; col: number } | null }) => void) | null,
  seleksi: null as ((opts: { selection: GridSelection | null }) => void) | null,
  tinggi: null as number | null,
  tinggiBaris: null as number | ((opts: { rowData: GridRow }) => number) | null,
  tinggiHeader: null as number | null,
};

/** Kolom (termasuk sticky kanan) dari render terakhir. Dipakai tes lebar kolom
 *  untuk memeriksa `basis` yang benar-benar diterima DSG. */
export const dsgKolom: KolomStub[] = [];

/** Salinan kolom render terakhir, aman dibaca setelah render. */
export function kolomTerakhir(): KolomStub[] {
  return [...dsgKolom];
}

/** ExcelTable memberi ref ke DSG (DataSheetGridRef) — stub terima dan abaikan. */
export const DynamicDataSheetGridStub = forwardRef(function DynamicDataSheetGridStub(
  {
    columns,
    value,
    rowClassName,
    stickyRightColumn,
    height,
    rowHeight,
    headerRowHeight,
    onActiveCellChange,
    onSelectionChange,
  }: {
    columns: Column<GridRow>[];
    value: GridRow[];
    rowClassName?: (args: { rowIndex: number }) => string | undefined;
    stickyRightColumn?: Column<GridRow>;
    height?: number;
    rowHeight?: number | ((opts: { rowData: GridRow }) => number);
    headerRowHeight?: number;
    onActiveCellChange?: (opts: { cell: { row: number } | null }) => void;
    onSelectionChange?: (opts: { selection: GridSelection | null }) => void;
  },
  _ref,
) {
  dsgStub.aktifSel = onActiveCellChange ?? null;
  dsgStub.seleksi = onSelectionChange ?? null;
  dsgStub.tinggi = height ?? null;
  dsgStub.tinggiBaris = rowHeight ?? null;
  dsgStub.tinggiHeader = headerRowHeight ?? null;
  const semua: KolomStub[] = [
    ...(columns as KolomMasuk[]),
    ...(stickyRightColumn ? [stickyRightColumn as KolomMasuk] : []),
  ];
  dsgKolom.length = 0;
  dsgKolom.push(...semua);
  const hBaris = typeof rowHeight === 'number' ? rowHeight : 0;
  const hHeader = typeof headerRowHeight === 'number' ? headerRowHeight : 0;
  return (
    <div className="dsg">

      <div className="dsg-row dsg-row-header">
        <div className="dsg-cell dsg-cell-gutter dsg-cell-header" />
        {semua.map((k, i) => (
          <div key={`h${i}`}>{renderKolom(k, null)}</div>
        ))}
      </div>

      {value.map((row, i) => (
        <div
          key={String(row.id)}
          className={cn('dsg-row', rowClassName?.({ rowIndex: i }))}
          style={{ top: hHeader + i * hBaris }}
        >
          <div className="dsg-cell dsg-cell-gutter">{i + 1}</div>
          {semua.map((k, j) => (
            <div key={String(j)}>{renderKolom(k, row)}</div>
          ))}
        </div>
      ))}
    </div>
  );
});
