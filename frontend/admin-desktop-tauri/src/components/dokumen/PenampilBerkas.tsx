import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorMessage } from '../../api/client';
import { formatUkuran } from '@/lib/arsipDokumen';
import {
  EDISI_KOSONG,
  hasilkanGambar,
  muatGambar,
  naturalKeRect,
  rectKeNatural,
  type EdisiGambar,
  type HasilGambar,
  type KualitasSimpan,
} from '@/lib/olahGambar';
import { ChevronLeft, ChevronRight, Download, Minus, Moon, Plus, RotateCcw, Sun, X } from '@/icons';
import { toast } from 'sonner';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export interface SumberBerkas {
  bytes: Uint8Array;
  mime: string;
  nama: string;
}

interface Props {
  sumber: SumberBerkas | null;
  kualitas: KualitasSimpan;
  onKeluaran: (hasil: HasilGambar | null) => void;
  idPrefix?: string;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function pasangWorkerPdf(): Promise<typeof import('pdfjs-dist')> {
  return import('pdfjs-dist').then(async (pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    return pdfjs;
  });
}

function ekstensiDariNama(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(i + 1).toLowerCase() : '';
}

function namaTanpaEkstensi(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(0, i) : nama;
}

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Viewer berkas dokumen: gambar (zoom/putar/crop/kompres) atau PDF (zoom/halaman).
 *  Edisi gambar dilaporkan sebagai byte keluaran untuk alur simpan. */
export default function PenampilBerkas({ sumber, kualitas, onKeluaran, idPrefix = 'penampil' }: Props) {
  const p = idPrefix;
  const gambar = sumber != null && sumber.mime.startsWith('image/');
  const pdf = sumber != null && sumber.mime === 'application/pdf';

  const [edisi, setEdisi] = useState<EdisiGambar>(EDISI_KOSONG);
  const [zoom, setZoom] = useState(1);
  const [gelap, setGelap] = useState(true);
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [modeCrop, setModeCrop] = useState(false);
  const [drafCrop, setDrafCrop] = useState<RectBox | null>(null);

  const bungkusRef = useRef<HTMLDivElement | null>(null);
  const [ukuranWadah, setUkuranWadah] = useState({ w: 0, h: 0 });

  // Reset tampilan saat sumber berganti.
  useEffect(() => {
    setEdisi(EDISI_KOSONG);
    setZoom(1);
    setModeCrop(false);
    setDrafCrop(null);
  }, [sumber]);

  // Ukur wadah untuk skala pas/1:1.
  useEffect(() => {
    const el = bungkusRef.current;
    if (!el) return;
    const ukur = () => setUkuranWadah({ w: el.clientWidth, h: el.clientHeight });
    ukur();
    const amati = new ResizeObserver(ukur);
    amati.observe(el);
    return () => amati.disconnect();
  }, []);

  // URL blob sumber (stabil per sumber; crop/zoom hanya transform CSS).
  const urlSumber = useMemo(() => {
    if (!sumber) return null;
    return URL.createObjectURL(new Blob([sumber.bytes.buffer as ArrayBuffer], { type: sumber.mime }));
  }, [sumber]);
  useEffect(() => () => {
    if (urlSumber) URL.revokeObjectURL(urlSumber);
  }, [urlSumber]);

  // ----- Gambar: dimensi natural untuk matematika tampil -----
  const [dimensi, setDimensi] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!sumber || !gambar) {
      setDimensi(null);
      return;
    }
    let hidup = true;
    muatGambar(sumber.bytes, sumber.mime)
      .then((img) => { if (hidup) setDimensi({ w: img.naturalWidth, h: img.naturalHeight }); })
      .catch(() => { if (hidup) setDimensi(null); });
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber]);

  // Ukuran tampil elemen img (untuk overlay crop yang akurat).
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ukuranTampil, setUkuranTampil] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (!el) {
      setUkuranTampil(null);
      return;
    }
    const ukur = () => setUkuranTampil({ w: el.offsetWidth, h: el.offsetHeight });
    ukur();
    const amati = new ResizeObserver(ukur);
    amati.observe(el);
    return () => amati.disconnect();
  }, [dimensi, zoom, edisi.rotasi, sumber]);

  // ----- Pipeline keluaran (sumber/edisi/kualitas berubah) -----
  useEffect(() => {
    if (!sumber) {
      setKeluaran(null);
      return;
    }
    let hidup = true;
    if (gambar) {
      hasilkanGambar(sumber.bytes, sumber.mime, edisi, kualitas)
        .then((h) => { if (hidup) setKeluaran(h); })
        .catch((e) => {
          if (hidup) {
            setKeluaran(null);
            toast.error(errorMessage(e));
          }
        });
    } else {
      setKeluaran({ bytes: sumber.bytes, mime: sumber.mime, ext: ekstensiDariNama(sumber.nama) || 'pdf' });
    }
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, edisi, kualitas]);

  useEffect(() => {
    onKeluaran(keluaran);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keluaran]);

  // ----- PDF: dokumen + render halaman -----
  const [dokPdf, setDokPdf] = useState<PDFDocumentProxy | null>(null);
  const [halPdf, setHalPdf] = useState(1);
  const [totalHal, setTotalHal] = useState(0);
  const [galatPdf, setGalatPdf] = useState('');
  const kanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sumber || !pdf) {
      setDokPdf(null);
      setTotalHal(0);
      setHalPdf(1);
      setGalatPdf('');
      return;
    }
    let hidup = true;
    let dok: PDFDocumentProxy | null = null;
    setGalatPdf('');
    pasangWorkerPdf()
      .then((pdfjs) => pdfjs.getDocument({ data: sumber.bytes.slice() }).promise)
      .then((d) => {
        if (!hidup) {
          void d.destroy();
          return;
        }
        dok = d;
        setDokPdf(d);
        setTotalHal(d.numPages);
        setHalPdf(1);
      })
      .catch((e) => {
        if (hidup) {
          setGalatPdf(errorMessage(e));
          toast.error(errorMessage(e));
        }
      });
    return () => {
      hidup = false;
      if (dok) void dok.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber]);

  useEffect(() => {
    const kanvas = kanvasRef.current;
    if (!dokPdf || !kanvas || halPdf < 1) return;
    let batal = false;
    let tugas: RenderTask | null = null;
    (async () => {
      try {
        const hal = await dokPdf.getPage(Math.min(halPdf, dokPdf.numPages));
        if (batal) return;
        const dasar = hal.getViewport({ scale: 1 });
        const skala = Math.max(0.2, ((ukuranWadah.w || dasar.width) / dasar.width) * zoom);
        const pandang = hal.getViewport({ scale: skala });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        kanvas.width = Math.round(pandang.width * dpr);
        kanvas.height = Math.round(pandang.height * dpr);
        kanvas.style.width = `${Math.round(pandang.width)}px`;
        kanvas.style.height = `${Math.round(pandang.height)}px`;
        const ctx = kanvas.getContext('2d');
        if (!ctx || batal) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        tugas = hal.render({ canvas: kanvas, canvasContext: ctx, viewport: pandang });
        await tugas.promise;
      } catch (e) {
        if (!batal && (e as Error)?.name !== 'RenderingCancelledException') {
          setGalatPdf(errorMessage(e));
        }
      }
    })();
    return () => {
      batal = true;
      tugas?.cancel();
    };
  }, [dokPdf, halPdf, zoom, ukuranWadah]);

  // ----- Crop gambar (eksklusif dengan putar agar WYSIWYG) -----
  const seretRef = useRef<{ x0: number; y0: number; rw: number; rh: number } | null>(null);

  const putar = useCallback(() => {
    setEdisi((e) => ({ ...e, rotasi: ((e.rotasi + 90) % 360) as EdisiGambar['rotasi'] }));
  }, []);

  function mulaiCrop(e: React.PointerEvent<HTMLDivElement>) {
    if (!modeCrop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const kotak = e.currentTarget.getBoundingClientRect();
    seretRef.current = { x0: e.clientX - kotak.left, y0: e.clientY - kotak.top, rw: kotak.width, rh: kotak.height };
    setDrafCrop(null);
  }
  function gerakCrop(e: React.PointerEvent<HTMLDivElement>) {
    const awal = seretRef.current;
    if (!awal || !modeCrop) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    const x1 = e.clientX - kotak.left;
    const y1 = e.clientY - kotak.top;
    setDrafCrop({
      x: Math.min(awal.x0, x1),
      y: Math.min(awal.y0, y1),
      w: Math.abs(x1 - awal.x0),
      h: Math.abs(y1 - awal.y0),
    });
  }
  function selesaiCrop(terapkan: boolean) {
    const draf = drafCrop;
    const awal = seretRef.current;
    seretRef.current = null;
    setDrafCrop(null);
    if (!terapkan || !draf || !awal || !dimensi || draf.w < 8 || draf.h < 8) return;
    setEdisi((ed) => ({
      ...ed,
      crop: rectKeNatural(draf, awal.rw, awal.rh, dimensi.w, dimensi.h),
    }));
    setModeCrop(false);
  }

  const rectTampil: RectBox | null = drafCrop
    ?? (edisi.crop && dimensi && ukuranTampil
      ? naturalKeRect(edisi.crop, ukuranTampil.w, ukuranTampil.h, dimensi.w, dimensi.h)
      : null);

  // ----- Layar penuh + unduh -----
  const seksiRef = useRef<HTMLElement | null>(null);
  function layarPenuh() {
    const el = seksiRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void el.requestFullscreen().catch((e: unknown) => toast.error(errorMessage(e)));
  }
  function unduhPilih() {
    const aktif = keluaran ?? (sumber ? { bytes: sumber.bytes, mime: sumber.mime, ext: ekstensiDariNama(sumber.nama) } : null);
    if (!sumber || !aktif) return;
    const namaUnduh = `${namaTanpaEkstensi(sumber.nama)}.${aktif.ext || ekstensiDariNama(sumber.nama) || 'bin'}`;
    const url = URL.createObjectURL(new Blob([aktif.bytes.buffer as ArrayBuffer], { type: aktif.mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = namaUnduh;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ----- Matematika tampil gambar -----
  const tegak = edisi.rotasi === 90 || edisi.rotasi === 270;
  const alamiTampil = dimensi ? { w: tegak ? dimensi.h : dimensi.w, h: tegak ? dimensi.w : dimensi.h } : null;
  const pas = alamiTampil && ukuranWadah.w > 0 && ukuranWadah.h > 0
    ? Math.min(ukuranWadah.w / alamiTampil.w, ukuranWadah.h / alamiTampil.h)
    : 1;
  const skalaTampil = pas * zoom;
  const pxLebar = alamiTampil ? Math.max(1, Math.round(alamiTampil.w * skalaTampil)) : 0;
  const pxTinggi = alamiTampil ? Math.max(1, Math.round(alamiTampil.h * skalaTampil)) : 0;
  const aturZoom = (z: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));

  const ukuranSumber = sumber ? formatUkuran(sumber.bytes.length) : '';
  const ukuranKeluar = keluaran && sumber && keluaran.bytes.length !== sumber.bytes.length
    ? formatUkuran(keluaran.bytes.length)
    : '';

  return (
    <section
      ref={seksiRef}
      aria-label="Pratinjau berkas"
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card',
        gelap && 'bg-neutral-950',
      )}
    >
      {/* Kepala: info + bg + penuh */}
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs" title={sumber?.nama ?? undefined}>
          {sumber ? `${sumber.nama} (${ukuranSumber}${ukuranKeluar ? ` → ${ukuranKeluar}` : ''})` : 'Belum ada berkas'}
        </span>
        <Button id={`btn_bg_${p}`} size="sm" variant="ghost" title={gelap ? 'Latar terang' : 'Latar gelap'} onClick={() => setGelap((g) => !g)}>
          {gelap ? <Sun size={14} /> : <Moon size={14} />}
        </Button>
        <Button id={`btn_layar_penuh_${p}`} size="sm" variant="ghost" title="Layar penuh" onClick={layarPenuh} disabled={!sumber}>
          Penuh
        </Button>
      </div>
      {/* Toolbar konteks */}
      {sumber && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1">
          {gambar ? (
            <>
              <Button id={`btn_zoom_kurang_${p}`} size="sm" variant="ghost" title="Perkecil" onClick={() => aturZoom(zoom / 1.25)}>
                <Minus size={14} />
              </Button>
              <span className="min-w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button id={`btn_zoom_tambah_${p}`} size="sm" variant="ghost" title="Perbesar" onClick={() => aturZoom(zoom * 1.25)}>
                <Plus size={14} />
              </Button>
              <Button id={`btn_zoom_pas_${p}`} size="sm" variant="ghost" title="Pas layar" onClick={() => aturZoom(1)}>
                Pas
              </Button>
              <Button
                id={`btn_putar_${p}`}
                size="sm"
                variant="ghost"
                title={edisi.crop ? 'Hapus crop dulu untuk memutar' : 'Putar 90° searah jarum jam'}
                disabled={!!edisi.crop}
                onClick={putar}
              >
                <RotateCcw size={14} className="-scale-x-100" />
              </Button>
              <Button
                id={`btn_crop_${p}`}
                size="sm"
                variant={modeCrop ? 'secondary' : 'ghost'}
                title={edisi.rotasi !== 0 ? 'Luruskan dulu (rotasi 0°) untuk crop' : (modeCrop ? 'Batal crop' : 'Crop: seret area pada gambar')}
                disabled={edisi.rotasi !== 0}
                onClick={() => { setModeCrop((m) => !m); setDrafCrop(null); }}
              >
                Crop
              </Button>
              {edisi.crop && (
                <Button id={`btn_crop_hapus_${p}`} size="sm" variant="ghost" title="Hapus crop" onClick={() => setEdisi((e) => ({ ...e, crop: null }))}>
                  <X size={14} />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button id={`btn_pdf_sebelum_${p}`} size="sm" variant="ghost" title="Halaman sebelumnya" disabled={halPdf <= 1} onClick={() => setHalPdf((h) => Math.max(1, h - 1))}>
                <ChevronLeft size={14} />
              </Button>
              <span className="min-w-16 text-center text-xs text-muted-foreground">
                {totalHal > 0 ? `hal ${Math.min(halPdf, totalHal)} / ${totalHal}` : '…'}
              </span>
              <Button id={`btn_pdf_berikut_${p}`} size="sm" variant="ghost" title="Halaman berikutnya" disabled={halPdf >= totalHal} onClick={() => setHalPdf((h) => Math.min(Math.max(totalHal, 1), h + 1))}>
                <ChevronRight size={14} />
              </Button>
              <Button id={`btn_zoom_kurang_${p}`} size="sm" variant="ghost" title="Perkecil" onClick={() => aturZoom(zoom / 1.25)}>
                <Minus size={14} />
              </Button>
              <span className="min-w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button id={`btn_zoom_tambah_${p}`} size="sm" variant="ghost" title="Perbesar" onClick={() => aturZoom(zoom * 1.25)}>
                <Plus size={14} />
              </Button>
              <Button id={`btn_zoom_pas_${p}`} size="sm" variant="ghost" title="Pas lebar" onClick={() => aturZoom(1)}>
                Pas
              </Button>
            </>
          )}
          <Button id={`btn_unduh_pilih_${p}`} size="sm" variant="ghost" title="Unduh yang tampil" onClick={unduhPilih}>
            <Download size={14} />
          </Button>
        </div>
      )}
      {/* Kanvas */}
      <div ref={bungkusRef} className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-2">
        {!sumber ? (
          <p className="m-auto px-6 text-center text-sm text-muted-foreground">
            Belum ada berkas dipilih — pilih lewat Browse untuk melihat pratinjau di sini.
          </p>
        ) : gambar && dimensi && urlSumber ? (
          <div className="relative m-auto shrink-0" style={{ width: pxLebar, height: pxTinggi }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
              ref={imgRef}
              src={urlSumber}
              alt=""
              draggable={false}
              style={{
                width: tegak ? pxTinggi : pxLebar,
                height: tegak ? pxLebar : pxTinggi,
                transform: `rotate(${edisi.rotasi}deg)`,
                transformOrigin: 'center',
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
            />
            {modeCrop && (
              <div
                aria-label="Area crop: seret untuk memilih, lepas untuk menerapkan"
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={mulaiCrop}
                onPointerMove={gerakCrop}
                onPointerUp={() => selesaiCrop(true)}
                onPointerCancel={() => selesaiCrop(false)}
              >
                {rectTampil && (
                  <div
                    className="absolute border-2 border-primary bg-primary/20"
                    style={{ left: rectTampil.x, top: rectTampil.y, width: rectTampil.w, height: rectTampil.h }}
                  />
                )}
              </div>
            )}
            {!modeCrop && rectTampil && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-primary/70"
                style={{ left: rectTampil.x, top: rectTampil.y, width: rectTampil.w, height: rectTampil.h }}
              />
            )}
          </div>
        ) : pdf ? (
          galatPdf ? (
            <p className="m-auto px-6 text-center text-sm text-destructive">{galatPdf}</p>
          ) : (
            <canvas ref={kanvasRef} className="m-auto shrink-0 rounded bg-white shadow" />
          )
        ) : (
          <p className="m-auto px-6 text-center text-sm text-muted-foreground">Memuat…</p>
        )}
      </div>
    </section>
  );
}
