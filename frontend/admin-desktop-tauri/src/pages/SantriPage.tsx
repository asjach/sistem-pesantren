import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  importSantri,
  listDokumenSantri,
  listSantri,
  tidakMemilikiDokumen,
  updateSantri,
  uploadDokumenSantri,
  uploadFotoSantri,
  type DokumenSantri,
  type Santri,
} from '../api/santri';
import { listLembaga, listTahunAjaran, referensiList, type Lembaga, type ReferensiRow, type TahunAjaran } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { FileUp, ImageUp, Upload } from 'lucide-react';
import { toast } from 'sonner';

/** Validator: tepat N digit angka (kosong = boleh). */
const digitValidator = (len: number, nama: string) => (v: string | null) =>
  (!v || v.trim() === '' || new RegExp(`^\\d{${len}}$`).test(v.trim()) ? null : `${nama} harus ${len} digit angka.`);

const tglValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Format tanggal: YYYY-MM-DD.');

const angkaValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d+$/.test(v.trim()) ? null : 'Harus angka.');

/** Kolom teks bebas. */
function teks(key: string, label: string, width = 140, maxLength = 255): ExcelField {
  return { key, label, width, kind: 'text', maxLength };
}

/** Kolom tanggal (YYYY-MM-DD). */
function tgl(key: string, label: string, width = 110): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 10, validate: tglValidator };
}

/** Kolom angka. */
function angka(key: string, label: string, width = 90): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 4, validate: angkaValidator };
}

/** Kolom per pihak (ayah/ibu/wali). */
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

/** Seluruh kolom profil santri (profil EMIS) — jalur pengisian UTAMA adalah
 *  edit langsung di tabel ini; import Excel hanya alternatif massal. */
const SANTRI_FIELDS: ExcelField[] = [
  {
    key: 'nama',
    label: 'Nama',
    width: 220,
    kind: 'text',
    maxLength: 255,
    validate: (v) => (v && v.trim() ? null : 'Nama wajib diisi.'),
  },
  teks('nama_singkat', 'Nama singkat', 140),
  { key: 'nik', label: 'NIK', width: 160, kind: 'text', maxLength: 16, validate: digitValidator(16, 'NIK') },
  { key: 'nisn', label: 'NISN', width: 120, kind: 'text', maxLength: 10, validate: digitValidator(10, 'NISN') },
  { key: 'nis', label: 'NIS', width: 100, kind: 'text', maxLength: 10 },
  {
    key: 'jk',
    label: 'JK',
    width: 60,
    kind: 'select',
    choices: [{ value: 'L', label: 'L' }, { value: 'P', label: 'P' }],
  },
  teks('tmp_lahir', 'Tempat lahir', 140),
  tgl('tgl_lahir', 'Tgl lahir', 110),
  angka('anak_ke', 'Anak ke', 80),
  angka('j_saudara', 'Jml saudara', 100),
  {
    key: 'tipe_santri',
    label: 'Tipe',
    width: 120,
    kind: 'select',
    choices: [{ value: 'asrama', label: 'asrama' }, { value: 'non_asrama', label: 'non_asrama' }],
  },
  teks('no_hp_santri', 'HP santri', 130, 20),
  {
    key: 'email_santri',
    label: 'Email santri',
    width: 180,
    kind: 'text',
    maxLength: 255,
    validate: (v) => (!v || v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Format email tidak valid.'),
  },
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
  { key: 'kelas', label: 'Kelas', width: 120, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
  { key: 'status', label: 'Status', width: 100, kind: 'static' },
];

/** Simpan perubahan sel grid → PATCH santri (hanya field yang berubah). */
async function commitSantri(id: number, f: Record<string, string | null>) {
  const body: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    if (TURUNAN_KEYS.has(k)) continue; // kelas/lembaga/status tidak dikirim
    if (k === 'nama') {
      body.nama_lengkap = (v ?? '').trim();
      continue;
    }
    body[k] = v === null || String(v).trim() === '' ? null : String(v).trim();
  }
  if (Object.keys(body).length === 0) return;
  await updateSantri(id, body);
}

/** Kolom tanggal: API mengirim ISO datetime → grid pakai YYYY-MM-DD. */
const TGL_KEYS = new Set(['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk']);
/** Kolom turunan (bukan kolom DB langsung). */
const TURUNAN_KEYS = new Set(['kelas', 'lembaga', 'status']);

function santriGridValues(s: Santri): Record<string, string | null> {
  const sumber = s as unknown as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const f of SANTRI_FIELDS) {
    if (TURUNAN_KEYS.has(f.key)) continue;
    // Kolom grid 'nama' dipetakan dari kolom DB nama_lengkap.
    const keyDb = f.key === 'nama' ? 'nama_lengkap' : f.key;
    const raw = sumber[keyDb];
    if (raw == null || raw === '') {
      out[f.key] = null;
      continue;
    }
    const str = String(raw);
    out[f.key] = TGL_KEYS.has(f.key) ? str.slice(0, 10) : str;
  }
  out.kelas = s.kelas?.nama_kelas ?? null;
  out.lembaga = s.lembaga?.kode ?? s.lembaga?.nama ?? String(s.lembaga_id);
  out.status = s.status_global ? 'aktif' : 'nonaktif';
  return out;
}

// 101 Santri: daftar + import PPDB + upload foto/dokumen.
export default function SantriPage() {
  const [rows, setRows] = useState<Santri[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [jenisDokumen, setJenisDokumen] = useState<ReferensiRow[]>([]);
  const pager = usePager('santri');
  const reqRef = useRef(0);
  const lembagaReqRef = useRef(0);
  const jenisDokumenReqRef = useRef(0);
  const taReqRef = useRef(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusGlobal, setStatusGlobal] = useState('_semua');

  const [importOpen, setImportOpen] = useState(false);
  const [importLembaga, setImportLembaga] = useState('');
  const [importTa, setImportTa] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const [fotoRow, setFotoRow] = useState<Santri | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [dokRow, setDokRow] = useState<Santri | null>(null);
  const [dokRows, setDokRows] = useState<DokumenSantri[]>([]);
  const [dokListLoading, setDokListLoading] = useState(false);
  const [dokJenis, setDokJenis] = useState('');
  const [dokFile, setDokFile] = useState<File | null>(null);
  const [dokCatatan, setDokCatatan] = useState('');
  const [busy, setBusy] = useState(false);

  const getValues = useCallback(santriGridValues, []);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listSantri({
          status_global: statusGlobal === '_semua' ? undefined : statusGlobal === 'aktif',
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
    [pager.page, pager.perPage, pager.sync, statusGlobal],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, statusGlobal]);

  useEffect(() => {
    const lembagaReq = ++lembagaReqRef.current;
    listLembaga({ per_page: 100 })
      .then((p) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setLembagas(p.data);
      })
      .catch((e) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setErr(errorMessage(e));
      });
    const jenisReq = ++jenisDokumenReqRef.current;
    referensiList('jenis_dokumen_santri')
      .then((r) => {
        if (jenisReq !== jenisDokumenReqRef.current) return;
        setJenisDokumen(r);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const req = ++taReqRef.current;
    if (!importLembaga) {
      setTas([]);
      return;
    }
    listTahunAjaran({ lembaga_id: Number(importLembaga), per_page: 100 })
      .then((p) => {
        if (req !== taReqRef.current) return;
        setTas(p.data);
      })
      .catch((e) => {
        if (req === taReqRef.current) setErr(errorMessage(e));
      });
  }, [importLembaga]);

  useEffect(() => {
    if (dokRow?.lembaga_id) {
      const req = ++jenisDokumenReqRef.current;
      referensiList('jenis_dokumen_santri', dokRow.lembaga_id)
        .then((r) => {
          if (req !== jenisDokumenReqRef.current) return;
          setJenisDokumen(r);
        })
        .catch(() => {});
    }
  }, [dokRow]);

  const loadDokumenList = useCallback(async (santriId: number) => {
    setDokListLoading(true);
    try {
      const res = await listDokumenSantri(santriId);
      setDokRows(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setDokListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dokRow) void loadDokumenList(dokRow.id);
    else setDokRows([]);
  }, [dokRow, loadDokumenList]);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importTa) return;
    setBusy(true);
    setErr('');
    try {
      const res = await importSantri({
        tahun_ajaran_id: Number(importTa),
        lembaga_id: importLembaga ? Number(importLembaga) : undefined,
        file: importFile,
      });
      if (res.errors?.length) {
        setErr(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
      } else {
        toast.success(res.pesan ?? 'Import selesai.');
        setImportOpen(false);
        setImportFile(null);
        await load(1);
      }
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFoto(e: React.FormEvent) {
    e.preventDefault();
    if (!fotoRow || !fotoFile) return;
    setBusy(true);
    setErr('');
    try {
      await uploadFotoSantri(fotoRow.id, fotoFile);
      toast.success('Foto terupload.');
      setFotoRow(null);
      setFotoFile(null);
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDokumen(e: React.FormEvent) {
    e.preventDefault();
    if (!dokRow || !dokFile || !dokJenis) return;
    setBusy(true);
    setErr('');
    try {
      await uploadDokumenSantri(dokRow.id, {
        jenis_dokumen_santri: dokJenis,
        file: dokFile,
        catatan: dokCatatan || undefined,
      });
      toast.success('Dokumen terupload.');
      setDokFile(null);
      setDokJenis('');
      setDokCatatan('');
      await loadDokumenList(dokRow.id);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleTidakMemiliki(d: DokumenSantri, checked: boolean) {
    if (!dokRow) return;
    setErr('');
    try {
      const res = await tidakMemilikiDokumen(dokRow.id, d.id, checked);
      setDokRows((prev) => prev.map((x) => (x.id === d.id ? res.data : x)));
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }

  const onSaved = useCallback(() => load(), [load]);
  const renderActions = useCallback((s: Santri) => (
    <>
      <ActionIcon id={`btn_foto_santri_${s.id}`} title="Upload foto" onClick={() => setFotoRow(s)}>
        <ImageUp size={16} />
      </ActionIcon>
      <ActionIcon id={`btn_dokumen_santri_${s.id}`} title="Dokumen" onClick={() => setDokRow(s)}>
        <FileUp size={16} />
      </ActionIcon>
    </>
  ), []);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="santri"
        fields={SANTRI_FIELDS}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText="Belum ada santri."
        canEdit
        onCommit={commitSantri}
        onSaved={onSaved}
        filter={(
          <Select value={statusGlobal} onValueChange={(v) => { setStatusGlobal(v); pager.goFirst(); }}>
            <SelectTrigger id="select_status_santri" title="Filter status" aria-label="Filter status" size="sm" className="w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_semua">Semua status</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="nonaktif">Nonaktif</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        addButton={(
          <Button id="btn_buka_import_santri" onClick={() => setImportOpen(true)}>
            <Upload data-icon="inline-start" size={16} /> Import
          </Button>
        )}
        renderActions={renderActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data santri (Excel/CSV)</DialogTitle>
            <DialogDescription className="sr-only">
              Impor data santri dari berkas Excel/CSV sesuai template.
            </DialogDescription>
          </DialogHeader>
          <form id="form_import_santri" onSubmit={onImport} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_import_lembaga">Lembaga tujuan</FieldLabel>
                <Select value={importLembaga} onValueChange={(v) => { setImportLembaga(v); setImportTa(''); }}>
                  <SelectTrigger id="select_import_lembaga" className="w-full">
                    <SelectValue placeholder="Pilih lembaga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="select_import_ta">Tahun ajaran</FieldLabel>
                <Select value={importTa} onValueChange={setImportTa}>
                  <SelectTrigger id="select_import_ta" className="w-full">
                    <SelectValue placeholder="Pilih tahun ajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_file_santri">File (.xlsx/.xls/.csv, maks 5 MB)</FieldLabel>
                <Input
                  id="input_file_santri"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_import_santri" type="submit" disabled={busy || !importFile || !importTa}>Import</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fotoRow !== null} onOpenChange={(o) => { if (!o) setFotoRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload foto: {fotoRow?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">
              Unggah foto santri (jpg/png, maksimal 2 MB).
            </DialogDescription>
          </DialogHeader>
          <form id="form_foto_santri" onSubmit={onUploadFoto} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="input_file_foto">File (jpg/png, maks 2 MB)</FieldLabel>
                <Input
                  id="input_file_foto"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setFotoFile(e.target.files?.[0] ?? null)}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFotoRow(null)}>Batal</Button>
              <Button id="btn_upload_foto" type="submit" disabled={busy || !fotoFile}>Upload</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dokRow !== null} onOpenChange={(o) => { if (!o) setDokRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumen: {dokRow?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">
              Checklist dokumen santri; tandai "tidak memiliki" bila memang tidak ada.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto rounded-md border">
            {dokListLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Memuat…</p>
            ) : dokRows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Belum ada checklist dokumen. Upload di bawah untuk menambah.</p>
            ) : (
              <ul className="divide-y">
                {dokRows.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.jenis_dokumen_santri}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.tidak_memiliki
                          ? 'Ditandai tidak memiliki'
                          : d.path_file
                            ? `Terupload · verifikasi: ${d.status_verifikasi}`
                            : 'Belum ada file'}
                        {d.catatan ? ` · ${d.catatan}` : ''}
                      </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--accent)]"
                        checked={d.tidak_memiliki}
                        onChange={(e) => void onToggleTidakMemiliki(d, e.target.checked)}
                      />
                      Tidak memiliki
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form id="form_dokumen_santri" onSubmit={onUploadDokumen} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_jenis_dokumen">Jenis dokumen</FieldLabel>
                <Select value={dokJenis} onValueChange={setDokJenis}>
                  <SelectTrigger id="select_jenis_dokumen" className="w-full">
                    <SelectValue placeholder="Pilih jenis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {jenisDokumen.map((r) => (
                        <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                          {String(r.nama ?? r.label ?? r.kode)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_file_dokumen">File (jpg/png/pdf, maks 5 MB)</FieldLabel>
                <Input
                  id="input_file_dokumen"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setDokFile(e.target.files?.[0] ?? null)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_catatan_dokumen">Catatan (opsional)</FieldLabel>
                <Input id="input_catatan_dokumen" value={dokCatatan} onChange={(e) => setDokCatatan(e.target.value)} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDokRow(null)}>Batal</Button>
              <Button id="btn_upload_dokumen" type="submit" disabled={busy || !dokFile || !dokJenis}>Upload</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
