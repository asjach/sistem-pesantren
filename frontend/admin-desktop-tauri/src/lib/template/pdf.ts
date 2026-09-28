/**
 * Pemuat PDF untuk editor template.
 *
 * Berkas template diunduh dengan header Authorization milik pengguna, lalu
 * dibaca pdf.js. Berkas tidak pernah dimuat lewat URL storage publik karena
 * route penyajian disk lokal tidak dilindungi middleware auth.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

export interface UkuranMm {
  lebar_mm: number;
  tinggi_mm: number;
}

/**
 * Poin ke milimeter, dibulatkan ke dua desimal.
 *
 * Dibulatkan karena FPDI di backend mengembalikan nilai pelarut
 * (210.00014444444 mm). Editor dan printer harus memakai angka yang sama,
 * kalau tidak satu miligram meleset dan kotak medan bergeser dari teks.
 */
export function poinKeMm(poin: number): number {
  return Math.round((poin / PT_PER_INCH) * MM_PER_INCH * 100) / 100;
}

export interface DokumenPdf {
  /** Jumlah halaman berkas. */
  jumlah: number;
  /** Ukuran tiap halaman dalam milimeter, sudah dibulatkan. */
  ukuran: UkuranMm[];
  /** Render satu halaman ke canvas pada lebar piksel tertentu. */
  render: (nomor: number, canvas: HTMLCanvasElement, lebarPx: number) => Promise<void>;
  /** Bebaskan dokumen; dipanggil setelah tidak dipakai lagi. */
  tutup: () => Promise<void>;
}

/**
 * Muat berkas PDF dari array byte.
 *
 * `useSystemFonts` dipakai agar PDF yang memakai font bawaan (Helvetica,
 * Times, Courier) dirender memakai font sistem, sehingga folder
 * standard_fonts tidak perlu ikut dibundel.
 */
export async function muatPdf(data: ArrayBuffer): Promise<DokumenPdf> {
  // Loading task yang disimpan, bukan dokumennya: `destroy()` untuk
  // menghentikan worker ada di situ, sedangkan PDFDocumentProxy tidak
  // memilikinya.
  const tugas = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
  const doc = await tugas.promise;

  const ukuran: UkuranMm[] = [];

  for (let nomor = 1; nomor <= doc.numPages; nomor += 1) {
    const page = await doc.getPage(nomor);
    const [, , , , lebarPoin, tinggiPoin] = page.view;

    ukuran.push({ lebar_mm: poinKeMm(lebarPoin), tinggi_mm: poinKeMm(tinggiPoin) });

    page.cleanup();
  }

  return {
    jumlah: doc.numPages,
    ukuran,
    render: async (nomor, canvas, lebarPx) => {
      const page = await doc.getPage(nomor);
      const [, , , , lebarPoin] = page.view;
      const skala = lebarPoin > 0 ? lebarPx / lebarPoin : 1;

      const viewport = page.getViewport({ scale: skala });
      const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
      canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const konteks = canvas.getContext('2d');
      if (!konteks) {
        return;
      }

      konteks.save();
      konteks.scale(dpr, dpr);

      await page.render({ canvas, canvasContext: konteks, viewport }).promise;

      konteks.restore();
      page.cleanup();
    },
    tutup: () => tugas.destroy(),
  };
}
