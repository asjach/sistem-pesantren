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

/**
 * Ukuran halaman dari viewport pdf.js, dalam milimeter.
 *
 * Ukuran diambil dari getViewport, bukan dari page.view. page.view hanya
 * berisi empat angka (x0, y0, x1, y1); membacanya sebagai pasangan
 * (lebar, tinggi) menghasilkan undefined sehingga ukuran halaman jadi NaN dan
 * seluruh kanvas rusak.
 */
export function ukuranMmDariViewport(viewport: { width: number; height: number }): UkuranMm {
  return { lebar_mm: poinKeMm(viewport.width), tinggi_mm: poinKeMm(viewport.height) };
}

/** Render dibatalkan karena halaman atau ukuran kanvas berubah. Bukan kegagalan. */
export class RenderDibatalkan extends Error {
  constructor() {
    super('Render halaman dibatalkan.');
    this.name = 'RenderDibatalkan';
  }
}

/** Error pembatalan internal pdf.js tidak boleh terbaca sebagai kegagalan. */
function renderDibatalkan(e: unknown): boolean {
  const nama = (e as { name?: string } | null)?.name ?? '';
  return nama === 'RenderingCancelledException' || nama === 'RenderDibatalkan';
}

export interface DokumenPdf {
  /** Jumlah halaman berkas. */
  jumlah: number;
  /** Ukuran tiap halaman dalam milimeter, sudah dibulatkan. */
  ukuran: UkuranMm[];
  /**
   * Render satu halaman ke canvas pada lebar piksel tertentu.
   *
   * Panggilan baru membatalkan render yang sedang berjalan pada dokumen ini:
   * pdf.js menolak dua render bersamaan pada kanvas yang sama.
   */
  render: (nomor: number, canvas: HTMLCanvasElement, lebarPx: number) => Promise<void>;
  /** Batalkan render yang sedang berjalan; aman dipanggil berkali-kali. */
  batalkan: () => void;
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

    ukuran.push(ukuranMmDariViewport(page.getViewport({ scale: 1 })));

    page.cleanup();
  }

  // pdf.js hanya menerima satu render aktif per kanvas. Menjalankan render
  // kedua sebelum yang pertama selesai memunculkan "Cannot use the same canvas
  // during multiple render() operations", jadi render diserialisasi dan yang
  // sedang berjalan dibatalkan ketika permintaan baru datang.
  //
  // Hanya satu LembarPdf yang aktif pada satu waktu karena editor memakai tab
  // per halaman, sehingga pembatalan tingkat dokumen ini tidak menabrak
  // render halaman lain.
  let aktif: { cancel: () => void } | null = null;
  let generasi = 0;
  let antre: Promise<void> = Promise.resolve();

  const gambarSatuHalaman = async (nomor: number, canvas: HTMLCanvasElement, lebarPx: number) => {
    const page = await doc.getPage(nomor);
    const ukuranPoin = page.getViewport({ scale: 1 });
    const skala = ukuranPoin.width > 0 ? lebarPx / ukuranPoin.width : 1;

    const viewport = page.getViewport({ scale: skala });
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

    // Menyetel lebar kanvas juga membersihkannya, sehingga render yang
    // terbatalkan tidak meninggalkan gambar separuh jadi.
    canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const konteks = canvas.getContext('2d');
    if (!konteks) {
      page.cleanup();
      return;
    }

    konteks.save();
    konteks.scale(dpr, dpr);

    const tugas = page.render({ canvas, canvasContext: konteks, viewport });
    aktif = tugas;

    try {
      await tugas.promise;
    } catch (e) {
      if (renderDibatalkan(e)) {
        throw new RenderDibatalkan();
      }

      throw e;
    } finally {
      if (aktif === tugas) {
        aktif = null;
      }

      konteks.restore();
      page.cleanup();
    }
  };

  return {
    jumlah: doc.numPages,
    ukuran,
    render: (nomor, canvas, lebarPx) => {
      generasi += 1;
      const gen = generasi;

      // Render yang sedang berjalan tidak mungkin dikejar; hentikan sekarang.
      aktif?.cancel();
      aktif = null;

      const pekerjaan = antre.then(async () => {
        // Permintaan yang sudah digantikan tidak perlu digambar.
        if (gen !== generasi) {
          throw new RenderDibatalkan();
        }

        await gambarSatuHalaman(nomor, canvas, lebarPx);
      });

      // Antrean harus tetap bisa dilanjutkan walau satu pekerjaan gagal.
      antre = pekerjaan.then(
        () => undefined,
        () => undefined,
      );

      return pekerjaan;
    },
    batalkan: () => {
      generasi += 1;
      aktif?.cancel();
      aktif = null;
    },
    tutup: () => tugas.destroy(),
  };
}
