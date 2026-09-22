import type { MutableRefObject, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import { X } from '@/icons';
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
  formId: string;
  inputId: string;
  hasSearchInput: boolean;
  hasFilter: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  checkedCount: number;
  checkedRows: T[];
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  clearSelection: () => void;
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  fields: ExcelField[];
  terapkanPreset: (keys: string[] | null, label?: Record<string, string> | null) => void;
  presetApiRef?: MutableRefObject<PresetKolomApi | null>;
  /** Timpa lebar trigger dropdown Kolom (bawaan `w-44` di PresetKolom). */
  presetKolomClassName?: string;
  /** Visibilitas kontrol generik (tab Kontrol dialog Kelola tabel). */
  visToolbar: VisToolbar;
  /** Lebar efektif kontrol berlebar (px) dari tab Kontrol (bawaan bila kosong). */
  lebarToolbar: LebarToolbar;
  /** Lebar kolom tersimpan di DB (undefined = pakai presetKolomClassName). */
  lebarKolomDb?: number;
}

/** Bilah kontrol tabel 5 zona: kiri 1 filter halaman, kiri 2 bulk + info +
 *  kustom, tengah search 100px tetap, kanan 1 urut + kolom, kanan 2 kustom +
 *  tombol aksi halaman. Sisi kiri/kanan berbagi sisa ruang sama besar
 *  sehingga search selalu di tengah. */
export default function ToolbarTabel<T extends { id: string | number }>({
  tableKey,
  showToolbar,
  hidePreset,
  awalanToolbar,
  akhirToolbar,
  addButton,
  filter,
  formId,
  inputId,
  hasSearchInput,
  hasFilter,
  searchValue,
  onSearchChange,
  searchPlaceholder,
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
  const cariTampil = visToolbar.cari && hasSearchInput;
  const infoTampil = visToolbar.info;
  const urutTampil = visToolbar.urut && !!onUrut;
  const kolomTampil = visToolbar.kolom && !hidePreset;
  const filterTampil = visToolbar.filter && hasFilter;
  return (
    <div
      data-part="toolbar_tabel"
      id={`toolbar_tabel_${tableKey}`}
      title="Klik kanan untuk Kelola tabel"
      onContextMenu={(e) => {
        if (!presetApiRef?.current?.bukaKelola) return;
        e.preventDefault();
        presetApiRef.current.bukaKelola('kolom');
      }}
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

      {/* Tengah: kotak cari real-time 100px tetap (tanpa tombol submit). */}
      {cariTampil && (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex shrink-0 flex-nowrap items-end gap-1.5"
        >
          <div className="relative">
            <Input
              id={inputId}
              aria-label="Cari"
              placeholder={searchPlaceholder ?? 'Cari'}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pr-7"
              style={{ width: `${lebarToolbar.cari}px` }}
            />
            {searchValue ? (
              <button
                type="button"
                id={`${inputId}_hapus`}
                title="Hapus isi pencarian"
                aria-label="Hapus isi pencarian"
                onClick={() => onSearchChange?.('')}
                className="absolute top-1/2 right-1.5 grid size-4 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        </form>
      )}

      {/* Super-zona kanan: area 1 + 2 membungkus sebagai blok bila sempit. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-x-2 gap-y-2">
      {/* Kanan 1: dropdown Urutkan + dropdown Kolom. */}
      <div className="flex flex-nowrap items-end gap-2 [&>*]:shrink-0">
        {urutTampil && (
          <PresetUrut tableKey={tableKey} urutAktif={urutAktif} arahUrut={arahUrut} onUrut={onUrut} apiRef={presetApiRef} lebarTrigger={lebarToolbar.urut} />
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
