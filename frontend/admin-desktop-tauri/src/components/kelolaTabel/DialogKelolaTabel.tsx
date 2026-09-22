import { useState } from 'react';
import type { PresetTabel } from '../../api/preset';
import { useLembagaAktif } from '@/lembagaAktif';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ExcelField } from '../excel/types';
import TabKolom from './TabKolom';
import type { TabKolomProps } from './TabKolom';
import TabUrutan from './TabUrutan';
import TabKontrol from './TabKontrol';
import type { TabKelola } from './jenis';

export interface DialogKelolaTabelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: string;
  /** Tab yang dibuka pertama (induk me-remount dialog via `key` tiap dibuka). */
  tabAwal: TabKelola;
  banyakKolom: boolean;
  fields: ExcelField[];
  fieldKeys: Set<string>;
  presets: PresetTabel[];
  presetAwal: PresetTabel | null;
  /** Buka tab kolom dengan semua kolom terpilih (entri "Lengkap"). */
  mulaiLengkap: boolean;
  onPilihLengkap: () => void;
  /** Id preset bawaan tabel (null = tanpa bawaan); diubah via checkbox
   *  form TabKolom, tersimpan bersama tombol Simpan. */
  bawaanId: number | null;
  onPilihPreset: TabKolomProps['onPilihPreset'];
  onTersimpan: TabKolomProps['onTersimpan'];
  onPakaiLengkap: TabKolomProps['onPakaiLengkap'];
  onDihapus: TabKolomProps['onDihapus'];
}

const TAB_META: { kunci: TabKelola; label: string; superSaja?: boolean }[] = [
  { kunci: 'kolom', label: 'Kolom' },
  { kunci: 'urutan', label: 'Urutan' },
  { kunci: 'kontrol', label: 'Kontrol', superSaja: true },
];

/** Satu pintu kelola tampilan tabel: preset kolom, preset urutan, dan
 *  visibilitas kontrol toolbar — dipisah tab agar tak bercampur. */
export default function DialogKelolaTabel({
  open,
  onOpenChange,
  tableKey,
  tabAwal,
  banyakKolom,
  fields,
  fieldKeys,
  presets,
  presetAwal,
  mulaiLengkap,
  onPilihLengkap,
  bawaanId,
  onPilihPreset,
  onTersimpan,
  onPakaiLengkap,
  onDihapus,
}: DialogKelolaTabelProps) {
  /** Tab Kontrol = pengaturan global super_admin EFEKTIF (mati saat bertindak;
   *  seluruh dialog ini pun hanya dibuka super_admin; lapis pertahanan kedua). */
  const { efektifSuper: superAdmin } = useLembagaAktif();
  // Tab Kontrol = pengaturan global super_admin (seluruh dialog ini pun hanya
  // dibuka super_admin; lapis pertahanan kedua).
  const tabs = TAB_META.filter((t) => !t.superSaja || superAdmin);
  const [tab, setTab] = useState<TabKelola>(tabs.some((t) => t.kunci === tabAwal) ? tabAwal : 'kolom');
  const tutup = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[70dvh] sm:max-w-2xl lg:max-w-4xl',
          banyakKolom && 'lg:h-[70dvh] lg:max-w-4xl lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden',
        )}
      >
        <DialogHeader>
          <DialogTitle>Kelola tabel</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b pb-2" role="tablist" aria-label="Kelola tabel">
          {tabs.map((t) => (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              aria-selected={tab === t.kunci}
              id={`tab_kelola_${tableKey}_${t.kunci}`}
              onClick={() => setTab(t.kunci)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === t.kunci ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'kolom' && (
          <TabKolom
            tableKey={tableKey}
            fields={fields}
            fieldKeys={fieldKeys}
            presets={presets}
            banyakKolom={banyakKolom}
            presetAwal={presetAwal}
            mulaiLengkap={mulaiLengkap}
            onPilihLengkap={onPilihLengkap}
            bawaanId={bawaanId}
            onPilihPreset={onPilihPreset}
            onTersimpan={onTersimpan}
            onPakaiLengkap={onPakaiLengkap}
            onDihapus={onDihapus}
            onTutup={tutup}
          />
        )}
        {tab === 'urutan' && (
          <div className={cn('min-h-0', banyakKolom && 'lg:overflow-y-auto')}>
            <TabUrutan tableKey={tableKey} onTutup={tutup} />
          </div>
        )}
        {tab === 'kontrol' && (
          <div className={cn('min-h-0', banyakKolom && 'lg:overflow-y-auto')}>
            <TabKontrol tableKey={tableKey} onTutup={tutup} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
