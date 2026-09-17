import type { MutableRefObject, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import FilterField from '@/components/FilterField';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import { Search } from '@/icons';
import { cn } from '@/lib/utils';
import type { ExcelField } from './types';

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
  buttonId: string;
  hasSearchInput: boolean;
  hasFilter: boolean;
  showSearchButton: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
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
}

/** Bilah kontrol tabel: cari + filter (kiri), info seleksi/bulk, lalu kontrol
 *  kanan (Urutkan dari Preset Urut, Preset kolom, aksi utama halaman). */
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
  buttonId,
  hasSearchInput,
  hasFilter,
  showSearchButton,
  searchValue,
  onSearchChange,
  onSearchSubmit,
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
}: ToolbarTabelProps<T>) {
  return (
    <div
      data-part="toolbar_tabel"
      className={cn('flex flex-wrap items-end gap-2', showToolbar || addButton || !hidePreset ? 'mb-3' : 'mb-0')}
    >
      {awalanToolbar}
      {(hasSearchInput || hasFilter || onUrut) && (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit?.();
          }}
          className="flex flex-wrap items-end gap-1.5"
        >
          {hasSearchInput && (
            <FilterField label="Cari" htmlFor={inputId}>
              <Input
                id={inputId}
                aria-label="Cari"
                placeholder={searchPlaceholder ?? 'Cari'}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-44 sm:w-48"
              />
            </FilterField>
          )}
          {showSearchButton && (
            <Button id={buttonId} type="submit" size="icon-sm" variant="outline" title="Cari" aria-label="Cari">
              <Search size={16} />
            </Button>
          )}
          {hasFilter && (hasSearchInput || showSearchButton) && (
            <Separator orientation="vertical" className="h-4 self-center" />
          )}
          {filter}
        </form>
      )}
      <span
        id={`grid_info_${tableKey}`}
        className={`text-xs text-muted-foreground${checkedCount > 0 ? '' : ' hidden'}`}
      >
        {checkedCount} baris dipilih
      </span>
      {checkedRows.length > 0 && renderBulkActions ? (
        <div className="flex flex-wrap items-center gap-1.5">{renderBulkActions(checkedRows, clearSelection)}</div>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Urutan tabel: dropdown dari Preset Urut (DB, per tabel) + tombol
            arah. Kelola opsi lewat item "Kelola urutan…" di dropdown. */}
        {onUrut && (
          <PresetUrut tableKey={tableKey} urutAktif={urutAktif} arahUrut={arahUrut} onUrut={onUrut} />
        )}
        {/* Preset kolom tampilan (tersimpan di DB per lembaga) — tanpa pembungkus
            kotak agar tampil polos seperti kontrol lain. Kontrol tabel umum
            (mode edit/input, salin, autofit, reset) pindah ke ribbon tab "Tabel"
            agar tak memakan ruang toolbar. */}
        {!hidePreset && (
          <PresetKolom tableKey={tableKey} fields={fields} onApply={terapkanPreset} apiRef={presetApiRef} />
        )}

        {/* Tombol aksi utama halaman, sejajar dengan kontrol tabel. */}
        {addButton && <div className="flex items-center gap-2">{addButton}</div>}
        {akhirToolbar}
      </div>
    </div>
  );
}
