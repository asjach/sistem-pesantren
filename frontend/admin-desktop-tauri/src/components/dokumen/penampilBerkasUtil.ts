/**
 * Utilitas murni untuk PenampilBerkas: worker pdf.js, nama/ekstensi berkas,
 * format sudut, dan konstanta zoom/garis acuan.
 */

/** Jenis berkas yang bisa ditampilkan (byte + mime + nama). */
export interface SumberBerkas {
  bytes: Uint8Array;
  mime: string;
  nama: string;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

/** Posisi bawaan garis acuan (fraksi): tengah + sepertiga. */
export const POS_PANDUAN_BAWAN = { v: [1 / 3, 1 / 2, 2 / 3], h: [1 / 3, 1 / 2, 2 / 3] };

/** Muat pdf.js sekali + pasang worker-nya (Vite `?url`). */
export function pasangWorkerPdf(): Promise<typeof import('pdfjs-dist')> {
  return import('pdfjs-dist').then(async (pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    return pdfjs;
  });
}

export function ekstensiDariNama(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(i + 1).toLowerCase() : '';
}

export function formatMiring(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}°`;
}

export function namaTanpaEkstensi(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(0, i) : nama;
}
