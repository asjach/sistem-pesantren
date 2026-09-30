/** Olah gambar dokumen via canvas: putar, crop, resize, kompresi JPEG.
 *  Murni fungsi browser (tanpa dependensi); dipakai viewer + alur simpan. */

export interface CropPiksel {
  /** Koordinat natural (sebelum putar): kiri, atas, lebar, tinggi. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EdisiGambar {
  rotasi: 0 | 90 | 180 | 270;
  crop: CropPiksel | null;
}

export type KualitasSimpan = 'asli' | 'hemat';

/** Batas sisi terpanjang + kualitas JPEG untuk pilihan Hemat. */
export const MAKS_DIM_HEMAT = 1600;
export const KUALITAS_HEMAT = 0.82;

export const EDISI_KOSONG: EdisiGambar = { rotasi: 0, crop: null };

export function edisiAktif(e: EdisiGambar): boolean {
  return e.rotasi !== 0 || e.crop !== null;
}

/** Muat byte menjadi elemen gambar (tunggu decode selesai). */
export function muatGambar(bytes: Uint8Array, mime: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Berkas gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

function blobKeBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((b) => new Uint8Array(b));
}

function kanvasKeBlob(kanvas: HTMLCanvasElement, mime: string, kualitas?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    kanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal mengolah gambar.'))),
      mime,
      kualitas,
    );
  });
}

export interface HasilGambar {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

/** Terapkan edisi + kualitas ke gambar sumber.
 *  Tanpa edisi & kualitas Asli → byte asli dikembalikan apa adanya. */
export async function hasilkanGambar(
  sumber: Uint8Array,
  mimeSumber: string,
  edisi: EdisiGambar,
  kualitas: KualitasSimpan,
): Promise<HasilGambar> {
  const perluKanvas = edisiAktif(edisi) || kualitas === 'hemat';
  if (!perluKanvas) {
    return { bytes: sumber, mime: mimeSumber, ext: mimeSumber === 'image/png' ? 'png' : 'jpg' };
  }
  const img = await muatGambar(sumber, mimeSumber);
  const alamiW = img.naturalWidth;
  const alamiH = img.naturalHeight;

  // 1. Crop dalam koordinat natural (jepit ke dalam gambar).
  const c = edisi.crop;
  const sx = Math.max(0, Math.min(c?.x ?? 0, alamiW - 1));
  const sy = Math.max(0, Math.min(c?.y ?? 0, alamiH - 1));
  const sw = Math.max(1, Math.min(c?.w ?? alamiW, alamiW - sx));
  const sh = Math.max(1, Math.min(c?.h ?? alamiH, alamiH - sy));

  // 2. Putar: tukar dimensi untuk 90/270.
  const tegak = edisi.rotasi === 90 || edisi.rotasi === 270;
  let lebar = tegak ? sh : sw;
  let tinggi = tegak ? sw : sh;

  // 3. Resize hemat.
  if (kualitas === 'hemat') {
    const skala = Math.min(1, MAKS_DIM_HEMAT / Math.max(lebar, tinggi));
    lebar = Math.max(1, Math.round(lebar * skala));
    tinggi = Math.max(1, Math.round(tinggi * skala));
  }

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  if (kualitas === 'hemat') {
    // Ratakan alpha ke putih (JPEG tak punya transparansi).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lebar, tinggi);
  }
  ctx.translate(lebar / 2, tinggi / 2);
  ctx.rotate((edisi.rotasi * Math.PI) / 180);
  // Kanvas pas seukuran hasil putar (+resize seragam) → gambar mengisi penuh.
  const skalaIsi = lebar / sw;
  ctx.drawImage(img, sx, sy, sw, sh, (-sw * skalaIsi) / 2, (-sh * skalaIsi) / 2, sw * skalaIsi, sh * skalaIsi);

  const mimeKeluar = kualitas === 'hemat' ? 'image/jpeg' : mimeSumber.startsWith('image/png') ? 'image/png' : 'image/jpeg';
  const blob = await kanvasKeBlob(kanvas, mimeKeluar, mimeKeluar === 'image/jpeg' ? (kualitas === 'hemat' ? KUALITAS_HEMAT : 0.92) : undefined);
  return { bytes: await blobKeBytes(blob), mime: mimeKeluar, ext: mimeKeluar === 'image/png' ? 'png' : 'jpg' };
}

/** Ganti ekstensi nama file (untuk unduh hasil edisi yang berubah format). */
export function gantiEkstensi(nama: string, ext: string): string {
  return `${namaTanpaEkstensi(nama)}.${ext || 'bin'}`;
}

function namaTanpaEkstensi(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(0, i) : nama;
}

/** Petakan rect tampilan (px dalam kotak gambar) ke koordinat natural. */
export function rectKeNatural(
  rectTampil: { x: number; y: number; w: number; h: number },
  tampilW: number,
  tampilH: number,
  naturalW: number,
  naturalH: number,
): CropPiksel {
  const sx = naturalW / tampilW;
  const sy = naturalH / tampilH;
  return {
    x: Math.round(rectTampil.x * sx),
    y: Math.round(rectTampil.y * sy),
    w: Math.round(rectTampil.w * sx),
    h: Math.round(rectTampil.h * sy),
  };
}

/** Petakan crop natural kembali ke rect tampil (untuk menggambar overlay). */
export function naturalKeRect(
  crop: CropPiksel,
  tampilW: number,
  tampilH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: (crop.x / naturalW) * tampilW,
    y: (crop.y / naturalH) * tampilH,
    w: (crop.w / naturalW) * tampilW,
    h: (crop.h / naturalH) * tampilH,
  };
}
