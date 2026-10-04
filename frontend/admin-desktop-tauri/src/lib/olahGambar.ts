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
  /** Kemiringan halus (derajat, ±MAKS_MIRING) di atas rotasi — meluruskan pindaian miring. */
  miring: number;
  crop: CropPiksel | null;
  /** Ukuran keluaran eksplisit (px); null = ikut putaran/crop (+hemat bila dipilih). */
  ukuran: { w: number; h: number } | null;
}

export type KualitasSimpan = 'asli' | 'hemat';

/** Batas kemiringan (derajat) — satu-satunya kontrol putar (±180°). */
export const MAKS_MIRING = 180;

/** Batas sisi terpanjang + kualitas JPEG untuk pilihan Hemat. */
export const MAKS_DIM_HEMAT = 1600;
export const KUALITAS_HEMAT = 0.82;

/** Batas sisi ukuran eksplisit (px) — cegah kanvas raksasa. */
export const MAKS_UKURAN = 8000;

export const EDISI_KOSONG: EdisiGambar = { rotasi: 0, miring: 0, crop: null, ukuran: null };

export function edisiAktif(e: EdisiGambar): boolean {
  return e.rotasi !== 0 || e.miring !== 0 || e.crop !== null || e.ukuran !== null;
}

/** Jepit dimensi ke 1..MAKS_UKURAN (bulat). */
export function jepitUkuran(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(MAKS_UKURAN, Math.round(n)));
}

/** Bounding box (sebelum resize) citra w×h yang diputar sebesar derajat.
 *  Fungsi murni — dipakai pipeline kanvas dan pratinjau agar WYSIWYG. */
export function kotakPutar(derajat: number, w: number, h: number): { w: number; h: number } {
  const rad = (derajat * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));
  return { w: w * cosA + h * sinA, h: w * sinA + h * cosA };
}

/** Dimensi keluaran untuk (sw,sh) — dipakai kanvas, pratinjau, dan caption.
 *  Ukuran eksplisit menang atas hemat; diterapkan ke citra tegak lalu diputar. */
export function dimsKeluaran(
  e: EdisiGambar,
  kualitas: KualitasSimpan,
  sw: number,
  sh: number,
): { w: number; h: number } {
  let uw = sw;
  let uh = sh;
  if (e.ukuran) {
    uw = jepitUkuran(e.ukuran.w);
    uh = jepitUkuran(e.ukuran.h);
  }
  const b = bingkaiPutar(e.rotasi, e.miring, uw, uh);
  if (!e.ukuran && kualitas === 'hemat') {
    const k = Math.min(1, MAKS_DIM_HEMAT / Math.max(b.w, b.h));
    return { w: Math.max(1, Math.round(b.w * k)), h: Math.max(1, Math.round(b.h * k)) };
  }
  return { w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) };
}

/** Jepit kemiringan ke ±MAKS_MIRING. */
export function jepitMiring(derajat: number): number {
  if (Number.isNaN(derajat)) return 0;
  return Math.max(-MAKS_MIRING, Math.min(MAKS_MIRING, derajat));
}

/** Bingkai hasil putar: bounding box total (siku pas-piksel, miring membesar
 *  mengikuti sudut) — seluruh konten muat, tak ada yang terpotong. */
export function bingkaiPutar(rotasi: 0 | 90 | 180 | 270, miring: number, w: number, h: number): {
  w: number;
  h: number;
} {
  return kotakPutar(rotasi + jepitMiring(miring), w, h);
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

  // 2-3. Putar + resize via satu sumber kebenaran (ukuran eksplisit = citra tegak).
  const totalDerajat = edisi.rotasi + jepitMiring(edisi.miring);
  const rad = (totalDerajat * Math.PI) / 180;
  const { w: lebar, h: tinggi } = dimsKeluaran(edisi, kualitas, sw, sh);
  const u = edisi.ukuran;
  let dw = sw;
  let dh = sh;
  if (u) {
    dw = jepitUkuran(u.w);
    dh = jepitUkuran(u.h);
  } else if (kualitas === 'hemat') {
    const b0 = bingkaiPutar(edisi.rotasi, edisi.miring, sw, sh);
    const k = Math.min(1, MAKS_DIM_HEMAT / Math.max(b0.w, b0.h));
    dw = sw * k;
    dh = sh * k;
  }

  const mimeKeluar = kualitas === 'hemat' ? 'image/jpeg' : mimeSumber.startsWith('image/png') ? 'image/png' : 'image/jpeg';
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia.');
  if (mimeKeluar === 'image/jpeg') {
    // Ratakan alpha ke putih (JPEG tak punya transparansi; sudut hasil miring ikut putih).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lebar, tinggi);
  }
  ctx.translate(lebar / 2, tinggi / 2);
  ctx.rotate(rad);
  // Citra tegak berukuran keluaran (dw×dh) diputar mengisi kanvas pas.
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);

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

/** Putar koordinat ternormalisasi [0,1] searah jarum jam (kelipatan 90°). */
function putarUV(u: number, v: number, rotasi: 0 | 90 | 180 | 270): [number, number] {
  if (rotasi === 90) return [1 - v, u];
  if (rotasi === 180) return [1 - u, 1 - v];
  if (rotasi === 270) return [v, 1 - u];
  return [u, v];
}

/** Kebalikan putarUV (layar → natural). */
function balikUV(u: number, v: number, rotasi: 0 | 90 | 180 | 270): [number, number] {
  return putarUV(u, v, ((360 - rotasi) % 360) as 0 | 90 | 180 | 270);
}

/** Rect drag tampil (px dalam kotak) → crop natural, memperhitungkan putar 90°.
 *  Jepit akhir tetap di pipeline (hasilkanGambar). */
export function rectKeNaturalPutar(
  rectTampil: { x: number; y: number; w: number; h: number },
  tampilW: number,
  tampilH: number,
  naturalW: number,
  naturalH: number,
  rotasi: 0 | 90 | 180 | 270,
): CropPiksel {
  const [u0, v0] = balikUV(rectTampil.x / tampilW, rectTampil.y / tampilH, rotasi);
  const [u1, v1] = balikUV((rectTampil.x + rectTampil.w) / tampilW, (rectTampil.y + rectTampil.h) / tampilH, rotasi);
  return {
    x: Math.round(Math.min(u0, u1) * naturalW),
    y: Math.round(Math.min(v0, v1) * naturalH),
    w: Math.round(Math.abs(u1 - u0) * naturalW),
    h: Math.round(Math.abs(v1 - v0) * naturalH),
  };
}

/** Crop natural → rect tampil (px dalam kotak), memperhitungkan putar 90°. */
export function naturalKeRectPutar(
  crop: CropPiksel,
  tampilW: number,
  tampilH: number,
  naturalW: number,
  naturalH: number,
  rotasi: 0 | 90 | 180 | 270,
): { x: number; y: number; w: number; h: number } {
  const [u0, v0] = putarUV(crop.x / naturalW, crop.y / naturalH, rotasi);
  const [u1, v1] = putarUV((crop.x + crop.w) / naturalW, (crop.y + crop.h) / naturalH, rotasi);
  const x0 = Math.min(u0, u1) * tampilW;
  const y0 = Math.min(v0, v1) * tampilH;
  return { x: x0, y: y0, w: Math.max(u0, u1) * tampilW - x0, h: Math.max(v0, v1) * tampilH - y0 };
}
