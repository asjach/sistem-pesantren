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
  /** Label info halaman di zona tengah (baris 1; mis. konteks filter aktif).
   *  Baris 2 = info seleksi (otomatis, hanya saat ada centang). Zona tengah
   *  disembunyikan total bila keduanya kosong. */
  tengah?: ReactNode;
  checkedCount: number;
  checkedRows: T[];
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  clearSelection: () => void;
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
  presetUrutDiHeader?: boolean;
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

/** Bilah kontrol tabel 5 zona: kiri 1 filter halaman, kiri 2 bulk + kustom,
 *  tengah info (label halaman + seleksi), kanan 1 urut + kolom, kanan 2
 *  kustom + tombol aksi halaman. Sisi kiri/kanan berbagi sisa ruang sama
 *  besar sehingga info selalu di tengah. */
export default function ToolbarTabel<T extends { id: string | number }>({
  tableKey,
  showToolbar,
  hidePreset,
  awalanToolbar,
  akhirToolbar,
  addButton,
  filter,
  hasFilter,
  tengah,
  checkedCount,
  checkedRows,
  renderBulkActions,
  clearSelection,
  onUrut,
  presetUrutDiHeader = false,
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
  const adaInfoHalaman = tengah !== undefined && tengah !== null;
  const adaInfoSeleksi = checkedCount > 0;
  const tengahTampil = infoTampil && (adaInfoHalaman || adaInfoSeleksi);
  const urutTampil = visToolbar.urut && !!onUrut && !presetUrutDiHeader;
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

      {/* Kiri 2: bulk action + kontrol kustom halaman. */}
      <div className="flex flex-nowrap items-end gap-1.5 [&>*]:shrink-0">
        {checkedRows.length > 0 && renderBulkActions ? (
          <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">
            {renderBulkActions(checkedRows, clearSelection)}
          </div>
        ) : null}
        {awalanToolbar}
      </div>
      </div>

      {/* Tengah: pil info 2 baris (halaman + seleksi); sembunyi total bila kosong. */}
      {tengahTampil && (
        <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-full border bg-muted/60 px-4 py-1 text-center">
          {adaInfoHalaman ? (
            <span className="max-w-[32rem] truncate text-[11px] text-muted-foreground">{tengah}</span>
          ) : null}
          {adaInfoSeleksi ? (
            <span id={`grid_info_${tableKey}`} className="flex max-w-[32rem] items-center gap-1.5 truncate text-[11px] font-medium text-primary">
              <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
              {checkedCount} baris dipilih
            </span>
          ) : null}
        </div>
      )}

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
