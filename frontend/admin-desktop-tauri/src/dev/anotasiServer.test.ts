import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { File as NodeFile } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buatHandlerAnotasi } from './anotasiServer';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const catatan = { id: 'a_1', dibuat: '2026-10-23T00:00:00Z', rute: '/', selector: '#asal', tag: 'button', teks: '', komponen: [], sumber: null, instruksi: 'Pindahkan' };
const gambar = { berkas: 'screenshots/a_1.png', lebar: 1, tinggi: 1, dibuat: catatan.dibuat, preview_aktif: false };
let folder: string;
beforeEach(() => {
  // Response.formData milik Node harus memakai File Node, bukan implementasi jsdom.
  vi.stubGlobal('File', NodeFile);
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'simpes-anotasi-test-'));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); fs.rmSync(folder, { recursive: true, force: true }); });

async function minta(method: string, body: string | Buffer = '', url = '/', contentType = 'application/json', origin?: string) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), { method, url, headers: { 'content-type': contentType, host: '127.0.0.1:1420', ...(origin ? { origin } : {}) } }) as IncomingMessage;
  const headers: Record<string, string> = {};
  let hasil = Buffer.alloc(0);
  const res = { statusCode: 200, setHeader: (k: string, v: string) => { headers[k] = v; }, end: (data?: string | Buffer) => { hasil = Buffer.from(data ?? ''); } };
  await buatHandlerAnotasi(folder)(req, res as unknown as ServerResponse);
  return { status: res.statusCode, headers, body: hasil, json: () => JSON.parse(hasil.toString()) };
}
function multipart(data: unknown, file = png) {
  return Buffer.concat([
    Buffer.from(`--simpes\r\nContent-Disposition: form-data; name="anotasi"\r\n\r\n${JSON.stringify(data)}\r\n--simpes\r\nContent-Disposition: form-data; name="gambar"; filename="gambar.png"\r\nContent-Type: image/png\r\n\r\n`),
    file, Buffer.from('\r\n--simpes--\r\n'),
  ]);
}
const upload = (data: unknown = { ...catatan, gambar }, file = png) => minta('POST', multipart(data, file), '/', 'multipart/form-data; boundary=simpes');

describe('penyimpanan anotasi dan screenshot dev', () => {
  it('menyimpan referensi dan diff yang dihitung server bersama screenshot tanpa menjadikannya tujuan', async () => {
    const referensi = { ...catatan, selector: '#acuan', style: { color: 'blue' } };
    const respons = await upload({ ...catatan, style: { color: 'red' }, referensi, perbedaan_style: [], gambar });
    expect(respons.status).toBe(201);
    const tersimpan = (await minta('GET')).json().anotasi[0];
    expect(tersimpan.referensi).toMatchObject({ selector: '#acuan', style: { color: 'blue' } });
    expect(tersimpan.perbedaan_style).toEqual([{ properti: 'color', asal: 'red', referensi: 'blue' }]);
    expect(tersimpan).not.toHaveProperty('tujuan');
    expect(fs.readFileSync(path.join(folder, gambar.berkas))).toEqual(png);
  });
  it('tetap mendukung JSON lama tanpa screenshot', async () => {
    expect((await minta('POST', JSON.stringify(catatan))).status).toBe(201);
    expect((await minta('GET')).json().anotasi).toEqual([catatan]);
    expect((await minta('DELETE', '', '/?id=a_1')).status).toBe(204);
    expect((await minta('GET')).json().anotasi).toEqual([]);
  });
  it('menyimpan PNG lokal, melayani hanya gambar terkait, dan menghapus bersama anotasi', async () => {
    const hasil = await upload();
    expect({ status: hasil.status, data: hasil.json() }).toMatchObject({ status: 201, data: { id: 'a_1' } });
    const file = path.join(folder, 'screenshots/a_1.png');
    expect(fs.readFileSync(file)).toEqual(png);
    expect((await minta('GET')).json().anotasi[0].gambar).toEqual(gambar);
    const respons = await minta('GET', '', '/gambar?id=a_1');
    expect(respons.headers['Content-Type']).toBe('image/png');
    expect(respons.body).toEqual(png);
    expect((await minta('DELETE', '', '/?id=a_1')).status).toBe(204);
    expect(fs.existsSync(file)).toBe(false);
    expect((await minta('GET', '', '/gambar?id=a_1')).status).toBe(404);
  });
  it('retry identik tidak menduplikasi anotasi dan ID yang berbeda isinya ditolak', async () => {
    await upload();
    expect((await upload()).status).toBe(200);
    expect((await upload({ ...catatan, instruksi: 'Ubah', gambar })).status).toBe(409);
    expect((await minta('GET')).json().anotasi).toHaveLength(1);
  });
  it.each([
    [{ ...catatan, gambar: { ...gambar, berkas: '../rahasia.png' } }, png],
    [{ ...catatan, id: '../a', gambar }, png],
    [{ ...catatan, gambar: { ...gambar, lebar: 9 } }, png],
    [{ ...catatan, gambar }, Buffer.from('bukan png')],
    [catatan, png],
  ])('menolak lampiran tidak valid tanpa menulis anotasi: %j', async (data, file) => {
    expect((await upload(data, file)).status).toBe(400);
    expect(fs.existsSync(path.join(folder, 'anotasi.json'))).toBe(false);
    expect(fs.existsSync(path.join(folder, 'screenshots'))).toBe(false);
  });
  it('menolak metadata tanpa lampiran serta payload melebihi batas', async () => {
    expect((await minta('POST', JSON.stringify({ ...catatan, gambar }))).status).toBe(400);
    expect((await minta('POST', 'x'.repeat(64_001))).status).toBe(400);
    expect((await upload({ ...catatan, gambar }, Buffer.alloc(8 * 1024 * 1024 + 1))).status).toBe(400);
  });
  it('menolak path traversal, endpoint asing, dan POST lintas origin', async () => {
    expect((await minta('GET', '', '/gambar?id=..%2F..%2Frahasia')).status).toBe(400);
    expect((await minta('POST', JSON.stringify(catatan), '/asing')).status).toBe(404);
    expect((await minta('POST', multipart({ ...catatan, gambar }), '/', 'multipart/form-data; boundary=simpes', 'https://asing.example')).status).toBe(403);
  });
  it('menghapus PNG baru bila penulisan JSON gagal, tanpa kehilangan anotasi lama', async () => {
    await minta('POST', JSON.stringify({ ...catatan, id: 'lama' }));
    const asli = fs.writeFileSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((file, ...args) => {
      if (String(file).endsWith('anotasi.json.tmp')) throw new Error('Disk penuh');
      return asli(file, ...args);
    });
    expect((await upload()).status).toBe(400);
    expect(fs.existsSync(path.join(folder, gambar.berkas))).toBe(false);
    expect((await minta('GET')).json().anotasi[0].id).toBe('lama');
  });
  it('memulihkan PNG jika penghapusan JSON gagal', async () => {
    await upload();
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('Disk penuh'); });
    expect((await minta('DELETE', '', '/?id=a_1')).status).toBe(400);
    expect(fs.readFileSync(path.join(folder, gambar.berkas))).toEqual(png);
    expect((await minta('GET')).json().anotasi).toHaveLength(1);
  });
  it('tidak menimpa data rusak atau PNG yang tidak dimiliki operasi baru', async () => {
    fs.writeFileSync(path.join(folder, 'anotasi.json'), 'rusak');
    expect((await upload()).status).toBe(400);
    expect(fs.readFileSync(path.join(folder, 'anotasi.json'), 'utf8')).toBe('rusak');
    fs.unlinkSync(path.join(folder, 'anotasi.json'));
    fs.mkdirSync(path.join(folder, 'screenshots'));
    fs.writeFileSync(path.join(folder, gambar.berkas), png);
    expect((await upload()).status).toBe(400);
    expect(fs.readFileSync(path.join(folder, gambar.berkas))).toEqual(png);
  });
});
