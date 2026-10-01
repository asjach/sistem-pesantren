/** Mesin sinkron cermin dua arah (lokal ↔ server) — digerakkan tombol manual.
 *
 *  Tanpa antrean backend (batas shared hosting): orkestrasi batch di sini,
 *  backend hanya endpoint sinkronus (status-berkas / sinkron-unggah /
 *  tandai-sinkron / unduh). Semua operasi idempoten: batal kapan pun,
 *  jalan-ulang me-resume (baris cocok dilewati via `sinkron_hash`).
 *
 *  Matriks per baris (identitas cermin = `nama_file` sama di kedua sisi):
 *  hilang dua-duanya → galat; hanya lokal → naik; hanya server → turun;
 *  dua-duanya sama → tandai/sudah-sama; beda → mtime terbaru menang
 *  (seri <2 detik dimenangkan server, dicatat).
 */
import {
  ambilByteDokumen,
  listDokumen,
  sinkronUnggahDokumen,
  statusBerkasDokumen,
  tandaiSinkronDokumen,
  type DokumenRow,
  type StatusBerkasServer,
  type TipeDokumen,
} from '@/api/dokumen';
import {
  cariLokal,
  ekstensiDariNama,
  mimeDariEkstensi,
  targetTulisLokal,
  tulisTepatArsip,
  type TipeArsip,
} from '@/lib/arsipDokumen';
import { errorMessage } from '@/api/client';

export type AksiSinkron = 'sudah-sama' | 'naik' | 'turun' | 'ditandai' | 'dilewati' | 'galat';

export interface HasilSinkronBaris {
  id: number;
  nama: string;
  aksi: AksiSinkron;
  /** True bila hash beda tetapi mtime seri sehingga server dimenangkan. */
  seri?: boolean;
  pesan?: string;
}

export interface RingkasanSinkron {
  total: number;
  selesai: number;
  naik: number;
  turun: number;
  sama: number;
  ditandai: number;
  dilewati: number;
  seri: number;
  galat: number;
  galatDaftar: { nama: string; pesan: string }[];
  dibatalkan: boolean;
}

export interface ByteLokal {
  bytes: Uint8Array;
  /** Detik epoch. */
  mtime: number;
}

/** Titik jahit I/O agar mesin murni dan mudah dites (produksi: `depsPerangkat`). */
export interface DepsSinkron {
  statusServer(nama: string[]): Promise<Record<string, StatusBerkasServer>>;
  bacaLokal(row: DokumenRow): Promise<ByteLokal | null>;
  tulisLokal(row: DokumenRow, bytes: Uint8Array): Promise<void>;
  unggahServer(row: DokumenRow, bytes: Uint8Array, hash: string, mtime: number): Promise<void>;
  unduhServer(row: DokumenRow): Promise<Uint8Array>;
  tandaiServer(row: DokumenRow, hash: string): Promise<void>;
}

export interface OpsiSinkron {
  /** Dipanggil tiap baris selesai (untuk progres + tombol Batal). */
  lapor?: (ringkas: RingkasanSinkron) => void;
  /** True = hentikan setelah baris berjalan. */
  dibatalkan?: () => boolean;
  ukuranBatch?: number;
}

/** Selisih mtime di bawah ini = seri (server menang, dicatat). */
export const AMBANG_SERI_DETIK = 2;
/** Nama per panggilan status-berkas (batas backend 100). */
export const BATCH_STATUS = 100;

export function ringkasanAwal(total: number): RingkasanSinkron {
  return { total, selesai: 0, naik: 0, turun: 0, sama: 0, ditandai: 0, dilewati: 0, seri: 0, galat: 0, galatDaftar: [], dibatalkan: false };
}

/** SHA-256 hex (Web Crypto; backend mengirim sha256 di status-berkas). */
export async function hashSha256(data: Uint8Array): Promise<string> {
  const hasil = await crypto.subtle.digest('SHA-256', data.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(hasil)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function detikTersinkron(row: DokumenRow): number | null {
  if (!row.tersinkron_pada) return null;
  const t = Date.parse(row.tersinkron_pada);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** Satu baris: bandingkan sisi lokal vs server lalu samakan. Murni (I/O via deps). */
export async function sinkronSatuBaris(
  row: DokumenRow,
  lokal: ByteLokal | null,
  server: StatusBerkasServer | undefined,
  deps: DepsSinkron,
): Promise<HasilSinkronBaris> {
  const nama = row.nama_file ?? '';
  if (nama === '') return { id: row.id, nama: '(tanpa berkas)', aksi: 'dilewati', pesan: 'Baris tanpa nama_file.' };
  if (!lokal && !server?.ada) {
    return { id: row.id, nama, aksi: 'galat', pesan: 'Berkas tidak ada di lokal maupun server.' };
  }
  if (lokal && !server?.ada) {
    const hash = await hashSha256(lokal.bytes);
    await deps.unggahServer(row, lokal.bytes, hash, lokal.mtime);
    return { id: row.id, nama, aksi: 'naik' };
  }
  if (!lokal && server?.ada) {
    const bytes = await deps.unduhServer(row);
    await deps.tulisLokal(row, bytes);
    await deps.tandaiServer(row, await hashSha256(bytes));
    return { id: row.id, nama, aksi: 'turun' };
  }
  // Dua-duanya ada: jalan pintas tanpa baca-hash bila bukti sinkron masih baru.
  const shaServer = server?.sha256 ?? null;
  const tersinkron = detikTersinkron(row);
  if (
    row.penyimpanan === 'cermin' && row.sinkron_hash && shaServer
    && row.sinkron_hash.toLowerCase() === shaServer.toLowerCase()
    && tersinkron !== null && (lokal?.mtime ?? 0) <= tersinkron
  ) {
    return { id: row.id, nama, aksi: 'dilewati' };
  }
  const hashLokal = await hashSha256((lokal as ByteLokal).bytes);
  if (shaServer && hashLokal.toLowerCase() === shaServer.toLowerCase()) {
    if (row.penyimpanan === 'cermin' && (row.sinkron_hash ?? '').toLowerCase() === hashLokal.toLowerCase()) {
      return { id: row.id, nama, aksi: 'sudah-sama' };
    }
    await deps.tandaiServer(row, hashLokal);
    return { id: row.id, nama, aksi: 'ditandai' };
  }
  // Isi beda: mtime terbaru menang.
  const mLokal = lokal?.mtime ?? 0;
  const mServer = server?.mtime ?? 0;
  if (Math.abs(mLokal - mServer) <= AMBANG_SERI_DETIK) {
    const bytes = await deps.unduhServer(row);
    await deps.tulisLokal(row, bytes);
    await deps.tandaiServer(row, await hashSha256(bytes));
    return { id: row.id, nama, aksi: 'turun', seri: true, pesan: 'Waktu ubah seri; server dimenangkan.' };
  }
  if (mLokal > mServer) {
    await deps.unggahServer(row, (lokal as ByteLokal).bytes, hashLokal, mLokal);
    return { id: row.id, nama, aksi: 'naik' };
  }
  const bytes = await deps.unduhServer(row);
  await deps.tulisLokal(row, bytes);
  await deps.tandaiServer(row, await hashSha256(bytes));
  return { id: row.id, nama, aksi: 'turun' };
}

/** Sinkronkan daftar baris (status server per batch, byte satu per satu). */
export async function sinkronkanDaftar(
  rows: DokumenRow[],
  deps: DepsSinkron,
  opsi: OpsiSinkron = {},
): Promise<RingkasanSinkron> {
  const ringkas = ringkasanAwal(rows.length);
  const ukuran = opsi.ukuranBatch ?? BATCH_STATUS;
  const dgnNama = rows.filter((r) => (r.nama_file ?? '') !== '');
  const statusSemua: Record<string, StatusBerkasServer> = {};
  for (let i = 0; i < dgnNama.length; i += ukuran) {
    if (opsi.dibatalkan?.()) { ringkas.dibatalkan = true; return ringkas; }
    const batch = dgnNama.slice(i, i + ukuran);
    const hasil = await deps.statusServer(batch.map((r) => r.nama_file as string));
    Object.assign(statusSemua, hasil);
  }
  for (const row of rows) {
    if (opsi.dibatalkan?.()) { ringkas.dibatalkan = true; break; }
    try {
      const lokal = (row.nama_file ?? '') !== '' ? await deps.bacaLokal(row) : null;
      const hasil = await sinkronSatuBaris(row, lokal, statusSemua[row.nama_file as string], deps);
      ringkas.selesai += 1;
      if (hasil.aksi === 'galat') {
        ringkas.galat += 1;
        ringkas.galatDaftar.push({ nama: hasil.nama, pesan: hasil.pesan ?? 'Galat.' });
      } else {
        if (hasil.aksi === 'naik') ringkas.naik += 1;
        if (hasil.aksi === 'turun') ringkas.turun += 1;
        if (hasil.aksi === 'sudah-sama') ringkas.sama += 1;
        if (hasil.aksi === 'ditandai') ringkas.ditandai += 1;
        if (hasil.aksi === 'dilewati') ringkas.dilewati += 1;
        if (hasil.seri) ringkas.seri += 1;
      }
    } catch (e) {
      ringkas.selesai += 1;
      ringkas.galat += 1;
      ringkas.galatDaftar.push({ nama: row.nama_file ?? `#${row.id}`, pesan: errorMessage(e) });
    }
    opsi.lapor?.(ringkas);
  }
  if (opsi.dibatalkan?.()) ringkas.dibatalkan = true;
  return ringkas;
}

/** Ambil seluruh baris tipe (paginasi) untuk lingkup sinkron. */
export async function ambilSemuaBaris(
  tipe: TipeDokumen,
  params: { jenjang?: string[] | null; q?: string; santri_id?: number; signal?: AbortSignal } = {},
): Promise<DokumenRow[]> {
  const semua: DokumenRow[] = [];
  const perPage = 500;
  for (let page = 1; ; page += 1) {
    const hasil = await listDokumen(tipe, { ...params, page, per_page: perPage });
    semua.push(...hasil.data);
    if (page >= hasil.last_page || hasil.data.length === 0) break;
  }
  return semua;
}

// ---------------- Dependensi perangkat (Tauri) ----------------

/** Dependensi nyata ke arsip perangkat + API (hanya desktop). */
export function depsPerangkat(tipe: TipeDokumen): DepsSinkron {
  const baca = async (row: DokumenRow): Promise<(ByteLokal & { akar: string; lokasi: import('@/lib/arsipDokumen').LokasiArsip }) | null> => {
    const nama = row.nama_file ?? '';
    if (nama === '') return null;
    return cariLokal(nama, row.jenis_dokumen, tipe as TipeArsip, row.penyimpanan ?? 'server');
  };
  return {
    statusServer: async (nama) => (await statusBerkasDokumen(tipe, nama)).data,
    bacaLokal: baca,
    tulisLokal: async (row, bytes) => {
      const nama = row.nama_file as string;
      const ketemu = await baca(row);
      const target = ketemu ?? await targetTulisLokal(nama, row.jenis_dokumen, tipe as TipeArsip, row.penyimpanan ?? 'server');
      await tulisTepatArsip(bytes, nama, target.akar, tipe as TipeArsip, target.lokasi);
    },
    unggahServer: async (row, bytes, hash, mtime) => {
      const nama = row.nama_file as string;
      const file = new File([bytes.slice().buffer as ArrayBuffer], nama, {
        type: mimeDariEkstensi(ekstensiDariNama(nama)),
      });
      await sinkronUnggahDokumen(tipe, row.id, file, hash, mtime);
    },
    unduhServer: async (row) => ambilByteDokumen(tipe, row.id),
    tandaiServer: async (row, hash) => {
      await tandaiSinkronDokumen(tipe, row.id, hash);
    },
  };
}
