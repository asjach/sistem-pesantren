import { useId, useState, type ComponentProps } from 'react';
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
      /* Sementara: biru = toolbar; hapus setelah identifikasi visual. */
      className="flex h-8 shrink-0 items-center border-b border-sky-600 bg-sky-500/25 pl-2 pr-0"
    >
      <div className="min-w-0 truncate text-xs font-medium">{judul}</div>

      <Pemisah />

      <div
        data-slot="excel-table-actions"
        /* Sementara: rose = area aksi; hapus setelah identifikasi visual. */
        className="flex h-full min-w-0 flex-1 items-center border border-rose-600 bg-rose-500/25"
      />

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
        <ChevronDown size={14} />
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
        /* Sementara: violet = area filter; hapus setelah identifikasi visual. */
        className="absolute inset-x-0 top-8 z-50 flex h-8 items-center gap-2 overflow-x-auto border border-violet-600 bg-violet-500/25 px-2"
      >
        <div
          data-slot="excel-table-filter-left"
          /* Sementara: cyan = subzona kiri; hapus setelah identifikasi visual. */
          className="h-full min-w-0 flex-1 border border-cyan-600 bg-cyan-500/20"
        />

        <div
          data-slot="excel-table-filter-right"
          /* Sementara: fuchsia = subzona kanan; hapus setelah identifikasi visual. */
          className="flex h-full shrink-0 items-center gap-2 border border-fuchsia-600 bg-fuchsia-500/20 px-2"
        >
          <PresetUrut
            tableKey={tableKey}
            urutAktif={urutAktif}
            arahUrut={arahUrut}
            onUrut={onUrut}
            wrapperClassName="flex-row items-center gap-1.5"
          />
          <PresetKolom
            tableKey={tableKey}
            fields={fields}
            onApply={onApplyPreset}
            wrapperClassName="flex-row items-center gap-1.5"
          />
        </div>
      </div>
    )}
    </>
  );
}
