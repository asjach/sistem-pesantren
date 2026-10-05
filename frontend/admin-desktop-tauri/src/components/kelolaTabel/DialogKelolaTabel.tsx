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
import { BagianProvider, useRegistriBagian, type AksiBagian } from '@/components/kelolaHalaman/kotor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RotateCcw } from '@/icons';
import { cn } from '@/lib/utils';
import { bersihLabel, kanonLabel } from '@/lib/labelKolom';
import { toast } from 'sonner';
import type { ExcelField } from '../excel/types';
import TabKolom from './TabKolom';
import TabNamaPerataan from './TabNamaPerataan';
import TabUrutan from './TabUrutan';
import TabKontrol from './TabKontrol';
import TabFilterTabel from './TabFilterTabel';
import { EVENT_PRESET_BERUBAH } from './jenis';
import type { KunciFilterGlobal } from '@/components/VisibilitasFilter';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';

/** Kabari grid tabel terkait agar memuat ulang preset/susunan kolomnya. */
function kabariPreset(tableKey: string) {
  window.dispatchEvent(new CustomEvent(EVENT_PRESET_BERUBAH, { detail: { tableKey } }));
}

/** Isi section Kolom + Nama & Perataan untuk satu tabel: lem preset kolom
 *  (cermin logika `PresetKolom`, tanpa dropdown pemilih) plus editor nama
 *  header & perataan — hasil simpan diterapkan ke grid lewat event agar grid
 *  terkait menyegarkan dirinya sendiri. State nama header diangkat ke sini
 *  agar section Kolom (simpan preset) dan Nama & Perataan (edit) sinkron. */
function KelolaKolomTabel({
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

  /** Nama header kustom susunan yang dibuka (satu nilai per kolom, dipakai
   *  section Kolom saat simpan + diedit di section Nama & Perataan). */
  const [label, setLabel] = useState<Record<string, string>>({});
  const labelAwalRef = useRef(kanonLabel({}));

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  const muat = useCallback(async () => {
    try {
      const res = await listPresetTabel(tableKey);
      setPresets(res.data.presets);
      setBawaanId(res.data.default_preset_id);
      // Buka pada susunan yang benar-benar dipakai halaman ini: preset aktif,
      // lalu preset bawaan (cermin `PresetKolom`), kalau tidak "Lengkap
      // (semua kolom)"/"Lengkap kustom". Dialog jadi mencerminkan isi tabel,
      // bukan daftar kosong.
      const aktifId = res.data.aktif_preset_id ?? res.data.default_preset_id;
      const aktif = aktifId === null
        ? null
        : res.data.presets.find((p) => p.id === aktifId) ?? null;
      const kolomKustom = aktif === null ? res.data.aktif_kolom ?? null : null;
      const labelKustom = aktif === null ? res.data.aktif_label ?? null : null;
      const labelBersih = bersihLabel(aktif ? (aktif.label ?? null) : labelKustom, fieldKeys);
      setLabel(labelBersih);
      labelAwalRef.current = kanonLabel(labelBersih);
      setKelola((s) => ({ preset: aktif, lengkap: aktif === null, kolomAwal: kolomKustom, nonce: s.nonce + 1 }));
    } catch (e) {
      setPresets([]);
      setBawaanId(null);
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
   *  bertahan antar muat ulang, lalu minta grid memuatnya. */
  const pakaiLengkap = useCallback((keys: string[], label: Record<string, string>) => {
    const efektif = keys.filter((k) => fieldKeys.has(k));
    const labelBersih: Record<string, string> = {};
    for (const [k, v] of Object.entries(label)) {
      if (fieldKeys.has(k) && v.trim() !== '') labelBersih[k] = v.trim();
    }
    void setPresetAktif(tableKey, null, efektif, Object.keys(labelBersih).length > 0 ? labelBersih : null)
      .then(() => {
        kabariPreset(tableKey);
        toast.success('Susunan kolom disimpan.');
      })
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [fieldKeys, tableKey]);

  return (
    <>
      <Bagian id="bagian_kolom_tabel" judul="Kolom">
        <TabKolom
          key={kelola.nonce}
          tableKey={tableKey}
          fields={fields}
          kolomAwal={kelola.kolomAwal}
          fieldKeys={fieldKeys}
          presets={presets}
          presetAwal={kelola.preset}
          mulaiLengkap={kelola.lengkap}
          onPilihLengkap={() => {
            setLabel({});
            labelAwalRef.current = kanonLabel({});
            setKelola((s) => ({ preset: null, lengkap: true, kolomAwal: null, nonce: s.nonce + 1 }));
          }}
          bawaanId={bawaanId}
          onPilihPreset={(p) => {
            const bersih = bersihLabel(p?.label ?? null, fieldKeys);
            setLabel(bersih);
            labelAwalRef.current = kanonLabel(bersih);
            setKelola((s) => ({ preset: p, lengkap: false, kolomAwal: null, nonce: s.nonce + 1 }));
          }}
          onTersimpan={async (id) => {
            await setPresetAktif(tableKey, id);
            kabariPreset(tableKey);
            await muat();
          }}
          onPakaiLengkap={pakaiLengkap}
          onDihapus={async () => {
            await setPresetAktif(tableKey, null);
            kabariPreset(tableKey);
            await muat();
          }}
          label={label}
          setLabel={setLabel}
          labelAwalRef={labelAwalRef}
        />
      </Bagian>
      <Bagian id="bagian_nama_perataan_tabel" judul="Nama & Perataan">
        <TabNamaPerataan
          key={kelola.nonce}
          tableKey={tableKey}
          fields={fields}
          fieldKeys={fieldKeys}
          label={label}
          setLabel={setLabel}
        />
      </Bagian>
    </>
  );
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                id={`btn_kembalikan_${id}`}
                className="ml-auto"
                aria-label={aksi.label}
                disabled={aksi.disabled}
                onClick={aksi.onClick}
              >
                <RotateCcw />
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

/** Satu pintu pengaturan satu tabel: filter topBar + preset kolom + nama &
 *  perataan + preset urutan + visibilitas toolbar. Dibuka dari tabel terkait
 *  (menu konteks header) atau dari topBar halaman yang hanya punya satu tabel. */
export default function DialogKelolaTabel({
  open,
  onOpenChange,
  tableKey,
  judul,
  fields,
  filterRelevan = [],
  filterBawaan,
  filterModeBawaan,
  jumlahTabel = 1,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: string;
  /** Judul tabel tampil (boleh node, mis. header kaya dari grid). */
  judul: ReactNode;
  /** Fields tabel (dari grid); tanpa fields section Kolom diganti keterangan. */
  fields?: ExcelField[];
  /** Konteks filter halaman (dari registrasi halaman, bila ada). */
  filterRelevan?: readonly KunciFilterGlobal[];
  filterBawaan?: TampilFilterGlobal;
  filterModeBawaan?: ModeSemuaFilterGlobal;
  /** Jumlah tabel halaman (untuk catatan merge filter). */
  jumlahTabel?: number;
}) {
  /** Status kotor per bagian (semua bagian tampil sekaligus). */
  const [kotorBagian, setKotorBagian] = useState<Record<string, boolean>>({});
  /** Fungsi simpan tiap bagian, dipakai tombol Simpan terpadu. */
  const simpanBagianRef = useRef<Record<string, () => void>>({});
  /** Aksi ikon tiap bagian (mis. kembalikan bawaan). */
  const [aksiBagian, setAksiBagian] = useState<Record<string, AksiBagian>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  /** Aksi tertunda yang menunggu konfirmasi "buang perubahan?". */
  const [aksiTertunda, setAksiTertunda] = useState<(() => void) | null>(null);

  /** Ada perubahan belum tersimpan di bagian mana pun. */
  const adaKotor = Object.values(kotorBagian).some(Boolean);
  /** Cermin `adaKotor` untuk keputusan sinkron (state React baru terlihat
   *  pada render berikutnya). */
  const kotorRef = useRef(false);
  kotorRef.current = adaKotor;
  const lapor = useCallback((id: string, v: boolean) => {
    setKotorBagian((prev) => (prev[id] === v ? prev : { ...prev, [id]: v }));
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
  /** Urutan simpan: preset kolom dulu (membuat id bila preset baru),
   *  lalu nama & perataan, urutan, toolbar; filter terakhir agar penanda
   *  halaman disegarkan setelah setelan lain selesai. */
  const URUTAN_BAGIAN = ['kolom', 'tampilan', 'urutan', 'kontrol', 'filter'] as const;

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

  // Saat dibuka: bersihkan penanda kotor dan aksi tertunda.
  useEffect(() => {
    if (!open) return;
    setKotorBagian({});
    setAksiTertunda(null);
  }, [open, tableKey]);

  const adaFilter = filterRelevan.length > 0 && !!filterBawaan && !!filterModeBawaan;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : tutup())}>
      <DialogContent className="!flex h-[85dvh] max-h-[85dvh] flex-col !overflow-hidden !p-2 sm:max-w-2xl lg:max-w-4xl [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2">
        <BagianProvider value={registri}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Kelola tabel: {judul}</DialogTitle>
            <DialogDescription className="sr-only">
              Atur kolom, nama & perataan, urutan, toolbar, dan filter tabel ini.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {fields ? (
              <KelolaKolomTabel key={tableKey} tableKey={tableKey} fields={fields} />
            ) : (
              <Bagian id="bagian_kolom_tabel" judul="Kolom">
                <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                  Tabel “{judul}” tidak memakai preset kolom — kelola kolomnya dari toolbar tabel
                  masing-masing.
                </p>
              </Bagian>
            )}

            <Bagian id="bagian_urutan_tabel" judul="Urutan">
              <TabUrutan key={tableKey} tableKey={tableKey} />
            </Bagian>

            {/* Toolbar (kiri) dan Filter (kanan) berdampingan; menumpuk di
                layar sempit, dan Toolbar melebar penuh bila tabel tanpa filter. */}
            <div className={cn(
              'grid grid-cols-1 items-start gap-4',
              adaFilter && 'lg:grid-cols-2',
            )}>
              <Bagian id="bagian_toolbar_tabel" judul="Toolbar" aksi={aksiBagian.kontrol}>
                <TabKontrol key={tableKey} tableKey={tableKey} />
              </Bagian>
              {adaFilter ? (
                <Bagian id="bagian_filter_tabel" judul="Filter" aksi={aksiBagian.filter}>
                  <TabFilterTabel
                    tableKey={tableKey}
                    filterRelevan={filterRelevan}
                    bawaan={filterBawaan}
                    modeBawaan={filterModeBawaan}
                    catatan={jumlahTabel > 1
                      ? 'Filter topBar dipakai bersama seluruh tabel halaman ini — digabung: tampil bila ada tabel yang mengaktifkan, mode Jamak menang.'
                      : undefined}
                  />
                </Bagian>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" id="btn_tutup_kelola_tabel" onClick={tutup}>
              Tutup
            </Button>
            <Button
              type="button"
              id="btn_simpan_kelola_tabel"
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
              Perubahan yang belum disimpan akan hilang bila dilanjutkan. Pilih Batal lalu tekan
              Simpan untuk menyimpannya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              id="btn_buang_perubahan_kelola_tabel"
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
