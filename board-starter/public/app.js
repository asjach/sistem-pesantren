'use strict';
const $ = id => document.getElementById(id);
const labels = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', for_review: 'For Review', done: 'Done' };
const transitions = { backlog: ['todo'], todo: ['backlog', 'in_progress'], in_progress: ['backlog', 'for_review'], for_review: ['in_progress', 'done'], done: ['in_progress'] };
const state = { board: null, token: '', area: new URL(location.href).searchParams.get('area'), module: '', sub: '', editing: null, editRevision: null, busy: false };
let nameAction;
const element = (tag, attrs = {}, text = '') => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.textContent = text; return node;
};
const message = (text, error = false) => { $('pesan').textContent = text; $('pesan').className = error ? 'error' : ''; };
const localTime = time => new Date(time).toLocaleString('id-ID');
async function api(path, method = 'GET', body, revision = state.board?.revision) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Board-Token': state.token,
    ...(method === 'GET' || revision === undefined ? {} : { 'If-Match': String(revision) }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request gagal.');
  return data;
}
const currentArea = () => state.board?.aplikasi.find(a => a.id === Number(state.area));
const allPoints = () => state.board.aplikasi.flatMap(a => a.modul.flatMap(m => m.sub.flatMap(s => s.butir.map(p => ({ ...p, area: a, module: m, sub: s })))));
function fillSelect(id, options, value, placeholder) {
  const select = $(id); select.replaceChildren();
  if (placeholder) select.append(element('option', { value: '' }, placeholder));
  for (const item of options) select.append(element('option', { value: item.id }, item.nama));
  select.value = String(value ?? '');
}
function render() {
  const areas = state.board.aplikasi;
  if (!currentArea()) state.area = areas[0]?.id;
  const area = currentArea();
  fillSelect('pilih_area', areas, state.area);
  if (!area.modul.some(m => m.id === Number(state.module))) state.module = '';
  fillSelect('pilih_modul', area.modul, state.module, 'Semua modul');
  const modules = area.modul.filter(m => !state.module || m.id === Number(state.module));
  const subs = modules.flatMap(m => m.sub);
  if (!subs.some(s => s.id === Number(state.sub))) state.sub = '';
  fillSelect('pilih_submodul', subs, state.sub, 'Semua submodul');
  $('nama_area').textContent = area.nama;
  $('workflow_master').checked = state.board.workflow_master_aktif;
  $('workflow_area').checked = area.workflow_aktif;
  $('workflow_badge').textContent = area.workflow_efektif ? 'Workflow aktif' : 'Draf';
  $('workflow_badge').className = 'badge' + (area.workflow_efektif ? ' active' : '');
  $('workflow_hint').textContent = area.workflow_efektif ? 'Board menjadi acuan kerja untuk area ini.' : 'Aktifkan kedua pengaturan untuk memakai workflow bersama agen.';
  $('tambah_submodul').disabled = !state.module;
  $('ubah_modul').disabled = !state.module;
  $('ubah_submodul').disabled = !state.sub;
  $('tambah_poin').disabled = !subs.length;
  const total = allPoints().filter(p => p.area.id === area.id);
  $('ringkasan').textContent = `${total.length} poin · ${total.filter(p => p.status === 'done').length} selesai · ${total.filter(p => p.status === 'for_review').length} menunggu review`;
  const search = $('cari_poin').value.trim().toLocaleLowerCase('id');
  const points = total.filter(p => (!state.module || p.module.id === Number(state.module)) && (!state.sub || p.sub.id === Number(state.sub))
    && `${p.deskripsi} ${p.keterangan}`.toLocaleLowerCase('id').includes(search));
  const board = $('papan'); board.replaceChildren();
  for (const [status, title] of Object.entries(labels)) {
    const column = element('section', { class: 'column', 'data-status': status, 'aria-label': title });
    const heading = element('header', { class: 'column_header' });
    const list = points.filter(p => p.status === status);
    heading.append(element('span', { class: 'status_dot', 'aria-hidden': 'true' }), element('h2', {}, title), element('span', { class: 'count' }, String(list.length)));
    const cards = element('div', { class: 'cards' });
    for (const p of list) {
      const card = element('article', { class: 'card' });
      const context = element('div', { class: 'card_meta' });
      context.append(element('span', { class: 'context_tag' }, p.module.nama), element('span', { class: 'context_tag secondary' }, p.sub.nama));
      card.append(context);
      const open = element('button', { class: 'card_open', type: 'button' }, p.deskripsi);
      open.onclick = () => openEditor(p.id).catch(error => message(error.message, true)); card.append(open);
      const completed = p.subpoin.filter(s => s.selesai).length;
      if (p.subpoin.length) {
        const progress = element('div', { class: 'card_progress' });
        progress.append(element('span', {}, `${completed}/${p.subpoin.length}`), element('progress', { max: p.subpoin.length, value: completed, 'aria-label': `${completed} dari ${p.subpoin.length} subpoin selesai` }));
        card.append(progress);
      }
      const footer = element('div', { class: 'card_footer' });
      footer.append(element('span', { class: 'point_id' }, `#${p.id}`));
      if (p.keterangan) footer.append(element('span', {}, 'Requirement'));
      const controls = element('div', { class: 'order_buttons' });
      for (const [direction, symbol, titleText] of [[-1, '↑', 'Naikkan urutan'], [1, '↓', 'Turunkan urutan']]) {
        const button = element('button', { 'aria-label': `${titleText}: ${p.deskripsi}`, title: titleText }, symbol);
        const peers = p.sub.butir.filter(b => b.status === p.status), index = peers.findIndex(b => b.id === p.id);
        button.disabled = direction < 0 ? index === 0 : index === peers.length - 1;
        button.onclick = () => write(`/api/poin/${p.id}/urutan`, 'POST', { arah: direction }); controls.append(button);
      }
      footer.append(controls); card.append(footer); cards.append(card);
    }
    if (!list.length) cards.append(element('p', { class: 'empty' }, status === 'backlog' && !total.length ? 'Mulai dari satu hasil yang ingin Anda capai. Gunakan Tambah poin.' : 'Belum ada poin.'));
    column.append(heading, cards); board.append(column);
  }
  $('sinkronisasi').textContent = `Lokal · Revisi ${state.board.revision}`;
}
async function load(force = false) {
  const data = await api('/api/board');
  if (!force && data.revision === state.board?.revision) return;
  if (!force && ($('editor_poin').open || $('dialog_nama').open)) {
    if (data.revision !== state.board.revision) message('Board berubah di sesi lain. Tutup detail dan muat ulang sebelum menyimpan.');
    return;
  }
  state.board = data; render();
}
async function write(path, method, body) {
  if (state.busy) return;
  state.busy = true;
  try { await api(path, method, body); await load(true); message('Perubahan tersimpan.'); }
  catch (error) { message(error.message, true); }
  finally { state.busy = false; }
}
function addCheck(check = { teks: '', selesai: false }) {
  const row = element('div', { class: 'check_row' });
  const checked = element('input', { type: 'checkbox', 'aria-label': 'Subpoin selesai' }); checked.checked = check.selesai;
  const label = element('label'); label.append(element('span', { class: 'sr_only' }, 'Isi acceptance criteria'));
  const input = element('input', { type: 'text', maxlength: '500', required: '', placeholder: 'Hasil yang dapat diperiksa' }); input.value = check.teks; label.append(input);
  const remove = element('button', { type: 'button', 'aria-label': 'Hapus subpoin' }, '✕'); remove.onclick = () => row.remove();
  row.append(checked, label, remove); $('daftar_subpoin').append(row);
}
function notes(point) {
  $('daftar_catatan').replaceChildren();
  for (const note of [...point.catatan].reverse()) {
    const li = element('li', {}, `${note.jenis} — ${note.teks}`);
    li.append(element('small', {}, `${note.oleh} · ${localTime(note.waktu)}`)); $('daftar_catatan').append(li);
  }
}
async function openEditor(id = null) {
  await load(true);
  state.editing = id; state.editRevision = state.board.revision;
  const point = id ? allPoints().find(p => p.id === id) : null;
  if (id && !point) return message('Poin sudah tidak tersedia.', true);
  $('judul_editor').textContent = point ? `Poin #${id}` : 'Tambah poin';
  $('deskripsi_poin').value = point?.deskripsi || '';
  const subChoices = currentArea().modul.flatMap(m => m.sub.map(s => ({ id: s.id, nama: `${m.nama} / ${s.nama}` })));
  fillSelect('submodul_poin', subChoices, point?.sub.id || state.sub || subChoices.find(s => !state.module || currentArea().modul.find(m => m.id === Number(state.module))?.sub.some(sub => sub.id === s.id))?.id);
  $('submodul_poin').disabled = !!point;
  $('keterangan_poin').value = point?.keterangan || '';
  $('alasan_status').value = ''; $('error_editor').textContent = '';
  $('daftar_subpoin').replaceChildren(); (point?.subpoin || []).forEach(addCheck);
  $('status_poin').replaceChildren();
  for (const value of point ? [point.status, ...transitions[point.status]] : ['backlog']) $('status_poin').append(element('option', { value }, labels[value]));
  $('hapus_poin').hidden = !point; $('bagian_catatan').hidden = !point;
  $('teks_catatan').value = ''; $('riwayat_poin').replaceChildren();
  if (point) {
    notes(point);
    const data = await api(`/api/riwayat?poin_id=${id}`);
    for (const event of data.riwayat) {
      const li = element('li', {}, `${labels[event.dari] || 'Baru'} → ${labels[event.ke] || 'Dihapus'}${event.catatan ? ' · ' + event.catatan : ''}`);
      li.append(element('small', {}, `${event.oleh} · ${localTime(event.waktu)}`)); $('riwayat_poin').append(li);
    }
  }
  $('editor_poin').showModal();
}
$('form_poin').onsubmit = async event => {
  event.preventDefault(); if (state.busy) return; state.busy = true;
  $('error_editor').textContent = '';
  const body = { deskripsi: $('deskripsi_poin').value, keterangan: $('keterangan_poin').value,
    subpoin: [...$('daftar_subpoin').children].map(row => ({ teks: row.querySelector('input[type=text]').value, selesai: row.querySelector('input[type=checkbox]').checked })) };
  try {
    if (state.editing) { body.status = $('status_poin').value; body.catatan = $('alasan_status').value; }
    else {
      body.submodul_id = Number($('submodul_poin').value);
    }
    await api(state.editing ? `/api/poin/${state.editing}` : '/api/poin', state.editing ? 'PATCH' : 'POST', body, state.editRevision);
    $('editor_poin').close(); await load(true); message('Poin tersimpan.');
  } catch (error) { $('error_editor').textContent = error.message; }
  finally { state.busy = false; }
};
$('form_catatan').onsubmit = async event => {
  event.preventDefault(); if (state.busy) return; state.busy = true;
  try {
    const point = allPoints().find(p => p.id === state.editing);
    const draftChecks = [...$('daftar_subpoin').children].map(row => ({ teks: row.querySelector('input[type=text]').value, selesai: row.querySelector('input[type=checkbox]').checked }));
    if ($('deskripsi_poin').value !== point.deskripsi || $('keterangan_poin').value !== point.keterangan || JSON.stringify(draftChecks) !== JSON.stringify(point.subpoin)) {
      throw new Error('Simpan perubahan poin terlebih dahulu sebelum mencatat keputusan atau verifikasi.');
    }
    const result = await api(`/api/poin/${state.editing}/catatan`, 'POST', { jenis: $('jenis_catatan').value, teks: $('teks_catatan').value }, state.editRevision);
    state.editRevision = result.revision;
    state.board = await api('/api/board');
    notes(allPoints().find(p => p.id === state.editing)); $('teks_catatan').value = ''; $('error_editor').textContent = '';
  } catch (error) { $('error_editor').textContent = error.message; }
  finally { state.busy = false; }
};
$('hapus_poin').onclick = async () => {
  if (!confirm('Hapus poin ini? Riwayat status tetap disimpan, isi poin dan catatannya akan dihapus.')) return;
  try { await api(`/api/poin/${state.editing}`, 'DELETE', {}, state.editRevision); $('editor_poin').close(); await load(true); message('Poin dihapus. Riwayat status tetap tersedia melalui API.'); }
  catch (error) { $('error_editor').textContent = error.message; }
};
function nameDialog(title, value, action) {
  nameAction = action; $('judul_nama').textContent = title; $('input_nama').value = value;
  $('error_nama').textContent = ''; $('dialog_nama').showModal();
}
$('form_nama').onsubmit = async event => {
  event.preventDefault(); if (state.busy) return; state.busy = true;
  try { await nameAction($('input_nama').value); $('dialog_nama').close(); await load(true); message('Struktur tersimpan.'); }
  catch (error) { $('error_nama').textContent = error.message; }
  finally { state.busy = false; }
};
$('tambah_area').onclick = () => nameDialog('Tambah area kerja', '', nama => api('/api/aplikasi', 'POST', { nama }));
$('ubah_area').onclick = () => nameDialog('Ubah nama area', currentArea().nama, nama => api(`/api/aplikasi/${state.area}`, 'PATCH', { nama }));
$('tambah_modul').onclick = () => nameDialog('Tambah modul', '', nama => api('/api/modul', 'POST', { nama, aplikasi_id: Number(state.area) }));
$('ubah_modul').onclick = () => nameDialog('Ubah nama modul', currentArea().modul.find(m => m.id === Number(state.module)).nama, nama => api(`/api/modul/${state.module}`, 'PATCH', { nama }));
$('tambah_submodul').onclick = () => nameDialog('Tambah submodul', '', nama => api('/api/submodul', 'POST', { nama, modul_id: Number(state.module) }));
$('ubah_submodul').onclick = () => nameDialog('Ubah nama submodul', currentArea().modul.flatMap(m => m.sub).find(s => s.id === Number(state.sub)).nama, nama => api(`/api/submodul/${state.sub}`, 'PATCH', { nama }));
$('pilih_area').onchange = event => { state.area = Number(event.target.value); state.module = ''; state.sub = ''; render(); };
$('pilih_modul').onchange = event => { state.module = event.target.value; state.sub = ''; render(); };
$('pilih_submodul').onchange = event => { state.sub = event.target.value; render(); };
$('workflow_master').onchange = event => write('/api/workflow', 'PATCH', { aktif: event.target.checked });
$('workflow_area').onchange = event => write('/api/workflow', 'PATCH', { aplikasi_id: Number(state.area), aktif: event.target.checked });
$('tambah_subpoin').onclick = () => addCheck();
$('tutup_editor').onclick = () => $('editor_poin').close();
$('tutup_nama').onclick = () => $('dialog_nama').close();
$('tutup_panduan').onclick = () => $('dialog_panduan').close();
$('tombol_panduan').onclick = () => $('dialog_panduan').showModal();
$('tambah_poin').onclick = () => openEditor().catch(error => message(error.message, true));
$('muat_ulang').onclick = () => load(true).then(() => message('Board dimuat ulang.')).catch(error => message(error.message, true));
$('cari_poin').oninput = render;
$('editor_poin').onclose = () => load(true).catch(error => message(error.message, true));
async function start() {
  try { const session = await fetch('/api/session').then(r => r.json()); state.token = session.token; await load(true); }
  catch (error) { message(`Board tidak dapat dimuat: ${error.message}. Pastikan server masih berjalan.`, true); }
}
start();
setInterval(() => { if (state.board && !state.busy) load().catch(error => message(`Sinkronisasi terhenti: ${error.message}`, true)); }, 5000);
