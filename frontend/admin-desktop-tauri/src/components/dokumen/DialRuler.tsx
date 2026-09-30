import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface DialRulerProps {
  id: string;
  min: number;
  max: number;
  /** Langkah keyboard (tambah Shift = ×10). */
  step: number;
  value: number;
  /** Titik-titik putih (klik = loncat) + jangkar snap. */
  dots: number[];
  /** Radius snap ke titik saat seret dilepas (0 = tanpa snap). */
  snap?: number;
  /** Jarak tick kecil. */
  minor: number;
  /** Piksel per satuan nilai. */
  ppu?: number;
  format: (v: number) => string;
  disabled?: boolean;
  ariaLabel: string;
  /** Nilai klik-ganda (reset). */
  resetValue: number;
  onChange: (v: number) => void;
}

/** Dial ala pemutar foto: strip tick digeser, angka di tengah, titik = loncat.
 *  Seret (pointer), keyboard (panah/Shift/Home/End), klik-ganda = reset. */
export default function DialRuler({
  id,
  min,
  max,
  step,
  value,
  dots,
  snap = 0,
  minor,
  ppu = 2.5,
  format,
  disabled,
  ariaLabel,
  resetValue,
  onChange,
}: DialRulerProps) {
  const jepit = (v: number) => Math.min(max, Math.max(min, v));
  const total = (max - min) * ppu;
  const seret = useRef<{ x0: number; v0: number; aktif: boolean; akhir: number } | null>(null);

  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += minor) ticks.push(Math.round(v * 1000) / 1000);

  function mulaiSeret(e: React.PointerEvent) {
    if (disabled || e.button !== 0) return;
    seret.current = { x0: e.clientX, v0: value, aktif: false, akhir: value };
  }

  function gerakSeret(e: React.PointerEvent) {
    const s = seret.current;
    if (!s || disabled) return;
    if (!s.aktif) {
      if (Math.abs(e.clientX - s.x0) < 4) return;
      s.aktif = true;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const mentah = jepit(s.v0 - (e.clientX - s.x0) / ppu);
    s.akhir = mentah;
    onChange(mentah);
  }

  function selesaiSeret() {
    const s = seret.current;
    seret.current = null;
    if (!s?.aktif || disabled) return;
    if (snap > 0) {
      const dekat = dots.find((d) => Math.abs(d - s.akhir) <= snap);
      if (dekat !== undefined && dekat !== s.akhir) onChange(dekat);
    }
  }

  function tombol(e: React.KeyboardEvent) {
    if (disabled) return;
    const besar = e.shiftKey ? step * 10 : step;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(jepit(value - besar));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(jepit(value + besar));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  }

  return (
    <div
      id={id}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuetext={format(value)}
      aria-disabled={disabled}
      onPointerDown={mulaiSeret}
      onPointerMove={gerakSeret}
      onPointerUp={selesaiSeret}
      onPointerCancel={selesaiSeret}
      onDoubleClick={() => { if (!disabled) onChange(resetValue); }}
      onKeyDown={tombol}
      className={cn(
        'relative h-8 w-full cursor-ew-resize touch-none overflow-hidden rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-white/40',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {/* Tick + titik sebaris di tengah; angka menimpa tengah (mask bg panel). */}
      <div
        className="absolute inset-y-0"
        style={{ left: '50%', width: total, transform: `translateX(${-((value - min) * ppu)}px)` }}
      >
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-white/25"
            style={{ left: (t - min) * ppu }}
          />
        ))}
        {dots.map((d) => (
          <button
            key={d}
            type="button"
            aria-label={format(d)}
            title={format(d)}
            onClick={() => { if (!disabled) onChange(d); }}
            className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 transition-colors hover:bg-white"
            style={{ left: (d - min) * ppu }}
          />
        ))}
      </div>
      {/* Garis pendek di atas angka + angka sebaris tick (mask agar tick lewat tertutup). */}
      <span aria-hidden className="absolute top-0.5 left-1/2 h-1 w-px -translate-x-1/2 bg-white/70" />
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-neutral-950 px-1.5 text-sm leading-none font-semibold text-white tabular-nums"
      >
        {format(value)}
      </span>
    </div>
  );
}
