import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/client';
import type { DokumenRow, StatusBerkasServer } from '@/api/dokumen';
import {
  hashSha256,
  sinkronSatuBaris,
  sinkronkanDaftar,
  type ByteLokal,
  type DepsSinkron,
} from './sinkronDokumen';

const TEKS_A = new TextEncoder().encode('isi-a');
const TEKS_B = new TextEncoder().encode('isi-b');

function baris(sebagian: Partial<DokumenRow> = {}): DokumenRow {
  return {
    id: 1, tipe: 'santri', jenis_dokumen: 'Kartu Keluarga', pemilik: 'Ahmad',
    nama_file: 'a.pdf', catatan: null, unduh_url: '/x/unduh', ...sebagian,
  };
}

function lokal(mtime: number, bytes = TEKS_A): ByteLokal {
  return { mtime, baca: async () => bytes };
}

function server(sebagian: Partial<StatusBerkasServer> = {}): StatusBerkasServer {
  return { ada: true, ukuran: 5, mtime: 1000, sha256: '00'.repeat(32), ...sebagian };
}

function depsPalsu(unduh = TEKS_A): DepsSinkron & {
  naik: { row: DokumenRow; hash: string }[];
  turun: Uint8Array[];
  ditandai: string[];
  hapus: string[];
  ubah: string[];
} {
  const naik: { row: DokumenRow; hash: string }[] = [];
  const turun: Uint8Array[] = [];
  const ditandai: string[] = [];
  const hapus: string[] = [];
  const ubah: string[] = [];
  return {
    naik, turun, ditandai, hapus, ubah,
    statusServer: async () => ({}),
    statLokal: async () => null,
    hapusLokal: async (_r, nama) => { hapus.push(nama); },
    ubahNamaServer: async (_r, nama) => { ubah.push(nama); },
    tulisLokal: async (_r, b) => { turun.push(b); },
    unggahServer: async (row, _b, hash) => { naik.push({ row, hash }); },
    unduhServer: async () => unduh,
    tandaiServer: async (_r, h) => { ditandai.push(h); },
  };
}

describe('hashSha256', () => {
  it('vektor NIST untuk "abc"', async () => {
    await expect(hashSha256(new TextEncoder().encode('abc'))).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('sinkronSatuBaris', () => {
  it('hilang dua-duanya → galat', async () => {
    const d = depsPalsu();
    const h = await sinkronSatuBaris(baris(), null, { ada: false }, d);
    expect(h.aksi).toBe('galat');
    expect(d.naik).toHaveLength(0);
  });

  it('hanya lokal → naik dengan hash isi', async () => {
    const d = depsPalsu();
    const h = await sinkronSatuBaris(baris(), lokal(2000), { ada: false }, d);
    expect(h.aksi).toBe('naik');
    expect(d.naik).toHaveLength(1);
    expect(d.naik[0].hash).toBe(await hashSha256(TEKS_A));
  });

  it('hanya server → turun + tulis + tandai', async () => {
    const d = depsPalsu(TEKS_B);
    const h = await sinkronSatuBaris(baris(), null, server(), d);
    expect(h.aksi).toBe('turun');
    expect(d.turun).toHaveLength(1);
    expect(d.turun[0]).toEqual(TEKS_B);
    expect(d.ditandai).toEqual([await hashSha256(TEKS_B)]);
  });

  it('sama + sudah cermin → sudah-sama tanpa API', async () => {
    const d = depsPalsu();
    const sha = await hashSha256(TEKS_A);
    const h = await sinkronSatuBaris(
      baris({ penyimpanan: 'cermin', sinkron_hash: sha }),
      lokal(2000), server({ sha256: sha }), d,
    );
    expect(h.aksi).toBe('sudah-sama');
    expect(d.ditandai).toHaveLength(0);
  });

  it('sama tetapi belum ditandai → ditandai', async () => {
    const d = depsPalsu();
    const sha = await hashSha256(TEKS_A);
    const h = await sinkronSatuBaris(baris({ penyimpanan: 'lokal' }), lokal(2000), server({ sha256: sha }), d);
    expect(h.aksi).toBe('ditandai');
    expect(d.ditandai).toEqual([sha]);
    expect(d.naik).toHaveLength(0);
    expect(d.turun).toHaveLength(0);
  });

  it('jalan pintas: cermin + hash cocok + lokal tak berubah → dilewati', async () => {
    const d = depsPalsu();
    const tandai = vi.spyOn(d, 'tandaiServer');
    const h = await sinkronSatuBaris(
      baris({ penyimpanan: 'cermin', sinkron_hash: 'AB'.repeat(32), tersinkron_pada: new Date(3000 * 1000).toISOString() }),
      lokal(2000), server({ sha256: 'ab'.repeat(32), mtime: 2500 }), d,
    );
    expect(h.aksi).toBe('dilewati');
    expect(tandai).not.toHaveBeenCalled();
  });

  it('beda isi, lokal terbaru → naik', async () => {
    const d = depsPalsu();
    const h = await sinkronSatuBaris(
      baris({ penyimpanan: 'cermin' }), lokal(5000, TEKS_A), server({ mtime: 1000, sha256: 'ff'.repeat(32) }), d,
    );
    expect(h.aksi).toBe('naik');
    expect(h.seri).toBeUndefined();
  });

  it('beda isi, server terbaru → turun', async () => {
    const d = depsPalsu(TEKS_B);
    const h = await sinkronSatuBaris(
      baris({ penyimpanan: 'cermin' }), lokal(1000, TEKS_A), server({ mtime: 5000, sha256: 'ff'.repeat(32) }), d,
    );
    expect(h.aksi).toBe('turun');
    expect(d.turun[0]).toEqual(TEKS_B);
  });

  it('beda isi tetapi seri → server menang + flag seri', async () => {
    const d = depsPalsu(TEKS_B);
    const h = await sinkronSatuBaris(
      baris(), lokal(1001, TEKS_A), server({ mtime: 1000, sha256: 'ff'.repeat(32) }), d,
    );
    expect(h.aksi).toBe('turun');
    expect(h.seri).toBe(true);
  });

  it('tanpa nama_file → dilewati', async () => {
    const d = depsPalsu();
    const h = await sinkronSatuBaris(baris({ nama_file: null }), lokal(1), server(), d);
    expect(h.aksi).toBe('dilewati');
  });
});

describe('sinkronkanDaftar', () => {
  it('status server per batch 100 + ringkasan terhitung', async () => {
    const d = depsPalsu();
    const panggilBatch: number[] = [];
    d.statusServer = async (nama) => { panggilBatch.push(nama.length); return {}; };
    d.statLokal = async () => null;
    const rows = Array.from({ length: 250 }, (_, i) => baris({ id: i + 1, nama_file: `f${i}.pdf` }));
    const lapor: number[] = [];
    const hasil = await sinkronkanDaftar(rows, d, { lapor: (r) => { lapor.push(r.selesai); } });
    expect(panggilBatch).toEqual([100, 100, 50]);
    expect(hasil.total).toBe(250);
    expect(hasil.galat).toBe(250);
    expect(hasil.lokalAda).toBe(0);
    expect(lapor.at(-1)).toBe(250);
  });

  it('galat API menampilkan pesan validasi, bukan "API 422"', async () => {
    const d = depsPalsu();
    d.statLokal = async () => lokal(1);
    d.statusServer = async () => ({});
    d.unggahServer = async () => {
      throw new ApiError(422, { message: 'The file field must be a file of type: jpg, jpeg, png, pdf.', errors: {} });
    };
    const hasil = await sinkronkanDaftar([baris()], d);
    expect(hasil.galat).toBe(1);
    expect(hasil.galatDaftar[0].pesan).toContain('must be a file of type');
  });

  it('jalan pintas dan sudah-sama tidak membaca isi berkas', async () => {
    const d = depsPalsu();
    const baca = vi.fn(async () => TEKS_A);
    const sha = await hashSha256(TEKS_A);
    const cermin = baris({
      penyimpanan: 'cermin', sinkron_hash: sha,
      tersinkron_pada: new Date(3000 * 1000).toISOString(),
    });
    const r1 = await sinkronSatuBaris(cermin, { mtime: 2000, baca }, server({ sha256: sha, mtime: 2500 }), d);
    expect(r1.aksi).toBe('dilewati');
    expect(baca).not.toHaveBeenCalled();
    // Sudah-sama tanpa bukti waktu tetap butuh 1x baca untuk hash.
    const r2 = await sinkronSatuBaris(
      baris({ penyimpanan: 'cermin', sinkron_hash: sha }),
      { mtime: 2000, baca }, server({ sha256: sha }), d,
    );
    expect(r2.aksi).toBe('sudah-sama');
    expect(baca).toHaveBeenCalledTimes(1);
  });

  it('HEIC dikonversi: tulis baru → ubah nama → unggah → buang lama', async () => {
    const d = depsPalsu();
    const JPG = new TextEncoder().encode('jpeg-bytes');
    const urutan: string[] = [];
    d.statLokal = async () => lokal(1000, TEKS_A);
    d.statusServer = async () => ({});
    d.konversiJikaPerlu = async () => ({ bytes: JPG, nama: 'foto.jpg' });
    d.tulisLokal = async (r) => { urutan.push(`tulis:${r.nama_file}`); };
    d.ubahNamaServer = async (_r, nama) => { urutan.push(`ubah:${nama}`); };
    const unggahAsli = d.unggahServer;
    d.unggahServer = async (r, b, h, m) => { urutan.push(`unggah:${r.nama_file}`); await unggahAsli(r, b, h, m); };
    const hasil = await sinkronkanDaftar([baris({ nama_file: 'foto.heic' })], d);
    expect(hasil.naik).toBe(1);
    expect(hasil.konversi).toBe(1);
    expect(hasil.galat).toBe(0);
    expect(hasil.lokalAda).toBe(1);
    expect(urutan).toEqual(['tulis:foto.jpg', 'ubah:foto.jpg', 'unggah:foto.jpg']);
    expect(d.hapus).toEqual(['foto.heic']);
    expect(d.naik[0].hash).toBe(await hashSha256(JPG));
  });

  it('tabrakan nama hasil konversi → galat tanpa transfer', async () => {
    const d = depsPalsu();
    d.statLokal = async () => lokal(1000, TEKS_A);
    d.statusServer = async () => ({ 'foto.jpg': { ada: true } });
    d.konversiJikaPerlu = async () => ({ bytes: new Uint8Array([1]), nama: 'foto.jpg' });
    const tulis = vi.fn();
    d.tulisLokal = tulis;
    const hasil = await sinkronkanDaftar([baris({ nama_file: 'foto.heic' })], d);
    expect(hasil.galat).toBe(1);
    expect(hasil.naik).toBe(0);
    expect(hasil.galatDaftar[0].pesan).toContain('sudah ada di server');
    expect(tulis).not.toHaveBeenCalled();
    expect(d.naik).toHaveLength(0);
  });

  it('batal di tengah → berhenti + flag', async () => {
    const d = depsPalsu();
    d.statLokal = async () => null;
    let jalan = 0;
    const hasil = await sinkronkanDaftar(
      [baris({ id: 1 }), baris({ id: 2 }), baris({ id: 3 })], d,
      { dibatalkan: () => jalan++ >= 1 },
    );
    expect(hasil.dibatalkan).toBe(true);
    expect(hasil.selesai).toBeLessThan(3);
  });
});
