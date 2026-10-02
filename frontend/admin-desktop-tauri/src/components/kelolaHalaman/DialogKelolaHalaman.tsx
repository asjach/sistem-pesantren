import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '@/api/client';
import {
  listPresetTabel,
  setPresetAktif,
  type PresetTabel,
} from '@/api/preset';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { BagianProvider, useRegistriBagian } from './kotor';
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
}: {
  tableKey: string;
  fields: ExcelField[];
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
    />
  );
}

/** Bagian dialog: judul + keterangan singkat, isi mengikuti (tanpa tab).
 *  WAJIB di scope modul: kalau didefinisikan di dalam komponen, identitasnya
 *  berubah tiap render sehingga isi bagian di-remount dan state lokalnya
 *  (centang, penanda kotor) selalu kembali ke awal. */
function Bagian({ id, judul, keterangan, children }: {
  id: string;
  judul: string;
  keterangan: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={judul} className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2 border-b pb-1">
        <h3 className="shrink-0 text-xs font-semibold">{judul}</h3>
        <p className="min-w-0 truncate text-[11px] text-muted-foreground" title={keterangan}>
          {keterangan}
        </p>
      </div>
      {children}
    </section>
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
  const [tabelAktif, setTabelAktif] = useState<string>(tabel[0]?.key ?? '');
  /** Status kotor per bagian (semua bagian tampil sekaligus). */
  const [kotorBagian, setKotorBagian] = useState<Record<string, boolean>>({});
  /** Fungsi simpan tiap bagian, dipakai tombol Simpan terpadu. */
  const simpanBagianRef = useRef<Record<string, () => void>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  /** Aksi tertunda yang menunggu konfirmasi "buang perubahan?". */
  const [aksiTertunda, setAksiTertunda] = useState<(() => void) | null>(null);

  /** Ada perubahan belum tersimpan di bagian mana pun. */
  const kotor = Object.values(kotorBagian).some(Boolean);
  /** Cermin `kotor` untuk keputusan sinkron (state React baru terlihat pada
   *  render berikutnya). */
  const kotorRef = useRef(false);
  kotorRef.current = kotor;
  const lapor = useCallback((id: string, v: boolean) => {
    setKotorBagian((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }));
  }, []);
  const daftarSimpan = useCallback((id: string, simpan: (() => void) | null) => {
    if (simpan) simpanBagianRef.current[id] = simpan;
    else delete simpanBagianRef.current[id];
  }, []);
  const registri = useRegistriBagian(lapor, daftarSimpan);
  /** Urutan simpan: filter lebih dulu, lalu bagian per tabel. */
  const URUTAN_BAGIAN = ['filter', 'kolom', 'urutan', 'kontrol'] as const;
  const adaKotor = Object.values(kotorBagian).some(Boolean);
  /** Simpan semua bagian yang berubah, berurutan. */
  const simpanSemua = useCallback(async () => {
    setMenyimpan(true);
    try {
      for (const id of URUTAN_BAGIAN) {
        if (!kotorBagian[id]) continue;
        const fn = simpanBagianRef.current[id];
        if (fn) await fn();
      }
    } finally {
      setMenyimpan(false);
    }
  }, [kotorBagian]);

  /** Jalankan aksi, tapi tanya dulu bila ada perubahan belum tersimpan. */
  const coba = useCallback((aksi: () => void) => {
    if (kotorRef.current) setAksiTertunda(() => aksi);
    else aksi();
  }, []);

  const tutup = useCallback(() => coba(() => onOpenChange(false)), [coba, onOpenChange]);
  const konfigurasi = useMemo(() => konfigurasiFilterHalaman(pageKey), [pageKey]);

  // Saat dibuka: pilih tabel pertama lagi, dan bersihkan penanda kotor.
  useEffect(() => {
    if (!open) return;
    setTabelAktif(tabel[0]?.key ?? '');
    setKotorBagian({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pageKey]);

  const tabelTerpilih = tabel.find((t) => t.key === tabelAktif) ?? tabel[0];

return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())}>
      <DialogContent className="!flex h-[85dvh] max-h-[85dvh] flex-col !overflow-hidden sm:max-w-2xl lg:max-w-4xl">
        <BagianProvider value={registri}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Kelola halaman: {judul}</DialogTitle>
            <DialogDescription>
              Filter berlaku untuk bilah atas; bagian lain per tabel. Tekan
              <span className="font-medium"> Simpan</span> untuk menyimpan yang diubah.
            </DialogDescription>
          </DialogHeader>

          {tabel.length > 1 ? (
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

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            <Bagian
              id="bagian_filter_halaman"
              judul="Filter halaman"
              keterangan="Filter global yang tampil di bilah atas halaman ini."
            >
              <TabFilterHalaman
                pageKey={pageKey}
                filterRelevan={konfigurasi.filter}
                bawaan={filterBawaan}
                modeBawaan={konfigurasi.mode}
              />
            </Bagian>

            {tabelTerpilih ? (
              <>
                <Bagian
                  id="bagian_kolom_tabel"
                  judul="Kolom"
                  keterangan="Kolom yang tampil dan urutannya (seret untuk mengurutkan)."
                >
                  {tabelTerpilih.fields ? (
                    <KelolaKolomHalaman
                      key={tabelTerpilih.key}
                      tableKey={tabelTerpilih.key}
                      fields={tabelTerpilih.fields}
                    />
                  ) : (
                    <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                      Tabel “{tabelTerpilih.judul ?? tabelTerpilih.key}” tidak memakai preset
                      kolom — kelola kolomnya dari toolbar tabel masing-masing.
                    </p>
                  )}
                </Bagian>

                <Bagian
                  id="bagian_urutan_tabel"
                  judul="Urutan"
                  keterangan="Opsi urutkan dan arah tiap kolom pada toolbar tabel."
                >
                  <TabUrutan key={tabelTerpilih.key} tableKey={tabelTerpilih.key} />
                </Bagian>

                <Bagian
                  id="bagian_toolbar_tabel"
                  judul="Toolbar"
                  keterangan="Kontrol yang tampil dan lebar masing-masing."
                >
                  <TabKontrol key={tabelTerpilih.key} tableKey={tabelTerpilih.key} />
                </Bagian>
              </>
            ) : (
              <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                Halaman ini tidak mendaftarkan tabel — hanya filter yang bisa diatur.
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" id="btn_tutup_kelola_halaman" onClick={tutup}>
              Tutup
            </Button>
            <Button
              type="button"
              id="btn_simpan_kelola_halaman"
              disabled={!adaKotor || menyimpan}
              onClick={() => void simpanSemua()}
            >
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </BagianProvider>
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
