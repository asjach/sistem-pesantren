import type { ReactNode } from 'react';
import { bukaDariMenu } from './kelolaTabelDariMenu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import type { ArahUrut } from '@/api/urutPreset';
import { Info, NotebookTabs, Settings } from '@/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import InfoTampil from '@/components/info/InfoTampil';
import { htmlAdaIsi } from '@/components/info/sanitasiHtml';
import type { ExcelField } from './types';

interface Props {
  tableKey: string;
  /** Judul tabel (teks header bawaan atau milik halaman). */
  judul: ReactNode;
  /** Tampilkan teks judul (sakelar "Judul tabel"). Div kosongnya tetap dirender
   *  supaya pil info tengah & kontrol tak lompat ke tepi saat judul dimatikan. */
  judulTampil: boolean;
  /** HTML info tabel (sudah tersanitasi di server). `null`/kosong = tombol
   *  Info tak dirender. Dibaca semua pengguna, ditulis lewat tab Info Kelola
   *  Tabel. */
  infoTabel?: string | null;
  /** Tampilkan info tengah (dari visibilitas toolbar). */
  infoTampil: boolean;
  info: ReactNode;
  filterTampil: boolean;
  filter?: ReactNode;
  /** Aksi massal baris tercentang (sudah dirender halaman). Ditaruh tepat di
   *  sebelah kiri tombol aksi utama — dua-duanya berpasangan: "hapus yang
   *  dipilih" dan "tambah yang baru". */
  aksiMassal: ReactNode;
  awalanToolbar?: ReactNode;
  akhirToolbar?: ReactNode;
  urutTampil: boolean;
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, ArahUrut>) => void;
  kolomTampil: boolean;
  fields: ExcelField[];
  onApplyPreset: (keys: string[] | null, presetId?: number | null) => void;
  presetKolomClassName?: string;
  addButton?: ReactNode;
  /** Tampilkan blok tombol aksi utama (sakelar "Tombol aksi utama"). */
  tombolAksiTampil: boolean;
  addButtonLangsung: boolean;
  /** Tampilkan gerigi "Pengaturan tabel ini" (sakelar "Tombol Pengaturan
   *  tabel"). Dulu tombol ini ada di kaki tabel; sekarang jadi kontrol paling
   *  kanan di bilah judul. */
  tombolPengaturanTampil: boolean;
  /** Halaman ini mendaftarkan tabelnya ke registrasi — kalau tidak, dialognya
   *  tak akan terisi sehingga gerigi dinonaktifkan. */
  tabelTerdaftar: boolean;
  /** Boleh membuka dialog Kelola Tabel (super_admin efektif). */
  bolehKelola: boolean;
  onKelolaTabel: () => void;
}

/**
 * Bilah judul tabel: judul + info tengah, kontrol toolbar (filter, awalan/
 * akhir halaman, Urutkan, Kolom), aksi massal baris tercentang, tombol aksi
 * utama, gerigi pengaturan tabel di ujung kanan, dan menu klik-kanan "Kelola
 * Tabel". Id elemen dipertahankan agar halaman/tes tetap menemukannya.
 *
 * `min-h-8` (border-box, sudah termasuk `border-b` 1px) menjaga tinggi
 * bilah tetap sama walau tabel tanpa kontrol toolbar: semua kontrol
 * setinggi `h-6` (24px) tapi `py-1` + garis bawah membuat baris kontrol
 * tumbuh 1px lebih tinggi daripada baris berisi teks judul saja. Padding
 * vertikal diganti lantai tinggi agar keduanya tepat 32px.
 */
export default function JudulTabel({
  tableKey,
  judul,
  judulTampil,
  infoTabel,
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
  kolomTampil,
  fields,
  onApplyPreset,
  presetKolomClassName,
  addButton,
  tombolAksiTampil,
  addButtonLangsung,
  tombolPengaturanTampil,
  tabelTerdaftar,
  bolehKelola,
  onKelolaTabel,
}: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={!bolehKelola}>

        <div data-part="header_tabel" className="flex min-h-8 shrink-0 items-center justify-between gap-2 border-b border-border pr-1 pl-3 text-xs font-medium">
          <div className="flex min-w-0 flex-1 items-center gap-2">

            <div className="flex min-w-0 flex-1 items-center gap-1">
              <div className="min-w-0 truncate">{judulTampil ? judul : null}</div>
              {htmlAdaIsi(infoTabel) ? (

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      id={`btn_info_tabel_${tableKey}`}
                      type="button"
                      aria-label="Info tabel"
                      className="-my-1 inline-flex shrink-0 cursor-pointer items-center justify-center p-0.5 text-primary transition-colors"
                    >
                      <Info size="1em" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="max-h-[min(70vh,32rem)] w-96 max-w-[min(24rem,90vw)] overflow-y-auto p-3"
                  >
                    <InfoTampil html={infoTabel} />
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
            {infoTampil ? (
              <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-pil border bg-muted/60 px-4 py-1 text-center">
                <span className="max-w-[32rem] truncate text-[11px] text-muted-foreground">{info}</span>
              </div>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <div className="flex shrink-0 items-center justify-end gap-2">
              {filterTampil ? <div className="flex items-center gap-1.5 [&>*]:shrink-0">{filter}</div> : null}
              {awalanToolbar}
              {akhirToolbar}
              {urutTampil ? (
                <PresetUrut
                  tableKey={tableKey}
                  urutAktif={urutAktif}
                  arahUrut={arahUrut}
                  onUrut={onUrut}
                  wrapperClassName="flex-row items-center gap-1.5"
                />
              ) : null}
              {kolomTampil ? (
                <PresetKolom
                  tableKey={tableKey}
                  fields={fields}
                  onApply={onApplyPreset}
                  triggerClassName={presetKolomClassName}
                  wrapperClassName="flex-row items-center gap-1.5"
                />
              ) : null}
            </div>

            {aksiMassal ? <div className="flex shrink-0 flex-nowrap items-center gap-1.5 [&>*]:shrink-0">{aksiMassal}</div> : null}
            {tombolAksiTampil && addButton ? (
              addButtonLangsung
                ? <div className="shrink-0">{addButton}</div>
                : <div className="shrink-0"><MenuAksiToolbar triggerId={`btn_aksi_${tableKey}`}>{addButton}</MenuAksiToolbar></div>
            ) : null}

            {tombolPengaturanTampil ? (
              <div className="shrink-0">
                <Button
                  id={`btn_pengaturan_tabel_${tableKey}`}
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Pengaturan tabel ini"
                  title="Pengaturan tabel ini (kolom, urutan, filter)"
                  disabled={!tabelTerdaftar}
                  onClick={onKelolaTabel}
                >
                  <Settings size={14} />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </ContextMenuTrigger>
      {bolehKelola ? (
        <ContextMenuContent>
          <ContextMenuItem
            id={`menu_kelola_tabel_${tableKey}`}
            onSelect={onKelolaTabel ? () => bukaDariMenu(onKelolaTabel) : undefined}
          >
            <NotebookTabs data-icon="inline-start" size={16} /> Kelola Tabel
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
