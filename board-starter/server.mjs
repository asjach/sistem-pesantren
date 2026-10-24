import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStore, BoardError, STATUS } from './store.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const token = () => randomBytes(32).toString('hex');
const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
export function makeServer({ data = join(ROOT, 'data', 'board.sqlite') } = {}) {
  const store = createStore(data), uiToken = token(), agentToken = token();
  const assets = { '/': ['index.html', 'text/html'], '/board': ['index.html', 'text/html'],
    '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
        || req.headers['sec-fetch-site'] === 'cross-site') throw new BoardError('Akses hanya dari Board lokal.', 403);
      const url = new URL(req.url, origin), path = url.pathname;
      if (req.method === 'GET' && assets[path]) {
        const [file, type] = assets[path]; res.setHeader('Content-Type', `${type}; charset=utf-8`);
        return res.end(await readFile(join(ROOT, 'public', file)));
      }
      if (req.method === 'GET' && path === '/api/session') return json(res, 200, { token: uiToken });
      const isUser = equal(req.headers['x-board-token'], uiToken);
      const isAgent = equal(req.headers.authorization, `Bearer ${agentToken}`);
      if (!isUser && !isAgent) throw new BoardError('Token sesi diperlukan. Buka ulang Board atau jalankan CLI lokal.', 401);
      const actor = isUser ? 'pengguna' : 'agent';
      if (req.method === 'GET' && path === '/api/board') return json(res, 200, { ...store.snapshot(), status: STATUS });
      if (req.method === 'GET' && path === '/api/riwayat') {
        const id = url.searchParams.get('poin_id');
        if (id && !/^\d+$/.test(id)) throw new BoardError('ID tidak valid.');
        return json(res, 200, { riwayat: store.history(id ? Number(id) : null) });
      }
      const routes = [
        ['PATCH', /^\/api\/workflow$/, 'workflow'],
        ['POST', /^\/api\/aplikasi$/, 'create_aplikasi'], ['PATCH', /^\/api\/aplikasi\/(\d+)$/, 'update_aplikasi'],
        ['POST', /^\/api\/modul$/, 'create_modul'], ['PATCH', /^\/api\/modul\/(\d+)$/, 'update_modul'],
        ['POST', /^\/api\/submodul$/, 'create_submodul'], ['PATCH', /^\/api\/submodul\/(\d+)$/, 'update_submodul'],
        ['POST', /^\/api\/poin$/, 'create_poin'], ['PATCH', /^\/api\/poin\/(\d+)$/, 'update_poin'],
        ['POST', /^\/api\/poin\/(\d+)\/catatan$/, 'note_poin'], ['POST', /^\/api\/poin\/(\d+)\/urutan$/, 'order_poin'],
        ['DELETE', /^\/api\/poin\/(\d+)$/, 'delete_poin']
      ];
      const route = routes.find(([method, pattern]) => req.method === method && pattern.test(path));
      if (!route) throw new BoardError('Alamat tidak ditemukan.', 404);
      if (!req.headers['content-type']?.startsWith('application/json')) throw new BoardError('Gunakan Content-Type application/json.', 415);
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 128 * 1024) throw new BoardError('Request terlalu besar.', 413); chunks.push(chunk); }
      const raw = Buffer.concat(chunks).toString('utf8');
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { throw new BoardError('JSON tidak valid.', 400); }
      const revisionHeader = req.headers['if-match'];
      if (revisionHeader === undefined) throw new BoardError('Header If-Match wajib diisi dengan revision Board terbaru.', 428);
      if (revisionHeader !== undefined && !/^\d+$/.test(revisionHeader)) throw new BoardError('Revision tidak valid.');
      const revision = revisionHeader === undefined ? undefined : Number(revisionHeader);
      const result = store.mutate(route[2], Number(path.match(route[1])[1]), body, actor, revision);
      json(res, 200, result);
    } catch (error) {
      if (!(error instanceof BoardError)) console.error(error);
      json(res, error.status || 500, { message: error instanceof BoardError ? error.message : 'Terjadi kesalahan penyimpanan Board.' });
    }
  });
  server.on('close', () => store.close());
  return { server, agentToken, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
  const port = Number(option('--port', '4310'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port harus angka 1–65535.');
  const { server, agentToken } = makeServer({ data: resolve(ROOT, option('--data', join(ROOT, 'data', 'board.sqlite'))) });
  server.on('error', error => { console.error(`Board gagal berjalan: ${error.message}`); process.exitCode = 1; server.close(); });
  server.listen(port, '127.0.0.1', async () => {
    try {
      await mkdir(join(ROOT, '.local'), { recursive: true, mode: 0o700 });
      await writeFile(join(ROOT, '.local', 'access.json'), JSON.stringify({ url: `http://127.0.0.1:${port}`, token: agentToken }), { mode: 0o600 });
      console.log(`Board: http://127.0.0.1:${port}\nHentikan dengan Ctrl+C. Data tersimpan di SQLite.`);
    } catch (error) { console.error(error.message); server.close(); process.exitCode = 1; }
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
