import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
try {
  const args = process.argv.slice(2);
  const [command = 'baca', idOrJSON, input] = args;
  const parseInput = async value => {
    const index = args.indexOf('--file');
    if (index >= 0) return JSON.parse(await readFile(args[index + 1], 'utf8'));
    return JSON.parse(value?.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value);
  };
  const access = JSON.parse(await readFile(join(root, '.local', 'access.json'), 'utf8'));
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(access.url)) throw new Error('Alamat koneksi lokal tidak valid.');
  const headers = { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' };
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${access.url}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Request gagal.');
    return result;
  };
  let path = '/api/board', method = 'GET', body;
  if (command === 'riwayat') path = '/api/riwayat' + (idOrJSON ? `?poin_id=${Number(idOrJSON)}` : '');
  else if (command === 'tambah') { path = '/api/poin'; method = 'POST'; body = await parseInput(idOrJSON); }
  else if (['ubah', 'catat', 'urut'].includes(command)) {
    if (!/^\d+$/.test(idOrJSON || '')) throw new Error('ID poin harus angka.');
    path = `/api/poin/${idOrJSON}` + (command === 'catat' ? '/catatan' : command === 'urut' ? '/urutan' : '');
    method = command === 'ubah' ? 'PATCH' : 'POST';
    body = await parseInput(input);
  } else if (command !== 'baca') throw new Error('Command: baca | tambah JSON | ubah ID JSON | catat ID JSON | urut ID JSON | riwayat [ID]. Gunakan --file berkas.json sebagai alternatif JSON inline.');
  if (method !== 'GET') headers['If-Match'] = String((await request('/api/board')).revision);
  const result = await request(path, method, body);
  if (method !== 'GET') console.log(JSON.stringify({ hasil: result, board: await request('/api/board') }, null, 2));
  else console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Gagal: ${error.message}\nPastikan node server.mjs sedang berjalan.`);
  process.exitCode = 1;
}
