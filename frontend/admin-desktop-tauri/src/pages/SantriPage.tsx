import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createLembagaSantri,
  createSantri,
  generateNisk,
  importSantri,
  listDokumenSantri,
  listLembagaSantri,
  listSantri,
  periksaImportSantri,
  tidakMemilikiDokumen,
  unduhTemplateSantri,
  updateLembagaSantri,
  updateSantri,
  uploadDokumenSantri,
  uploadFotoSantri,
  type DokumenSantri,
  type ImportPeriksa,
  type LembagaSantri,
  type Santri,
} from '../api/santri';
import { listLembaga, type Lembaga } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { Download, FileUp, ImageUp, Plus, Upload } from '@/icons';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';

const digitValidator = (len: number, nama: string) => (v: string | null) =>
  (!v || v.trim() === '' || new RegExp(`^\\d{${len}}$`).test(v.trim()) ? null : `${nama} harus ${len} digit angka.`);

const tglValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Format tanggal: YYYY-MM-DD.');

const angkaValidator = (v: string | null) => (!v || v.trim() === '' || /^\d+$/.test(v.trim()) ? null : 'Harus angka.');

function teks(key: string, label: string, width = 140, maxLength = 255): ExcelField {
  return { key, label, width, kind: 'text', maxLength };
}

function tgl(key: string, label: string, width = 110): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 10, validate: tglValidator };
}

function angka(key: string, label: string, width = 90): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 4, validate: angkaValidator };
}

function pihakFields(prefix: 'ayah' | 'ibu' | 'wali', judul: string): ExcelField[] {
  return [
    teks(`${prefix}_nama`, `${judul} — Nama`, 160),
    { key: `${prefix}_nik`, label: `${judul} — NIK`, width: 150, kind: 'text', maxLength: 16, validate: digitValidator(16, 'NIK') },
    teks(`${prefix}_tmp_lahir`, `${judul} — Tempat lahir`, 140),
    tgl(`${prefix}_tgl_lahir`, `${judul} — Tgl lahir`, 120),
    teks(`${prefix}_status`, `${judul} — Status`, 110),
    teks(`${prefix}_pekerjaan`, `${judul} — Pekerjaan`, 140),
    teks(`${prefix}_pendidikan`, `${judul} — Pendidikan`, 140),
    teks(`${prefix}_penghasilan`, `${judul} — Penghasilan`, 140),
    teks(`${prefix}_telp`, `${judul} — Telp`, 130, 20),
    teks(`${prefix}_alamat`, `${judul} — Alamat`, 200, 500),
    teks(`${prefix}_status_tempat_tinggal`, `${judul} — Tempat tinggal`, 150),
  ];
}

/** Kolom buku induk: identitas murni + ringkasan keanggotaan (bukan kolom DB). */
const SANTRI_FIELDS: ExcelField[] = [
  { key: 'nama', label: 'Nama', width: 220, kind: 'text', maxLength: 255, validate: (v) => (v && v.trim() ? null : 'Nama wajib diisi.') },
  teks('nama_singkat', 'Nama singkat', 140),
  { key: 'nik', label: 'NIK', width: 160, kind: 'text', maxLength: 16, validate: digitValidator(16, 'NIK') },
  { key: 'nisn', label: 'NISN', width: 120, kind: 'text', maxLength: 10, validate: digitValidator(10, 'NISN') },
  { key: 'jk', label: 'JK', width: 60, kind: 'select', choices: [{ value: 'L', label: 'L' }, { value: 'P', label: 'P' }] },
  teks('tmp_lahir', 'Tempat lahir', 140),
  tgl('tgl_lahir', 'Tgl lahir', 110),
  angka('anak_ke', 'Anak ke', 80),
  angka('j_saudara', 'Jml saudara', 100),
  { key: 'tipe_santri', label: 'Tipe', width: 120, kind: 'select', choices: [{ value: 'asrama', label: 'asrama' }, { value: 'non_asrama', label: 'non_asrama' }] },
  teks('no_hp_santri', 'HP santri', 130, 20),
  { key: 'email_santri', label: 'Email santri', width: 180, kind: 'text', maxLength: 255, validate: (v) => (!v || v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Format email tidak valid.') },
  teks('agama', 'Agama', 100),
  teks('cita_cita', 'Cita-cita', 130),
  teks('hobi', 'Hobi', 130),
  teks('kebutuhan_khusus', 'Kebutuhan khusus', 150),
  teks('kebutuhan_disabilitas', 'Disabilitas', 130),
  teks('nomor_kip', 'No. KIP', 130),
  { key: 'no_kk', label: 'No. KK', width: 150, kind: 'text', maxLength: 16, validate: digitValidator(16, 'No. KK') },
  teks('kewarganegaraan', 'Kewarganegaraan', 130),
  teks('bahasa_sehari', 'Bahasa sehari-hari', 150),
  teks('status_tempat_tinggal', 'Tempat tinggal', 150),
  teks('jarak_ke_pesantren', 'Jarak', 110),
  teks('waktu_tempuh', 'Waktu tempuh', 120),
  teks('transportasi', 'Transportasi', 130),
  tgl('tanggal_masuk', 'Tgl masuk', 110),
  teks('alamat', 'Alamat', 220, 500),
  teks('rt', 'RT', 60, 3),
  teks('rw', 'RW', 60, 3),
  teks('kode_pos', 'Kode pos', 90, 10),
  teks('provinsi', 'Provinsi', 150),
  teks('kab_kota', 'Kab/Kota', 150),
  teks('kecamatan', 'Kecamatan', 150),
  teks('desa_kelurahan', 'Desa/Kelurahan', 150),
  ...pihakFields('ayah', 'Ayah'),
  ...pihakFields('ibu', 'Ibu'),
  ...pihakFields('wali', 'Wali'),
  teks('yang_membiayai', 'Yang membiayai', 140),
  { key: 'keanggotaan', label: 'Keanggotaan', width: 180, kind: 'static' },
  { key: 'status', label: 'Status', width: 100, kind: 'static' },
];

const TGL_KEYS = new Set(['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk']);
const TURUNAN_KEYS = new Set(['keanggotaan', 'status']);

function santriGridValues(s: Santri): Record<string, string | null> {
  const sumber = s as unknown as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const f of SANTRI_FIELDS) {
    if (TURUNAN_KEYS.has(f.key)) continue;
    const keyDb = f.key === 'nama' ? 'nama_lengkap' : f.key;
    const raw = sumber[keyDb];
    if (raw == null || raw === '') {
      out[f.key] = null;
      continue;
    }
    const str = String(raw);
    out[f.key] = TGL_KEYS.has(f.key) ? str.slice(0, 10) : str;
  }
  const aktif = s.lembaga_aktif ?? [];
  out.keanggotaan = aktif.length
    ? aktif.map((ls) => `${ls.lembaga?.kode ?? ls.lembaga_id}${ls.nis_lokal ? `/${ls.nis_lokal}` : ''}`).join(', ')
    : '—';
  out.status = s.status_global ? 'aktif' : 'nonaktif';
  return out;
}

async function commitSantri(id: number, f: Record<string, string | null>) {
  const body: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    if (TURUNAN_KEYS.has(k)) continue;
    if (k === 'nama') {
      body.nama_lengkap = (v ?? '').trim();
      continue;
    }
    body[k] = v === null || String(v).trim() === '' ? null : String(v).trim();
  }
  if (Object.keys(body).length === 0) return;
  await updateSantri(id, body);
}

/** Buku Induk: identitas santri (buku induk) + panel keanggotaan per lembaga + import identitas. */
export default function SantriPage() {
  const [rows, setRows] = useState<Santri[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const pager = usePager('santri');
  const reqRef = useRef(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusGlobal, setStatusGlobal] = useState('_semua');
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [periksaHasil, setPeriksaHasil] = useState<ImportPeriksa | null>(null);
  const [periksaBusy, setPeriksaBusy] = useState(false);

  const [fotoRow, setFotoRow] = useState<Santri | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [dokRow, setDokRow] = useState<Santri | null>(null);
  const [dokRows, setDokRows] = useState<DokumenSantri[]>([]);
  const [dokJenis, setDokJenis] = useState('');
  const [dokFile, setDokFile] = useState<File | null>(null);
  const [dokCatatan, setDokCatatan] = useState('');

  const [profilRow, setProfilRow] = useState<Santri | null>(null);

  // Dialog keanggotaan (NIS lokal/kemenag per lembaga).
  const [anggotaRow, setAnggotaRow] = useState<Santri | null>(null);
  const [anggotaList, setAnggotaList] = useState<LembagaSantri[]>([]);
  const [anggotaLembaga, setAnggotaLembaga] = useState('');
  const [anggotaNis, setAnggotaNis] = useState('');
  const [anggotaMulai, setAnggotaMulai] = useState('');

  // Dialog Tambah identitas.
  const [tambahOpen, setTambahOpen] = useState(false);
  const [addNama, setAddNama] = useState('');
  const [addJk, setAddJk] = useState('L');
  const [addNik, setAddNik] = useState('');
  const [addNisn, setAddNisn] = useState('');
  const [addLembaga, setAddLembaga] = useState('');
  const [addNisLokal, setAddNisLokal] = useState('');
  const [busy, setBusy] = useState(false);

  // Hanya lembaga operasional (root pesantren tidak bisa menjadi keanggotaan).
  const lembagaOperasional = lembagas.filter((l) => l.parent);

  const { user } = useAuth();
  const singleLembagaId =
    user && !user.roles.some((r) => r.name === 'super_admin') && (user.lembagas?.length ?? 0) === 1
      ? user.lembagas![0].id
      : null;

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listSantri({
          status_global: statusGlobal === '_semua' ? undefined : statusGlobal === 'aktif',
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
          q: terapkanCari || undefined,
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, statusGlobal, lembagaId, terapkanCari],
  );

  useEffect(() => {
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, statusGlobal, lembagaId, terapkanCari]);

  const bukaAnggota = useCallback(async (s: Santri) => {
    setAnggotaRow(s);
    setAnggotaLembaga('');
    setAnggotaNis('');
    setAnggotaMulai('');
    try {
      const res = await listLembagaSantri(s.id);
      setAnggotaList(res.data);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, []);

  const simpanAnggota = useCallback(async () => {
    if (!anggotaRow || !anggotaLembaga) return;
    try {
      await createLembagaSantri(anggotaRow.id, {
        lembaga_id: Number(anggotaLembaga),
        nis_lokal: anggotaNis.trim() || null,
        tgl_mulai: anggotaMulai || null,
      });
      toast.success('Keanggotaan disimpan.');
      setAnggotaNis('');
      setAnggotaLembaga('');
      setAnggotaMulai('');
      const res = await listLembagaSantri(anggotaRow.id);
      setAnggotaList(res.data);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [anggotaRow, anggotaLembaga, anggotaNis, anggotaMulai, load]);

  const aksiAnggota = useCallback(
    async (fn: () => Promise<unknown>, pesan: string) => {
      try {
        await fn();
        toast.success(pesan);
        if (anggotaRow) {
          const res = await listLembagaSantri(anggotaRow.id);
          setAnggotaList(res.data);
        }
        await load();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [anggotaRow, load],
  );

  const muatDokumen = useCallback(async (s: Santri) => {
    try {
      const res = await listDokumenSantri(s.id);
      setDokRows(res.data);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, []);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<Santri>
        tableKey="santri"
        fields={SANTRI_FIELDS}
        rows={rows}
        getValues={santriGridValues}
        loading={loading}
        emptyText="Belum ada santri pada filter ini."
        canEdit
        onCommit={commitSantri}
        onSaved={() => load()}
        renderActions={(s) => (
          <>
            <ActionIcon id={`btn_anggota_santri_${s.id}`} title="Keanggotaan lembaga" onClick={() => void bukaAnggota(s)}><Plus size={16} /></ActionIcon>
            <ActionIcon id={`btn_foto_santri_${s.id}`} title="Upload foto" onClick={() => { setFotoRow(s); setFotoFile(null); }}><ImageUp size={16} /></ActionIcon>
            <ActionIcon id={`btn_profil_santri_${s.id}`} title="Profil santri" onClick={() => setProfilRow(s)}><FileUp size={16} /></ActionIcon>
            <ActionIcon id={`btn_dokumen_santri_${s.id}`} title="Dokumen santri" onClick={() => { setDokRow(s); setDokJenis(''); setDokFile(null); void muatDokumen(s); }}><Upload size={16} /></ActionIcon>
          </>
        )}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIK / NISN"
        searchIds={{ form: 'form_cari_santri', input: 'input_cari_santri', button: 'btn_cari_santri' }}
        filter={(
          <>
            <FilterField label="Status" htmlFor="select_status_santri">
              <Select value={statusGlobal} onValueChange={(v) => { setStatusGlobal(v); pager.goFirst(); }}>
                <SelectTrigger id="select_status_santri" title="Filter status" aria-label="Filter status" size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua status</SelectItem>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
            <Button id="btn_buka_tambah_santri" size="sm" onClick={() => { setAddNama(''); setAddJk('L'); setAddNik(''); setAddNisn(''); setAddLembaga(''); setAddNisLokal(''); setTambahOpen(true); }}>
              <Plus data-icon="inline-start" size={16} /> Santri
            </Button>
            <Button id="btn_buka_import_santri" size="sm" variant="outline" onClick={() => { setImportFile(null); setPeriksaHasil(null); setImportOpen(true); }}>
              <FileUp data-icon="inline-start" size={16} /> Import
            </Button>
          </>
        )}
      />
      <Pager page={pager.page} lastPage={lastPage} total={total} perPage={pager.perPage} onPage={(p) => { pager.setPage(p); load(p); }} onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }} />

      {/* Tambah identitas */}
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah santri</DialogTitle>
            <DialogDescription>Identitas buku induk; keanggotaan lembaga opsional di sini.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const res = await createSantri({ nama_lengkap: addNama.trim(), jk: addJk, nik: addNik.trim() || null, nisn: addNisn.trim() || null });
              if (addLembaga) {
                await createLembagaSantri(res.data.id, { lembaga_id: Number(addLembaga), nis_lokal: addNisLokal.trim() || null });
              }
              toast.success('Santri ditambahkan.');
              setTambahOpen(false);
              await load(1);
            } catch (e2) {
              toast.error(errorMessage(e2));
            } finally {
              setBusy(false);
            }
          }}>
            <FieldLabel htmlFor="input_nama_santri">Nama</FieldLabel>
            <Input id="input_nama_santri" value={addNama} onChange={(e) => setAddNama(e.target.value)} required maxLength={255} />
            <FieldLabel htmlFor="select_jk_santri">Jenis kelamin</FieldLabel>
            <Select value={addJk} onValueChange={setAddJk}>
              <SelectTrigger id="select_jk_santri"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="P">P</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nik_santri">NIK</FieldLabel>
            <Input id="input_nik_santri" value={addNik} onChange={(e) => setAddNik(e.target.value)} maxLength={16} />
            <FieldLabel htmlFor="input_nisn_santri">NISN</FieldLabel>
            <Input id="input_nisn_santri" value={addNisn} onChange={(e) => setAddNisn(e.target.value)} maxLength={10} />
            <FieldLabel htmlFor="select_lembaga_tambah_santri">Lembaga (opsional)</FieldLabel>
            <Select value={addLembaga === '' ? '_kosong' : addLembaga} onValueChange={(v) => setAddLembaga(v === '_kosong' ? '' : v)}>
              <SelectTrigger id="select_lembaga_tambah_santri"><SelectValue placeholder="Tanpa lembaga" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_kosong">Tanpa lembaga</SelectItem>
                  {lembagaOperasional.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nis_lokal_tambah">NIS lokal</FieldLabel>
            <Input id="input_nis_lokal_tambah" value={addNisLokal} onChange={(e) => setAddNisLokal(e.target.value)} maxLength={20} disabled={!addLembaga} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button id="btn_simpan_tambah_santri" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Keanggotaan */}
      <Dialog open={anggotaRow !== null} onOpenChange={(o) => { if (!o) setAnggotaRow(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Keanggotaan: {anggotaRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>NIS lokal per lembaga; NIS Kemenag digenerate dari Buku Induk.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Lembaga</th>
                  <th className="p-2">NIS lokal</th>
                  <th className="p-2">NIS Kemenag</th>
                  <th className="p-2">Mulai</th>
                  <th className="p-2">Selesai</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {anggotaList.length === 0 ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Belum ada keanggotaan.</td></tr>
                ) : anggotaList.map((ls) => (
                  <tr key={ls.id} className="border-t">
                    <td className="p-2">{ls.lembaga?.kode ?? ls.lembaga?.nama ?? ls.lembaga_id}</td>
                    <td className="p-2">{ls.nis_lokal ?? '—'}</td>
                    <td className="p-2">{ls.nis_kemenag ?? '—'}</td>
                    <td className="p-2">{ls.tgl_mulai?.slice(0, 10) ?? '—'}</td>
                    <td className="p-2">{ls.tgl_selesai?.slice(0, 10) ?? '—'}</td>
                    <td className="p-2">{ls.is_active ? 'aktif' : 'nonaktif'}</td>
                    <td className="p-2 text-right">
                      <Button
                        id={`btn_generate_nisk_${ls.id}`}
                        size="sm"
                        variant="outline"
                        disabled={!ls.nis_lokal || Boolean(ls.nis_kemenag)}
                        onClick={() => void aksiAnggota(() => generateNisk(ls.id), 'NIS Kemenag digenerate.')}
                      >
                        Generate NISK
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-[max-content_1fr_max-content_1fr] items-center gap-3">
            <FieldLabel htmlFor="select_lembaga_anggota">Lembaga</FieldLabel>
            <Select value={anggotaLembaga === '' ? '_kosong' : anggotaLembaga} onValueChange={(v) => setAnggotaLembaga(v === '_kosong' ? '' : v)}>
              <SelectTrigger id="select_lembaga_anggota"><SelectValue placeholder="Pilih lembaga" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_kosong">Pilih lembaga</SelectItem>
                  {lembagaOperasional.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_nis_lokal_anggota">NIS lokal</FieldLabel>
            <Input id="input_nis_lokal_anggota" value={anggotaNis} onChange={(e) => setAnggotaNis(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_mulai_anggota">Tgl mulai</FieldLabel>
            <Input id="input_mulai_anggota" type="date" value={anggotaMulai} onChange={(e) => setAnggotaMulai(e.target.value)} />
            <Button id="btn_simpan_anggota" size="sm" disabled={!anggotaLembaga} onClick={() => void simpanAnggota()}>Tambah keanggotaan</Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAnggotaRow(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import identitas */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import identitas santri</DialogTitle>
            <DialogDescription>Buku induk: hanya identitas. Keanggotaan/riwayat lewat halaman masing-masing.</DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!importFile || !periksaHasil?.siap_import) return;
            setBusy(true);
            try {
              const res = await importSantri({ file: importFile });
              if (res.errors?.length) {
                toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
              } else {
                toast.success(res.pesan ?? 'Import selesai.');
                setImportOpen(false);
                await load(1);
              }
            } catch (e2) {
              toast.error(errorMessage(e2));
            } finally {
              setBusy(false);
            }
          }}>
            <Button
              id="btn_unduh_template_santri"
              type="button"
              variant="link"
              className="col-span-2 h-auto justify-start px-0"
              onClick={() => void unduhTemplateSantri(singleLembagaId ?? undefined).catch((e) => toast.error(errorMessage(e)))}
            >
              <Download data-icon="inline-start" size={16} /> Unduh template Excel identitas
            </Button>
            <Input
              id="input_file_import_santri"
              className="col-span-2"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setPeriksaHasil(null); }}
              required
            />
            {periksaHasil ? (
              <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_periksa_import_santri">
                <p className="font-medium">
                  {periksaHasil.ringkasan.baris_diproses} baris diperiksa · {periksaHasil.ringkasan.baris_valid} valid · {periksaHasil.ringkasan.baris_gagal} bermasalah
                </p>
                {periksaHasil.errors.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                    {periksaHasil.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>
                )}
              </div>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_periksa_import_santri" type="button" variant="outline" disabled={!importFile || periksaBusy || busy} onClick={async () => {
                if (!importFile) return;
                setPeriksaBusy(true);
                try {
                  const res = await periksaImportSantri({ file: importFile });
                  setPeriksaHasil(res);
                  if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
                } catch (e2) {
                  setPeriksaHasil(null);
                  toast.error(errorMessage(e2));
                } finally {
                  setPeriksaBusy(false);
                }
              }}>{periksaBusy ? 'Memeriksa…' : 'Periksa'}</Button>
              <Button id="btn_import_santri" type="submit" disabled={busy || periksaBusy || !periksaHasil?.siap_import}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Foto */}
      <Dialog open={fotoRow !== null} onOpenChange={(o) => { if (!o) setFotoRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload foto: {fotoRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>JPG/PNG maks 2 MB.</DialogDescription>
          </DialogHeader>
          <Input id="input_foto_santri" type="file" accept="image/png,image/jpeg" onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFotoRow(null)}>Batal</Button>
            <Button id="btn_upload_foto_santri" disabled={!fotoFile || busy} onClick={async () => {
              if (!fotoRow || !fotoFile) return;
              setBusy(true);
              try {
                await uploadFotoSantri(fotoRow.id, fotoFile);
                toast.success('Foto diupload.');
                setFotoRow(null);
                await load();
              } catch (e2) {
                toast.error(errorMessage(e2));
              } finally {
                setBusy(false);
              }
            }}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dokumen */}
      <Dialog open={dokRow !== null} onOpenChange={(o) => { if (!o) { setDokRow(null); setDokRows([]); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumen: {dokRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Checklist dokumen santri (mengikuti kamus lembaga).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 items-end gap-3">
            <div className="col-span-1">
              <FieldLabel htmlFor="select_jenis_dokumen_santri">Jenis dokumen</FieldLabel>
              <Input id="select_jenis_dokumen_santri" value={dokJenis} onChange={(e) => setDokJenis(e.target.value)} placeholder="Nama jenis" />
            </div>
            <div className="col-span-1">
              <FieldLabel htmlFor="input_file_dokumen_santri">File</FieldLabel>
              <Input id="input_file_dokumen_santri" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setDokFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button id="btn_upload_dokumen_santri" disabled={busy || !dokFile || !dokJenis} onClick={async () => {
              if (!dokRow || !dokFile || !dokJenis) return;
              setBusy(true);
              try {
                await uploadDokumenSantri(dokRow.id, { jenis_dokumen_santri: dokJenis, file: dokFile, catatan: dokCatatan || undefined });
                toast.success('Dokumen diupload.');
                setDokFile(null);
                setDokCatatan('');
                await muatDokumen(dokRow);
              } catch (e2) {
                toast.error(errorMessage(e2));
              } finally {
                setBusy(false);
              }
            }}>Upload</Button>
          </div>
          <div className="max-h-56 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="p-2">Jenis</th><th className="p-2">Status</th><th className="p-2">File</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {dokRows.length === 0 ? <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Belum ada dokumen.</td></tr> : dokRows.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{d.jenis_dokumen_santri}</td>
                    <td className="p-2">{d.tidak_memiliki ? 'tidak memiliki' : d.status_verifikasi}</td>
                    <td className="p-2">{d.path_file ? 'ada' : '—'}</td>
                    <td className="p-2 text-right">
                      <Button id={`btn_tidak_miliki_dok_${d.id}`} size="sm" variant="outline" onClick={() => dokRow && void (async () => {
                        try {
                          await tidakMemilikiDokumen(dokRow.id, d.id, !d.tidak_memiliki);
                          await muatDokumen(dokRow);
                        } catch (e) { toast.error(errorMessage(e)); }
                      })()}>Tandai</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setDokRow(null); setDokRows([]); }}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProfilSantriDialog santriId={profilRow?.id ?? null} open={profilRow !== null} onOpenChange={(o) => { if (!o) setProfilRow(null); }} />
    </div>
  );
}
