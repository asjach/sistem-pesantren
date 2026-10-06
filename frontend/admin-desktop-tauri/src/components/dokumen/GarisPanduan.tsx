import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

/** Satu garis acuan putus-putus yang bisa digeser (seret/keyboard/klik-ganda reset). */
export default function GarisPanduan({
  id,
  vertikal,
  fraksi,
  bawaan,
  tengah,
  label,
  warna,
  padaUbah,
}: {
  id: string;
  vertikal: boolean;
  fraksi: number;
  bawaan: number;
  tengah: boolean;
  label: string;
  warna: string;
  padaUbah: (f: number) => void;
}) {
  const seret = useRef<{ dasar: number } | null>(null);

  function mulaiSeret(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    seret.current = { dasar: fraksi };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function gerakSeret(e: ReactPointerEvent) {
    const s = seret.current;
    if (!s || !(e.buttons & 1)) return;
    const kotak = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
    if (!kotak) return;
    const pos = vertikal ? e.clientX - kotak.left : e.clientY - kotak.top;
    const ukuran = vertikal ? kotak.width : kotak.height;
    if (ukuran <= 0) return;
    padaUbah(Math.min(1, Math.max(0, pos / ukuran)));
  }

  function tombol(e: ReactKeyboardEvent) {
    const langkah = e.shiftKey ? 0.1 : 0.01;
    const kurang = vertikal ? ['ArrowLeft', 'ArrowDown'] : ['ArrowUp', 'ArrowLeft'];
    const tambah = vertikal ? ['ArrowRight', 'ArrowUp'] : ['ArrowDown', 'ArrowRight'];
    if (kurang.includes(e.key)) {
      e.preventDefault();
      padaUbah(Math.min(1, Math.max(0, fraksi - langkah)));
    } else if (tambah.includes(e.key)) {
      e.preventDefault();
      padaUbah(Math.min(1, Math.max(0, fraksi + langkah)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      padaUbah(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      padaUbah(1);
    }
  }

  const persen = Math.round(fraksi * 100);
  return (
    <div
      id={id}
      role="slider"
      tabIndex={0}
      data-seret
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={persen}
      aria-valuetext={`${persen}%`}
      onPointerDown={mulaiSeret}
      onPointerMove={gerakSeret}
      onPointerUp={() => { seret.current = null; }}
      onPointerCancel={() => { seret.current = null; }}
      onDoubleClick={() => padaUbah(bawaan)}
      onKeyDown={tombol}
      title={`${label} — seret untuk geser, klik ganda untuk kembali`}
      className={cn(
        'pointer-events-auto absolute touch-none rounded outline-none select-none focus-visible:bg-white/15',
        vertikal
          ? 'inset-y-0 w-[9px] -translate-x-1/2 cursor-ew-resize'
          : 'inset-x-0 h-[9px] -translate-y-1/2 cursor-ns-resize',
      )}
      style={vertikal ? { left: `${persen}%` } : { top: `${persen}%` }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute border-dashed',
          vertikal
            ? 'inset-y-0 left-1/2 border-l'
            : 'inset-x-0 top-1/2 border-t',
        )}
        style={{ borderColor: warna, opacity: tengah ? 0.9 : 0.45 }}
      />
    </div>
  );
}
