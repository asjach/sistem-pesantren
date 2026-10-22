import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import InfoTampil from '@/components/info/InfoTampil';
import { htmlAdaIsi } from '@/components/info/sanitasiHtml';
import { ChevronDown, Info } from '@/icons';

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
  /** Visibilitas komponen dari setelan tabel. */
  tampilJudul?: boolean;
  tampilUrut?: boolean;
  tampilKolom?: boolean;
  /** HTML info tabel (sudah tersanitasi); kosong = tanpa tombol Info. */
  infoHtml?: string | null;
  /** Gerigi Pengaturan tabel (dirakit ExcelTabelV2). */
  pengaturan?: ReactNode;
  /** Trigger menu pengaturan tabel (MenuPengaturanV2). */
  menu?: ReactNode;
  urutAktif?: ComponentProps<typeof PresetUrut>['urutAktif'];
  arahUrut?: ComponentProps<typeof PresetUrut>['arahUrut'];
  onUrut?: ComponentProps<typeof PresetUrut>['onUrut'];
  onApplyPreset: ComponentProps<typeof PresetKolom>['onApply'];
}

/** Toolbar ExcelTabelV2: judul + info, area aksi, pengaturan cepat, filter,
 *  dan menu pengaturan tabel. */
export default function BilahToolbarV2({
  judul,
  tableKey,
  fields,
  aksi,
  filter,
  hidePreset = false,
  tampilJudul = true,
  tampilUrut = true,
  tampilKolom = true,
  infoHtml = null,
  pengaturan,
  menu,
  urutAktif,
  arahUrut,
  onUrut,
  onApplyPreset,
}: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const idAreaFilter = useId();

  const kolomTampil = !hidePreset && tampilKolom;
  const areaFilterAda = kolomTampil || tampilUrut || filter != null;

  return (
    <>
      <div
        data-slot="excel-table-toolbar"
        className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 pl-2 pr-0"
      >
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          {tampilJudul && (
            <div className="min-w-0 truncate text-xs font-semibold">{judul}</div>
          )}
          {htmlAdaIsi(infoHtml) && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id={`btn_info_tabel_${tableKey}`}
                  aria-label="Info tabel"
                  title="Info tabel"
                  className="-my-1 inline-flex shrink-0 cursor-pointer items-center justify-center p-0.5 text-primary transition-colors"
                >
                  <Info size="1em" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[min(70vh,32rem)] w-96 max-w-[min(24rem,90vw)] overflow-y-auto p-3"
              >
                <InfoTampil html={infoHtml ?? ''} />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="min-w-0 flex-1" />

        {aksi != null && (
          <div
            data-slot="excel-table-actions"
            className="flex h-full min-w-0 shrink-0 items-center gap-1 overflow-hidden"
          >
            {aksi}
          </div>
        )}

        {(pengaturan != null || areaFilterAda) && <Pemisah />}
        {pengaturan}

        {areaFilterAda && (
          <>
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
          </>
        )}

        {menu != null && (
          <>
            <Pemisah />
            {menu}
          </>
        )}
      </div>

      {terbuka && areaFilterAda && (
        <div
          id={idAreaFilter}
          data-slot="excel-table-filter-area"
          className="absolute inset-x-0 top-8 z-50 flex h-8 items-center gap-2 overflow-x-auto border-b border-border bg-popover px-2 shadow-sm"
        >
          <div
            data-slot="excel-table-filter-left"
            className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden"
          >
            {kolomTampil && (
              <PresetKolom
                tableKey={tableKey}
                fields={fields}
                onApply={onApplyPreset}
                wrapperClassName="flex-row items-center gap-1.5"
              />
            )}
            {tampilUrut && (
              <PresetUrut
                tableKey={tableKey}
                urutAktif={urutAktif}
                arahUrut={arahUrut}
                onUrut={onUrut}
                wrapperClassName="flex-row items-center gap-1.5"
              />
            )}
            {filter}
          </div>
        </div>
      )}
    </>
  );
}
