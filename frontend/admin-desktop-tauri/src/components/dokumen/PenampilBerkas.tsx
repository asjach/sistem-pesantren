import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import TombolIkon from '@/components/TombolIkon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DialRuler from './DialRuler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { errorMessage } from '../../api/client';
import { formatUkuran } from '@/lib/arsipDokumen';
import {
  bingkaiPutar,
  dimsKeluaran,
  EDISI_KOSONG,
  edisiAktif,
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
import { Check, ChevronLeft, ChevronRight, Crop, Download, Focus, Fullscreen, Grid, ImageUp, Link2, Minus, Plus, RotateCcw, RotateCw, Ruler, Scaling, Unlink, X } from '@/icons';
import { toast } from 'sonner';
import GarisPanduan from './GarisPanduan';
import {
  POS_PANDUAN_BAWAN,
  ZOOM_MAX,
  ZOOM_MIN,
  ekstensiDariNama,
  formatMiring,
  namaTanpaEkstensi,
  type SumberBerkas,
} from './penampilBerkasUtil';
import { usePdfDokumen } from './usePdfDokumen';

export type { SumberBerkas } from './penampilBerkasUtil';

interface Props {
  sumber: SumberBerkas | null;
  kualitas: KualitasSimpan;
  onKeluaran: (hasil: HasilGambar | null) => void;
  idPrefix?: string;
  /** `false` = sembunyikan tombol ubah (putar/crop/resize/editor) — mode lihat saja. */
  bisaUbah?: boolean;
  /** Teks saat belum ada berkas (bawaan: arahan Browse tambah dokumen). */
  teksKosong?: string;
  /** Dilaporkan tiap ada/tidaknya perubahan (edisi putar/crop/resize atau hasil editor). */
  onKotor?: (kotor: boolean) => void;
  /** Dilaporkan saat pipeline keluaran sibuk/selesai — induk mengunci Simpan
   *  selama sibuk agar tak mengunggah byte basi (balapan edisi vs keluaran). */
  onProses?: (sibuk: boolean) => void;
}


interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Viewer berkas dokumen: gambar (zoom/putar/crop/kompres) atau PDF (zoom/halaman).
 *  Edisi gambar dilaporkan sebagai byte keluaran untuk alur simpan. */
export default function PenampilBerkas({ sumber: sumberProp, kualitas, onKeluaran, idPrefix = 'penampil', bisaUbah = true, teksKosong, onKotor, onProses }: Props) {
  const p = idPrefix;
  /** Hasil bekukan putaran menimpa sumber prop (edisi toolbar direset) — alur simpan tak berubah. */
  const [sumberEdit, setSumberEdit] = useState<SumberBerkas | null>(null);
  const sumber = sumberEdit ?? sumberProp;
  const gambar = sumber != null && sumber.mime.startsWith('image/');
  const pdf = sumber != null && sumber.mime === 'application/pdf';

  const [edisi, setEdisi] = useState<EdisiGambar>(EDISI_KOSONG);
  const [zoom, setZoom] = useState(1);
  const [keluaran, setKeluaran] = useState<HasilGambar | null>(null);
  /** Pipeline keluaran sedang menghitung (induk mengunci Simpan selama ini). */
  const [memproses, setMemproses] = useState(false);
  const [modeCrop, setModeCrop] = useState(false);
  const [drafCrop, setDrafCrop] = useState<RectBox | null>(null);
  /** Mode putar: tampil/sembunyi bar kontrol bawah (nilai edisi tetap tersimpan). */
  const [modePutar, setModePutar] = useState(false);
  /** Mode resize: bar W×H bawah (independen dari putar/crop). */
  const [modeResize, setModeResize] = useState(false);
  /** Kunci rasio resize + aspek terkunci (ditangkap saat aktivasi). */
  const [kunciUkuran, setKunciUkuran] = useState(true);
  const [aspekUkuran, setAspekUkuran] = useState(1);
  /** Target dial panel putar: kemiringan atau skala (zoom). */
  const [modeDial, setModeDial] = useState<'rotasi' | 'skala'>('rotasi');
  /** Garis acuan putus-putus (tengah + sepertiga) untuk meluruskan. */
  const [panduan, setPanduan] = useState(false);
  /** Warna garis acuan (hex). */
  const [warnaPanduan, setWarnaPanduan] = useState('#525252');
  /** Posisi garis acuan (fraksi kotak tampil) — bisa digeser per garis. */
  const [posPanduan, setPosPanduan] = useState(POS_PANDUAN_BAWAN);
  /** Mode penggaris: seret garis di gambar, lepas untuk meluruskan otomatis. */
  const [modeLurus, setModeLurus] = useState(false);
  /** Acuan penggaris tegak (vertikal) bila true, datar bila false. */
  const [lurusTegak, setLurusTegak] = useState(false);
  /** Garis penggaris sementara (koordinat px kotak tampil). */
  const [garisLurus, setGarisLurus] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const garisRef = useRef<typeof garisLurus>(null);
  garisRef.current = garisLurus;

  const bungkusRef = useRef<HTMLDivElement | null>(null);
  const [ukuranWadah, setUkuranWadah] = useState({ w: 0, h: 0 });
  /** Cermin ref untuk listener roda (tetap segar tanpa pasang-copot ulang). */
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const dimensiRef = useRef<{ w: number; h: number } | null>(null);

  // Reset tampilan saat sumber berganti.
  useEffect(() => {
    setEdisi(EDISI_KOSONG);
    setZoom(1);
    setModeCrop(false);
    setModePutar(false);
    setModeResize(false);
    setKunciUkuran(true);
    setDrafCrop(null);
    setModeDial('rotasi');
    setPanduan(false);
    setWarnaPanduan('#525252');
    setPosPanduan(POS_PANDUAN_BAWAN);
    setModeLurus(false);
    setLurusTegak(false);
    setGarisLurus(null);
    setSumberEdit(null);
    setMemproses(false);
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

  /** Seret latar/kanvas untuk menggeser pandangan (pan). Abaikan yang
   *  bertanda data-seret (overlay crop/penggaris/garis punya handler sendiri). */
  const geserPandangan = useRef<{ x0: number; y0: number; sl: number; st: number } | null>(null);
  function mulaiGeser(e: React.PointerEvent) {
    // Klik tengah = reset zoom 100%.
    if (e.button === 1) {
      e.preventDefault();
      aturZoom(1);
      return;
    }
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest?.('[data-seret]')) return;
    const el = bungkusRef.current;
    if (!el) return;
    geserPandangan.current = { x0: e.clientX, y0: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture?.(e.pointerId);
  }
  function gerakGeser(e: React.PointerEvent) {
    const s = geserPandangan.current;
    const el = bungkusRef.current;
    if (!s || !el || !(e.buttons & 1)) return;
    if ((e.target as HTMLElement).closest?.('[data-seret]')) return;
    el.scrollLeft = s.sl - (e.clientX - s.x0);
    el.scrollTop = s.st - (e.clientY - s.y0);
  }
  function selesaiGeser() {
    geserPandangan.current = null;
  }

  /** Roda mouse: Ctrl/Cmd+scroll = zoom (tengah pandangan dijaga);
   *  scroll biasa = geser vertikal, Shift+scroll = geser horizontal (bawaan).
   *  Listener native non-pasif agar preventDefault menahan zoom halaman. */
  useEffect(() => {
    const el = bungkusRef.current;
    if (!el) return;
    const padaRoda = (e: WheelEvent) => {
      if (!sumber || (gambar && !dimensiRef.current)) return;
      // Tanpa Ctrl/Cmd: biarkan perilaku bawaan (vertikal / Shift = horizontal).
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoomRef.current * Math.exp(-dy * 0.0015) * 100) / 100));
      if (z === zoomRef.current) return;
      const fx = (el.scrollLeft + el.clientWidth / 2) / Math.max(1, el.scrollWidth);
      const fy = (el.scrollTop + el.clientHeight / 2) / Math.max(1, el.scrollHeight);
      flushSync(() => setZoom(z));
      el.scrollLeft = fx * el.scrollWidth - el.clientWidth / 2;
      el.scrollTop = fy * el.scrollHeight - el.clientHeight / 2;
    };
    el.addEventListener('wheel', padaRoda, { passive: false });
    return () => el.removeEventListener('wheel', padaRoda);
  }, [sumber, gambar]);

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
      dimensiRef.current = null;
      return;
    }
    let hidup = true;
    muatGambar(sumber.bytes, sumber.mime)
      .then((img) => {
        if (!hidup) return;
        setDimensi({ w: img.naturalWidth, h: img.naturalHeight });
        dimensiRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      })
      .catch(() => { if (hidup) { setDimensi(null); dimensiRef.current = null; } });
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber]);

  // ----- Pipeline keluaran (sumber/edisi/kualitas berubah) -----
  useEffect(() => {
    if (!sumber) {
      setKeluaran(null);
      setMemproses(false);
      return;
    }
    let hidup = true;
    setMemproses(true);
    if (gambar) {
      hasilkanGambar(sumber.bytes, sumber.mime, edisi, kualitas)
        .then((h) => { if (hidup) { setKeluaran(h); setMemproses(false); } })
        .catch((e) => {
          if (hidup) {
            setKeluaran(null);
            setMemproses(false);
            toast.error(errorMessage(e));
          }
        });
    } else {
      setKeluaran({ bytes: sumber.bytes, mime: sumber.mime, ext: ekstensiDariNama(sumber.nama) || 'pdf' });
      setMemproses(false);
    }
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, edisi, kualitas]);

  useEffect(() => {
    onKeluaran(keluaran);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keluaran]);

  // Laporkan status kotor (edisi putar/crop/resize aktif atau hasil editor lengkap).
  const kotor = edisiAktif(edisi) || sumberEdit !== null;
  useEffect(() => {
    onKotor?.(kotor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kotor]);

  useEffect(() => {
    onProses?.(memproses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memproses]);

  // ----- PDF: dokumen + render halaman -----
  const { dokPdf, halPdf, setHalPdf, totalHal, galatPdf, kanvasRef } = usePdfDokumen({ aktif: pdf, sumber, zoom, ukuranWadah });

  // ----- Crop gambar: baru / pindah / ubah-sudut, komit eksplisit via Terapkan -----
  type SeretCrop =
    | { jenis: 'baru'; x0: number; y0: number }
    | { jenis: 'pindah'; dx: number; dy: number }
    | { jenis: 'ubah'; sudut: 'nw' | 'ne' | 'sw' | 'se' }
    | { jenis: 'sisi'; sisi: 'n' | 's' | 'w' | 'e' };
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
      // Rasio bebas: sisi tengah bisa digeser (atas/bawah/kiri/kanan).
      if (rasioCrop === null) {
        const sisi: ['n' | 's' | 'w' | 'e', number, number][] = [
          ['n', d.x + d.w / 2, d.y],
          ['s', d.x + d.w / 2, d.y + d.h],
          ['w', d.x, d.y + d.h / 2],
          ['e', d.x + d.w, d.y + d.h / 2],
        ];
        for (const [s, hx, hy] of sisi) {
          if (Math.abs(x - hx) <= JANGKAU_HANDLE && Math.abs(y - hy) <= JANGKAU_HANDLE) {
            seretCropRef.current = { jenis: 'sisi', sisi: s };
            return;
          }
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
      // Sisi hanya ada saat rasio bebas — abaikan defensif di jalur terkunci.
      if (s.jenis === 'sisi') return;
      const jangkar = {
        nw: { x: d.x + d.w, y: d.y + d.h },
        ne: { x: d.x, y: d.y + d.h },
        sw: { x: d.x + d.w, y: d.y },
        se: { x: d.x, y: d.y },
      }[s.sudut];
      const batasW = s.sudut === 'nw' || s.sudut === 'sw' ? jangkar.x : rw - jangkar.x;
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
    if (s.jenis === 'sisi') {
      if (s.sisi === 'n') {
        const y0 = jepit(y, bawah - MIN_CROP);
        setDrafCrop({ x: d.x, y: y0, w: d.w, h: bawah - y0 });
      } else if (s.sisi === 's') {
        setDrafCrop({ x: d.x, y: d.y, w: d.w, h: Math.max(MIN_CROP, Math.min(y - d.y, rh - d.y)) });
      } else if (s.sisi === 'w') {
        const x0 = jepit(x, kanan - MIN_CROP);
        setDrafCrop({ x: x0, y: d.y, w: kanan - x0, h: d.h });
      } else {
        setDrafCrop({ x: d.x, y: d.y, w: Math.max(MIN_CROP, Math.min(x - d.x, rw - d.x)), h: d.h });
      }
      return;
    }
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

  /** Penggaris pelurus: seret garis acuan di gambar, lepas untuk putar otomatis.
   *  Garis dianggap seharusnya datar (atau tegak bila lurusTegak). */
  function mulaiLurus(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    setGarisLurus({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function gerakLurus(e: React.PointerEvent) {
    if (!(e.buttons & 1)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setGarisLurus((g) => (g ? { ...g, x1: e.clientX - r.left, y1: e.clientY - r.top } : g));
  }

  function selesaiLurus() {
    const g = garisRef.current;
    garisRef.current = null;
    setGarisLurus(null);
    if (!g) return;
    const dx = g.x1 - g.x0;
    const dy = g.y1 - g.y0;
    if (Math.hypot(dx, dy) < 8) {
      toast.warning('Garis terlalu pendek — seret lebih panjang.');
      return;
    }
    // Sudut garis searah jarum jam dari horizontal (layar y ke bawah).
    const sudut = (Math.atan2(dy, dx) * 180) / Math.PI;
    let delta = lurusTegak ? 90 - sudut : -sudut;
    while (delta > 90) delta -= 180;
    while (delta < -90) delta += 180;
    setEdisi((e) => ({ ...e, miring: jepitMiring(e.miring + delta) }));
    toast.success(`${lurusTegak ? 'Tegak' : 'Datar'}: putar ${formatMiring(delta)}.`);
  }

  /** Bekukan putaran (90°/miring) menjadi piksel sumber baru — kualitas Asli
   *  agar tak ada kompresi ganda (simpanan akhir yang menerapkan kualitas). */
  async function bekukanPutaran(): Promise<boolean> {
    if (!sumber || !gambar) return false;
    try {
      const hasil = await hasilkanGambar(sumber.bytes, sumber.mime, edisi, 'asli');
      setSumberEdit({ bytes: hasil.bytes, mime: hasil.mime, nama: `${namaTanpaEkstensi(sumber.nama)}.${hasil.ext}` });
      setEdisi(EDISI_KOSONG);
      setDrafCrop(null);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    }
  }

  /** Mode edit eksklusif (satu panel bawah terbuka): tutup lainnya.
   *  Draf crop dipertahankan (hanya overlay disembunyikan). */
  function tutupModeLain(kecuali: 'putar' | 'crop' | 'resize') {
    if (kecuali !== 'putar') setModePutar(false);
    if (kecuali !== 'crop') setModeCrop(false);
    if (kecuali !== 'resize') setModeResize(false);
    setModeLurus(false);
    setGarisLurus(null);
  }

  /** Mulai/sunting crop; bila sedang miring, putaran dibekukan dulu otomatis. */
  async function mulaiModeCrop() {
    if (modeCrop) {
      batalCrop();
      return;
    }
    tutupModeLain('crop');
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
      tutupModeLain('resize');
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
  /** Padding wadah kanvas (p-2 dua sisi) dikurangkan agar 100% pas tanpa scrollbar. */
  const PAD_KANVAS = 16;
  const isiW = Math.max(0, ukuranWadah.w - PAD_KANVAS);
  const isiH = Math.max(0, ukuranWadah.h - PAD_KANVAS);
  const pas = kotakLuar && isiW > 0 && isiH > 0
    ? Math.min(isiW / kotakLuar.w, isiH / kotakLuar.h)
    : 1;
  const skalaTampil = pas * zoom;
  const dasarLebar = dimensi ? Math.max(1, Math.floor(dimensi.w * skalaTampil)) : 0;
  const dasarTinggi = dimensi ? Math.max(1, Math.floor(dimensi.h * skalaTampil)) : 0;
  const pxLebar = kotakLuar ? Math.max(1, Math.floor(kotakLuar.w * skalaTampil)) : 0;
  const pxTinggi = kotakLuar ? Math.max(1, Math.floor(kotakLuar.h * skalaTampil)) : 0;
  const aturZoom = (z: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)));

  /** Pratinjau crop-menempel: kotak + skala dari keluaran eksak (crop, bukan penuh). */
  const cropMenempel = !!edisi.crop && !modeCrop && gambar && !!dimensi;
  const outCrop = cropMenempel && edisi.crop
    ? dimsKeluaran(edisi, kualitas, edisi.crop.w, edisi.crop.h)
    : null;
  const pasCrop = outCrop && isiW > 0 && isiH > 0
    ? Math.min(isiW / outCrop.w, isiH / outCrop.h)
    : 1;
  const tCrop = pasCrop * zoom;
  const boxCropW = outCrop ? Math.max(1, Math.round(outCrop.w * tCrop)) : 0;
  const boxCropH = outCrop ? Math.max(1, Math.round(outCrop.h * tCrop)) : 0;
  const kotakLebar = cropMenempel ? boxCropW : pxLebar;
  const kotakTinggi = cropMenempel ? boxCropH : pxTinggi;
  /** Scroll hanya bila kotak melebihi ruang (100% pas = hidden, tanpa lingkaran umpan-balik scrollbar). */
  const perluGulir = kotakLebar > isiW || kotakTinggi > isiH;

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
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
    >
      {/* Toolbar: ubah (kiri) | zoom (tengah) | penuh + unduh (kanan) */}
      {sumber && (
        <>
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1">
          {pdf && (
            <>
              <TombolIkon tip="Halaman sebelumnya" id={`btn_pdf_sebelum_${p}`} size="sm" variant="ghost" disabled={halPdf <= 1} onClick={() => setHalPdf((h) => Math.max(1, h - 1))}>
                <ChevronLeft size={14} />
              </TombolIkon>
              <span className="min-w-16 text-center text-xs text-muted-foreground">
                {totalHal > 0 ? `hal ${Math.min(halPdf, totalHal)} / ${totalHal}` : '…'}
              </span>
              <TombolIkon tip="Halaman berikutnya" id={`btn_pdf_berikut_${p}`} size="sm" variant="ghost" disabled={halPdf >= totalHal} onClick={() => setHalPdf((h) => Math.min(Math.max(totalHal, 1), h + 1))}>
                <ChevronRight size={14} />
              </TombolIkon>
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
            </>
          )}
          {gambar && bisaUbah && (
            <div className="flex items-center gap-0.5 rounded-md border border-input p-0.5" role="group" aria-label="Mode ubah">
                <TombolIkon
                  tip={modePutar ? 'Sembunyikan kontrol putar' : 'Putar: tampilkan kontrol derajat'}
                  id={`btn_mode_putar_${p}`}
                  size="sm"
                  variant={modePutar ? 'secondary' : 'ghost'}
                  onClick={() => {
                    if (modePutar) {
                      setModePutar(false);
                      setModeLurus(false);
                      setGarisLurus(null);
                    } else {
                      tutupModeLain('putar');
                      setModePutar(true);
                    }
                  }}
                >
                  <RotateCw size={14} />
                </TombolIkon>
                <TombolIkon
                  tip={modeCrop ? 'Batal crop' : (edisi.crop ? 'Sunting crop' : (edisi.miring !== 0 ? 'Crop: putaran dibekukan otomatis dulu' : 'Crop: aktifkan lalu seret area pada gambar'))}
                  id={`btn_crop_${p}`}
                  size="sm"
                  variant={modeCrop ? 'secondary' : 'ghost'}
                  onClick={() => void mulaiModeCrop()}
                >
                  <Crop size={14} />
                </TombolIkon>
                {edisi.crop && (
                  <TombolIkon tip="Hapus crop" id={`btn_crop_hapus_${p}`} size="sm" variant="ghost" onClick={() => setEdisi((e) => ({ ...e, crop: null }))}>
                    <X size={14} />
                  </TombolIkon>
                )}
                <TombolIkon
                  tip={modeResize ? 'Sembunyikan kontrol resize' : 'Resize: tampilkan kontrol ukuran'}
                  id={`btn_mode_resize_${p}`}
                  size="sm"
                  variant={modeResize ? 'secondary' : 'ghost'}
                  onClick={toggleResize}
                >
                  <Scaling size={14} />
                </TombolIkon>
              </div>
          )}
          <span className="min-w-1 flex-1" />
          {/* Grup tampil (tengah) */}
          <TombolIkon tip="Perkecil" id={`btn_zoom_kurang_${p}`} size="sm" variant="ghost" onClick={() => aturZoom(zoom / 1.25)}>
            <Minus size={14} />
          </TombolIkon>
          <span className="min-w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <TombolIkon tip="Perbesar" id={`btn_zoom_tambah_${p}`} size="sm" variant="ghost" onClick={() => aturZoom(zoom * 1.25)}>
            <Plus size={14} />
          </TombolIkon>
          <TombolIkon tip={gambar ? 'Pas layar' : 'Pas lebar'} id={`btn_zoom_pas_${p}`} size="icon" variant="ghost" onClick={() => aturZoom(1)}>
            <Focus size={14} />
          </TombolIkon>
          <span className="min-w-1 flex-1" />
          {/* Grup kanan: penuh + unduh */}
          <TombolIkon tip="Layar penuh" id={`btn_layar_penuh_${p}`} size="icon" variant="ghost" onClick={layarPenuh} disabled={!sumber}>
            <Fullscreen size={14} />
          </TombolIkon>
          <TombolIkon tip="Unduh yang tampil" id={`btn_unduh_pilih_${p}`} size="sm" variant="ghost" onClick={unduhPilih}>
            <Download size={14} />
          </TombolIkon>
        </div>
        </>
      )}
      {/* Kanvas: seret untuk geser, roda untuk zoom */}
      <div
        ref={bungkusRef}
        onPointerDown={mulaiGeser}
        onPointerMove={gerakGeser}
        onPointerUp={selesaiGeser}
        onPointerCancel={selesaiGeser}
        onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
        className={cn(
          'flex min-h-0 flex-1 items-start justify-center p-2 select-none',
          perluGulir ? 'overflow-auto cursor-grab active:cursor-grabbing' : 'overflow-hidden',
        )}
      >
        {!sumber ? (
            <div className="m-auto flex flex-col items-center gap-2 px-6 text-center">
              <ImageUp size={28} className="text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {teksKosong ?? 'Belum ada berkas dipilih — pilih lewat Browse untuk melihat pratinjau di sini.'}
              </p>
            </div>
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
                data-seret
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
                    <span className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary" />
                    <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-sm border border-white bg-primary" />
                    {rasioCrop === null && (
                      <>
                        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-sm border border-white bg-primary" />
                        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-sm border border-white bg-primary" />
                        <span className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-primary" />
                        <span className="absolute top-1/2 -right-1.5 h-3 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-primary" />
                      </>
                    )}
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
            {/* Garis acuan geser (khusus putar): tengah tegas + sepertiga redup. */}
            {panduan && modePutar && (
              <div role="group" aria-label="Garis acuan geser" className="pointer-events-none absolute inset-0">
                {posPanduan.v.map((f, i) => (
                  <GarisPanduan
                    key={`pv${i}`}
                    id={`garis_panduan_${p}_v${i}`}
                    vertikal
                    fraksi={f}
                    bawaan={POS_PANDUAN_BAWAN.v[i]}
                    tengah={i === 1}
                    label={`Garis acuan vertikal ${i + 1}`}
                    warna={warnaPanduan}
                    padaUbah={(nf) => setPosPanduan((s) => ({ ...s, v: s.v.map((x, j) => (j === i ? nf : x)) }))}
                  />
                ))}
                {posPanduan.h.map((f, i) => (
                  <GarisPanduan
                    key={`ph${i}`}
                    id={`garis_panduan_${p}_h${i}`}
                    vertikal={false}
                    fraksi={f}
                    bawaan={POS_PANDUAN_BAWAN.h[i]}
                    tengah={i === 1}
                    label={`Garis acuan horizontal ${i + 1}`}
                    warna={warnaPanduan}
                    padaUbah={(nf) => setPosPanduan((s) => ({ ...s, h: s.h.map((x, j) => (j === i ? nf : x)) }))}
                  />
                ))}
              </div>
            )}
            {/* Overlay penggaris: seret garis acuan, lepas untuk meluruskan. */}
            {modeLurus && (
              <div
                aria-label="Penggaris pelurus: seret garis pada gambar lalu lepas"
                data-seret
                className="absolute inset-0 cursor-crosshair touch-none select-none"
                onPointerDown={mulaiLurus}
                onPointerMove={gerakLurus}
                onPointerUp={selesaiLurus}
                onPointerCancel={() => setGarisLurus(null)}
              >
                {garisLurus && (
                  <svg aria-hidden className="absolute inset-0 h-full w-full">
                    <line
                      x1={garisLurus.x0}
                      y1={garisLurus.y0}
                      x2={garisLurus.x1}
                      y2={garisLurus.y1}
                      stroke="white"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      style={{ filter: 'drop-shadow(0 0 2px black)' }}
                    />
                    <circle cx={garisLurus.x0} cy={garisLurus.y0} r={3.5} fill="white" style={{ filter: 'drop-shadow(0 0 2px black)' }} />
                    <circle cx={garisLurus.x1} cy={garisLurus.y1} r={3.5} fill="white" style={{ filter: 'drop-shadow(0 0 2px black)' }} />
                  </svg>
                )}
              </div>
            )}
          </div>
        ) : pdf ? (
          galatPdf ? (
            <p className="m-auto px-6 text-center text-xs text-destructive">{galatPdf}</p>
          ) : (
            <canvas ref={kanvasRef} className="m-auto shrink-0 rounded bg-white shadow" />
          )
        ) : (
          <p className="m-auto px-6 text-center text-xs text-muted-foreground">
            Pratinjau tidak tersedia untuk berkas ini — tetap bisa disimpan/diunduh.
          </p>
        )}
      </div>
      {/* Panel putar: dial + segmented Putar|Skala (dial Skala = zoom). */}
      {gambar && sumber && modePutar && (
        <div className="flex shrink-0 flex-col items-center gap-1 border-t border-neutral-800 bg-neutral-950 px-4 py-1.5">
          <div className="flex w-full max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1">
            {modeDial === 'rotasi' ? (
              <DialRuler
                id={`dial_putar_${p}`}
                min={-MAKS_MIRING}
                max={MAKS_MIRING}
                step={0.1}
                value={edisi.miring}
                dots={[-180, -135, -90, -45, 0, 45, 90, 135, 180]}
                snap={1.5}
                minor={5}
                ppu={2.5}
                format={formatMiring}
                disabled={!!edisi.crop || modeCrop}
                ariaLabel="Dial kemiringan: seret untuk memutar, panah untuk halus, klik titik untuk loncat, klik ganda untuk lurus"
                resetValue={0}
                onChange={(v) => setEdisi((e) => ({ ...e, miring: jepitMiring(v) }))}
              />
            ) : (
              <DialRuler
                id={`dial_skala_${p}`}
                min={25}
                max={400}
                step={1}
                value={Math.round(zoom * 100)}
                dots={[50, 100, 200, 400]}
                snap={4}
                minor={5}
                ppu={2}
                format={(v) => `${Math.round(v)}%`}
                ariaLabel="Dial skala: seret untuk zoom, panah untuk halus, klik titik untuk loncat, klik ganda untuk 100%"
                resetValue={100}
                onChange={(v) => aturZoom(v / 100)}
              />
            )}
          </div>
          </div>
          <div className="flex items-center gap-1">
          <div role="group" aria-label="Target dial" className="flex rounded-full bg-white/10 p-1">
            {(['rotasi', 'skala'] as const).map((m) => (
              <button
                key={m}
                type="button"
                id={`seg_dial_${m}_${p}`}
                aria-pressed={modeDial === m}
                onClick={() => setModeDial(m)}
                className={cn(
                  'rounded-full px-4 py-0.5 text-xs transition-colors',
                  modeDial === m ? 'bg-white/20 text-white ring-1 ring-white/25' : 'text-neutral-400 hover:text-white',
                )}
              >
                {m === 'rotasi' ? 'Putar' : 'Skala'}
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id={`btn_dial_reset_${p}`}
                aria-label={modeDial === 'rotasi' ? 'Luruskan (0°)' : 'Skala 100%'}
                disabled={modeDial === 'rotasi' && (!!edisi.crop || modeCrop)}
                onClick={() => {
                  if (modeDial === 'rotasi') setEdisi((e) => ({ ...e, miring: 0 }));
                  else aturZoom(1);
                }}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{modeDial === 'rotasi' ? 'Luruskan (0°)' : 'Skala 100%'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id={`btn_panduan_${p}`}
                aria-label={panduan ? 'Sembunyikan garis acuan' : 'Tampilkan garis acuan'}
                aria-pressed={panduan}
                onClick={() => setPanduan((v) => !v)}
                className={cn(
                  'rounded-full p-1.5 transition-colors hover:bg-white/10 hover:text-white',
                  panduan ? 'bg-white/20 text-white ring-1 ring-white/25' : 'text-neutral-400',
                )}
              >
                <Grid size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{panduan ? 'Sembunyikan garis acuan' : 'Tampilkan garis acuan'}</p>
            </TooltipContent>
          </Tooltip>
          {panduan && (
            <input
              type="color"
              id={`warna_panduan_${p}`}
              aria-label="Warna garis acuan"
              title="Warna garis acuan"
              value={warnaPanduan}
              onChange={(e) => setWarnaPanduan(e.target.value)}
              className="size-6 cursor-pointer rounded-full border border-white/25 bg-transparent p-0.5"
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id={`btn_lurus_${p}`}
                aria-label={modeLurus ? 'Tutup penggaris pelurus' : 'Penggaris pelurus: seret garis untuk meluruskan'}
                aria-pressed={modeLurus}
                disabled={modeCrop}
                onClick={() => { setGarisLurus(null); setModeLurus((v) => !v); }}
                className={cn(
                  'rounded-full p-1.5 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40',
                  modeLurus ? 'bg-white/20 text-white ring-1 ring-white/25' : 'text-neutral-400',
                )}
              >
                <Ruler size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{modeLurus ? 'Tutup penggaris pelurus' : 'Penggaris pelurus: seret garis untuk meluruskan'}</p>
            </TooltipContent>
          </Tooltip>
          {modeLurus && (
            <div role="group" aria-label="Acuan penggaris" className="flex shrink-0 rounded-full bg-white/10 p-0.5">
              {(['datar', 'tegak'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  id={`seg_lurus_${a}_${p}`}
                  aria-pressed={(a === 'tegak') === lurusTegak}
                  title={a === 'datar' ? 'Garis acuan datar (horizontal)' : 'Garis acuan tegak (vertikal)'}
                  onClick={() => setLurusTegak(a === 'tegak')}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] whitespace-nowrap transition-colors',
                    (a === 'tegak') === lurusTegak ? 'bg-white/20 text-white ring-1 ring-white/25' : 'text-neutral-400 hover:text-white',
                  )}
                >
                  {a === 'datar' ? 'Datar' : 'Tegak'}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
      {/* Panel crop: pil rasio + terapkan/batal. */}
      {gambar && sumber && modeCrop && (
        <div className="flex shrink-0 items-center gap-2 border-t bg-muted/40 px-4 py-2">
          <span className="shrink-0 text-xs text-muted-foreground">Rasio</span>
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          <div id={`grup_rasio_crop_${p}`} role="group" aria-label="Rasio crop" className="m-auto flex items-center gap-1 py-0.5">
            {RASIO_CROP.map((c) => {
              const aktif = (c.r === null && rasioCrop === null) || (c.r !== null && rasioCrop === c.r);
              return (
                <button
                  key={c.id}
                  type="button"
                  id={`btn_rasio_crop_${p}_${c.id}`}
                  aria-pressed={aktif}
                  title={c.r === null ? 'Crop bebas' : `Kunci rasio ${c.label}`}
                  onClick={() => pilihRasioCrop(c.r)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors',
                    aktif
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          </div>
          <TombolIkon
            tip="Terapkan crop"
            id={`btn_crop_terapkan_${p}`}
            size="icon"
            variant="default"
            disabled={!drafCrop}
            onClick={terapkanCrop}
          >
            <Check size={14} />
          </TombolIkon>
          <TombolIkon tip="Batal crop" id={`btn_crop_batal_${p}`} size="icon" variant="outline" onClick={batalCrop}>
            <X size={14} />
          </TombolIkon>
        </div>
      )}
      {/* Bar resize: dua baris kompak (W×H+kunci / template+caption). */}
      {gambar && sumber && modeResize && (
        <div className="flex shrink-0 flex-col items-center gap-1.5 border-t bg-muted/40 px-4 py-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Lebar</span>
            <input
              id={`input_ukuran_lebar_${p}`}
              type="number"
              min={1}
              max={MAKS_UKURAN}
              step={1}
              value={edisi.ukuran?.w ?? benihUkuran.w}
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
              aria-label="Tinggi keluaran piksel"
              onChange={(e) => ubahTinggi(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-20 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-center text-xs"
            />
            <span className="text-xs text-muted-foreground">px</span>
            <TombolIkon
              tip={kunciUkuran ? 'Buka kunci rasio' : 'Kunci rasio'}
              id={`btn_ukuran_kunci_${p}`}
              size="sm"
              variant={kunciUkuran ? 'secondary' : 'ghost'}
              onClick={kunciUlang}
            >
              {kunciUkuran ? <Link2 size={14} /> : <Unlink size={14} />}
            </TombolIkon>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Template</span>
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
        </div>
      )}
      {/* Status bar: nama berkas + dimensi + keluaran saat diedit. */}
      {sumber && (
        <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={sumber.nama}>
            {sumber.nama}
          </span>
          {gambar && dimensi && <span className="shrink-0">{dimensi.w} × {dimensi.h} px · {ukuranSumber}</span>}
          {kotor && (
            <>
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px font-medium text-primary">Diedit</span>
              <span className="shrink-0">{captionUkuran}{ukuranKeluar ? ` · ${ukuranKeluar}` : ''}</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
