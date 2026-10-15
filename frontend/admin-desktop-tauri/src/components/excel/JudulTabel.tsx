import type { MutableRefObject, ReactNode } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import type { ArahUrut } from '@/api/urutPreset';
import { NotebookTabs, Settings } from '@/icons';
import { Button } from '@/components/ui/button';
import type { ExcelField } from './types';

interface Props {
  tableKey: string;
  /** Judul tabel (teks header bawaan atau milik halaman). */
  judul: ReactNode;
  /** Tampilkan teks judul (sakelar "Judul tabel"). Div kosongnya tetap dirender
   *  supaya pil info tengah & kontrol tak lompat ke tepi saat judul dimatikan. */
  judulTampil: boolean;
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
  kolomTampil: boolean;
  fields: ExcelField[];
  onApplyPreset: (keys: string[] | null, presetId?: number | null) => void;
  presetApiRef: MutableRefObject<PresetKolomApi | null>;
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
 * Bilah judul tabel: judul + info tengah, kontrol toolbar (filter, aksi massal,
 * awalan/akhir halaman, Urutkan, Kolom), tombol aksi utama, gerigi pengaturan
 * tabel di ujung kanan, dan menu klik-kanan "Kelola Tabel". Id elemen
 * dipertahankan agar halaman/tes tetap menemukannya.
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
  presetApiRef,
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
        <div data-part="header_tabel" className="flex min-h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3 text-xs font-medium">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Div tetap ada walau teksnya dimatikan (sakelar "Judul tabel"):
                ia yang memberi ruang `flex-1`, jadi pil info & kontrol tak
                lompat ke tepi kiri. */}
            <div className="min-w-0 flex-1 truncate">{judulTampil ? judul : null}</div>
            {infoTampil ? (
              <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-pil border bg-muted/60 px-4 py-1 text-center">
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
                />
              ) : null}
            </div>
            {tombolAksiTampil && addButton ? (
              addButtonLangsung
                ? <div className="shrink-0">{addButton}</div>
                : <div className="shrink-0"><MenuAksiToolbar triggerId={`btn_aksi_${tableKey}`}>{addButton}</MenuAksiToolbar></div>
            ) : null}
            {/* Gerigi PALING KANAN bilah = pengaturan KHUSUS TABEL INI saja
                (kolom, urutan, filter, preset) untuk tableKey ini. Dulu ia di
                kaki tabel; sekarang di sini supaya kontrol tabel & pengaturan
                tabelnya bertemu di satu bilah. Jangan masukkan setelan global
                ke sini: pengaturan yang berlaku aplikasi/semua tabel punya
                pintunya sendiri, yaitu gerigi di TopBar — mencampur keduanya
                membuat jangkauan pilihan tak jelas.
                Nonaktif bila halaman ini tak mendaftarkan tabelnya ke
                registrasi (dialognya tak akan terisi). */}
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
            onSelect={onKelolaTabel}
          >
            <NotebookTabs data-icon="inline-start" size={16} /> Kelola Tabel
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
