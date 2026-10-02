import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, prefGet, prefSet } from '@/api/client';
import {
  listPresetTabel,
  setPresetAktif,
  type PresetTabel,
} from '@/api/preset';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KotorProvider } from './kotor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';
import TabKolom from '../kelolaTabel/TabKolom';
import TabUrutan from '../kelolaTabel/TabUrutan';
import TabKontrol from '../kelolaTabel/TabKontrol';
import { EVENT_PRESET_BERUBAH } from '../kelolaTabel/jenis';
import TabFilterHalaman from './TabFilterHalaman';
import { konfigurasiFilterHalaman } from '@/lib/filterHalaman';
import type { KunciFilterGlobal, TabelHalaman } from '../VisibilitasFilter';

/** Tab dialog Kelola Halaman. */
export type TabHalaman = 'filter' | 'kolom' | 'urutan' | 'kontrol';

/** Tab terakhir yang dipakai (per perangkat) — dialog dibuka kembali pada tab
 *  yang sama, bukan selalu balik ke tab pertama. */
const TAB_TERAKHIR_KEY = 'simpes_kelola_tab';

const TAB_META: { kunci: TabHalaman; label: string }[] = [
  { kunci: 'filter', label: 'Filter' },
  { kunci: 'kolom', label: 'Kolom' },
  { kunci: 'urutan', label: 'Urutan' },
  { kunci: 'kontrol', label: 'Toolbar' },
];

/** Kabari grid tabel terkait agar memuat ulang preset/susunan kolomnya. */
function kabariPreset(tableKey: string) {
  window.dispatchEvent(new CustomEvent(EVENT_PRESET_BERUBAH, { detail: { tableKey } }));
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
  // `lengkap: true` = mode "Lengkap (semua kolom)": keadaan awal sebelum data
  // preset termuat. Tanpa ini tab Kolom terbuka dengan 0 kolom terpilih, dan
  // tombol Simpan mati — terlihat seperti form yang rusak.
  const [kelola, setKelola] = useState<{
    preset: PresetTabel | null;
    lengkap: boolean;
    /** Susunan "Lengkap kustom" tersimpan (null = semua kolom). */
    kolomAwal: string[] | null;
    nonce: number;
  }>({ preset: null, lengkap: true, kolomAwal: null, nonce: 0 });

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const banyakKolom = fields.length > 30;

  const muat = useCallback(async () => {
    try {
      const res = await listPresetTabel(tableKey);
      setPresets(res.data.presets);
      setBawaanId(res.data.default_preset_id);
      // Buka pada susunan yang benar-benar dipakai halaman ini: preset aktif
      // bila ada, kalau tidak "Lengkap (semua kolom)". Dialog jadi mencerminkan
      // isi tabel, bukan daftar kosong.
      const aktif = res.data.presets.find((p) => p.id === res.data.aktif_preset_id) ?? null;
      const kolomKustom = aktif === null ? res.data.aktif_kolom ?? null : null;
      setKelola((s) => ({ preset: aktif, lengkap: aktif === null, kolomAwal: kolomKustom, nonce: s.nonce + 1 }));
    } catch (e) {
      setPresets([]);
      setBawaanId(null);
      toast.error(errorMessage(e));
    }
  }, [tableKey]);

  useEffect(() => {
    setKelola({ preset: null, lengkap: true, kolomAwal: null, nonce: 0 });
    void muat();
  }, [muat]);

  /** Simpan susunan "Lengkap kustom" (tanpa preset bernama) ke server supaya
   *  bertahan antar muat ulang, lalu minta grid memuatnya. */
  const pakaiLengkap = useCallback((keys: string[], label: Record<string, string>) => {
    const efektif = keys.filter((k) => fieldKeys.has(k));
    const labelBersih: Record<string, string> = {};
    for (const [k, v] of Object.entries(label)) {
      if (fieldKeys.has(k) && v.trim() !== '') labelBersih[k] = v.trim();
    }
    void setPresetAktif(tableKey, null, efektif, Object.keys(labelBersih).length > 0 ? labelBersih : null)
      .then(() => kabariPreset(tableKey))
      .catch((e: unknown) => toast.error(errorMessage(e)));
    toast.success('Susunan kolom disimpan.');
  }, [fieldKeys, tableKey]);

  return (
    <TabKolom
      key={kelola.nonce}
      tableKey={tableKey}
      fields={fields}
      kolomAwal={kelola.kolomAwal}
      fieldKeys={fieldKeys}
      presets={presets}
      banyakKolom={banyakKolom}
      presetAwal={kelola.preset}
      mulaiLengkap={kelola.lengkap}
      onPilihLengkap={() => setKelola((s) => ({ preset: null, lengkap: true, kolomAwal: null, nonce: s.nonce + 1 }))}
      bawaanId={bawaanId}
      onPilihPreset={(p) => setKelola((s) => ({ preset: p, lengkap: false, kolomAwal: null, nonce: s.nonce + 1 }))}
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
 *  urutan + visibilitas toolbar. Pengelolaan tabel hanya lewat sini. */
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
  const refTab = useRef<(HTMLButtonElement | null)[]>([]);
  /** Ada perubahan belum tersimpan di tab aktif (dilaporkan tab). */
  const [, setKotor] = useState(false);
  /** Cermin `kotor` untuk keputusan sinkron: `laporKotor(false)` yang dipanggil
   *  tepat sebelum menutup (setelah menyimpan) harus langsung berlaku, sedangkan
   *  state React baru terlihat pada render berikutnya. */
  const kotorRef = useRef(false);
  /** Aksi tertunda yang menunggu konfirmasi "buang perubahan?". */
  const [aksiTertunda, setAksiTertunda] = useState<(() => void) | null>(null);
  const laporKotor = useCallback((v: boolean) => {
    kotorRef.current = v;
    setKotor(v);
  }, []);

  /** Jalankan aksi, tapi tanya dulu bila ada perubahan belum tersimpan. */
  const coba = useCallback((aksi: () => void) => {
    if (kotorRef.current) setAksiTertunda(() => aksi);
    else aksi();
  }, []);

  const tutup = useCallback(() => coba(() => onOpenChange(false)), [coba, onOpenChange]);
  /** Ganti tab + ingat pilihannya agar bukaan berikutnya langsung ke tab itu. */
  const gantiTab = useCallback((t: TabHalaman) => {
    coba(() => {
      setTab(t);
      prefSet(TAB_TERAKHIR_KEY, t).catch(() => {});
    });
  }, [coba]);
  const konfigurasi = useMemo(() => konfigurasiFilterHalaman(pageKey), [pageKey]);
  const tabMeta = useMemo(
    () => tabel.length > 0 ? TAB_META : TAB_META.filter((item) => item.kunci === 'filter'),
    [tabel.length],
  );
  /** Navigasi tab ala WAI-ARIA: panah kiri/kanan, Home, End. */
  const onKeyDownTab = useCallback((e: React.KeyboardEvent, idx: number) => {
    const n = tabMeta.length;
    let berikut = -1;
    if (e.key === 'ArrowRight') berikut = (idx + 1) % n;
    else if (e.key === 'ArrowLeft') berikut = (idx - 1 + n) % n;
    else if (e.key === 'Home') berikut = 0;
    else if (e.key === 'End') berikut = n - 1;
    if (berikut < 0) return;
    e.preventDefault();
    gantiTab(tabMeta[berikut].kunci);
    refTab.current[berikut]?.focus();
  }, [tabMeta, gantiTab]);

  // Saat dibuka: pilih tabel pertama lagi, dan kembalikan tab terakhir yang
  // dipakai — selama tab itu memang tersedia untuk halaman ini.
  useEffect(() => {
    if (!open) return;
    setTabelAktif(tabel[0]?.key ?? '');
    let batal = false;
    prefGet(TAB_TERAKHIR_KEY)
      .then((v) => {
        if (batal) return;
        const tersedia = tabMeta.some((m) => m.kunci === v);
        setTab(tersedia ? (v as TabHalaman) : 'filter');
      })
      .catch(() => setTab('filter'));
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pageKey]);

  const tabelTerpilih = tabel.find((t) => t.key === tabelAktif) ?? tabel[0];
  const butuhPilihTabel = tabel.length > 1 && tab !== 'filter';
  // Tab/tabel berganti = komponen tab di-remount: penanda lama tidak berlaku.
  useEffect(() => {
    kotorRef.current = false;
    setKotor(false);
  }, [tab, tabelAktif, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())}>
      <DialogContent
        className={cn(
          '!flex max-h-[80dvh] flex-col !overflow-hidden sm:max-w-2xl lg:max-w-4xl',
          // Tab Filter isinya sering pendek (1-4 baris): biarkan dialog mengikuti
          // isi agar tidak menyisakan ruang kosong. Tab padat (Kolom/Urutan/
          // Toolbar) butuh tinggi pasti untuk scroll internalnya.
          tab === 'filter' ? 'h-auto min-h-0' : 'h-[70dvh]',
        )}
      >
        <KotorProvider value={laporKotor}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Kelola halaman: {judul}</DialogTitle>
          <DialogDescription>
            Atur filter, kolom, urutan, dan toolbar untuk halaman ini. Tab
            <span className="font-medium"> Filter</span> mengatur filter global di bilah atas;
            tab lain berlaku per tabel. Perubahan baru tersimpan setelah menekan
            <span className="font-medium"> Simpan</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-start gap-1 border-b pb-2" role="tablist" aria-label="Kelola halaman">
          {tabMeta.map((t, idx) => (
            <button
              key={t.kunci}
              ref={(el) => { refTab.current[idx] = el; }}
              type="button"
              role="tab"
              aria-selected={tab === t.kunci}
              aria-controls={`panel_kelola_halaman_${t.kunci}`}
              tabIndex={tab === t.kunci ? 0 : -1}
              id={`tab_kelola_halaman_${t.kunci}`}
              onClick={() => gantiTab(t.kunci)}
              onKeyDown={(e) => onKeyDownTab(e, idx)}
              className={cn(
                'h-fit rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === t.kunci ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {butuhPilihTabel ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5" role="group" aria-label="Pilih tabel">
            <span className="text-xs text-muted-foreground">Tabel:</span>
            {tabel.map((t) => (
              <button
                key={t.key}
                type="button"
                id={`btn_pilih_tabel_halaman_${t.key}`}
                aria-pressed={t.key === tabelTerpilih?.key}
                onClick={() => coba(() => setTabelAktif(t.key))}
                className={cn(
                  // Pil bergaris, bukan blok abu seperti tab di atasnya, supaya
                  // "tabel mana" tidak tertukar dengan "tab mana".
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  t.key === tabelTerpilih?.key
                    ? 'border-accent bg-accent/20 font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/40 hover:text-foreground',
                )}
              >
                {t.judul ?? t.key}
              </button>
            ))}
          </div>
        ) : null}

        <div
          role="tabpanel"
          id={`panel_kelola_halaman_${tab}`}
          aria-labelledby={`tab_kelola_halaman_${tab}`}
          tabIndex={0}
          className="flex min-h-0 flex-1 flex-col focus-visible:outline-none"
        >
        {tab === 'filter' && (
          <div className="flex min-h-0 flex-col">
            <TabFilterHalaman
              pageKey={pageKey}
              filterRelevan={konfigurasi.filter}
              bawaan={filterBawaan}
              modeBawaan={konfigurasi.mode}
              onTutup={tutup}
            />
          </div>
        )}
        {tab === 'kolom' && tabelTerpilih && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tabelTerpilih.fields ? (
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
            )}
          </div>
        )}
        {tab === 'urutan' && tabelTerpilih && (
          <div key={tabelTerpilih.key} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TabUrutan tableKey={tabelTerpilih.key} onTutup={tutup} />
          </div>
        )}
        {tab === 'kontrol' && tabelTerpilih && (
          <div key={tabelTerpilih.key} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TabKontrol tableKey={tabelTerpilih.key} onTutup={tutup} />
          </div>
        )}
        {tab !== 'filter' && !tabelTerpilih ? (
          <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            Halaman ini tidak mendaftarkan tabel — tab ini belum tersedia.
          </p>
        ) : null}
        </div>
        </KotorProvider>
      </DialogContent>

      {/* Konfirmasi sebelum perubahan belum tersimpan dibuang. */}
      <AlertDialog open={aksiTertunda !== null} onOpenChange={(o) => { if (!o) setAksiTertunda(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Perubahan belum disimpan</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan di tab ini akan hilang bila dilanjutkan. Pilih Batal lalu tekan
              Simpan untuk menyimpannya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              id="btn_buang_perubahan_kelola_halaman"
              onClick={() => {
                const lanjut = aksiTertunda;
                setAksiTertunda(null);
                lanjut?.();
              }}
            >
              Buang perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
