import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const STATUS = ['backlog', 'todo', 'in_progress', 'for_review', 'done'];
export class BoardError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new BoardError(message, status); };
const text = (value, max = 2000, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(`Teks ${required ? 'wajib diisi dan ' : ''}maksimal ${max} karakter.`);
  }
  return value.trim();
};
const checks = value => {
  if (!Array.isArray(value) || value.length > 30) fail('Maksimal 30 subpoin.');
  return value.map(s => {
    if (!s || typeof s.selesai !== 'boolean') fail('Status subpoin harus boolean.');
    return { teks: text(s.teks, 500, true), selesai: s.selesai };
  });
};
export function statusTurunan(points) {
  if (!points.length) return 'backlog';
  return ['in_progress', 'todo', 'backlog', 'for_review'].find(s => points.some(p => p.status === s)) || 'done';
}
export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`CREATE TABLE IF NOT EXISTS board_state (id INTEGER PRIMARY KEY CHECK(id=1), document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS board_history (id INTEGER PRIMARY KEY, poin_id INTEGER, dari TEXT, ke TEXT, oleh TEXT NOT NULL, catatan TEXT NOT NULL, waktu TEXT NOT NULL);`);
  const initial = { schema_version: 1, revision: 0, seq: 3, workflow_master_aktif: false,
    aplikasi: [{ id: 1, nama: 'Project baru', workflow_aktif: false, modul: [
      { id: 2, nama: 'Umum', sub: [{ id: 3, nama: 'Kebutuhan awal', butir: [] }] }
    ] }] };
  db.prepare('INSERT OR IGNORE INTO board_state VALUES (1, ?)').run(JSON.stringify(initial));
  const read = () => JSON.parse(db.prepare('SELECT document FROM board_state WHERE id=1').get().document);
  const snapshot = () => {
    const state = read();
    for (const app of state.aplikasi) {
      app.workflow_efektif = state.workflow_master_aktif && app.workflow_aktif;
      for (const mod of app.modul) for (const sub of mod.sub) sub.status = statusTurunan(sub.butir);
    }
    return state;
  };
  function locate(state, type, id) {
    for (const app of state.aplikasi) {
      if (type === 'aplikasi' && app.id === id) return { app, target: app };
      for (const mod of app.modul) {
        if (type === 'modul' && mod.id === id) return { app, mod, target: mod };
        for (const sub of mod.sub) {
          if (type === 'submodul' && sub.id === id) return { app, mod, sub, target: sub };
          const point = sub.butir.find(p => p.id === id);
          if (type === 'poin' && point) return { app, mod, sub, target: point };
        }
      }
    }
    fail('Data tidak ditemukan.', 404);
  }
  const history = (id = null) => db.prepare(`SELECT * FROM board_history ${id ? 'WHERE poin_id = ?' : ''} ORDER BY id DESC LIMIT 200`).all(...(id ? [id] : []));
  function mutate(operation, id, body, actor, revision) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Body harus berupa object JSON.');
    db.exec('BEGIN IMMEDIATE');
    try {
      const state = read();
      if (revision !== undefined && revision !== state.revision) fail('Board berubah di sesi lain. Muat ulang sebelum menyimpan.', 409);
      let result;
      const stamp = () => new Date().toISOString();
      const scope = point => JSON.stringify([point.deskripsi, point.subpoin.map(s => s.teks)]);
      const event = (point, from, to, note) => db.prepare('INSERT INTO board_history (poin_id,dari,ke,oleh,catatan,waktu) VALUES (?,?,?,?,?,?)')
        .run(point, from, to, actor, note, stamp());
      const active = app => {
        if (actor === 'agent' && !(state.workflow_master_aktif && app.workflow_aktif)) fail('Workflow area kerja masih Draf.', 409);
      };
      if (operation === 'workflow') {
        if (actor !== 'pengguna') fail('Pengaturan workflow hanya boleh diubah pengguna.', 403);
        if (typeof body.aktif !== 'boolean') fail('Nilai aktif harus boolean.');
        if (body.aplikasi_id !== undefined) locate(state, 'aplikasi', body.aplikasi_id).target.workflow_aktif = body.aktif;
        else state.workflow_master_aktif = body.aktif;
        event(null, null, null, `Workflow ${body.aplikasi_id ? 'area #' + body.aplikasi_id : 'master'}: ${body.aktif ? 'Aktif' : 'Draf'}`);
      } else if (operation.startsWith('create_')) {
        const type = operation.slice(7);
        if (type === 'aplikasi') {
          if (actor === 'agent') fail('Buat area kerja melalui pengguna.', 403);
          result = { id: ++state.seq, nama: text(body.nama, 120, true), workflow_aktif: false, modul: [] };
          state.aplikasi.push(result);
        } else if (type === 'modul') {
          const { app } = locate(state, 'aplikasi', body.aplikasi_id); active(app);
          result = { id: ++state.seq, nama: text(body.nama, 120, true), sub: [] }; app.modul.push(result);
        } else if (type === 'submodul') {
          const { app, mod } = locate(state, 'modul', body.modul_id); active(app);
          result = { id: ++state.seq, nama: text(body.nama, 120, true), butir: [] }; mod.sub.push(result);
        } else if (type === 'poin') {
          const { app, sub } = locate(state, 'submodul', body.submodul_id); active(app);
          if (body.status !== undefined && body.status !== 'backlog') fail('Poin baru harus masuk Backlog.');
          result = { id: ++state.seq, deskripsi: text(body.deskripsi, 500, true), keterangan: text(body.keterangan ?? ''),
            status: 'backlog', subpoin: checks(body.subpoin ?? []), catatan: [] };
          sub.butir.push(result); event(result.id, null, 'backlog', 'Poin dibuat.');
        } else fail('Operasi tidak ditemukan.', 404);
      } else {
        const [action, type] = operation.split('_');
        const { app, sub, target } = locate(state, type, id); active(app);
        result = target;
        if (action === 'note') {
          if (!['persetujuan', 'revisi', 'verifikasi', 'keputusan', 'catatan'].includes(body.jenis)) fail('Jenis catatan tidak valid.');
          target.catatan.push({ jenis: body.jenis, teks: text(body.teks, 4000, true), oleh: actor,
            waktu: stamp(), scope: scope(target), digunakan: false });
        } else if (action === 'delete') {
          if (actor !== 'pengguna') fail('Penghapusan dilakukan pengguna melalui Board.', 403);
          sub.butir = sub.butir.filter(p => p.id !== id); event(id, target.status, null, `Dihapus: ${target.deskripsi}`);
        } else if (action === 'order') {
          if (![-1, 1].includes(body.arah)) fail('Arah harus -1 atau 1.');
          const peers = sub.butir.filter(p => p.status === target.status);
          const peerIndex = peers.indexOf(target), neighbor = peers[peerIndex + body.arah];
          if (!neighbor) fail('Poin sudah berada di ujung urutan.', 409);
          const index = sub.butir.indexOf(target), next = sub.butir.indexOf(neighbor);
          [sub.butir[index], sub.butir[next]] = [sub.butir[next], sub.butir[index]];
        } else if (action === 'update' && type !== 'poin') {
          target.nama = text(body.nama, 120, true);
        } else if (action === 'update') {
          const allowed = ['deskripsi', 'keterangan', 'subpoin', 'status', 'catatan'];
          if (!Object.keys(body).length || Object.keys(body).some(k => !allowed.includes(k))) fail('Field perubahan poin tidak valid.');
          const previousScope = scope(target), previousRequirement = target.keterangan;
          if (body.deskripsi !== undefined) target.deskripsi = text(body.deskripsi, 500, true);
          if (body.keterangan !== undefined) target.keterangan = text(body.keterangan);
          if (body.subpoin !== undefined) target.subpoin = checks(body.subpoin);
          if (['in_progress', 'for_review', 'done'].includes(target.status)
            && (scope(target) !== previousScope || target.keterangan !== previousRequirement)) {
            fail('Scope yang sudah dimulai dikunci. Pengguna perlu mengembalikan ke Backlog untuk perencanaan ulang; kebutuhan baru dibuat sebagai poin baru.');
          }
          const next = body.status ?? target.status;
          if (!STATUS.includes(next)) fail('Status tidak valid.');
          if (next === 'for_review' || next === 'done') {
            if (!target.subpoin.length || target.subpoin.some(s => !s.selesai)) fail('Selesaikan seluruh subpoin sebelum For Review atau Done.');
          }
          if (next !== target.status) {
            const from = target.status;
            const transitions = { backlog: ['todo'], todo: ['backlog', 'in_progress'], in_progress: ['backlog', 'for_review'], for_review: ['in_progress', 'done'], done: ['in_progress'] };
            if (!transitions[from].includes(next)) fail('Perpindahan status tidak mengikuti flow Board.');
            if (actor === 'agent' && ['todo', 'done', 'backlog'].includes(next)) fail('Pemilihan, penyelesaian, atau penjadwalan ulang hanya oleh pengguna.', 403);
            if (next === 'in_progress') {
              if (app.modul.some(m => m.sub.some(s => s.butir.some(p => p.id !== id && p.status === 'in_progress')))) fail('Sudah ada satu poin In Progress pada area ini.', 409);
              const kinds = from === 'todo' ? ['persetujuan'] : from === 'done' ? ['keputusan'] : ['revisi'];
              const evidence = target.catatan.find(n => kinds.includes(n.jenis) && !n.digunakan && n.scope === scope(target));
              if (!evidence) fail(`Catat ${kinds[0]} terbaru untuk scope ini terlebih dahulu.`);
              if (!target.subpoin.length) fail('Simpan acceptance criteria sebelum mulai.');
              if (from === 'todo' && target.keterangan) fail('Turunkan requirement ke subpoin, lalu kosongkan keterangan sebelum mulai.');
              evidence.digunakan = true;
              for (const note of target.catatan) if (note.jenis === 'verifikasi') note.digunakan = true;
            }
            if (next === 'for_review') {
              const verification = target.catatan.find(n => n.jenis === 'verifikasi' && !n.digunakan && n.scope === scope(target));
              if (!verification) fail('Catat hasil verifikasi terbaru untuk scope ini terlebih dahulu.');
              verification.digunakan = true;
            }
            const note = body.catatan === undefined ? '' : text(body.catatan, 2000);
            if (from === 'done' && !note) fail('Alasan reopen wajib diisi.');
            target.status = next; event(id, from, next, note);
          }
        } else fail('Operasi tidak ditemukan.', 404);
      }
      state.revision++;
      db.prepare('UPDATE board_state SET document=? WHERE id=1').run(JSON.stringify(state));
      db.exec('COMMIT');
      return { revision: state.revision, hasil: result ?? null };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { snapshot, mutate, history, close: () => db.close() };
}
