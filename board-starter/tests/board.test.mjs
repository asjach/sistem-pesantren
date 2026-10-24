import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createStore, statusTurunan } from '../store.mjs';
import { makeServer } from '../server.mjs';

const actor = 'pengguna';
function setup(t) {
  const store = createStore(':memory:'); t.after(() => store.close());
  const change = (op, id, body, who = actor, revision) => store.mutate(op, id, body, who, revision);
  change('workflow', null, { aktif: true }); change('workflow', null, { aktif: true, aplikasi_id: 1 });
  const add = (title = 'Hasil yang bisa diperiksa') => change('create_poin', null, { submodul_id: 3, deskripsi: title }).hasil.id;
  const point = id => store.snapshot().aplikasi[0].modul[0].sub[0].butir.find(p => p.id === id);
  const note = (id, jenis, teks = 'Bukti dari pengguna atau hasil pemeriksaan') => change('note_poin', id, { jenis, teks });
  const prepare = id => { change('update_poin', id, { status: 'todo', subpoin: [{ teks: 'Hasil dapat digunakan', selesai: false }] }); note(id, 'persetujuan'); };
  return { store, change, add, point, note, prepare };
}
test('Database baru Draf, kosong, idempotent dan bertahan setelah dibuka ulang', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'board-storage-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'data', 'board.sqlite'); let store = createStore(path);
  assert.equal(store.snapshot().workflow_master_aktif, false);
  assert.equal(store.snapshot().aplikasi[0].workflow_efektif, false);
  store.mutate('create_poin', null, { submodul_id: 3, deskripsi: 'Tersimpan' }, actor);
  store.close(); store = createStore(path);
  assert.equal(store.snapshot().aplikasi.length, 1);
  assert.equal(store.snapshot().aplikasi[0].modul[0].sub[0].butir[0].deskripsi, 'Tersimpan'); store.close();
});
test('Workflow efektif memerlukan master dan flag area; agen tidak menulis saat Draf', t => {
  const { store, change, add } = setup(t);
  change('workflow', null, { aktif: false }); assert.equal(store.snapshot().aplikasi[0].workflow_efektif, false);
  assert.throws(() => change('create_poin', null, { submodul_id: 3, deskripsi: 'Tidak boleh' }, 'agent'), /Draf/);
  assert.throws(() => change('workflow', null, { aktif: true }, 'agent'), /pengguna/);
  assert.ok(add());
});
test('Pemilihan, Done, penjadwalan ulang dan hapus tidak bisa melalui akses agen', t => {
  const { change, add, prepare, note } = setup(t); const id = add();
  assert.throws(() => change('update_poin', id, { status: 'todo' }, 'agent'), /pengguna/);
  prepare(id); change('update_poin', id, { status: 'in_progress' }, 'agent');
  assert.throws(() => change('update_poin', id, { status: 'backlog' }, 'agent'), /pengguna/);
  change('update_poin', id, { subpoin: [{ teks: 'Hasil dapat digunakan', selesai: true }] }); note(id, 'verifikasi');
  change('update_poin', id, { status: 'for_review' }, 'agent');
  assert.throws(() => change('update_poin', id, { status: 'done' }, 'agent'), /pengguna/);
  assert.throws(() => change('delete_poin', id, {}, 'agent'), /pengguna/);
});
test('Acceptance criteria, persetujuan dan pengosongan requirement menjadi gerbang mulai', t => {
  const { change, add, prepare, note, point } = setup(t); const id = add();
  change('update_poin', id, { status: 'todo' });
  assert.throws(() => change('update_poin', id, { status: 'in_progress' }), /persetujuan/);
  prepare(id); change('update_poin', id, { keterangan: 'Requirement belum diturunkan' });
  assert.throws(() => change('update_poin', id, { status: 'in_progress' }), /requirement/);
  assert.equal(point(id).status, 'todo');
  change('update_poin', id, { keterangan: '', subpoin: [{ teks: 'Scope berubah', selesai: false }] });
  assert.throws(() => change('update_poin', id, { status: 'in_progress' }), /persetujuan/);
  note(id, 'persetujuan'); change('update_poin', id, { status: 'in_progress' });
  assert.equal(point(id).status, 'in_progress');
});
test('Hanya satu In Progress per area; area lain dapat bekerja independen', t => {
  const { change, add, prepare, store } = setup(t); const first = add(), second = add('Kedua'); prepare(first); prepare(second);
  change('update_poin', first, { status: 'in_progress' });
  assert.throws(() => change('update_poin', second, { status: 'in_progress' }), /satu poin/);
  const app = change('create_aplikasi', null, { nama: 'Area lain' }).hasil.id;
  const mod = change('create_modul', null, { aplikasi_id: app, nama: 'Modul' }).hasil.id;
  const sub = change('create_submodul', null, { modul_id: mod, nama: 'Submodul' }).hasil.id;
  const third = change('create_poin', null, { submodul_id: sub, deskripsi: 'Ketiga' }).hasil.id;
  prepare(third); change('update_poin', third, { status: 'in_progress' });
  assert.equal(store.snapshot().aplikasi[1].modul[0].sub[0].butir[0].status, 'in_progress');
});
test('Review membutuhkan checklist dan verifikasi baru; Done manual dan reopen beralasan', t => {
  const { change, add, prepare, note, point, store } = setup(t); const id = add(); prepare(id);
  change('update_poin', id, { status: 'in_progress' });
  assert.throws(() => change('update_poin', id, { status: 'for_review' }), /subpoin/);
  change('update_poin', id, { subpoin: [{ teks: 'Hasil dapat digunakan', selesai: true }] });
  assert.equal(point(id).status, 'in_progress');
  assert.throws(() => change('update_poin', id, { status: 'for_review' }), /verifikasi/);
  note(id, 'verifikasi'); change('update_poin', id, { status: 'for_review' });
  assert.throws(() => change('update_poin', id, { status: 'in_progress' }), /revisi/);
  note(id, 'revisi'); change('update_poin', id, { status: 'in_progress' });
  assert.throws(() => change('update_poin', id, { status: 'for_review' }), /verifikasi/);
  note(id, 'verifikasi'); change('update_poin', id, { status: 'for_review' }); change('update_poin', id, { status: 'done' });
  note(id, 'keputusan'); assert.throws(() => change('update_poin', id, { status: 'in_progress' }), /Alasan/);
  change('update_poin', id, { status: 'in_progress', catatan: 'Pengguna meminta reopen' });
  assert.equal(store.history(id)[0].catatan, 'Pengguna meminta reopen');
});
test('Revision usang dan input gagal tidak menyebabkan write atau riwayat parsial', t => {
  const { change, add, point, store } = setup(t); const id = add(); const before = store.snapshot();
  assert.throws(() => change('update_poin', id, { deskripsi: 'Hilang' }, actor, 0), /sesi lain/);
  assert.throws(() => change('update_poin', id, { deskripsi: 'Parsial', status: 'done' }), /subpoin/);
  assert.deepEqual(store.snapshot(), before); assert.notEqual(point(id).deskripsi, 'Parsial');
  assert.equal(store.history(id).length, 1);
});
test('Scope terkunci setelah mulai; teks tidak dapat diganti diam-diam di In Progress atau Done', t => {
  const { change, add, point, prepare, note } = setup(t); const id = add(); prepare(id);
  change('update_poin', id, { status: 'in_progress' });
  assert.throws(() => change('update_poin', id, { deskripsi: 'Scope baru' }, 'agent'), /dikunci/);
  assert.throws(() => change('update_poin', id, { subpoin: [{ teks: 'Scope baru', selesai: true }] }), /dikunci/);
  change('update_poin', id, { subpoin: [{ teks: 'Hasil dapat digunakan', selesai: true }] });
  note(id, 'verifikasi'); change('update_poin', id, { status: 'for_review' }); change('update_poin', id, { status: 'done' });
  assert.throws(() => change('update_poin', id, { deskripsi: 'Scope baru' }), /dikunci/);
  assert.equal(point(id).status, 'done');
});
test('Urutan menggeser poin yang terlihat pada column yang sama', t => {
  const { change, add, store } = setup(t); const a = add('A'), b = add('B'), c = add('C');
  change('update_poin', b, { status: 'todo' }); change('order_poin', a, { arah: 1 });
  const points = store.snapshot().aplikasi[0].modul[0].sub[0].butir;
  assert.deepEqual(points.filter(p => p.status === 'backlog').map(p => p.id), [c, a]);
});
test('Urutan stabil, update parsial dan status turunan mengikuti flow asal', t => {
  const { change, add, point, store } = setup(t); const first = add(), second = add('Kedua');
  change('update_poin', first, { keterangan: 'Tetap ada' }); change('update_poin', first, { deskripsi: 'Judul baru' });
  assert.equal(point(first).keterangan, 'Tetap ada');
  change('order_poin', second, { arah: -1 }); assert.equal(store.snapshot().aplikasi[0].modul[0].sub[0].butir[0].id, second);
  assert.throws(() => change('order_poin', second, { arah: -1 }), /ujung/);
  assert.equal(statusTurunan([]), 'backlog');
  assert.equal(statusTurunan([{ status: 'done' }, { status: 'for_review' }]), 'for_review');
  assert.equal(statusTurunan([{ status: 'for_review' }, { status: 'todo' }]), 'todo');
});
test('HTTP lokal menolak akses tanpa token, origin asing, host asing, body invalid dan file traversal', async t => {
  const { server, agentToken } = makeServer({ data: ':memory:' }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, headers = {}) => fetch(base + path, { headers });
  assert.equal((await get('/')).status, 200); assert.equal((await get('/api/board')).status, 401);
  assert.equal((await get('/api/session', { Origin: 'https://example.org' })).status, 403);
  const badHost = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/api/session', { headers: { Host: 'attacker.test' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(badHost, 403);
  assert.equal((await get('/.local/access.json')).status, 401);
  const session = await (await get('/api/session')).json();
  const user = { 'X-Board-Token': session.token, 'Content-Type': 'application/json' };
  assert.equal((await get('/api/board', user)).status, 200);
  const invalid = await fetch(base + '/api/workflow', { method: 'PATCH', headers: user, body: '{' }); assert.equal(invalid.status, 400);
  const agent = { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json', 'If-Match': '0' };
  const denied = await fetch(base + '/api/workflow', { method: 'PATCH', headers: agent, body: '{"aktif":true}' }); assert.equal(denied.status, 403);
  assert.equal((await get('/api/board', agent)).status, 200);
  const missingRevision = await fetch(base + '/api/workflow', { method: 'PATCH', headers: user, body: '{"aktif":true}' }); assert.equal(missingRevision.status, 428);
  const payload = Buffer.from(JSON.stringify({ submodul_id: 3, deskripsi: 'Riset 日本語 🔒' }));
  const split = payload.indexOf(Buffer.from('日')) + 1;
  const unicode = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/api/poin', { method: 'POST', headers: { ...user, 'If-Match': '0' } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks))));
    });
    req.on('error', reject); req.write(payload.subarray(0, split)); setTimeout(() => req.end(payload.subarray(split)), 5);
  });
  assert.equal(unicode.hasil.deskripsi, 'Riset 日本語 🔒');
});
test('CLI bekerja dari direktori lain dan menerima file JSON tanpa npm dependency', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'board-portable-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const { server, agentToken, store } = makeServer({ data: ':memory:' }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  await cp(join(root, 'cli.mjs'), join(directory, 'cli.mjs')); await mkdir(join(directory, '.local'));
  await writeFile(join(directory, '.local', 'access.json'), JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, token: agentToken }));
  const run = promisify(execFile);
  const read = await run(process.execPath, [join(directory, 'cli.mjs'), 'baca'], { cwd: tmpdir() });
  assert.equal(JSON.parse(read.stdout).workflow_master_aktif, false);
  store.mutate('workflow', null, { aktif: true }, actor); store.mutate('workflow', null, { aplikasi_id: 1, aktif: true }, actor);
  const input = join(directory, 'perubahan.json'); await writeFile(input, JSON.stringify({ submodul_id: 3, deskripsi: 'Portable' }));
  const added = await run(process.execPath, [join(directory, 'cli.mjs'), 'tambah', '--file', input], { cwd: tmpdir() });
  assert.equal(JSON.parse(added.stdout).hasil.hasil.deskripsi, 'Portable');
  assert.ok(await readFile(join(directory, 'cli.mjs'), 'utf8'));
});
