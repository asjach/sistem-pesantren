import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { BATAS_GAMBAR, ID_GAMBAR_VALID, normalisasiAnotasi, type Anotasi } from './anotasiData';

const BATAS_JSON = 64_000;

async function bacaBadan(req: IncomingMessage, batas: number): Promise<Buffer> {
  const potongan: Buffer[] = [];
  let ukuran = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    ukuran += buffer.length;
    if (ukuran > batas) throw new Error('Badan anotasi terlalu besar.');
    potongan.push(buffer);
  }
  return Buffer.concat(potongan);
}

export function validasiPng(data: Buffer, anotasi: Anotasi) {
  if (!anotasi.gambar || data.length < 45 || data.length > BATAS_GAMBAR
    || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || data.readUInt32BE(8) !== 13 || data.toString('ascii', 12, 16) !== 'IHDR'
    || data.readUInt32BE(16) !== anotasi.gambar.lebar || data.readUInt32BE(20) !== anotasi.gambar.tinggi
    || data.subarray(-8, -4).toString('ascii') !== 'IEND') throw new Error('PNG atau ukuran screenshot tidak valid.');
}

/** Endpoint dev saja. Multipart menyimpan JSON + PNG sebagai satu operasi. */
export function buatHandlerAnotasi(folder: string) {
  const berkas = path.join(folder, 'anotasi.json');
  const folderGambar = path.join(folder, 'screenshots');
  const lokasiGambar = (id: string) => {
    if (!ID_GAMBAR_VALID.test(id)) throw new Error('ID screenshot tidak valid.');
    return path.join(folderGambar, `${id}.png`);
  };
  const baca = (): Anotasi[] => {
    if (!fs.existsSync(berkas)) return [];
    const isi = JSON.parse(fs.readFileSync(berkas, 'utf8')) as { anotasi?: Anotasi[] };
    if (!Array.isArray(isi.anotasi)) throw new Error('Berkas anotasi tidak valid.');
    return isi.anotasi;
  };
  const tulis = (daftar: Anotasi[]) => {
    fs.mkdirSync(folder, { recursive: true });
    try {
      fs.writeFileSync(`${berkas}.tmp`, `${JSON.stringify({ diperbarui: new Date().toISOString(), anotasi: daftar }, null, 2)}\n`);
      fs.renameSync(`${berkas}.tmp`, berkas);
    } finally {
      fs.rmSync(`${berkas}.tmp`, { force: true });
    }
  };
  const kirim = (res: ServerResponse, status: number, data?: unknown) => {
    res.statusCode = status;
    res.setHeader('Cache-Control', 'no-store');
    if (data !== undefined) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(data === undefined ? undefined : JSON.stringify(data));
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return kirim(res, 403, { pesan: 'Origin anotasi tidak diizinkan.' });
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      // Jangan melayani file sembarang atau meneruskan metode ke route lain.
      if (url.pathname === '/gambar' && req.method === 'GET') {
        const id = url.searchParams.get('id') ?? '';
        const lokasi = lokasiGambar(id);
        if (!baca().some((a) => a.id === id && a.gambar) || !fs.existsSync(lokasi)) return kirim(res, 404, { pesan: 'Screenshot tidak ditemukan.' });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store');
        res.end(fs.readFileSync(lokasi));
        return;
      }
      if (url.pathname !== '/') return kirim(res, 404, { pesan: 'Endpoint tidak ditemukan.' });
      if (req.method === 'GET') return kirim(res, 200, { anotasi: baca() });
      if (req.method === 'POST') {
        const contentType = req.headers['content-type'] ?? '';
        const multipart = contentType.startsWith('multipart/form-data;');
        const badan = await bacaBadan(req, multipart ? BATAS_GAMBAR + BATAS_JSON + 4096 : BATAS_JSON);
        let json = badan.toString('utf8');
        let png: Buffer | undefined;
        if (multipart) {
          const form = await new Response(new Uint8Array(badan), { headers: { 'Content-Type': contentType } }).formData();
          const data = form.get('anotasi');
          const gambar = form.get('gambar');
          if (typeof data !== 'string' || Buffer.byteLength(data) > BATAS_JSON || !gambar || typeof gambar === 'string' || gambar.type !== 'image/png') throw new Error('Lampiran anotasi tidak valid.');
          json = data;
          png = Buffer.from(await gambar.arrayBuffer());
        }
        const baru = normalisasiAnotasi(JSON.parse(json));
        if (!!baru.gambar !== !!png) throw new Error('Metadata dan lampiran screenshot harus lengkap.');
        if (png) validasiPng(png, baru);
        const daftar = baca();
        const lama = daftar.find((a) => a.id === baru.id);
        if (lama) {
          // Retry sesudah respons terputus tidak menggandakan anotasi.
          if (JSON.stringify(lama) !== JSON.stringify(baru)
            || (png && !fs.readFileSync(lokasiGambar(baru.id)).equals(png))) return kirim(res, 409, { pesan: 'ID anotasi sudah digunakan.' });
          return kirim(res, 200, lama);
        }
        const lokasi = png ? lokasiGambar(baru.id) : null;
        try {
          if (lokasi && png) {
            fs.mkdirSync(folderGambar, { recursive: true });
            fs.writeFileSync(lokasi, png, { flag: 'wx' });
          }
          tulis([...daftar, baru]);
        } catch (error) {
          // Jangan menghapus file milik operasi lama bila write wx ditolak.
          if (lokasi && (error as NodeJS.ErrnoException).code !== 'EEXIST') fs.rmSync(lokasi, { force: true });
          throw error;
        }
        return kirim(res, 201, baru);
      }
      if (req.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return kirim(res, 400, { pesan: 'Parameter id wajib.' });
        const daftar = baca();
        const anotasi = daftar.find((a) => a.id === id);
        if (!anotasi) return kirim(res, 404, { pesan: 'Anotasi tidak ditemukan.' });
        const lokasi = anotasi.gambar ? lokasiGambar(id) : null;
        const dipindah = !!lokasi && fs.existsSync(lokasi);
        if (dipindah) fs.renameSync(lokasi!, `${lokasi}.hapus`);
        try { tulis(daftar.filter((a) => a.id !== id)); }
        catch (error) {
          if (dipindah) fs.renameSync(`${lokasi}.hapus`, lokasi!);
          throw error;
        }
        if (dipindah) fs.rmSync(`${lokasi}.hapus`, { force: true });
        return kirim(res, 204);
      }
      kirim(res, 405, { pesan: 'Metode tidak didukung.' });
    } catch (error) {
      kirim(res, 400, { pesan: error instanceof Error ? error.message : 'Permintaan anotasi gagal.' });
    }
  };
}
