import { useState } from 'react';
import type { PresetTabel } from '../../api/preset';
import { useAuth } from '@/auth/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  onPilihPreset: TabKolomProps['onPilihPreset'];
  onTersimpan: TabKolomProps['onTersimpan'];
  onPakaiLengkap: TabKolomProps['onPakaiLengkap'];
  onDihapus: TabKolomProps['onDihapus'];
}

const TAB_META: { kunci: TabKelola; label: string; ket: string; superSaja?: boolean }[] = [
  { kunci: 'kolom', label: 'Kolom', ket: 'Preset kolom tampil untuk tabel ini (global, semua lembaga).' },
  { kunci: 'urutan', label: 'Urutan', ket: 'Opsi dropdown Urutkan (global, semua lembaga).' },
  { kunci: 'kontrol', label: 'Kontrol', ket: 'Kontrol toolbar yang tampil (global, super_admin).', superSaja: true },
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
  onPilihPreset,
  onTersimpan,
  onPakaiLengkap,
  onDihapus,
}: DialogKelolaTabelProps) {
  const { user } = useAuth();
  const superAdmin = (user?.roles ?? []).some((r) => r.name === 'super_admin');
  // Tab Kontrol = pengaturan global super_admin (seluruh dialog ini pun hanya
  // dibuka super_admin; lapis pertahanan kedua).
  const tabs = TAB_META.filter((t) => !t.superSaja || superAdmin);
  const [tab, setTab] = useState<TabKelola>(tabs.some((t) => t.kunci === tabAwal) ? tabAwal : 'kolom');
  const meta = tabs.find((t) => t.kunci === tab) ?? tabs[0];
  const tutup = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[70dvh] sm:max-w-2xl',
          banyakKolom && 'lg:h-[70dvh] lg:max-w-4xl lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden',
        )}
      >
        <DialogHeader>
          <DialogTitle>Kelola tabel</DialogTitle>
          <DialogDescription>{meta.ket}</DialogDescription>
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
