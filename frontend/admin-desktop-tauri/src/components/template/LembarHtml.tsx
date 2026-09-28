import { mmKePx } from '@/lib/template/satuan';
import type { UkuranHalaman } from '@/lib/template/tipe';

/** Jarak antar garis guide tipis, dalam milimeter. */
const JARAK_GUIDE_MM = 5;

/** Jarak garis guide yang ditebalkan, dalam milimeter. */
const JARAK_GUIDE_BESAR_MM = 25;

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

  // Guide dipakai sebagai pengatur posisi, bukan sebagai isi halaman. Kalau
  // semua garis sama tebalnya, halaman terlihat seperti kertas grafik dan
  // kotak medan sulit dibaca. Jadi lima milimeter sangat tipis dan
  // tiap dua puluh lima milimeter ditebalkan sebagai pembatas.
  const gayaTipis = 'pointer-events-none absolute bg-slate-500/20';
  const gayaBesar = 'pointer-events-none absolute bg-slate-500/40';

  return (
    <div
      className={className}
      style={{ width: lebarPx, height: tinggiPx, background: '#fff' }}
      aria-label={`Halaman ${ukuran.lebar_mm} kali ${ukuran.tinggi_mm} milimeter`}
    >
      {garisX.map((mm) => (
        <span
          key={`x${mm}`}
          className={mm % JARAK_GUIDE_BESAR_MM === 0 ? gayaBesar : gayaTipis}
          style={{ left: mmKePx(mm, zoom), top: 0, height: '100%', width: 1 }}
        />
      ))}
      {garisY.map((mm) => (
        <span
          key={`y${mm}`}
          className={mm % JARAK_GUIDE_BESAR_MM === 0 ? gayaBesar : gayaTipis}
          style={{ top: mmKePx(mm, zoom), left: 0, width: '100%', height: 1 }}
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
