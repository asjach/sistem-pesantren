import type { MutableRefObject, ReactNode } from 'react';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import { cn } from '@/lib/utils';
import type { ExcelField } from './types';
import type { VisToolbar, LebarToolbar } from '@/components/kelolaTabel/jenis';

export interface ToolbarTabelProps<T extends { id: string | number }> {
  tableKey: string;
  showToolbar: boolean;
  hidePreset: boolean;
  awalanToolbar?: ReactNode;
  akhirToolbar?: ReactNode;
  addButton?: ReactNode;
  filter?: ReactNode;
  hasFilter: boolean;
  checkedCount: number;
  checkedRows: T[];
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  clearSelection: () => void;
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  fields: ExcelField[];
  terapkanPreset: (keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => void;
  presetApiRef?: MutableRefObject<PresetKolomApi | null>;
  /** Timpa lebar trigger dropdown Kolom (bawaan `w-44` di PresetKolom). */
  presetKolomClassName?: string;
  /** Visibilitas kontrol generik (tab Toolbar dialog Kelola Halaman). */
  visToolbar: VisToolbar;
  /** Lebar efektif kontrol berlebar (px) dari tab Kontrol (bawaan bila kosong). */
  lebarToolbar: LebarToolbar;
  /** Lebar kolom tersimpan di DB (undefined = pakai presetKolomClassName). */
  lebarKolomDb?: number;
}

/** Bilah kontrol tabel 4 zona: kiri 1 filter halaman, kiri 2 bulk + info +
 *  kustom, kanan 1 urut + kolom, kanan 2 kustom + tombol aksi halaman. */
export default function ToolbarTabel<T extends { id: string | number }>({
  tableKey,
  showToolbar,
  hidePreset,
  awalanToolbar,
  akhirToolbar,
  addButton,
  filter,
  hasFilter,
  checkedCount,
  checkedRows,
  renderBulkActions,
  clearSelection,
  onUrut,
  urutAktif,
  arahUrut,
  fields,
  terapkanPreset,
  presetApiRef,
  presetKolomClassName,
  visToolbar,
  lebarToolbar,
  lebarKolomDb,
}: ToolbarTabelProps<T>) {
  const infoTampil = visToolbar.info;
  const urutTampil = visToolbar.urut && !!onUrut;
  const kolomTampil = visToolbar.kolom && !hidePreset;
  const filterTampil = visToolbar.filter && hasFilter;
  return (
    <div
      data-part="toolbar_tabel"
      id={`toolbar_tabel_${tableKey}`}
      className={cn('flex flex-wrap items-end gap-x-2 gap-y-2', showToolbar || addButton || !hidePreset ? 'mb-3' : 'mb-0')}
    >
      {/* Super-zona kiri: area 1 + 2 membungkus sebagai blok bila sempit. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-2">
      {/* Kiri 1: kelompok filter halaman. */}
      <div className="flex flex-nowrap items-end gap-1.5 [&>*]:shrink-0">
        {filterTampil && filter}
      </div>

      {/* Kiri 2: bulk action + info seleksi + kontrol kustom halaman. */}
      <div className="flex flex-nowrap items-end gap-1.5 [&>*]:shrink-0">
        {checkedRows.length > 0 && renderBulkActions ? (
          <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">
            {renderBulkActions(checkedRows, clearSelection)}
          </div>
        ) : null}
        {infoTampil && (
        <span
          id={`grid_info_${tableKey}`}
          className={`text-xs text-muted-foreground${checkedCount > 0 ? '' : ' hidden'}`}
        >
          {checkedCount} baris dipilih
        </span>
        )}
        {awalanToolbar}
      </div>
      </div>

      {/* Super-zona kanan: area 1 + 2 membungkus sebagai blok bila sempit. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-x-2 gap-y-2">
      {/* Kanan 1: dropdown Urutkan + dropdown Kolom. */}
      <div className="flex flex-nowrap items-end gap-2 [&>*]:shrink-0">
        {urutTampil && (
          <PresetUrut tableKey={tableKey} urutAktif={urutAktif} arahUrut={arahUrut} onUrut={onUrut} lebarTrigger={lebarToolbar.urut} />
        )}
        {/* Preset kolom tampilan (tersimpan di DB per lembaga) — tanpa pembungkus
            kotak agar tampil polos seperti kontrol lain. Kontrol tabel umum
            (mode edit/input, salin, autofit, reset) pindah ke ribbon tab "Tabel"
            agar tak memakan ruang toolbar. */}
        {kolomTampil && (
          <PresetKolom tableKey={tableKey} fields={fields} onApply={terapkanPreset} apiRef={presetApiRef} triggerClassName={presetKolomClassName} lebarTrigger={lebarKolomDb} />
        )}
      </div>

      {/* Kanan 2: kontrol kustom + tombol aksi utama halaman. */}
      <div className="flex flex-nowrap items-end justify-end gap-2 [&>*]:shrink-0">
        {akhirToolbar}
        {/* Tombol aksi utama halaman, diringkas jadi menu dropdown. */}
        {addButton && <MenuAksiToolbar triggerId={`btn_aksi_${tableKey}`}>{addButton}</MenuAksiToolbar>}
      </div>
      </div>
    </div>
  );
}
