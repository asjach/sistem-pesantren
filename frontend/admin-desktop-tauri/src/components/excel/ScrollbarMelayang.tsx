import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/** Panjang minimal jempol (px) agar tetap bisa dipegang. */
const JEMPOL_MIN = 20;

/** Langkah keyboard panah (px); PageUp/Down/Home/End mengikuti bawaan. */
const LANGKAH_PANAH = 40;

interface Props {
  /** Arah bilah. */
  orientasi: 'vertikal' | 'horizontal';
  /** Wadah `.simpes-dsg` (tempat mencari `.dsg-container`). */
  wadahRef: RefObject<HTMLDivElement | null>;
}

/** Bilah gulir melayang di tepi kartu tabel — pengganti scrollbar bawaan
 *  yang disembunyikan (lihat index.css). Grid melukis sampai tepi kartu
 *  ("menembus" area scrollbar); bilah 10px ini melayang di atasnya.
 *  Gulir roda/sentuh tetap bawaan — komponen ini hanya visual + pegangan:
 *  seret jempol, klik rel (lompat satu layar), keyboard saat fokus.
 *  `.dsg-container` dicari ulang tiap sinkron agar tahan remount grid. */
export default function ScrollbarMelayang({ orientasi, wadahRef }: Props) {
  const vertikal = orientasi === 'vertikal';
  const relRef = useRef<HTMLDivElement>(null);
  const seret = useRef<{ awalPointer: number; awalGulir: number } | null>(null);
  const [tampil, setTampil] = useState(false);
  const [awal, setAwal] = useState(0);
  const [panjang, setPanjang] = useState(JEMPOL_MIN);

  function cariGulir(): HTMLElement | null {
    return wadahRef.current?.querySelector<HTMLElement>('.dsg-container') ?? null;
  }

  function selaraskan() {
    const sc = cariGulir();
    if (!sc) {
      setTampil(false);
      return;
    }
    const total = vertikal ? sc.scrollHeight : sc.scrollWidth;
    const tampak = vertikal ? sc.clientHeight : sc.clientWidth;
    const posisi = vertikal ? sc.scrollTop : sc.scrollLeft;
    if (total <= tampak + 1) {
      setTampil(false);
      return;
    }
    const rel = relRef.current ? (vertikal ? relRef.current.clientHeight : relRef.current.clientWidth) : 0;
    const pjg = Math.max(JEMPOL_MIN, (tampak / total) * rel);
    const maks = Math.max(0, rel - pjg);
    const awl = total > tampak ? (posisi / (total - tampak)) * maks : 0;
    setTampil(true);
    setAwal(awl);
    setPanjang(pjg);
  }

  // Tiap render induk (baris/kolom/lebar berubah) + gulir + resize: cukup
  // pendengar `scroll` mode capture di wadah (menangkap remount grid) dan
  // ResizeObserver — tanpa MutationObserver.
  useLayoutEffect(() => {
    selaraskan();
  });
  useEffect(() => {
    const wadah = wadahRef.current;
    if (!wadah || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const jadwal = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(selaraskan);
    };
    wadah.addEventListener('scroll', jadwal, { capture: true, passive: true });
    const ro = new ResizeObserver(jadwal);
    ro.observe(wadah);
    return () => {
      cancelAnimationFrame(raf);
      wadah.removeEventListener('scroll', jadwal, { capture: true });
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Metrik untuk seret: bisa-gulir konten per px lintasan jempol. */
  function metrikSeret(): { bisaGulir: number; lintasan: number } | null {
    const sc = cariGulir();
    const rel = relRef.current;
    if (!sc || !rel) return null;
    const total = vertikal ? sc.scrollHeight : sc.scrollWidth;
    const tampak = vertikal ? sc.clientHeight : sc.clientWidth;
    const relUkuran = vertikal ? rel.clientHeight : rel.clientWidth;
    const lintasan = relUkuran - panjang;
    if (lintasan <= 0 || total <= tampak) return null;
    return { bisaGulir: total - tampak, lintasan };
  }

  function mulaiSeret(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const sc = cariGulir();
    if (!sc) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seret.current = {
      awalPointer: vertikal ? e.clientY : e.clientX,
      awalGulir: vertikal ? sc.scrollTop : sc.scrollLeft,
    };
  }

  function gerakSeret(e: ReactPointerEvent<HTMLDivElement>) {
    const s = seret.current;
    if (!s) return;
    const sc = cariGulir();
    const m = metrikSeret();
    if (!sc || !m) return;
    const delta = (vertikal ? e.clientY : e.clientX) - s.awalPointer;
    const nilai = s.awalGulir + (delta * m.bisaGulir) / m.lintasan;
    if (vertikal) sc.scrollTop = nilai;
    else sc.scrollLeft = nilai;
  }

  function lepasSeret() {
    seret.current = null;
  }

  /** Klik rel (bukan jempol): lompat satu layar ke arah klik. */
  function klikRel(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const sc = cariGulir();
    const rel = relRef.current;
    if (!sc || !rel) return;
    const kotak = rel.getBoundingClientRect();
    const titik = vertikal ? e.clientY - kotak.top : e.clientX - kotak.left;
    const tampak = vertikal ? sc.clientHeight : sc.clientWidth;
    const delta = titik < awal ? -tampak : tampak;
    if (vertikal) sc.scrollTop += delta;
    else sc.scrollLeft += delta;
  }

  function tekanTombol(e: ReactKeyboardEvent<HTMLDivElement>) {
    const sc = cariGulir();
    if (!sc) return;
    const tampak = vertikal ? sc.clientHeight : sc.clientWidth;
    const maju = vertikal ? e.key === 'ArrowDown' : e.key === 'ArrowRight';
    const mundur = vertikal ? e.key === 'ArrowUp' : e.key === 'ArrowLeft';
    if (maju || mundur) {
      e.preventDefault();
      const delta = (maju ? 1 : -1) * LANGKAH_PANAH;
      if (vertikal) sc.scrollTop += delta;
      else sc.scrollLeft += delta;
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const delta = (e.key === 'PageDown' ? 1 : -1) * tampak;
      if (vertikal) sc.scrollTop += delta;
      else sc.scrollLeft += delta;
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const nilai = e.key === 'Home' ? 0 : (vertikal ? sc.scrollHeight : sc.scrollWidth);
      if (vertikal) sc.scrollTop = nilai;
      else sc.scrollLeft = nilai;
    }
  }

  if (!tampil) return null;
  const persen = Math.round((awal / Math.max(1, (relRef.current ? (vertikal ? relRef.current.clientHeight : relRef.current.clientWidth) : 1) - panjang)) * 100);
  return (
    <div
      ref={relRef}
      role="scrollbar"
      aria-orientation={vertikal ? 'vertical' : 'horizontal'}
      aria-label={vertikal ? 'Gulir vertikal tabel' : 'Gulir horizontal tabel'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.max(0, persen))}
      tabIndex={0}
      onPointerDown={klikRel}
      onKeyDown={tekanTombol}
      className={cn(
        'absolute z-10 touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        vertikal ? 'inset-y-0 right-0 w-2.5' : 'inset-x-0 bottom-0 h-2.5',
      )}
    >
      <div
        role="presentation"
        onPointerDown={mulaiSeret}
        onPointerMove={gerakSeret}
        onPointerUp={lepasSeret}
        onPointerCancel={lepasSeret}
        style={vertikal ? { top: awal, height: panjang } : { left: awal, width: panjang }}
        className={cn(
          'absolute rounded-full bg-[color-mix(in_srgb,var(--accent)_55%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]',
          vertikal ? 'left-1/2 w-[6px] -translate-x-1/2' : 'top-1/2 h-[6px] -translate-y-1/2',
        )}
      />
    </div>
  );
}
