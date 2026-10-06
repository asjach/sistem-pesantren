import type { MutableRefObject, ReactNode } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import type { ArahUrut } from '@/api/urutPreset';
import { NotebookTabs } from '@/icons';
import type { ExcelField } from './types';

interface Props {
  tableKey: string;
  /** Judul tabel (teks header bawaan atau milik halaman). */
  judul: ReactNode;
  /** Tampilkan info tengah (dari visibilitas toolbar). */
  infoTampil: boolean;
  info: ReactNode;
  filterTampil: boolean;
  filter?: ReactNode;
  /** Aksi massal baris tercentang (sudah dirender halaman). */
  aksiMassal: ReactNode;
  awalanToolbar?: ReactNode;
  akhirToolbar?: ReactNode;
  urutTampil: boolean;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, ArahUrut>) => void;
  /** Lebar trigger dropdown Urutkan (px) dari tab Kontrol. */
  lebarUrut?: number;
  kolomTampil: boolean;
  fields: ExcelField[];
  onApplyPreset: (keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => void;
  presetApiRef: MutableRefObject<PresetKolomApi | null>;
  presetKolomClassName?: string;
  /** Lebar trigger dropdown Kolom (px); menang atas kelas halaman. */
  lebarKolom?: number;
  addButton?: ReactNode;
  addButtonLangsung: boolean;
  /** Boleh membuka dialog Kelola Tabel (super_admin efektif). */
  bolehKelola: boolean;
  onKelolaTabel: () => void;
}

/**
 * Bilah judul tabel: judul + info tengah, kontrol toolbar (filter, aksi massal,
 * awalan/akhir halaman, Urutkan, Kolom), tombol aksi utama, dan menu klik-kanan
 * "Kelola Tabel". Id elemen dipertahankan agar halaman/tes tetap menemukannya.
 */
export default function JudulTabel({
  tableKey,
  judul,
  infoTampil,
  info,
  filterTampil,
  filter,
  aksiMassal,
  awalanToolbar,
  akhirToolbar,
  urutTampil,
  urutAktif,
  arahUrut,
  onUrut,
  lebarUrut,
  kolomTampil,
  fields,
  onApplyPreset,
  presetApiRef,
  presetKolomClassName,
  lebarKolom,
  addButton,
  addButtonLangsung,
  bolehKelola,
  onKelolaTabel,
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!bolehKelola}>
        <div data-part="header_tabel" className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--warna-border-ribbon)] bg-muted/40 px-3 py-1 text-xs font-medium">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1 truncate">{judul}</div>
            {infoTampil ? (
              <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-full border bg-muted/60 px-4 py-1 text-center">
                <span className="max-w-[32rem] truncate text-[11px] text-muted-foreground">{info}</span>
              </div>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <div className="flex shrink-0 items-center justify-end gap-2">
              {filterTampil ? <div className="flex items-center gap-1.5 [&>*]:shrink-0">{filter}</div> : null}
              {aksiMassal ? <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">{aksiMassal}</div> : null}
              {awalanToolbar}
              {akhirToolbar}
              {urutTampil ? (
                <PresetUrut
                  tableKey={tableKey}
                  urutAktif={urutAktif}
                  arahUrut={arahUrut}
                  onUrut={onUrut}
                  wrapperClassName="flex-row items-center gap-1.5"
                  lebarTrigger={lebarUrut}
                />
              ) : null}
              {kolomTampil ? (
                <PresetKolom
                  tableKey={tableKey}
                  fields={fields}
                  onApply={onApplyPreset}
                  apiRef={presetApiRef}
                  triggerClassName={presetKolomClassName}
                  wrapperClassName="flex-row items-center gap-1.5"
                  lebarTrigger={lebarKolom}
                />
              ) : null}
            </div>
            {addButton ? (
              addButtonLangsung
                ? <div className="shrink-0">{addButton}</div>
                : <div className="shrink-0"><MenuAksiToolbar triggerId={`btn_aksi_${tableKey}`}>{addButton}</MenuAksiToolbar></div>
            ) : null}
          </div>
        </div>
      </ContextMenuTrigger>
      {bolehKelola ? (
        <ContextMenuContent>
          <ContextMenuItem
            id={`menu_kelola_tabel_${tableKey}`}
            onSelect={onKelolaTabel}
          >
            <NotebookTabs data-icon="inline-start" size={16} /> Kelola Tabel
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
