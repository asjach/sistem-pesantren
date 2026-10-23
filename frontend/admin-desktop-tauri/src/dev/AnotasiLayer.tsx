import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ClipboardList, RefreshCw, SquareMousePointer, Trash2, X } from '@/icons';
import {
  bacaKonteks,
  buatId,
  hapusAnotasi,
  muatAnotasi,
  parentElemen,
  simpanAnotasi,
  tujuanValid,
  type Anotasi,
} from './anotasi';
import { bandingkanStyle, POSISI_RELATIF, stylePerbandinganTersedia, type PosisiRelatif } from './anotasiData';
import DetailStyleAnotasi from './DetailStyleAnotasi';
import PreviewStyleAnotasi from './PreviewStyleAnotasi';
import { PengelolaPreviewStyle } from './previewStyle';
import { useScreenshotAnotasi } from './useScreenshotAnotasi';
import GambarAnotasi from './GambarAnotasi';
import PerbandinganStyleAnotasi from './PerbandinganStyleAnotasi';

const LEBAR_POPOVER = 480;
const TINGGI_POPOVER = 520;
const LABEL_PINTASAN = 'Ctrl/⌘+Shift+A';
const PEMILIH_INTERAKTIF = 'button, a, input, select, textarea, label, [role="button"], [role="tab"], [role="menuitem"]';
const WADAH_FOKUS = '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]';

/** Abaikan lapisan anotasi; klik ikon di dalam tombol tetap menandai tombolnya. */
function sasaranTerpilih(el: Element): Element | null {
  if (el.closest('[data-anotasi-abaikan], [data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]')) return null;
  return el.closest(PEMILIH_INTERAKTIF) ?? el;
}

function posisiPopover(rect: DOMRect, wadah: Element | null) {
  const kotakWadah = wadah?.getBoundingClientRect() ?? null;
  const lebar = Math.min(
    LEBAR_POPOVER,
    window.innerWidth - 16,
    kotakWadah ? kotakWadah.width - 8 : Number.POSITIVE_INFINITY,
  );

  const kiri = kotakWadah
    ? Math.min(
      Math.max(4, rect.left - kotakWadah.left),
      Math.max(4, kotakWadah.width - lebar - 4),
    )
    : Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - lebar - 8));

  const batasBawah = kotakWadah ? kotakWadah.height - 4 : window.innerHeight - 8;
  const bawah = (kotakWadah ? rect.bottom - kotakWadah.top : rect.bottom) + 8;
  const atasCadangan = (kotakWadah ? rect.top - kotakWadah.top : rect.top) - TINGGI_POPOVER - 8;
  const atas = bawah + TINGGI_POPOVER > batasBawah
    ? Math.max(kotakWadah ? 4 : 8, atasCadangan)
    : bawah;

  return {
    left: kiri, top: atas, width: lebar,
    maxHeight: Math.max(0, batasBawah - atas),
  };
}

function DetailElemen({ label, elemen, awal, onPilih, onSorot, pengelolaPreview, onPreview, menyimpan }: {
  label: 'Asal' | 'Tujuan' | 'Referensi';
  elemen: Element;
  awal: Element;
  onPilih: (el: Element) => void;
  onSorot: (rect: DOMRect | null) => void;
  pengelolaPreview: PengelolaPreviewStyle;
  onPreview: () => void;
  menyimpan: boolean;
}) {
  const konteks = bacaKonteks(elemen);
  return (
    <section aria-label={`Elemen ${label.toLowerCase()}`} className="min-w-0 border border-border p-2">
      <h3 className="mb-1 text-xs font-semibold">{label}</h3>
      <div aria-label={`Parent ${label.toLowerCase()}`} className="mb-1 flex flex-wrap items-center gap-1">
        {parentElemen(awal).map((el, index) => {
          const nama = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`;
          return (
            <span key={index} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 && <span aria-hidden="true">→</span>}
              <button
                type="button"
                disabled={menyimpan}
                aria-label={`Pilih ${label.toLowerCase()}: ${nama}`}
                aria-pressed={el === elemen}
                title={nama}
                className="max-w-full break-all border border-border px-1 py-0.5 font-mono text-[11px] hover:bg-accent aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onMouseEnter={() => onSorot(el.getBoundingClientRect())}
                onMouseLeave={() => onSorot(null)}
                onFocus={() => onSorot(el.getBoundingClientRect())}
                onBlur={() => onSorot(null)}
                onClick={() => { onPilih(el); onSorot(null); }}
              >
                {nama}
              </button>
            </span>
          );
        })}
      </div>
      <dl className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px] leading-snug">
        <dt className="text-muted-foreground">Sumber</dt>
        <dd className="min-w-0 break-all font-mono select-text">{konteks.sumber ?? (konteks.komponen.join(' > ') || konteks.tag)}</dd>
        <dt className="text-muted-foreground">Selector</dt>
        <dd className="min-w-0 break-all font-mono select-text">{konteks.selector}</dd>
      </dl>
      <DetailStyleAnotasi elemen={elemen} label={label.toLowerCase()} />
      {label !== 'Referensi' && <PreviewStyleAnotasi key={konteks.selector} elemen={elemen} label={label.toLowerCase()} pengelola={pengelolaPreview} onUbah={onPreview} disabled={menyimpan} />}
    </section>
  );
}

function Sorotan({ rect, label, tujuan = false, referensi = false }: { rect: DOMRect; label: string; tujuan?: boolean; referensi?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed border-2 ${referensi ? 'border-violet-500 bg-violet-500/10' : tujuan ? 'border-amber-500 bg-amber-500/10' : 'border-primary bg-primary/10'}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <span className={`absolute left-0 max-w-full px-1 text-[10px] ${rect.top > 20 ? 'bottom-full' : 'top-0'} ${referensi ? 'bg-violet-700 text-white' : tujuan ? 'bg-amber-500 text-black' : 'bg-primary text-primary-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

/**
 * Lapisan anotasi UI mode dev. Aktifkan mode tandai, klik elemen, lalu tulis
 * instruksi; hasilnya ditulis ke `.dev/anotasi.json` untuk dibaca agen.
 */
export default function AnotasiLayer({ rute }: { rute?: string }) {
  const [pengelolaPreview] = useState(() => new PengelolaPreviewStyle());
  const [aktif, setAktif] = useState(false);
  const [panel, setPanel] = useState(false);
  const [daftar, setDaftar] = useState<Anotasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [sorot, setSorot] = useState<DOMRect | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  const [asalAwal, setAsalAwal] = useState<Element | null>(null);
  const [tujuan, setTujuan] = useState<Element | null>(null);
  const [tujuanAwal, setTujuanAwal] = useState<Element | null>(null);
  const [memilih, setMemilih] = useState<'tujuan' | 'referensi' | null>(null);
  const memilihTujuan = memilih === 'tujuan';
  const [referensi, setReferensi] = useState<Element | null>(null);
  const [referensiAwal, setReferensiAwal] = useState<Element | null>(null);
  const [galatReferensi, setGalatReferensi] = useState<string | null>(null);
  const [posisiRelatif, setPosisiRelatif] = useState<PosisiRelatif>('di_dalam');
  const [sorotParent, setSorotParent] = useState<DOMRect | null>(null);
  const [galatPilihan, setGalatPilihan] = useState<string | null>(null);
  const [instruksi, setInstruksi] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [versiPreview, setVersiPreview] = useState(0);
  const screenshot = useScreenshotAnotasi(target, tujuan, versiPreview, !!(target && pengelolaPreview.snapshot(target)) || !!(tujuan && pengelolaPreview.snapshot(tujuan)));
  const sibuk = menyimpan || screenshot.mengambil;
  const identitasDraft = useRef<{ id: string; dibuat: string } | null>(null);
  const refTextarea = useRef<HTMLTextAreaElement>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setDaftar(await muatAnotasi());
      setGalat(null);
    } catch {
      setGalat('Tidak dapat memuat anotasi. Pastikan dev server berjalan.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const pilih = useCallback((el: Element) => {
    if (memilih === 'referensi' && target) {
      if (el === target) { setGalatPilihan('Referensi tampilan harus berbeda dari asal.'); return; }
      setReferensi(el);
      setReferensiAwal(el);
      setGalatReferensi(null);
      setMemilih(null);
      setSorot(target.getBoundingClientRect());
      setGalatPilihan(null);
      setAktif(false);
      return;
    }
    if (memilihTujuan && target) {
      if (!tujuanValid(target, el)) {
        setGalatPilihan('Pilih tujuan yang berbeda dari asal dan bukan elemen di dalam asal.');
        return;
      }
      if (tujuan && tujuan !== el) pengelolaPreview.reset(tujuan);
      setTujuan(el);
      setTujuanAwal(el);
      setMemilih(null);
      setSorot(target.getBoundingClientRect());
      setGalatPilihan(null);
      setAktif(false);
      return;
    }
    setTarget(el);
    setAsalAwal(el);
    setSorot(el.getBoundingClientRect());
    setInstruksi('');
    setAktif(false);
  }, [memilih, memilihTujuan, target, tujuan, pengelolaPreview]);

  const batal = useCallback(() => {
    pengelolaPreview.resetSemua();
    identitasDraft.current = null;
    setTarget(null);
    setAsalAwal(null);
    setTujuan(null);
    setTujuanAwal(null);
    setMemilih(null);
    setReferensi(null);
    setReferensiAwal(null);
    setGalatReferensi(null);
    setPosisiRelatif('di_dalam');
    setSorotParent(null);
    setGalatPilihan(null);
    setSorot(null);
    setInstruksi('');
  }, [pengelolaPreview]);

  useEffect(() => {
    batal();
    setAktif(false);
  }, [rute, batal]);

  useEffect(() => () => pengelolaPreview.resetSemua(), [pengelolaPreview]);

  const perbaruiPreview = useCallback(() => {
    setVersiPreview((versi) => versi + 1);
    setSorot(target?.getBoundingClientRect() ?? null);
  }, [target]);

  const batalPemilihan = useCallback(() => {
    setAktif(false);
    setMemilih(null);
    setGalatPilihan(null);
    setSorot(target?.getBoundingClientRect() ?? null);
  }, [target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && (aktif || target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (sibuk) return;
        if (memilih) batalPemilihan();
        else { batal(); setAktif(false); }
        return;
      }
      if (e.repeat || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'a') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (sibuk) return;
      batal();
      setAktif((nyala) => !nyala);
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [batal, aktif, target, memilih, batalPemilihan, sibuk]);

  useEffect(() => {
    if (!aktif) return;

    const akar = document.documentElement;
    const kursorLama = akar.style.cursor;
    akar.style.cursor = 'crosshair';

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sasaran = el instanceof Element && el !== document.documentElement ? sasaranTerpilih(el) : null;
      setSorot(sasaran ? sasaran.getBoundingClientRect() : null);
    };

    const onClick = (e: MouseEvent) => {
      const asal = e.target;
      if (asal instanceof Element && asal.closest('[data-anotasi-abaikan]')) return;

      e.preventDefault();
      e.stopPropagation();

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sasaran = el instanceof Element && el !== document.documentElement ? sasaranTerpilih(el) : null;
      if (sasaran) pilih(sasaran);
    };

    // Cegah aksi button dan dismiss dialog pada pointerdown selama pemilihan.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-anotasi-abaikan]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      akar.style.cursor = kursorLama;
    };
  }, [aktif, pilih]);

  useEffect(() => {
    if (!target) return;

    const perbarui = () => {
      if (!target.isConnected) {
        batal();
        return;
      }
      if (tujuan && !tujuan.isConnected) {
        pengelolaPreview.reset(tujuan);
        setTujuan(null);
        setTujuanAwal(null);
        setGalatPilihan('Elemen tujuan sudah tidak tersedia. Pilih tujuan kembali.');
      }
      setSorot(target.getBoundingClientRect());
    };

    perbarui();
    window.addEventListener('scroll', perbarui, true);
    window.addEventListener('resize', perbarui);

    return () => {
      window.removeEventListener('scroll', perbarui, true);
      window.removeEventListener('resize', perbarui);
    };
  }, [target, tujuan, batal, pengelolaPreview]);

  useEffect(() => {
    if (target && !aktif) refTextarea.current?.focus();
  }, [target, aktif]);

  useEffect(() => {
    if (!target) return;

    const periksa = () => {
      if (!target.isConnected) { batal(); setAktif(false); return; }
      else if (tujuan && !tujuan.isConnected) {
        pengelolaPreview.reset(tujuan);
        setTujuan(null);
        setTujuanAwal(null);
        setGalatPilihan('Elemen tujuan sudah tidak tersedia. Pilih tujuan kembali.');
      }
      if (referensi && !referensi.isConnected) setGalatReferensi('Elemen referensi sudah tidak tersedia. Pilih kembali atau hapus referensi sebelum Simpan.');
    };
    const observer = new MutationObserver(periksa);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [target, tujuan, referensi, batal, pengelolaPreview]);

  async function simpan() {
    if (!target || !target.isConnected || !instruksi.trim() || sibuk || aktif) return;
    if (!screenshot.validasi()) return;
    if (referensi && (!referensi.isConnected || referensi === target)) {
      setGalatReferensi('Referensi tidak valid. Pilih kembali atau hapus referensi sebelum Simpan.');
      return;
    }
    if (tujuan && (!tujuan.isConnected || !tujuanValid(target, tujuan))) {
      setGalatPilihan('Tujuan tidak valid. Pilih tujuan kembali.');
      return;
    }

    setMenyimpan(true);
    try {
      const konteksPreview = (elemen: Element) => {
        const preview = pengelolaPreview.snapshot(elemen);
        return { ...bacaKonteks(elemen, true), ...(preview ? { preview } : {}) };
      };
      const konteksAsal = konteksPreview(target);
      const konteksReferensi = referensi ? konteksPreview(referensi) : null;
      if (konteksReferensi && (!stylePerbandinganTersedia(konteksAsal.style) || !stylePerbandinganTersedia(konteksReferensi.style))) {
        setGalatReferensi('Style asal atau referensi tidak dapat dibaca. Pilih kembali atau hapus referensi.');
        return;
      }
      const baru: Anotasi = {
        ...(identitasDraft.current ??= { id: buatId(), dibuat: new Date().toISOString() }),
        rute: `${window.location.pathname}${window.location.search}`,
        ...konteksAsal,
        instruksi: instruksi.trim(),
        ...(tujuan ? { tujuan: { ...konteksPreview(tujuan), posisi: posisiRelatif } } : {}),
      };
      if (konteksReferensi) {
        baru.referensi = konteksReferensi;
        baru.perbedaan_style = bandingkanStyle(konteksAsal.style!, konteksReferensi.style!);
      }
      if (screenshot.gambar) baru.gambar = { ...screenshot.gambar.metadata, berkas: `screenshots/${baru.id}.png` };
      const tersimpan = screenshot.gambar ? await simpanAnotasi(baru, screenshot.gambar.blob) : await simpanAnotasi(baru);
      setDaftar((lama) => [...lama, tersimpan]);
      batal();
      toast.success('Anotasi tersimpan');
    } catch {
      toast.error('Gagal menyimpan anotasi. Pastikan dev server berjalan.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    try {
      await hapusAnotasi(id);
      setDaftar((lama) => lama.filter((a) => a.id !== id));
      toast.success('Anotasi dihapus');
    } catch {
      toast.error('Gagal menghapus anotasi.');
    }
  }

  const wadahFokus = target?.closest(WADAH_FOKUS) ?? null;
  const posisi = target && sorot ? posisiPopover(sorot, wadahFokus) : null;
  const infoPemilihan = (
    <div data-anotasi-abaikan onFocus={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className="pointer-events-auto fixed top-2 left-1/2 z-[10000] flex max-w-[calc(100%-16px)] -translate-x-1/2 flex-col gap-1 border border-primary bg-popover p-2 text-xs text-popover-foreground shadow-lg">
      <p>{memilih ? `Klik elemen ${memilih === 'referensi' ? 'referensi tampilan' : 'tujuan'} · Esc kembali ke instruksi` : `Klik elemen untuk diberi instruksi · ${LABEL_PINTASAN} · Esc batal`}</p>
      {galatPilihan && <p role="alert" className="text-destructive">{galatPilihan}</p>}
      {memilih && <Button type="button" size="sm" variant="outline" onClick={batalPemilihan}>Batal memilih {memilih}</Button>}
    </div>
  );

  const lapisan = createPortal(
    <div
      data-anotasi-abaikan
      data-slot="anotasi-dev"
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      {target && <Sorotan rect={target.getBoundingClientRect()} label="Asal" />}
      {tujuan && <Sorotan rect={tujuan.getBoundingClientRect()} label={tujuan === referensi ? 'Tujuan · Referensi tampilan' : 'Tujuan'} tujuan />}
      {referensi?.isConnected && referensi !== tujuan && <Sorotan rect={referensi.getBoundingClientRect()} label="Referensi tampilan" referensi />}
      {aktif && sorot && <Sorotan rect={sorot} label={memilih ? `Calon ${memilih}` : 'Calon asal'} tujuan={memilihTujuan} referensi={memilih === 'referensi'} />}
      {sorotParent && <Sorotan rect={sorotParent} label="Parent" />}

      {aktif && (wadahFokus ? createPortal(infoPemilihan, wadahFokus) : infoPemilihan)}

      {target && asalAwal && posisi && !aktif && (() => {
        const isi = (
        <div
          data-anotasi-abaikan
          role="region"
          aria-label="Editor anotasi"
          // Portal berada di DOM dialog tetapi bukan di React tree FocusScope.
          // Hentikan event di sini agar Radix tidak menganggapnya interaksi luar.
          onFocus={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed z-20 flex flex-col border border-border bg-popover p-2 text-popover-foreground shadow-lg"
          style={posisi}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Instruksi untuk agent
            </span>
          </div>

          <div className="mb-2 flex min-h-0 flex-col gap-2 overflow-y-auto">
            <DetailElemen label="Asal" elemen={target} awal={asalAwal} onSorot={setSorotParent} pengelolaPreview={pengelolaPreview} onPreview={perbaruiPreview} menyimpan={sibuk} onPilih={(el) => {
              if (sibuk) return;
              if (target !== el) pengelolaPreview.reset(target);
              setTarget(el);
              setSorot(el.getBoundingClientRect());
              if (el === referensi) {
                setReferensi(null);
                setReferensiAwal(null);
                setGalatReferensi('Asal baru sama dengan referensi. Pilih referensi tampilan kembali bila diperlukan.');
              }
              if (tujuan && !tujuanValid(el, tujuan)) {
                pengelolaPreview.reset(tujuan);
                setTujuan(null);
                setTujuanAwal(null);
                setGalatPilihan('Tujuan tidak sesuai dengan asal yang baru. Pilih tujuan kembali.');
              }
            }} />
            {tujuan && tujuanAwal && <DetailElemen label="Tujuan" elemen={tujuan} awal={tujuanAwal} onSorot={setSorotParent} pengelolaPreview={pengelolaPreview} onPreview={perbaruiPreview} menyimpan={sibuk} onPilih={(el) => {
              if (sibuk) return;
              if (!tujuanValid(target, el)) {
                setGalatPilihan('Asal dan tujuan harus berbeda; tujuan tidak boleh berada di dalam asal.');
                return;
              }
              if (tujuan !== el) pengelolaPreview.reset(tujuan);
              setTujuan(el);
              setGalatPilihan(null);
            }} />}
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => {
                setMemilih('tujuan');
                setGalatPilihan(null);
                setPanel(false);
                setAktif(true);
              }}>{tujuan ? 'Ganti tujuan' : 'Pilih tujuan'}</Button>
              {tujuan && <Button type="button" variant="ghost" size="sm" disabled={sibuk} onClick={() => {
                pengelolaPreview.reset(tujuan);
                setTujuan(null);
                setTujuanAwal(null);
                setPosisiRelatif('di_dalam');
                setGalatPilihan(null);
              }}>Hapus tujuan</Button>}
            </div>
            {tujuan ? <label className="flex flex-col gap-1 text-xs" htmlFor="posisi_tujuan_anotasi">
              Posisi terhadap tujuan
              <select id="posisi_tujuan_anotasi" disabled={sibuk} value={posisiRelatif} onChange={(e) => setPosisiRelatif(e.target.value as PosisiRelatif)} className="w-full border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {Object.entries(POSISI_RELATIF).map(([nilai, label]) => <option key={nilai} value={nilai}>{label}</option>)}
              </select>
            </label> : <p className="text-[11px] text-muted-foreground">Tujuan opsional; anotasi biasa dapat langsung disimpan.</p>}
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-[11px] text-muted-foreground">Referensi tampilan adalah acuan style, bukan tujuan pemindahan. Keduanya dapat dipilih secara terpisah.</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => {
                  setMemilih('referensi');
                  setGalatPilihan(null);
                  setPanel(false);
                  setAktif(true);
                }}>{referensi ? 'Ganti referensi tampilan' : 'Pilih referensi tampilan'}</Button>
                {referensi && <Button type="button" variant="ghost" size="sm" disabled={sibuk} onClick={() => {
                  setReferensi(null);
                  setReferensiAwal(null);
                  setGalatReferensi(null);
                }}>Hapus referensi</Button>}
              </div>
            </div>
            {referensi && referensiAwal && <>
              <DetailElemen label="Referensi" elemen={referensi} awal={referensiAwal} onSorot={setSorotParent} pengelolaPreview={pengelolaPreview} onPreview={perbaruiPreview} menyimpan={sibuk} onPilih={(el) => {
                if (sibuk) return;
                if (el === target) { setGalatReferensi('Referensi tampilan harus berbeda dari asal.'); return; }
                setReferensi(el);
                setGalatReferensi(null);
              }} />
              <PerbandinganStyleAnotasi key={`${bacaKonteks(target).selector}|${bacaKonteks(referensi).selector}`} asal={target} referensi={referensi} disabled={sibuk} previewAktif={!!pengelolaPreview.snapshot(target) || !!pengelolaPreview.snapshot(referensi)} />
            </>}
            {galatReferensi && <p role="alert" className="text-xs text-destructive">{galatReferensi}</p>}
            {galatPilihan && <p role="alert" className="text-xs text-destructive">{galatPilihan}</p>}
            <section aria-label="Screenshot anotasi" className="border-t border-border pt-2">
              <p className="mb-1 text-[11px] text-muted-foreground">Opsional: ambil area asal dan tujuan yang terlihat, tanpa editor. Periksa gambar sebelum Simpan; render canvas atau konten eksternal mungkin berbeda.</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void screenshot.ambil()}>{screenshot.mengambil ? 'Mengambil screenshot…' : screenshot.gambar ? 'Ambil ulang screenshot' : 'Ambil screenshot'}</Button>
                {screenshot.gambar && <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={screenshot.reset}>Buang screenshot</Button>}
              </div>
              {screenshot.mengambil && <p role="status" className="text-xs">Sedang menyiapkan gambar…</p>}
              {screenshot.galat && <p role="alert" className="mt-1 text-xs text-destructive">{screenshot.galat}</p>}
              {screenshot.gambar && <GambarAnotasi key={screenshot.gambar.url} url={screenshot.gambar.url} metadata={screenshot.gambar.metadata} />}
            </section>
          </div>

          <textarea
            ref={refTextarea}
            id="input_instruksi_anotasi"
            aria-label="Instruksi untuk agent"
            rows={3}
            disabled={sibuk}
            className="min-h-20 w-full shrink-0 resize-none border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Contoh: samakan font NIS dengan kolom lain"
            value={instruksi}
            onChange={(e) => setInstruksi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void simpan();
              }
            }}
          />

          <div className="mt-1 flex shrink-0 items-center justify-end gap-2">
            <span className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={sibuk} onClick={batal}>
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!instruksi.trim() || sibuk}
                onClick={() => void simpan()}
              >
                {menyimpan ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </span>
          </div>
        </div>
        );
        return wadahFokus ? createPortal(isi, wadahFokus) : isi;
      })()}

      {panel && (
        <section
          aria-label="Daftar anotasi UI"
          className="pointer-events-auto fixed top-12 right-3 z-10 flex max-h-[min(60vh,calc(100vh-60px))] w-[380px] max-w-[calc(100vw-24px)] flex-col border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
            <span className="text-[11px] font-semibold tracking-wide uppercase">Anotasi UI</span>
            <span className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Muat ulang anotasi"
                onClick={() => void muat()}
              >
                <RefreshCw />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Tutup daftar anotasi"
                onClick={() => setPanel(false)}
              >
                <X />
              </Button>
            </span>
          </div>

          <p className="border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
            Tersimpan di <span className="font-mono">.dev/anotasi.json</span> untuk dibaca agent.
            {' '}Pintasan <span className="font-mono">{LABEL_PINTASAN}</span> juga aktif saat dialog terbuka.
          </p>

          {galat && (
            <p className="m-2 border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {galat}
            </p>
          )}

          <div className="min-h-0 overflow-y-auto">
            {memuat && !daftar.length ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">Memuat anotasi…</p>
            ) : daftar.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">
                Belum ada anotasi. Aktifkan mode tandai lalu klik elemen.
              </p>
            ) : (
              [...daftar].reverse().map((a) => (
                <div key={a.id} className="flex items-start gap-2 border-b border-border px-2 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="truncate font-mono">{a.rute || '/'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate font-mono">{a.sumber ?? a.selector}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug">{a.instruksi}</p>
                    {a.gambar && <GambarAnotasi url={`/__anotasi/gambar?id=${encodeURIComponent(a.id)}`} metadata={a.gambar} />}
                    {a.tujuan && <div className="mt-1 text-[11px]">
                      <p><span className="font-semibold">Asal:</span> <span className="break-all font-mono select-text">{a.selector}</span></p>
                      <p><span className="font-semibold">Tujuan · {POSISI_RELATIF[a.tujuan.posisi]}:</span> <span className="break-all font-mono select-text">{a.tujuan.selector}</span></p>
                      {a.tujuan.sumber && <p className="break-all font-mono text-muted-foreground select-text">{a.tujuan.sumber}</p>}
                    </div>}
                    {a.referensi && <div className="mt-1 text-[11px]">
                      <p><span className="font-semibold">Referensi tampilan:</span> <span className="break-all font-mono select-text">{a.referensi.selector}</span></p>
                      <p className="text-muted-foreground">{a.perbedaan_style?.length ?? 0} properti berbeda · bukan tujuan pemindahan.</p>
                    </div>}
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {a.komponen.join(' > ') || a.tag}
                      {a.teks ? ` · "${a.teks}"` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Hapus anotasi: ${a.instruksi.slice(0, 60)}`}
                    onClick={() => void hapus(a.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

    </div>,
    document.body,
  );

  return (
    <>
      {lapisan}
      <div data-anotasi-abaikan className="flex shrink-0 items-center gap-0.5">
        <Button
          id="btn_buka_anotasi"
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Buka daftar anotasi (${daftar.length})`}
          aria-expanded={panel}
          title="Daftar anotasi UI (mode dev)"
          onClick={() => setPanel((buka) => !buka)}
          className="relative text-[color-mix(in_srgb,var(--sidebar-foreground)_75%,transparent)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-[color:var(--chrome-ring)]"
        >
          <ClipboardList size={14} />
          {daftar.length > 0 && (
            <span className="pointer-events-none absolute -top-1 -right-1 min-w-[14px] bg-primary px-1 text-center text-[9px] leading-[14px] text-primary-foreground">
              {daftar.length}
            </span>
          )}
        </Button>

        <Button
          id="btn_tandai_elemen"
          type="button"
          variant={aktif ? 'default' : 'ghost'}
          size="icon"
          aria-label={aktif ? 'Matikan mode tandai elemen' : 'Tandai elemen untuk agent'}
          aria-keyshortcuts="Control+Shift+A Meta+Shift+A"
          aria-pressed={aktif}
          disabled={sibuk}
          className={aktif ? 'focus-visible:ring-[color:var(--chrome-ring)]' : 'text-[color-mix(in_srgb,var(--sidebar-foreground)_75%,transparent)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)] focus-visible:ring-[color:var(--chrome-ring)]'}
          title={`Tandai elemen untuk agent (mode dev, ${LABEL_PINTASAN})`}
          onClick={() => {
            batal();
            setAktif((nyala) => !nyala);
          }}
        >
          <SquareMousePointer size={14} />
        </Button>
      </div>
    </>
  );
}
