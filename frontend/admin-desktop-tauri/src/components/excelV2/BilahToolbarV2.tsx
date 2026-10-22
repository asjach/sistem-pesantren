import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import { ChevronDown, MoreVertical } from '@/icons';

function Pemisah() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />;
}

interface Props {
  judul: string;
  tableKey: ComponentProps<typeof PresetUrut>['tableKey'];
  fields: ComponentProps<typeof PresetKolom>['fields'];
  /** Tombol aksi halaman (mis. Tambah) di area aksi. */
  aksi?: ReactNode;
  /** Isi subzona kiri area filter (mis. dropdown status). */
  filter?: ReactNode;
  /** Tabel ringkas baca-saja: sembunyikan pemilih preset kolom. */
  hidePreset?: boolean;
  urutAktif?: ComponentProps<typeof PresetUrut>['urutAktif'];
  arahUrut?: ComponentProps<typeof PresetUrut>['arahUrut'];
  onUrut?: ComponentProps<typeof PresetUrut>['onUrut'];
  onApplyPreset: ComponentProps<typeof PresetKolom>['onApply'];
}

/** Toolbar ExcelTabelV2: judul, area aksi, area filter, dan trigger menu. */
export default function BilahToolbarV2({
  judul,
  tableKey,
  fields,
  aksi,
  filter,
  hidePreset = false,
  urutAktif,
  arahUrut,
  onUrut,
  onApplyPreset,
}: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const idAreaFilter = useId();

  return (
    <>
      <div
        data-slot="excel-table-toolbar"
        className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 pl-2 pr-0"
      >
        <div className="min-w-0 shrink-0 truncate text-xs font-semibold">{judul}</div>

        <div className="min-w-0 flex-1" />

        <div
          data-slot="excel-table-actions"
          className="flex h-full min-w-0 shrink-0 items-center gap-1 overflow-hidden"
        >
          {aksi}
        </div>

        <Pemisah />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-trigger="excel-table-filter"
          aria-label="Area filter"
          aria-expanded={terbuka}
          aria-controls={idAreaFilter}
          title="Area filter"
          className="!h-full !w-6"
          onClick={() => setTerbuka((buka) => !buka)}
        >
          <ChevronDown
            size={14}
            className={terbuka ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </Button>

        <Pemisah />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-trigger="excel-table-menu"
          aria-label="Menu lainnya"
          title="Menu lainnya"
          className="!h-full !w-6"
        >
          <MoreVertical size={14} />
        </Button>
      </div>

      {terbuka && (
        <div
          id={idAreaFilter}
          data-slot="excel-table-filter-area"
          className="absolute inset-x-0 top-8 z-50 flex h-8 items-center gap-2 overflow-x-auto border-b border-border bg-popover px-2 shadow-sm"
        >
          <div
            data-slot="excel-table-filter-left"
            className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden"
          >
            {!hidePreset && (
              <PresetKolom
                tableKey={tableKey}
                fields={fields}
                onApply={onApplyPreset}
                wrapperClassName="flex-row items-center gap-1.5"
              />
            )}
            <PresetUrut
              tableKey={tableKey}
              urutAktif={urutAktif}
              arahUrut={arahUrut}
              onUrut={onUrut}
              wrapperClassName="flex-row items-center gap-1.5"
            />
            {filter}
          </div>
        </div>
      )}
    </>
  );
}
