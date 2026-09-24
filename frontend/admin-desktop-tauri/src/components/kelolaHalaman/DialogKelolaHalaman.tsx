import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  listPresetTabel,
  setPresetAktif,
  type PresetTabel,
} from '@/api/preset';
import { useStandarTampilan } from '../../standarTampilan';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';
import TabKolom from '../kelolaTabel/TabKolom';
import TabUrutan from '../kelolaTabel/TabUrutan';
import TabKontrol from '../kelolaTabel/TabKontrol';
import { EVENT_PRESET_BERUBAH } from '../kelolaTabel/jenis';
import TabFilterHalaman from './TabFilterHalaman';
import type { KunciFilterGlobal, TabelHalaman } from '../VisibilitasFilter';

/** Tab dialog Kelola Halaman. */
export type TabHalaman = 'filter' | 'kolom' | 'urutan' | 'kontrol';

const TAB_META: { kunci: TabHalaman; label: string }[] = [
  { kunci: 'filter', label: 'Filter' },
  { kunci: 'kolom', label: 'Kolom' },
  { kunci: 'urutan', label: 'Urutan' },
  { kunci: 'kontrol', label: 'Toolbar' },
];

/** Kabari grid tabel terkait agar memuat ulang preset kolomnya. */
function kabariPreset(tableKey: string, lengkap?: { keys: string[]; label: Record<string, string> }) {
  window.dispatchEvent(new CustomEvent(EVENT_PRESET_BERUBAH, { detail: lengkap ? { tableKey, lengkap } : { tableKey } }));
}

/** Isi tab Kolom untuk satu tabel: lem preset kolom (cermin logika
 *  `PresetKolom`, tanpa dropdown pemilih) — hasil simpan diterapkan ke grid
 *  lewat event agar grid terkait menyegarkan dirinya sendiri. */
function KelolaKolomHalaman({
  tableKey,
  fields,
  onTutup,
}: {
  tableKey: string;
  fields: ExcelField[];
  onTutup: () => void;
}) {
  const [presets, setPresets] = useState<PresetTabel[]>([]);
  const [bawaanId, setBawaanId] = useState<number | null>(null);
  /** Preset yang dibuka + mulai-lengkap + penanda remount (agar state lokal
   *  TabKolom ter-reset). */
  const [kelola, setKelola] = useState<{ preset: PresetTabel | null; lengkap: boolean; nonce: number }>({
    preset: null, lengkap: false, nonce: 0,
  });

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const { tandai, hapus: hapusPribadi, merekam, simpanKeStandar } = useStandarTampilan();
  const banyakKolom = fields.length > 30;

  const muat = useCallback(async () => {
    try {
      const res = await listPresetTabel(tableKey);
      setPresets(res.data.presets);
      setBawaanId(res.data.default_preset_id);
    } catch (e) {
      setPresets([]);
      setBawaanId(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey]);

  useEffect(() => {
    setKelola({ preset: null, lengkap: false, nonce: 0 });
    void muat();
  }, [muat]);

  /** Terapkan susunan Lengkap kustom langsung (tanpa menyimpan preset). */
  const pakaiLengkap = useCallback((keys: string[], label: Record<string, string>) => {
    const efektif = keys.filter((k) => fieldKeys.has(k));
    const labelBersih: Record<string, string> = {};
    for (const [k, v] of Object.entries(label)) {
      if (fieldKeys.has(k) && v.trim() !== '') labelBersih[k] = v.trim();
    }
    if (merekam) {
      hapusPribadi(`preset.${tableKey}`);
      simpanKeStandar({ presetAktif: { [tableKey]: null } });
    } else {
      tandai(`preset.${tableKey}`);
      void setPresetAktif(tableKey, null)
        .then(() => kabariPreset(tableKey, { keys: efektif, label: labelBersih }))
        .catch((e: unknown) => toast.error(errorMessage(e)));
    }
    toast.success('Susunan kolom diterapkan.');
  }, [fieldKeys, merekam, hapusPribadi, simpanKeStandar, tableKey, tandai]);

  return (
    <TabKolom
      key={kelola.nonce}
      tableKey={tableKey}
      fields={fields}
      fieldKeys={fieldKeys}
      presets={presets}
      banyakKolom={banyakKolom}
      presetAwal={kelola.preset}
      mulaiLengkap={kelola.lengkap}
      onPilihLengkap={() => setKelola((s) => ({ preset: null, lengkap: true, nonce: s.nonce + 1 }))}
      bawaanId={bawaanId}
      onPilihPreset={(p) => setKelola((s) => ({ preset: p, lengkap: false, nonce: s.nonce + 1 }))}
      onTersimpan={async (id) => {
        await setPresetAktif(tableKey, id);
        kabariPreset(tableKey);
        await muat();
      }}
      onPakaiLengkap={(keys, label) => pakaiLengkap(keys, label)}
      onDihapus={async () => {
        await setPresetAktif(tableKey, null);
        kabariPreset(tableKey);
        await muat();
      }}
      onTutup={onTutup}
    />
  );
}

/** Satu pintu pengaturan halaman: filter topBar + preset kolom + preset
 *  urutan + visibilitas toolbar — perluasan Kelola Tabel ke cakupan halaman.
 *  Entry per tabel di tab Kolom/Urutan/Toolbar tetap memakai komponen yang
 *  sama dengan dialog Kelola Tabel. */
export default function DialogKelolaHalaman({
  open,
  onOpenChange,
  pageKey,
  judul,
  tabel,
  filterBawaan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  /** Judul halaman tampil (dari route). */
  judul: string;
  /** Daftar tabel halaman ini (satu atau banyak). */
  tabel: TabelHalaman[];
  /** Bawaan filter kode (untuk tab Filter). */
  filterBawaan: Record<KunciFilterGlobal, boolean>;
}) {
  const [tab, setTab] = useState<TabHalaman>('filter');
  const [tabelAktif, setTabelAktif] = useState<string>(tabel[0]?.key ?? '');
  const tutup = () => onOpenChange(false);

  // Reset pilihan saat halaman/ganti dialog dibuka.
  useEffect(() => {
    if (open) {
      setTab('filter');
      setTabelAktif(tabel[0]?.key ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pageKey]);

  const tabelTerpilih = tabel.find((t) => t.key === tabelAktif) ?? tabel[0];
  const banyakKolom = (tabelTerpilih?.fields?.length ?? 0) > 30;
  const butuhPilihTabel = tabel.length > 1 && tab !== 'filter';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[70dvh] sm:max-w-2xl lg:max-w-4xl',
          banyakKolom && 'lg:h-[70dvh] lg:max-w-4xl lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:overflow-hidden',
        )}
      >
        <DialogHeader>
          <DialogTitle>Kelola halaman: {judul}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b pb-2" role="tablist" aria-label="Kelola halaman">
          {TAB_META.map((t) => (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              aria-selected={tab === t.kunci}
              id={`tab_kelola_halaman_${t.kunci}`}
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

        {butuhPilihTabel ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Pilih tabel">
            <span className="text-xs text-muted-foreground">Tabel:</span>
            {tabel.map((t) => (
              <button
                key={t.key}
                type="button"
                id={`btn_pilih_tabel_halaman_${t.key}`}
                aria-pressed={t.key === tabelTerpilih?.key}
                onClick={() => setTabelAktif(t.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs transition-colors',
                  t.key === tabelTerpilih?.key ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {t.judul ?? t.key}
              </button>
            ))}
          </div>
        ) : null}

        {tab === 'filter' && (
          <TabFilterHalaman pageKey={pageKey} bawaan={filterBawaan} onTutup={tutup} />
        )}
        {tab === 'kolom' && tabelTerpilih && (
          tabelTerpilih.fields ? (
            <KelolaKolomHalaman
              key={tabelTerpilih.key}
              tableKey={tabelTerpilih.key}
              fields={tabelTerpilih.fields}
              onTutup={tutup}
            />
          ) : (
            <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Tabel “{tabelTerpilih.judul ?? tabelTerpilih.key}” tidak memakai preset kolom —
              kelola kolomnya dari toolbar tabel masing-masing.
            </p>
          )
        )}
        {tab === 'urutan' && tabelTerpilih && (
          <div key={tabelTerpilih.key} className={cn('min-h-0', banyakKolom && 'lg:overflow-y-auto')}>
            <TabUrutan tableKey={tabelTerpilih.key} onTutup={tutup} />
          </div>
        )}
        {tab === 'kontrol' && tabelTerpilih && (
          <div key={tabelTerpilih.key} className={cn('min-h-0', banyakKolom && 'lg:overflow-y-auto')}>
            <TabKontrol tableKey={tabelTerpilih.key} onTutup={tutup} />
          </div>
        )}
        {tab !== 'filter' && !tabelTerpilih ? (
          <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            Halaman ini tidak mendaftarkan tabel — tab ini belum tersedia.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
