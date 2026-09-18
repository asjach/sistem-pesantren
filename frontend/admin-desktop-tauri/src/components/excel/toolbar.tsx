import type { MutableRefObject, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import { Search, X } from '@/icons';
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
      className={cn('flex flex-nowrap items-end gap-2', showToolbar || addButton || !hidePreset ? 'mb-3' : 'mb-0')}
    >
      {/* Zona kiri: kontrol khusus halaman + filter. */}
      <div className="flex flex-1 flex-nowrap items-end gap-1.5 [&>*]:shrink-0">
        {awalanToolbar}
        {filter}
      </div>

      {/* Zona tengah: kotak cari. Zona kiri & kanan sama-sama `flex-1` sehingga
          kotak cari berada di tengah toolbar pada semua tabel. */}
      {(hasSearchInput || showSearchButton) && (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit?.();
          }}
          className="flex shrink-0 flex-nowrap items-end gap-1.5"
        >
          {hasSearchInput && (
            <div className="relative">
              <Input
                id={inputId}
                aria-label="Cari"
                placeholder={searchPlaceholder ?? 'Cari'}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-35 pr-7"
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
          )}
          {showSearchButton && (
            <Button id={buttonId} type="submit" size="icon-sm" variant="outline" title="Cari" aria-label="Cari">
              <Search size={16} />
            </Button>
          )}
        </form>
      )}

      {/* Zona kanan: info seleksi, bulk, kontrol tabel, aksi halaman. */}
      <div className="flex flex-1 flex-nowrap items-end justify-end gap-2 [&>*]:shrink-0">
        <span
          id={`grid_info_${tableKey}`}
          className={`text-xs text-muted-foreground${checkedCount > 0 ? '' : ' hidden'}`}
        >
          {checkedCount} baris dipilih
        </span>
        {checkedRows.length > 0 && renderBulkActions ? (
          <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">
            {renderBulkActions(checkedRows, clearSelection)}
          </div>
        ) : null}
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
