import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { errorMessage } from '../../api/client';
import { formatUkuran } from '@/lib/arsipDokumen';
import { TERJEMAHAN_EDITOR_ID } from '@/lib/terjemahEditor';
import {
  bingkaiPutar,
  dimsKeluaran,
  EDISI_KOSONG,
  hasilkanGambar,
  jepitMiring,
  jepitUkuran,
  kotakPutar,
  MAKS_DIM_HEMAT,
  MAKS_MIRING,
  MAKS_UKURAN,
  muatGambar,
  naturalKeRectPutar,
  rectKeNaturalPutar,
  type EdisiGambar,
  type HasilGambar,
  type KualitasSimpan,
} from '@/lib/olahGambar';
import { ChevronLeft, ChevronRight, Download, Link2, Minus, Moon, Pencil, Plus, RefreshCcw, RefreshCw, RotateCcw, RotateCw, Scaling, Sun, Unlink, X } from '@/icons';
import { toast } from 'sonner';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/** Editor lengkap (Filerobot) dimuat malas agar bundle awal tetap ramping. */
const EditorLengkap = lazy(() =>
  import('react-filerobot-image-editor').then((m) => ({ default: m.default as unknown as ComponentType<Record<string, unknown>> })),
);

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
export default function PenampilBerkas({ sumber: sumberProp, kualitas, onKeluaran, idPrefix = 'penampil' }: Props) {
  const p = idPrefix;
  /** Hasil editor lengkap menimpa sumber prop (edisi toolbar direset) — alur simpan tak berubah. */
  const [sumberEdit, setSumberEdit] = useState<SumberBerkas | null>(null);
  const sumber = sumberEdit ?? sumberProp;
  const gambar = sumber != null && sumber.mime.startsWith('image/');
  const pdf = sumber != null && sumber.mime === 'application/pdf';

  const [edisi, setEdisi] = useState<EdisiGambar>(EDISI_KOSONG);
  const [zoom, setZoom] = useState(1);
  const [gelap, setGelap] = useState(true);
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  const [modeCrop, setModeCrop] = useState(false);
  const [drafCrop, setDrafCrop] = useState<RectBox | null>(null);
  /** Mode putar: tampil/sembunyi bar kontrol bawah (nilai edisi tetap tersimpan). */
  const [modePutar, setModePutar] = useState(false);
  /** Mode resize: bar W×H bawah (independen dari putar/crop). */
  const [modeResize, setModeResize] = useState(false);
  /** Kunci rasio resize + aspek terkunci (ditangkap saat aktivasi). */
  const [kunciUkuran, setKunciUkuran] = useState(true);
  const [aspekUkuran, setAspekUkuran] = useState(1);
  /** Teks spinbox miring (null = ikut edisi); dikomit saat blur/Enter agar desimal bisa diketik. */
  const [teksMiring, setTeksMiring] = useState<string | null>(null);
  /** Editor lengkap: url data + buka/tutup. */
  const [urlEditor, setUrlEditor] = useState<string | null>(null);
  const [editorBuka, setEditorBuka] = useState(false);
  /** Fungsi tarik-data FIE (diisi editor via prop) — ambil hasil tanpa dialog save-as. */
  type MintaDataEditor = (info?: { name?: string; extension?: string }) => {
    imageData?: { imageBase64?: string; name?: string };
  };
  const mintaDataEditor = useRef<MintaDataEditor | null>(null);

  const bungkusRef = useRef<HTMLDivElement | null>(null);
  const [ukuranWadah, setUkuranWadah] = useState({ w: 0, h: 0 });

  // Reset tampilan saat sumber berganti.
  useEffect(() => {
    setEdisi(EDISI_KOSONG);
    setZoom(1);
    setModeCrop(false);
    setModePutar(false);
    setModeResize(false);
    setKunciUkuran(true);
    setDrafCrop(null);
    setTeksMiring(null);
    setSumberEdit(null);
    setEditorBuka(false);
    setUrlEditor(null);
  }, [sumberProp]);

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

  // ----- Crop gambar: baru / pindah / ubah-sudut, komit eksplisit via Terapkan -----
  type SeretCrop =
    | { jenis: 'baru'; x0: number; y0: number }
    | { jenis: 'pindah'; dx: number; dy: number }
    | { jenis: 'ubah'; sudut: 'nw' | 'ne' | 'sw' | 'se' };
  const seretCropRef = useRef<SeretCrop | null>(null);
  const JANGKAU_HANDLE = 12;
  const MIN_CROP = 8;
  /** Rasio crop terkunci (lebar/tinggi); null = bebas. */
  const [rasioCrop, setRasioCrop] = useState<number | null>(null);

  /** Preset rasio crop (A4 portrait untuk dokumen). */
  const RASIO_CROP: { label: string; id: string; r: number | null }[] = [
    { label: 'Bebas', id: 'bebas', r: null },
    { label: '1:1', id: '1_1', r: 1 },
    { label: '3:4', id: '3_4', r: 3 / 4 },
    { label: '4:3', id: '4_3', r: 4 / 3 },
    { label: '2:3', id: '2_3', r: 2 / 3 },
    { label: '3:2', id: '3_2', r: 3 / 2 },
    { label: '1:2', id: '1_2', r: 1 / 2 },
    { label: '2:1', id: '2_1', r: 2 },
    { label: '9:16', id: '9_16', r: 9 / 16 },
    { label: '16:9', id: '16_9', r: 16 / 9 },
    { label: 'A4', id: 'a4', r: 1 / Math.SQRT2 },
  ];

  /** Pilih preset rasio: langsung terapkan kotak terbesar di tengah. */
  function pilihRasioCrop(r: number | null) {
    setRasioCrop(r);
    if (r === null) return;
    let w = pxLebar;
    let h = w / r;
    if (h > pxTinggi) {
      h = pxTinggi;
      w = h * r;
    }
    if (w < MIN_CROP || h < MIN_CROP) return;
    setDrafCrop({ x: (pxLebar - w) / 2, y: (pxTinggi - h) / 2, w, h });
  }

  function posisiCrop(e: React.PointerEvent) {
    const kotak = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - kotak.left, y: e.clientY - kotak.top, rw: kotak.width, rh: kotak.height };
  }

  function mulaiSeretCrop(e: React.PointerEvent<HTMLDivElement>) {
    if (!modeCrop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = posisiCrop(e);
    const d = drafCrop;
    if (d) {
      const sudut: ['nw' | 'ne' | 'sw' | 'se', number, number][] = [
        ['nw', d.x, d.y],
        ['ne', d.x + d.w, d.y],
        ['sw', d.x, d.y + d.h],
        ['se', d.x + d.w, d.y + d.h],
      ];
      for (const [s, hx, hy] of sudut) {
        if (Math.abs(x - hx) <= JANGKAU_HANDLE && Math.abs(y - hy) <= JANGKAU_HANDLE) {
          seretCropRef.current = { jenis: 'ubah', sudut: s };
          return;
        }
      }
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) {
        seretCropRef.current = { jenis: 'pindah', dx: x - d.x, dy: y - d.y };
        return;
      }
    }
    seretCropRef.current = { jenis: 'baru', x0: x, y0: y };
    setDrafCrop(null);
  }

  function gerakSeretCrop(e: React.PointerEvent<HTMLDivElement>) {
    const s = seretCropRef.current;
    if (!s || !modeCrop) return;
    const { x, y, rw, rh } = posisiCrop(e);
    const jepit = (v: number, maks: number) => Math.max(0, Math.min(v, maks));
    const r = rasioCrop;
    // Rasio terkunci: semua gestur menjaga w/h.
    if (r !== null) {
      if (s.jenis === 'baru') {
        const w = Math.min(Math.abs(x - s.x0), rw, rh * r);
        if (w < MIN_CROP) {
          setDrafCrop(null);
          return;
        }
        const h = w / r;
        setDrafCrop({
          x: jepit(x >= s.x0 ? s.x0 : s.x0 - w, rw - w),
          y: jepit(y >= s.y0 ? s.y0 : s.y0 - h, rh - h),
          w,
          h,
        });
        return;
      }
      const d = drafCrop;
      if (!d) return;
      if (s.jenis === 'pindah') {
        setDrafCrop({ x: jepit(x - s.dx, rw - d.w), y: jepit(y - s.dy, rh - d.h), w: d.w, h: d.h });
        return;
      }
      const jangkar = {
        nw: { x: d.x + d.w, y: d.y + d.h },
        ne: { x: d.x, y: d.y + d.h },
        sw: { x: d.x + d.w, y: d.y },
        se: { x: d.x, y: d.y },
      }[s.sudut];
      const batasW = s.sudut === 'nw' || s.sudut === 'sw' ? jangkar.x : rw - jangkar.x;
      const batasH = s.sudut === 'nw' || s.sudut === 'ne' ? jangkar.y : rh - jangkar.y;
      const w = Math.max(MIN_CROP, Math.min(Math.abs(x - jangkar.x), batasW, Math.abs(y - jangkar.y) * r));
      const h = w / r;
      setDrafCrop({
        x: s.sudut === 'nw' || s.sudut === 'sw' ? jangkar.x - w : jangkar.x,
        y: s.sudut === 'nw' || s.sudut === 'ne' ? jangkar.y - h : jangkar.y,
        w,
        h,
      });
      return;
    }
    if (s.jenis === 'baru') {
      setDrafCrop({ x: Math.min(s.x0, x), y: Math.min(s.y0, y), w: Math.abs(x - s.x0), h: Math.abs(y - s.y0) });
      return;
    }
    const d = drafCrop;
    if (!d) return;
    if (s.jenis === 'pindah') {
      setDrafCrop({ x: jepit(x - s.dx, rw - d.w), y: jepit(y - s.dy, rh - d.h), w: d.w, h: d.h });
      return;
    }
    const kanan = d.x + d.w;
    const bawah = d.y + d.h;
    if (s.sudut === 'nw') {
      const x0 = jepit(x, kanan - MIN_CROP);
      const y0 = jepit(y, bawah - MIN_CROP);
      setDrafCrop({ x: x0, y: y0, w: kanan - x0, h: bawah - y0 });
    } else if (s.sudut === 'ne') {
      const y0 = jepit(y, bawah - MIN_CROP);
      setDrafCrop({ x: d.x, y: y0, w: Math.max(MIN_CROP, Math.min(x - d.x, rw - d.x)), h: bawah - y0 });
    } else if (s.sudut === 'sw') {
      const x0 = jepit(x, kanan - MIN_CROP);
      setDrafCrop({ x: x0, y: d.y, w: kanan - x0, h: Math.max(MIN_CROP, Math.min(y - d.y, rh - d.y)) });
    } else {
      setDrafCrop({
        x: d.x,
        y: d.y,
        w: Math.max(MIN_CROP, Math.min(x - d.x, rw - d.x)),
        h: Math.max(MIN_CROP, Math.min(y - d.y, rh - d.y)),
      });
    }
  }

  function selesaiSeretCrop() {
    seretCropRef.current = null;
    // Tanpa komit otomatis — tunggu Terapkan; buang coretan terlalu kecil.
    setDrafCrop((d) => (d && (d.w < MIN_CROP || d.h < MIN_CROP) ? null : d));
  }

  function terapkanCrop() {
    const d = drafCrop;
    if (!d || !dimensi || d.w < MIN_CROP || d.h < MIN_CROP) return;
    setEdisi((ed) => ({
      ...ed,
      crop: rectKeNaturalPutar(d, pxLebar, pxTinggi, dimensi.w, dimensi.h, ed.rotasi),
    }));
    setModeCrop(false);
    setDrafCrop(null);
    setRasioCrop(null);
  }

  function batalCrop() {
    setModeCrop(false);
    setDrafCrop(null);
    setRasioCrop(null);
  }

  /** Bekukan putaran (90°/miring) menjadi piksel sumber baru — kualitas Asli
   *  agar tak ada kompresi ganda (simpanan akhir yang menerapkan kualitas). */
  async function bekukanPutaran(): Promise<boolean> {
    if (!sumber || !gambar) return false;
    try {
      const hasil = await hasilkanGambar(sumber.bytes, sumber.mime, edisi, 'asli');
      setSumberEdit({ bytes: hasil.bytes, mime: hasil.mime, nama: `${namaTanpaEkstensi(sumber.nama)}.${hasil.ext}` });
      setEdisi(EDISI_KOSONG);
      setTeksMiring(null);
      setDrafCrop(null);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }

  /** Mulai/sunting crop; bila sedang miring, putaran dibekukan dulu otomatis. */
  async function mulaiModeCrop() {
    if (modeCrop) {
      batalCrop();
      return;
    }
    if (edisi.miring !== 0) {
      const ok = await bekukanPutaran();
      if (!ok) return;
      toast.success('Putaran dibekukan — silakan crop.');
    }
    // Sunting ulang: jadikan crop lama sebagai draf (rasio bebas).
    setRasioCrop(null);
    if (edisi.crop && dimensi) {
      setDrafCrop(naturalKeRectPutar(edisi.crop, pxLebar, pxTinggi, dimensi.w, dimensi.h, edisi.rotasi));
    } else {
      setDrafCrop(null);
    }
    setModeCrop(true);
  }

  /** Komit teks spinbox miring (jepit ±MAKS_MIRING). */
  const komitMiring = useCallback(() => {
    setTeksMiring((t) => {
      if (t !== null) {
        const angka = Number.parseFloat(t.replace(',', '.'));
        setEdisi((e) => ({ ...e, miring: jepitMiring(angka) }));
      }
      return null;
    });
  }, []);

  /** Lompat ke sudut eksak (tombol ikon posisi slider). */
  function lompatMiring(derajat: number) {
    setTeksMiring(null);
    setEdisi((e) => ({ ...e, miring: jepitMiring(derajat) }));
  }

  // ----- Resize eksplisit (W×H citra tegak; menang atas hemat) -----
  /** Dimensi acuan saat ini (crop bila ada). */
  const acuanUkuran = useMemo(() => ({
    w: edisi.crop?.w ?? dimensi?.w ?? 1,
    h: edisi.crop?.h ?? dimensi?.h ?? 1,
  }), [edisi.crop, dimensi]);

  /** Benih input = keluaran tanpa ukuran eksplisit. */
  const benihUkuran = useMemo(
    () => dimsKeluaran({ ...edisi, ukuran: null }, kualitas, acuanUkuran.w, acuanUkuran.h),
    [edisi, kualitas, acuanUkuran],
  );

  /** Caption keluaran eksak menurut pipeline. */
  const captionUkuran = useMemo(() => {
    if (!dimensi) return '';
    const o = dimsKeluaran(edisi, kualitas, acuanUkuran.w, acuanUkuran.h);
    return `Keluaran: ${o.w} × ${o.h} px`;
  }, [edisi, kualitas, dimensi, acuanUkuran]);

  /** Template resize: persen + sisi-panjang px — hanya yang ≤ acuan (tanpa upscale). */
  const presetResize = useMemo(() => {
    const a = acuanUkuran;
    const maks = Math.max(a.w, a.h);
    const daftar: { id: string; label: string; w: number; h: number; asli: boolean }[] = [
      ...[25, 50, 75].map((persen) => ({
        id: `p${persen}`,
        label: `${persen}%`,
        w: Math.max(1, Math.round((a.w * persen) / 100)),
        h: Math.max(1, Math.round((a.h * persen) / 100)),
        asli: false,
      })),
      { id: 'p100', label: '100%', w: a.w, h: a.h, asli: true },
      ...[320, 640, 800, 1024, 1280, 1600]
        .filter((sisi) => sisi <= maks)
        .map((sisi) => {
          const k = sisi / maks;
          return {
            id: `s${sisi}`,
            label: `${sisi}px`,
            w: Math.max(1, Math.round(a.w * k)),
            h: Math.max(1, Math.round(a.h * k)),
            asli: false,
          };
        }),
    ];
    return daftar;
  }, [acuanUkuran]);

  /** Terapkan template (100% = kembali asli = hapus eksplisit). */
  function pilihPresetResize(t: { w: number; h: number; asli: boolean }) {
    setEdisi((e) => ({ ...e, ukuran: t.asli ? null : { w: t.w, h: t.h } }));
  }

  function toggleResize() {
    if (!modeResize) {
      setAspekUkuran(benihUkuran.w / Math.max(1, benihUkuran.h));
      setKunciUkuran(true);
    }
    setModeResize((m) => !m);
  }

  function ubahLebar(v: string) {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return;
    const w = jepitUkuran(n);
    const h = kunciUkuran ? jepitUkuran(w / aspekUkuran) : jepitUkuran(edisi.ukuran?.h ?? benihUkuran.h);
    setEdisi((e) => ({ ...e, ukuran: { w, h } }));
  }

  function ubahTinggi(v: string) {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return;
    const h = jepitUkuran(n);
    const w = kunciUkuran ? jepitUkuran(h * aspekUkuran) : jepitUkuran(edisi.ukuran?.w ?? benihUkuran.w);
    setEdisi((e) => ({ ...e, ukuran: { w, h } }));
  }

  function kunciUlang() {
    const cur = edisi.ukuran;
    if (cur) setAspekUkuran(cur.w / Math.max(1, cur.h));
    else setAspekUkuran(benihUkuran.w / Math.max(1, benihUkuran.h));
    setKunciUkuran((k) => !k);
  }

  // ----- Editor lengkap (Filerobot): hasil kembali sebagai sumber baru -----
  const bukaEditor = useCallback(() => {
    if (!sumber || !gambar) return;
    const blob = new Blob([sumber.bytes.buffer as ArrayBuffer], { type: sumber.mime });
    const baca = new FileReader();
    baca.onload = () => {
      setUrlEditor(typeof baca.result === 'string' ? baca.result : null);
      setEditorBuka(true);
    };
    baca.onerror = () => toast.error('Gagal menyiapkan editor.');
    baca.readAsDataURL(blob);
  }, [sumber, gambar]);

  async function simpanEditor(data: { imageBase64?: string; name?: string }) {
    try {
      if (!data.imageBase64 || !sumber) throw new Error('Hasil editor kosong.');
      const res = await fetch(data.imageBase64);
      const buf = new Uint8Array(await res.arrayBuffer());
      const mimeUrl = data.imageBase64.slice(5, data.imageBase64.indexOf(';'));
      const mime = mimeUrl.startsWith('image/') ? mimeUrl : sumber.mime;
      const nama = data.name && data.name.includes('.')
        ? data.name
        : `${namaTanpaEkstensi(sumber.nama)}.${ekstensiDariNama(sumber.nama) || 'jpg'}`;
      setSumberEdit({ bytes: buf, mime, nama });
      setEdisi(EDISI_KOSONG);
      setTeksMiring(null);
      setModeCrop(false);
      setModePutar(false);
      setModeResize(false);
      setKunciUkuran(true);
      setDrafCrop(null);
      setEditorBuka(false);
      toast.success('Hasil editor diterapkan.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Terapkan hasil editor langsung (tanpa save-as FIE) — dipakai tombol internal & cegatan save. */
  function terapkanEditor() {
    const minta = mintaDataEditor.current;
    if (!minta || !sumber) {
      toast.warning('Editor belum siap.');
      return;
    }
    try {
      const { imageData } = minta({
        name: namaTanpaEkstensi(sumber.nama),
        extension: sumber.mime === 'image/png' ? 'png' : 'jpeg',
      });
      if (!imageData?.imageBase64) throw new Error('Hasil editor kosong.');
      void simpanEditor(imageData);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

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

  // ----- Matematika tampil gambar (cermin pipeline agar WYSIWYG) -----
  // Tanpa crop menempel: elemen = citra penuh (CSS transform, eksak).
  // Crop menempel (bukan draf): canvas digambar persis pipeline (selalu eksak,
  // termasuk kombinasi crop+resize+putar yang tak bisa diwakili CSS).
  const totalPutar = edisi.rotasi + edisi.miring;
  let sxTampil = 1;
  let syTampil = 1;
  if (dimensi) {
    const uTampil = edisi.ukuran;
    if (uTampil) {
      sxTampil = jepitUkuran(uTampil.w) / dimensi.w;
      syTampil = jepitUkuran(uTampil.h) / dimensi.h;
    } else if (kualitas === 'hemat') {
      const b0 = kotakPutar(totalPutar, dimensi.w, dimensi.h);
      sxTampil = syTampil = Math.min(1, MAKS_DIM_HEMAT / Math.max(b0.w, b0.h));
    }
  }
  const kotakLuar = useMemo(
    () => (dimensi ? kotakPutar(totalPutar, dimensi.w * sxTampil, dimensi.h * syTampil) : null),
    [dimensi, totalPutar, sxTampil, syTampil],
  );
  const pas = kotakLuar && ukuranWadah.w > 0 && ukuranWadah.h > 0
    ? Math.min(ukuranWadah.w / kotakLuar.w, ukuranWadah.h / kotakLuar.h)
    : 1;
  const skalaTampil = pas * zoom;
  const dasarLebar = dimensi ? Math.max(1, Math.round(dimensi.w * skalaTampil)) : 0;
  const dasarTinggi = dimensi ? Math.max(1, Math.round(dimensi.h * skalaTampil)) : 0;
  const pxLebar = kotakLuar ? Math.max(1, Math.round(kotakLuar.w * skalaTampil)) : 0;
  const pxTinggi = kotakLuar ? Math.max(1, Math.round(kotakLuar.h * skalaTampil)) : 0;
  const aturZoom = (z: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));

  /** Pratinjau crop-menempel: kotak + skala dari keluaran eksak (crop, bukan penuh). */
  const cropMenempel = !!edisi.crop && !modeCrop && gambar && !!dimensi;
  const outCrop = cropMenempel && edisi.crop
    ? dimsKeluaran(edisi, kualitas, edisi.crop.w, edisi.crop.h)
    : null;
  const pasCrop = outCrop && ukuranWadah.w > 0 && ukuranWadah.h > 0
    ? Math.min(ukuranWadah.w / outCrop.w, ukuranWadah.h / outCrop.h)
    : 1;
  const tCrop = pasCrop * zoom;
  const boxCropW = outCrop ? Math.max(1, Math.round(outCrop.w * tCrop)) : 0;
  const boxCropH = outCrop ? Math.max(1, Math.round(outCrop.h * tCrop)) : 0;
  const kotakLebar = cropMenempel ? boxCropW : pxLebar;
  const kotakTinggi = cropMenempel ? boxCropH : pxTinggi;

  /** Cache decode gambar per sumber (redraw slider tetap cepat). */
  const imgCacheRef = useRef<{ src: SumberBerkas | null; img: HTMLImageElement | null }>({ src: null, img: null });
  async function imgTerdekode(): Promise<HTMLImageElement | null> {
    if (!sumber || !gambar) return null;
    const c = imgCacheRef.current;
    if (c.src === sumber && c.img) return c.img;
    try {
      const img = await muatGambar(sumber.bytes, sumber.mime);
      imgCacheRef.current = { src: sumber, img };
      return img;
    } catch {
      return null;
    }
  }

  const kanvasCropRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!cropMenempel || !edisi.crop || !sumber) return;
    let hidup = true;
    void imgTerdekode().then((img) => {
      const kanvas = kanvasCropRef.current;
      if (!hidup || !img || !kanvas) return;
      const { x: cx, y: cy, w: cw, h: ch } = edisi.crop as { x: number; y: number; w: number; h: number };
      const crop = { x: cx, y: cy, w: cw, h: ch };
      const total = edisi.rotasi + jepitMiring(edisi.miring);
      const u = edisi.ukuran;
      let duW = crop.w;
      let duH = crop.h;
      if (u) {
        duW = jepitUkuran(u.w);
        duH = jepitUkuran(u.h);
      } else if (kualitas === 'hemat') {
        const b0 = bingkaiPutar(edisi.rotasi, edisi.miring, crop.w, crop.h);
        const k = Math.min(1, MAKS_DIM_HEMAT / Math.max(b0.w, b0.h));
        duW = crop.w * k;
        duH = crop.h * k;
      }
      kanvas.width = boxCropW;
      kanvas.height = boxCropH;
      const ctx = kanvas.getContext('2d');
      if (!ctx) return;
      const jpeg = kualitas === 'hemat' || !sumber.mime.startsWith('image/png');
      if (jpeg) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, boxCropW, boxCropH);
      }
      ctx.translate(boxCropW / 2, boxCropH / 2);
      ctx.rotate((total * Math.PI) / 180);
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, (-duW * tCrop) / 2, (-duH * tCrop) / 2, duW * tCrop, duH * tCrop);
    });
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropMenempel, edisi, kualitas, sumber, boxCropW, boxCropH, tCrop]);

  /** Overlay crop dalam koordinat kotak (putar diperhitungkan). */
  const rectTampil: RectBox | null = drafCrop
    ?? (edisi.crop && dimensi
      ? naturalKeRectPutar(edisi.crop, pxLebar, pxTinggi, dimensi.w, dimensi.h, edisi.rotasi)
      : null);

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
        <>
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
                id={`btn_mode_putar_${p}`}
                size="sm"
                variant={modePutar ? 'secondary' : 'ghost'}
                title={modePutar ? 'Sembunyikan kontrol putar' : 'Putar: tampilkan kontrol derajat'}
                onClick={() => setModePutar((m) => !m)}
              >
                <RotateCw size={14} />
              </Button>
              <Button
                id={`btn_crop_${p}`}
                size="sm"
                variant={modeCrop ? 'secondary' : 'ghost'}
                title={modeCrop ? 'Batal crop' : (edisi.crop ? 'Sunting crop' : (edisi.miring !== 0 ? 'Crop: putaran dibekukan otomatis dulu' : 'Crop: aktifkan lalu seret area pada gambar'))}
                onClick={() => void mulaiModeCrop()}
              >
                Crop
              </Button>
              {edisi.crop && (
                <Button id={`btn_crop_hapus_${p}`} size="sm" variant="ghost" title="Hapus crop" onClick={() => setEdisi((e) => ({ ...e, crop: null }))}>
                  <X size={14} />
                </Button>
              )}
              <Button
                id={`btn_mode_resize_${p}`}
                size="sm"
                variant={modeResize ? 'secondary' : 'ghost'}
                title={modeResize ? 'Sembunyikan kontrol resize' : 'Resize: tampilkan kontrol ukuran'}
                onClick={toggleResize}
              >
                <Scaling size={14} />
              </Button>
              <Button
                id={`btn_editor_lengkap_${p}`}
                size="sm"
                variant="ghost"
                title="Editor lengkap: filter, anotasi, teks, tanda air, resize"
                onClick={bukaEditor}
              >
                <Pencil size={14} />
                <span className="ml-1">Editor</span>
              </Button>
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
        </>
      )}
      {/* Kanvas */}
      <div ref={bungkusRef} className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-2">
        {!sumber ? (
          <p className="m-auto px-6 text-center text-sm text-muted-foreground">
            Belum ada berkas dipilih — pilih lewat Browse untuk melihat pratinjau di sini.
          </p>
        ) : gambar && dimensi && urlSumber ? (
          <div className="relative m-auto shrink-0 overflow-hidden" style={{ width: kotakLebar, height: kotakTinggi }}>
            {cropMenempel ? (
              <canvas
                ref={kanvasCropRef}
                width={boxCropW}
                height={boxCropH}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ width: boxCropW, height: boxCropH }}
              />
            ) : (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  src={urlSumber}
                  alt=""
                  draggable={false}
                  style={{
                    width: dasarLebar,
                    height: dasarTinggi,
                    transform: `rotate(${totalPutar}deg) scale(${sxTampil}, ${syTampil})`,
                    transformOrigin: 'center',
                  }}
                  className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
                />
              </>
            )}
            {modeCrop && (
              <div
                aria-label="Area crop: seret untuk memilih/geser/ubah, lalu Terapkan"
                className="absolute inset-0 cursor-crosshair touch-none select-none"
                onPointerDown={mulaiSeretCrop}
                onPointerMove={gerakSeretCrop}
                onPointerUp={selesaiSeretCrop}
                onPointerCancel={selesaiSeretCrop}
              >
                {rectTampil && (
                  <div
                    className="absolute cursor-move border-2 border-primary bg-primary/20"
                    style={{ left: rectTampil.x, top: rectTampil.y, width: rectTampil.w, height: rectTampil.h }}
                  >
                    <span className="absolute -top-1.5 -left-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary" />
                    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 cursor-nesw-resize rounded-sm border border-white bg-primary" />
                    <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-sm border border-white bg-primary" />
                    <span className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary" />
                  </div>
                )}
              </div>
            )}
            {!modeCrop && rectTampil && !cropMenempel && (
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
      {/* Bar putar ala Pintura: angka di atas, slider + tombol posisi di bawahnya. */}
      {gambar && sumber && modePutar && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2">
          <div className="flex min-w-0 w-full max-w-xl flex-1 flex-col items-center gap-1">
            <div className="flex shrink-0 items-center gap-1">
              <input
                id={`input_miring_${p}`}
                type="number"
                min={-MAKS_MIRING}
                max={MAKS_MIRING}
                step={0.1}
                value={teksMiring ?? String(Math.round(edisi.miring * 10) / 10)}
                disabled={!!edisi.crop || modeCrop}
                title={edisi.crop || modeCrop ? 'Selesaikan/batalkan crop dulu untuk memutar' : 'Kemiringan (derajat, Enter untuk terapkan)'}
                aria-label="Kemiringan derajat (spinbox)"
                onChange={(e) => {
                  const t = e.target.value;
                  setTeksMiring(t);
                  // Live: nilai valid langsung ke pratinjau; teks mentah tetap bisa diketik.
                  const angka = Number.parseFloat(t.replace(',', '.'));
                  if (!Number.isNaN(angka)) {
                    setEdisi((ed) => ({ ...ed, miring: jepitMiring(angka) }));
                  }
                }}
                onBlur={komitMiring}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onFocus={(e) => e.target.select()}
                className="w-20 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-center text-xs"
              />
              <span className="shrink-0 text-xs text-muted-foreground">°</span>
            </div>
          <div className="relative min-w-0 w-full flex-1">
            <input
              id={`geser_miring_${p}`}
              type="range"
              min={-MAKS_MIRING}
              max={MAKS_MIRING}
              step={0.1}
              value={edisi.miring}
              disabled={!!edisi.crop || modeCrop}
              title={edisi.crop || modeCrop ? 'Selesaikan/batalkan crop dulu untuk memutar' : 'Kemiringan: 0 di tengah, ±180° (menempel ke 0 bila < 0,5°)'}
              aria-label="Kemiringan derajat"
              onChange={(e) => {
                setTeksMiring(null);
                const mentah = Number(e.target.value);
                // Deten tengah: dua rentang 0→180 dan 0→-180, menempel ke 0 bila dekat.
                const nilai = Math.abs(mentah) <= 0.5 ? 0 : mentah;
                setEdisi((ed) => ({ ...ed, miring: jepitMiring(nilai) }));
              }}
              className="w-full accent-primary"
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/60" />
            {/* Tombol posisi tepat di bawah nilainya (kompensasi setengah thumb ±8px). */}
            <div className="relative mt-0.5 h-8">
              {(
                [
                  { nilai: -180, kiri: 'calc(0% + 8px)', ikon: RefreshCcw, jud: 'Putar -180°', id: 'miring_min180' },
                  { nilai: -90, kiri: 'calc(25% + 4px)', ikon: RotateCcw, jud: 'Putar -90°', id: 'miring_min90' },
                  { nilai: 0, kiri: '50%', ikon: X, jud: 'Luruskan (0°)', id: 'miring_nol' },
                  { nilai: 90, kiri: 'calc(75% - 4px)', ikon: RotateCw, jud: 'Putar 90°', id: 'miring_90' },
                  { nilai: 180, kiri: 'calc(100% - 8px)', ikon: RefreshCw, jud: 'Putar 180°', id: 'miring_180' },
                ] as const
              ).map((t) => (
                <Button
                  key={t.id}
                  id={`btn_${t.id}_${p}`}
                  size="sm"
                  variant={edisi.miring === t.nilai ? 'secondary' : 'ghost'}
                  title={edisi.crop || modeCrop ? 'Selesaikan/batalkan crop dulu untuk memutar' : t.jud}
                  disabled={!!edisi.crop || modeCrop}
                  onClick={() => lompatMiring(t.nilai)}
                  className="absolute top-0 -translate-x-1/2 px-2"
                  style={{ left: t.kiri }}
                >
                  <t.ikon size={14} />
                </Button>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}
      {/* Bar crop: rasio + terapkan/batal (kontrol bawah, aktivasi tombol Crop atas). */}
      {gambar && sumber && modeCrop && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 border-t bg-muted/40 px-4 py-2">
          <span className="px-1 text-xs text-muted-foreground">Rasio:</span>
          {RASIO_CROP.map((c) => (
            <Button
              key={c.id}
              id={`btn_rasio_crop_${p}_${c.id}`}
              size="sm"
              variant={(c.r === null && rasioCrop === null) || (c.r !== null && rasioCrop === c.r) ? 'secondary' : 'ghost'}
              title={c.r === null ? 'Crop bebas' : `Kunci rasio ${c.label}`}
              onClick={() => pilihRasioCrop(c.r)}
            >
              {c.label}
            </Button>
          ))}
          <Button
            id={`btn_crop_terapkan_${p}`}
            size="sm"
            variant="default"
            title="Terapkan crop"
            disabled={!drafCrop}
            onClick={terapkanCrop}
            className="ml-2"
          >
            Terapkan
          </Button>
          <Button id={`btn_crop_batal_${p}`} size="sm" variant="outline" title="Batal crop" onClick={batalCrop}>
            Batal
          </Button>
        </div>
      )}
      {/* Bar resize: W×H + kunci rasio + kembali asli + caption keluaran eksak. */}
      {gambar && sumber && modeResize && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2">
          <span className="text-xs text-muted-foreground">Lebar</span>
          <input
            id={`input_ukuran_lebar_${p}`}
            type="number"
            min={1}
            max={MAKS_UKURAN}
            step={1}
            value={edisi.ukuran?.w ?? benihUkuran.w}
            title="Lebar keluaran (px)"
            aria-label="Lebar keluaran piksel"
            onChange={(e) => ubahLebar(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-20 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-center text-xs"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <span className="text-xs text-muted-foreground">Tinggi</span>
          <input
            id={`input_ukuran_tinggi_${p}`}
            type="number"
            min={1}
            max={MAKS_UKURAN}
            step={1}
            value={edisi.ukuran?.h ?? benihUkuran.h}
            title="Tinggi keluaran (px)"
            aria-label="Tinggi keluaran piksel"
            onChange={(e) => ubahTinggi(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-20 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-center text-xs"
          />
          <span className="text-xs text-muted-foreground">px</span>
          <Button
            id={`btn_ukuran_kunci_${p}`}
            size="sm"
            variant={kunciUkuran ? 'secondary' : 'ghost'}
            title={kunciUkuran ? 'Buka kunci rasio' : 'Kunci rasio'}
            onClick={kunciUlang}
          >
            {kunciUkuran ? <Link2 size={14} /> : <Unlink size={14} />}
          </Button>
          <span className="px-1 text-xs text-muted-foreground">Template:</span>
          <Select
            value={presetResize.find((t) => (t.asli ? !edisi.ukuran : edisi.ukuran?.w === t.w && edisi.ukuran?.h === t.h))?.id ?? ''}
            onValueChange={(id) => {
              const t = presetResize.find((x) => x.id === id);
              if (t) pilihPresetResize(t);
            }}
          >
            <SelectTrigger id={`select_resize_preset_${p}`} className="w-36" aria-label="Template resize">
              <SelectValue placeholder="Pilih template" />
            </SelectTrigger>
            <SelectContent>
              {presetResize.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label} — {t.w}×{t.h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="px-1 text-xs text-muted-foreground">{captionUkuran}</span>
        </div>
      )}
      {/* Modal editor lengkap (hanya gambar). */}
      {editorBuka && urlEditor && sumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Editor gambar lengkap">
          <div className="h-[88vh] w-[min(1100px,94vw)] overflow-hidden rounded-xl bg-white">
            <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Memuat editor…</p>}>
              <EditorLengkap
                source={urlEditor}
                useBackendTranslations={false}
                // Tombol Simpan FIE berlabel Terapkan; save-as bawaan diblokir
                // (nama final ditentukan aplikasi saat Simpan dokumen).
                translations={{ ...TERJEMAHAN_EDITOR_ID, save: 'Terapkan' }}
                tabsIds={['Adjust', 'Finetune', 'Filters', 'Annotate', 'Watermark', 'Resize']}
                defaultTabId="Adjust"
                defaultSavedImageName={namaTanpaEkstensi(sumber.nama)}
                defaultSavedImageType={sumber.mime === 'image/png' ? 'png' : 'jpeg'}
                defaultSavedImageQuality={0.92}
                getCurrentImgDataFnRef={mintaDataEditor}
                onBeforeSave={() => { terapkanEditor(); return false; }}
                onSave={(d: { imageBase64?: string; name?: string }) => void simpanEditor(d)}
                onClose={() => setEditorBuka(false)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </section>
  );
}
