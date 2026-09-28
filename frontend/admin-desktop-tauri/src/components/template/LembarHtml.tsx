import { mmKePx } from '@/lib/template/satuan';
import type { UkuranHalaman } from '@/lib/template/tipe';

/** Jarak antar garis guide dalam milimeter. */
const JARAK_GUIDE_MM = 10;

interface LembarHtmlProps {
  ukuran: UkuranHalaman;
  /** Lebar halaman dalam piksel CSS; sama dengan lebar kanvas. */
  lebarPx: number;
  zoom: number;
  /** Tampilkan garis guide setiap 10 mm. */
  tampilGuide?: boolean;
  className?: string;
}

/**
 * Halaman kosong untuk template yang tata letaknya digambar sendiri.
 *
 * Berbeda dengan LembarPdf, tidak ada berkas yang dirender. Yang datang dari
 * server hanyalah ukuran halaman dalam milimeter, jadi guide digambar dari
 * angka itu juga. Guide tidak ikut tercetak; gunanya hanya sebagai pengukur
 * saat menempatkan medan.
 */
export default function LembarHtml({ ukuran, lebarPx, zoom, tampilGuide = true, className }: LembarHtmlProps) {
  const tinggiPx = Math.round((lebarPx * ukuran.tinggi_mm) / ukuran.lebar_mm);
  const garisX = tampilGuide ? deret(0, ukuran.lebar_mm, JARAK_GUIDE_MM) : [];
  const garisY = tampilGuide ? deret(0, ukuran.tinggi_mm, JARAK_GUIDE_MM) : [];

  return (
    <div
      className={className}
      style={{ width: lebarPx, height: tinggiPx, background: '#fff' }}
      aria-label={`Halaman ${ukuran.lebar_mm} kali ${ukuran.tinggi_mm} milimeter`}
    >
      {garisX.map((mm) => (
        <span
          key={`x${mm}`}
          className="pointer-events-none absolute w-px bg-border"
          style={{ left: mmKePx(mm, zoom), top: 0, height: '100%' }}
        />
      ))}
      {garisY.map((mm) => (
        <span
          key={`y${mm}`}
          className="pointer-events-none absolute h-px bg-border"
          style={{ top: mmKePx(mm, zoom), left: 0, width: '100%' }}
        />
      ))}
    </div>
  );
}

/** Deret kelipatan dari nol sampai batas, tanpa overshoot. */
function deret(dari: number, sampai: number, langkah: number): number[] {
  const hasil: number[] = [];

  for (let nilai = dari; nilai <= sampai + 0.001; nilai += langkah) {
    hasil.push(Math.round(nilai * 100) / 100);
  }

  return hasil;
}
