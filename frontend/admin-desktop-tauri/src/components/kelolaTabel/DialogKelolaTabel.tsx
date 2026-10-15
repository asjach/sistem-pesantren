import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '@/api/client';
import {
  listPresetTabel,
  setPresetAktif,
  type PresetTabel,
} from '@/api/preset';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { BagianProvider, useRegistriBagian, type AksiBagian, type HasilSimpan } from '@/components/kelolaHalaman/kotor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Loader2, RotateCcw, TriangleAlert } from '@/icons';
import { cn } from '@/lib/utils';
import { kanonLabel } from '@/lib/labelKolom';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';
import TabKolom, { type TabKolomProps } from './TabKolom';
import TabUmum from './TabUmum';
import TabUrutan from './TabUrutan';
import TabVisibilitasKomponen from './TabVisibilitasKomponen';
import { KOMPONEN_INFO_BEKAL, type InfoKomponenTabel } from '@/components/excel/komponenTabel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EVENT_PRESET_BERUBAH, kabariPreset } from './jenis';

/** State bersama tab Kolom untuk satu tabel: preset kolom
 *  (cermin logika `PresetKolom`, tanpa dropdown pemilih) plus editor nama
 *  header & perataan. Keduanya mengedit hal yang sama (susunan kolom + nama
 *  header kustom) dan sekarang duduk di tab berbeda, jadi state-nya harus
 *  hidup di satu tempat di luar tab — state lokal tiap tab baru di-reset
 *  lewat `nonce` saat preset dibuka ulang. */
function useKelolaKolom({ tableKey, fields }: { tableKey: string; fields: ExcelField[] }) {
  const [presets, setPresets] = useState<PresetTabel[]>([]);
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

  /** Nama header kustom susunan yang dibuka (satu nilai per kolom, dipakai
   *  tab Kolom saat simpan + diedit di kotak nama tiap baris). */
  const [label, setLabel] = useState<Record<string, string>>({});
  const labelAwalRef = useRef(kanonLabel({}));

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  const muat = useCallback(async () => {
    try {
      const res = await listPresetTabel(tableKey);
      setPresets(res.data.presets);
      // Buka pada susunan yang benar-benar dipakai halaman ini: preset aktif,
      // kalau tidak "Lengkap (semua kolom)"/"Lengkap kustom" — cermin
      // `PresetKolom`. Dialog jadi mencerminkan isi tabel, bukan daftar kosong.
      const aktifId = res.data.aktif_preset_id;
      const aktif = aktifId === null
        ? null
        : res.data.presets.find((p) => p.id === aktifId) ?? null;
      const kolomKustom = aktif === null ? res.data.aktif_kolom ?? null : null;
      /* Label SENGAJA tidak disentuh di sini: nama header kolom adalah setelan
         per TABEL (`toolbar_preset.label`) yang sudah dimuat `useKelolaKolom`.
         Dulu label ikut preset; menimpanya sekarang akan mengembalikan label
         tabel ke nilai preset lama setiap kali dialog dibuka. */
      setKelola((s) => ({ preset: aktif, lengkap: aktif === null, kolomAwal: kolomKustom, nonce: s.nonce + 1 }));
    } catch (e) {
      setPresets([]);
      setLabel({});
      labelAwalRef.current = kanonLabel({});
      toast.error(errorMessage(e));
    }
  }, [fieldKeys, tableKey]);

  useEffect(() => {
    setKelola({ preset: null, lengkap: true, kolomAwal: null, nonce: 0 });
    setLabel({});
    labelAwalRef.current = kanonLabel({});
    void muat();
  }, [muat]);

  /** Simpan susunan "Lengkap kustom" (tanpa preset bernama) ke server supaya
   *  bertahan antar muat ulang, lalu minta grid memuatnya. Label tidak dikirim:
   *  nama header kolom disimpan per TABEL oleh `TabKolom`. */
  const pakaiLengkap = useCallback((keys: string[]) => {
    const efektif = keys.filter((k) => fieldKeys.has(k));
    void setPresetAktif(tableKey, null, efektif)
      .then(() => {
        kabariPreset(tableKey);
        toast.success('Susunan kolom disimpan.');
      })
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [fieldKeys, tableKey]);

  const pilihLengkap = useCallback(() => {
    setLabel({});
    labelAwalRef.current = kanonLabel({});
    setKelola((s) => ({ preset: null, lengkap: true, kolomAwal: null, nonce: s.nonce + 1 }));
  }, []);
  const pilihPreset = useCallback((p: PresetTabel | null) => {
    /* Label tabel dibiarkan apa adanya: preset mengubah kolom mana yang TAMPIL,
       bukan cara kolom dinamai. */
    setKelola((s) => ({ preset: p, lengkap: false, kolomAwal: null, nonce: s.nonce + 1 }));
  }, []);
  const tersimpan = useCallback(async (id: number) => {
    await setPresetAktif(tableKey, id);
    kabariPreset(tableKey);
    await muat();
  }, [muat, tableKey]);
  const dihapus = useCallback(async () => {
    await setPresetAktif(tableKey, null);
    kabariPreset(tableKey);
    await muat();
  }, [muat, tableKey]);

  return {
    /** Muat ulang daftar preset (dipakai listener `EVENT_PRESET_BERUBAH`). */
    muat,
    /** `key` untuk TabKolom: naik tiap preset dibuka ulang. */
    nonce: kelola.nonce,
    kolom: {
      tableKey,
      fields,
      fieldKeys,
      presets,
      kolomAwal: kelola.kolomAwal,
      presetAwal: kelola.preset,
      mulaiLengkap: kelola.lengkap,
      label,
      setLabel,
      labelAwalRef,
      onPilihLengkap: pilihLengkap,
      onPilihPreset: pilihPreset,
      onTersimpan: tersimpan,
      onPakaiLengkap: pakaiLengkap,
      onDihapus: dihapus,
    } satisfies TabKolomProps,
  };
}

/** Bagian dialog: judul + isi, tanpa tab.
 *  WAJIB di scope modul: kalau didefinisikan di dalam komponen, identitasnya
 *  berubah tiap render sehingga isi bagian di-remount dan state lokalnya
 *  (centang, penanda kotor) selalu kembali ke awal. */
export function Bagian({ id, judul, aksi, children }: {
  id: string;
  judul: string;
  /** Aksi ikon di kanan judul (mis. kembalikan bawaan). */
  aksi?: AksiBagian;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={judul} className="flex flex-col gap-2 rounded-lg border bg-card/40 p-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{judul}</h3>
        {aksi ? (
          /* Label ikut tampil, bukan hanya tooltip: di dialog ini tiap bagian
             punya tab sendiri, jadi tidak lagi banyak ikon ↺ yangbertumpuk
             dan ikon polos jadi tak terbaca. */
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                id={aksi.idTombol ?? `btn_kembalikan_${id}`}
                className="ml-auto gap-1.5 text-muted-foreground"
                aria-label={aksi.label}
                disabled={aksi.disabled}
                onClick={aksi.onClick}
              >
                {aksi.ikon ?? <RotateCcw />}
                <span className="text-xs">{aksi.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{aksi.label}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Tab satu bagian. Titik amber = bagiannya punya perubahan belum
 *  tersimpan; badge angka sengaja tidak dipakai (ramai di 5 tab), yang penting
 *  user tahu "ada yang belum disimpan" tanpa harus membuka tabnya. */
function TabBagian({ id, label, kotor }: { id: string; label: string; kotor: boolean }) {
  return (
    <TabsTrigger id={`tab_kelola_${id}`} value={id} className="gap-1.5">
      {label}
      {kotor ? (
        <>
          {/* Spasi eksplisit: `{label}` dan node ini berdempetan, tanpa
              spasi keduanya menempel jadi "Kolom(belum tersimpan)". */}
          {' '}
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="sr-only">(belum tersimpan)</span>
        </>
      ) : null}
    </TabsTrigger>
  );
}

/** Satu pintu pengaturan satu tabel: visibilitas komponen + info tabel +
 *  tampilan perangkat + preset kolom (nama & perataan) + preset urutan.
 *  Dibuka dari tabel terkait (menu konteks header / gerigi kaki tabel) atau
 *  dari topBar halaman yang hanya punya satu tabel. */
export default function DialogKelolaTabel({
  open,
  onOpenChange,
  tableKey,
  judul,
  fields,
  infoKomponen = KOMPONEN_INFO_BEKAL,
  nonModal = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: string;
  /** Judul tabel tampil (boleh node, mis. header kaya dari grid). */
  judul: ReactNode;
  /** Fields tabel (dari grid); tanpa fields section Kolom diganti keterangan. */
  fields?: ExcelField[];
  /** Komponen tabel yang benar-benar ada (dihitung ExcelTable) — menentukan
   *  sakelar visibilitas mana yang ditawarkan di tab Umum. Bawaan dipakai
   *  jalur dari TopBar yang tak punya grid di belakang. */
  infoKomponen?: InfoKomponenTabel;
  /** Panel melayang di samping tabel yang sedang dilihat (Sheet non-modal),
   *  bukan dialog modal. Dipakai jalur tabel; dari topBar tetap modal karena
   *  tak jelas tabel mana yang "di belakang". */
  nonModal?: boolean;
}) {
  /** Status kotor per bagian (dipakai badge di tab + penanda simpan). */
  const [kotorBagian, setKotorBagian] = useState<Record<string, boolean>>({});
  /** Tab aktif. Tab Umum paling depan dan jadi bawaan saat dialog dibuka.
   *  Tiap bagian punya tab sendiri supaya tidak perlu scroll jauh mencari
   *  bagian; isi tab tetap ter-mount semua (lihat catatan TabsContent). */
  const [tab, setTab] = useState('umum');
  /** Fungsi simpan tiap bagian, dipakai tombol Simpan terpadu. */
  const simpanBagianRef = useRef<Record<string, () => HasilSimpan>>({});
  /** Aksi ikon tiap bagian (mis. kembalikan bawaan). */
  const [aksiBagian, setAksiBagian] = useState<Record<string, AksiBagian>>({});

  /** Ada perubahan BELUM TERSIMPAN di bagian mana pun. Bagian menyimpan
   *  sendiri saat berubah, jadi ini hanya jendela sesaat antara ketikan dan
   *  balasan server - bukan tumpukan pekerjaan yang menunggu tombol Simpan. */
  const adaKotor = Object.values(kotorBagian).some(Boolean);
  /** Cermin `adaKotor` untuk keputusan sinkron (state React baru terlihat
   *  pada render berikutnya). */
  const kotorRef = useRef(false);
  kotorRef.current = adaKotor;

  /** Bagian yang gagal disimpan otomatis sejak pembukaan terakhir. Dipakai
   *  footer untuk berhenti bilang "tersimpan" bila ada yang gagal. */
  const [adaGagal, setAdaGagal] = useState(false);
  /** Penanda antre: nomor urut permintaan simpan terakhir yang dimulai. */
  const antreRef = useRef(0);
  /** Bagian yang sedang disimpan (untuk indikator "Menyimpan…"). */
  const [sedangSimpan, setSedangSimpan] = useState<string[]>([]);

  const lapor = useCallback((id: string, v: boolean) => {
    setKotorBagian((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }));
    /* TERAPKAN LANGSUNG: bagian melaporkan "kotor" tepat saat nilainya
       berubah, jadi di situlah penyimpanan dijalankan - tanpa menunggu
       tombol. Bagian yang gagal tetap ditandai kotor supaya percobaan
       berikutnya (ketikan berikutnya) bisa mengulang; kegagalannya juga
       dicatat agar footer berhenti mengaku "tersimpan". */
    if (!v) return;
    const fn = simpanBagianRef.current[id];
    if (!fn) return;
    const nomor = (antreRef.current += 1);
    setSedangSimpan((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void (async () => {
      let ok: boolean | void = true;
      try {
        ok = await fn();
      } catch {
        ok = false;
      } finally {
        // Hanya permintaan TERAKHIR yang boleh membersihkan indikator:
        // yang lama bisa selesai belakangan (balapan) dan mematikan
        // indikator milik yang baru.
        if (nomor === antreRef.current) {
          setSedangSimpan((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
        }
      }
      if (ok === false) setAdaGagal(true);
    })();
  }, []);
  const daftarSimpan = useCallback((id: string, simpan: (() => void) | null) => {
    if (simpan) simpanBagianRef.current[id] = simpan;
    else delete simpanBagianRef.current[id];
  }, []);
  const daftarAksi = useCallback((id: string, aksi: AksiBagian | null) => {
    setAksiBagian((prev) => {
      if (aksi === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: aksi };
    });
  }, []);
  const registri = useRegistriBagian(lapor, daftarSimpan, daftarAksi);
  /* Tak ada lagi perubahan tertunda: tiap bagian menyimpan sendiri saat
     diubah, jadi menutup dialog tak bisa membuang pekerjaan - dan
     konfirmasi "buang perubahan?" tak lagi punya alasan. */
  const tutup = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Saat dibuka: bersihkan penanda kotor dan catatan gagal.
  useEffect(() => {
    if (!open) return;
    setKotorBagian({});
    setAdaGagal(false);
  }, [open, tableKey]);

  // Hook tetap dipanggil tanpa syarat: `fields` boleh undefined (tab Kolom
  // lalu menampilkan keterangan), tapi state Kolom harus hidup terus supaya
  // tidak hilang saat pindah tabel.
  const { muat, ...kolom } = useKelolaKolom({ tableKey, fields: fields ?? [] });

  // Ikut menyegarkan diri saat susunan preset diubah dari luar (mis. menu klik
  // kanan header tabel atau seret kolom), tapi JANGAN sentuh editan yang belum
  // disimpan supaya pekerjaan pengguna tidak hilang.
  useEffect(() => {
    const segarkan = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.tableKey !== tableKey || kotorRef.current) return;
      void muat();
    };
    window.addEventListener(EVENT_PRESET_BERUBAH, segarkan);
    return () => window.removeEventListener(EVENT_PRESET_BERUBAH, segarkan);
  }, [tableKey, muat]);

  /** Jumlah bagian yang belum tersimpan — dipakai badge di tab + footer. */
  const jumlahKotor = useMemo(
    () => ['umum', 'visibilitas', 'kolom', 'urutan']
      .filter((id) => kotorBagian[id]).length,
    [kotorBagian],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())} modal={!nonModal}>
      <SheetContent
        side="right"
        /* Saat dibuka dari TABEL yang sedang dilihat: non-modal + tanpa
           overlay, supaya tabelnya tetap terlihat dan hidup - itulah alasan
           panel ini ada. Dari topBar (tabel di halaman lain) tetap modal:
           tak ada tabel di belakang yang layak dilihat. */
        overlay={!nonModal}
        onInteractOutside={nonModal ? (e) => e.preventDefault() : undefined}
        aria-label={`Pengaturan tabel ${typeof judul === 'string' ? judul : 'ini'}`}
        /* - Lebar tetap 600px (bukan `max-w`): panel ini menemani tabel di
             belakang, jadi lebarnya tak perlu ikut melebar di layar besar.
           - `!overflow-hidden` WAJIB: SheetContent bawaan ber-`overflow-y-auto`,
             sehingga yang menggulir adalah SELURUH panel - header (judul + tab)
             dan footer (status + Tutup) ikut terbuang ke luar layar begitu
             digulir, dan daftar kolom yang panjang membuat panel setinggi
             2904px. Yang boleh menggulir hanya isi tab (lihat TabsContent). */
        className="!flex h-dvh w-full flex-col gap-0 !overflow-hidden !p-0 sm:w-[600px] sm:max-w-[600px]"
      >
        <BagianProvider value={registri}>
          <SheetHeader className="shrink-0 gap-1 border-b px-4 py-3">
            <SheetTitle>Kelola tabel: {judul}</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Atur tampilan, kolom, dan urutan tabel ini. Perubahan
              tersimpan sendiri saat diubah.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList variant="line" className="h-auto w-full shrink-0 justify-start gap-1 border-b px-3 py-1.5">
              {/* Titik "belum tersimpan" tab Umum juga naik dari section
                  visibilitas komponen (id sendiri — satu tab bisa punya >1
                  bagian terdaftar). */}
              <TabBagian id="umum" label="Umum" kotor={!!kotorBagian.umum || !!kotorBagian.visibilitas} />
              <TabBagian id="kolom" label="Kolom" kotor={!!kotorBagian.kolom} />
              <TabBagian id="urutan" label="Urutan" kotor={!!kotorBagian.urutan} />
            </TabsList>

            {/* Semua panel `forceMount`: pindah tab tidak boleh membuang state
                lokal tiap bagian (centang, penanda kotor) — kalau ter-unmount,
                bagian yang sudah dikotori diam-diam tak ikut tersimpan. */}
            <TabsContent value="umum" forceMount className="min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
              <Bagian id="bagian_umum_tabel" judul="Umum" aksi={aksiBagian.umum}>
                <div className="flex flex-col gap-3">
                  <TabVisibilitasKomponen tableKey={tableKey} info={infoKomponen} />
                  <TabUmum tableKey={tableKey} judul={judul} fields={fields} />
                </div>
              </Bagian>
            </TabsContent>

            <TabsContent value="kolom" forceMount className="min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
              <Bagian id="bagian_kolom_tabel" judul="Kolom" aksi={aksiBagian.kolom}>
                {fields ? (
                  <TabKolom key={`${tableKey}-${kolom.nonce}`} {...kolom.kolom} />
                ) : (
                  <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                    Tabel “{judul}” tidak memakai preset kolom — kelola kolomnya dari toolbar tabel
                    masing-masing.
                  </p>
                )}
              </Bagian>
            </TabsContent>


            <TabsContent value="urutan" forceMount className="min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
              <Bagian id="bagian_urutan_tabel" judul="Urutan">
                <TabUrutan key={tableKey} tableKey={tableKey} />
              </Bagian>
            </TabsContent>
          </Tabs>

          <SheetFooter className="shrink-0 flex-row items-center gap-2 border-t px-4 py-3">
            {/* Perubahan tersimpan sendiri saat diubah, jadi tak ada tombol
                Simpan - yang perlu diketahui pengguna hanyalah SEDANG apa
                datanya sekarang. Ini status, bukan aksi. */}
            <p
              className={cn('mr-auto flex items-center gap-1.5 text-xs', adaGagal ? 'text-destructive' : 'text-muted-foreground')}
              id="status_simpan_kelola_tabel"
              role="status"
              aria-live="polite"
            >
              {adaGagal ? (
                <><TriangleAlert size={13} /> Ada perubahan yang gagal disimpan.</>
              ) : sedangSimpan.length > 0 || adaKotor ? (
                <><Loader2 size={13} className="animate-spin" /> Menyimpan…</>
              ) : (
                <><Check size={13} /> Semua perubahan tersimpan.</>
              )}
            </p>
            <Button type="button" variant="outline" id="btn_tutup_kelola_tabel" onClick={tutup}>
              Tutup
            </Button>
          </SheetFooter>
        </BagianProvider>
      </SheetContent>
    </Sheet>
  );
}
