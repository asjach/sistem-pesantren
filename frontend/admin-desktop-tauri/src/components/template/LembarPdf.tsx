import { useEffect, useRef, useState } from 'react';

import type { DokumenPdf, UkuranMm } from '@/lib/template/pdf';
import { cn } from '@/lib/utils';

interface LembarPdfProps {
  doc: DokumenPdf;
  nomor: number;
  /** Lebar kanvas dalam piksel CSS; tinggi mengikuti rasio halaman. */
  lebarPx: number;
  className?: string;
}

/**
 * Satu halaman PDF yang dirender ke canvas.
 *
 * Lebar halaman dalam milimeter datang dari pdf.js dan bulatannya sama dengan
 * yang dipakai FPDI di backend, jadi kotak medan yang diletakkan di atasnya
 * tepat bertumpuk dengan isi halaman.
 */
export default function LembarPdf({ doc, nomor, lebarPx, className }: LembarPdfProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const ukuran: UkuranMm = doc.ukuran[nomor - 1] ?? { lebar_mm: 210, tinggi_mm: 297 };
  const tinggiPx = Math.round((lebarPx * ukuran.tinggi_mm) / ukuran.lebar_mm);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let batal = false;
    setGalat(null);

    doc
      .render(nomor, canvas, lebarPx)
      .catch((e: unknown) => {
        if (!batal) {
          setGalat(e instanceof Error ? e.message : 'Halaman gagal ditampilkan.');
        }
      });

    return () => {
      batal = true;
    };
  }, [doc, nomor, lebarPx]);

  return (
    <div
      className={cn('relative bg-white shadow-sm ring-1 ring-border', className)}
      style={{ width: lebarPx, height: tinggiPx }}
    >
      <canvas ref={canvasRef} aria-label={`Halaman ${nomor} berkas template`} />
      {galat && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
          {galat}
        </p>
      )}
    </div>
  );
}
