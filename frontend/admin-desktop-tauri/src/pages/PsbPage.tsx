import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  accCalon,
  bulkAcc,
  bulkHapus,
  bulkPulihkan,
  bulkSeleksi,
  bulkVerifikasi,
  createCalonPsb,
  downloadTemplatePsb,
  hapusCalon,
  importPsb,
  listAntrean,
  listDokumenCalon,
  listGelombangPsb,
  promosiCalon,
  pulihkanCalon,
  seleksiCalon,
  verifikasiCalon,
  verifikasiDokumen,
  type BulkHasil,
  type PsbCalon,
  type PsbGelombang,
} from '../api/psb';
import { listLembaga, type Lembaga } from '../api/master';
import type { DokumenSantri } from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  FolderOpen,
  Gavel,
  RotateCcw,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';

// Tahapan timeline PSB → kumpulan status_pendaftaran (nilai enum di DB).
const STAGES: { id: string; label: string; statuses: string[] }[] = [
  { id: 'pendaftar', label: 'Pendaftar', statuses: ['baru', 'waiting_list'] },
  { id: 'terdaftar', label: 'Terdaftar', statuses: ['terverifikasi'] },
  { id: 'tes', label: 'Tes Akademik', statuses: ['lolos'] },
  { id: 'daftar_ulang', label: 'Daftar Ulang', statuses: ['pemberkasan', 'ajukan_daftar_ulang'] },
  { id: 'diterima', label: 'Diterima', statuses: ['daftar_ulang'] },
  { id: 'ditolak', label: 'Mengundurkan Diri / Ditolak', statuses: ['ditolak', 'tidak_lolos'] },
];

const PSB_FIELDS: ExcelField[] = [
  { key: 'no', label: 'No. pendaftaran', width: 190, kind: 'static' },
  { key: 'nama', label: 'Nama', width: 200, kind: 'static' },
  { key: 'nik', label: 'NIK', width: 160, kind: 'static' },
  { key: 'tipe', label: 'Tipe', width: 110, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
  { key: 'gelombang', label: 'Gelombang', width: 140, kind: 'static' },
  { key: 'paket', label: 'Paket', width: 120, kind: 'static' },
  { key: 'status', label: 'Status', width: 150, kind: 'static' },
  { key: 'daftar', label: 'Tgl daftar', width: 110, kind: 'static' },
];

type BulkAksi = 'verifikasi' | 'seleksi' | 'acc' | 'hapus' | 'pulihkan';

function psbGridValues(c: PsbCalon): Record<string, string | null> {
  const detail = c.lembaga_detail ?? [];
  const namaLembaga = detail.length > 0
    ? detail.map((d) => d.lembaga?.nama ?? String(d.lembaga_id)).join(' + ')
    : (c.lembaga_tujuan?.nama ?? String(c.lembaga_id));
  return {
    no: c.no_pendaftaran,
    nama: c.nama_lengkap,
    nik: c.nik,
    tipe: c.tipe_santri,
    lembaga: namaLembaga,
    gelombang: c.gelombang?.nama ?? String(c.gelombang_id),
    paket: detail.length > 1 ? 'MI-MD' : null,
    status: c.deleted_at ? 'terhapus' : c.status_pendaftaran,
    daftar: c.tanggal_daftar,
  };
}

// 100 PSB: antrean per tahapan timeline + verifikasi/seleksi/ACC/tolak/promosi + dokumen + import.
export default function PsbPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [stage, setStage] = useState('daftar_ulang');
  const [subStatus, setSubStatus] = useState('');
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [lembagaId, setLembagaId] = useState('');
  const [rows, setRows] = useState<PsbCalon[]>([]);
  const pager = usePager('psb');
  const reqRef = useRef(0);
  const lembagaReqRef = useRef(0);
  const gelombangReqRef = useRef(0);
  const dokumenReqRef = useRef(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [seleksiRow, setSeleksiRow] = useState<PsbCalon | null>(null);
  const [seleksiLolos, setSeleksiLolos] = useState('lolos');
  const [seleksiCatatan, setSeleksiCatatan] = useState('');

  const [tampilTerhapus, setTampilTerhapus] = useState(false);
  const [bulkAksi, setBulkAksi] = useState<BulkAksi | null>(null);
  const [bulkIds, setBulkIds] = useState<number[]>([]);
  const [bulkLolos, setBulkLolos] = useState('lolos');
  const [bulkCatatan, setBulkCatatan] = useState('');
  const [bulkHasil, setBulkHasil] = useState<BulkHasil | null>(null);
  const [bulkProses, setBulkProses] = useState(false);

  const [dokRow, setDokRow] = useState<PsbCalon | null>(null);
  const [dokumen, setDokumen] = useState<DokumenSantri[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [gelombangs, setGelombangs] = useState<PsbGelombang[]>([]);
  const [importGelombang, setImportGelombang] = useState('');
  const [importLembaga, setImportLembaga] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const [tambahOpen, setTambahOpen] = useState(false);
  const [tfGelombang, setTfGelombang] = useState('');
  const [tfLembaga, setTfLembaga] = useState('');
  const [tfTipe, setTfTipe] = useState<'asrama' | 'non_asrama'>('non_asrama');
  const [tfNik, setTfNik] = useState('');
  const [tfNama, setTfNama] = useState('');
  const [tfJk, setTfJk] = useState('');
  const [tfTglLahir, setTfTglLahir] = useState('');
  const [tfEmail, setTfEmail] = useState('');
  const [tfTelp, setTfTelp] = useState('');
  const [tfAyah, setTfAyah] = useState('');
  const [tfIbu, setTfIbu] = useState('');
  const [tfPindahan, setTfPindahan] = useState(false);
  const [tfTingkat, setTfTingkat] = useState('');

  const getValues = useCallback(psbGridValues, []);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const stageDef = STAGES.find((s) => s.id === stage);
        let statuses = stageDef?.statuses ?? [];
        // Tahap Pendaftar dipisah: baru vs waiting_list.
        if (stage === 'pendaftar' && subStatus) statuses = [subStatus];
        const res = await listAntrean({
          status: statuses.join(','),
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
          terhapus: tampilTerhapus || undefined,
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.data.current_page, res.data.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data.data);
        setBadge(res.badge ?? {});
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, stage, subStatus, lembagaId, tampilTerhapus],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, stage, subStatus, lembagaId, tampilTerhapus]);

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
    const gelombangReq = ++gelombangReqRef.current;
    listGelombangPsb()
      .then((r) => {
        if (gelombangReq !== gelombangReqRef.current) return;
        setGelombangs(r.data);
      })
      .catch(() => {});
  }, []);

  function resetTambah() {
    setTfGelombang(''); setTfLembaga(''); setTfTipe('non_asrama');
    setTfNik(''); setTfNama(''); setTfJk(''); setTfTglLahir('');
    setTfEmail(''); setTfTelp(''); setTfAyah(''); setTfIbu('');
    setTfPindahan(false); setTfTingkat('');
  }

  async function onCreateCalon(e: React.FormEvent) {
    e.preventDefault();
    if (!tfGelombang || !tfLembaga) return;
    setBusy(true);
    setErr('');
    try {
      const res = await createCalonPsb({
        gelombang_id: Number(tfGelombang),
        lembaga_id: Number(tfLembaga),
        tipe_santri: tfTipe,
        nik: tfNik.trim(),
        nama_lengkap: tfNama.trim(),
        jk: tfJk === '' ? undefined : (tfJk as 'L' | 'P'),
        tgl_lahir: tfTglLahir || undefined,
        email_ortu: tfEmail.trim() || undefined,
        telp_ortu: tfTelp.trim() || undefined,
        nama_ayah: tfAyah.trim() || undefined,
        nama_ibu: tfIbu.trim() || undefined,
        is_pindahan: tfPindahan || undefined,
        masuk_tingkat: tfPindahan && tfTingkat ? tfTingkat : undefined,
      });
      toast.success(res.pesan ?? 'Pendaftar dibuat.');
      setTambahOpen(false);
      resetTambah();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  const run = useCallback(async (fn: () => Promise<{ pesan?: string }>, sukses: string) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      toast.success(sukses);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [load]);

  const openDokumen = useCallback(async (c: PsbCalon) => {
    const reqId = ++dokumenReqRef.current;
    setDokRow(c);
    setDokumen([]);
    try {
      const res = await listDokumenCalon(c.id);
      if (reqId !== dokumenReqRef.current) return;
      setDokumen(res.data);
    } catch (e) {
      if (reqId !== dokumenReqRef.current) return;
      setErr(errorMessage(e));
    }
  }, []);

  async function onSeleksi(e: React.FormEvent) {
    e.preventDefault();
    if (!seleksiRow) return;
    await run(
      () => seleksiCalon(seleksiRow.id, { lolos: seleksiLolos === 'lolos', catatan: seleksiCatatan || undefined }),
      'Hasil seleksi disimpan.',
    );
    setSeleksiRow(null);
    setSeleksiCatatan('');
  }

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importGelombang || !importLembaga) return;
    setBusy(true);
    setErr('');
    try {
      const res = await importPsb({
        gelombang_id: Number(importGelombang),
        lembaga_id: Number(importLembaga),
        file: importFile,
      });
      if (res.errors?.length) {
        setErr(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
      } else {
        toast.success(res.pesan ?? 'Import PSB selesai.');
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

  async function onTemplate() {
    setErr('');
    try {
      await downloadTemplatePsb();
      toast.success('Template diunduh.');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const onSaved = useCallback(() => load(), [load]);
  const onCommit = useCallback(async () => {}, []);

  async function jalankanBulk() {
    if (!bulkAksi || bulkIds.length === 0) return;
    setBulkProses(true);
    setErr('');
    try {
      const res = bulkAksi === 'verifikasi'
        ? await bulkVerifikasi(bulkIds)
        : bulkAksi === 'seleksi'
          ? await bulkSeleksi(bulkIds, bulkLolos === 'lolos', bulkCatatan || undefined)
          : bulkAksi === 'acc'
            ? await bulkAcc(bulkIds)
            : bulkAksi === 'hapus'
              ? await bulkHapus(bulkIds)
              : await bulkPulihkan(bulkIds);
      setBulkAksi(null);
      setBulkHasil(res.data);
      if (res.data.gagal.length === 0) toast.success(res.pesan);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBulkProses(false);
    }
  }

  const bukaBulk = useCallback((aksi: BulkAksi, ids: number[]) => {
    setBulkAksi(aksi);
    setBulkIds(ids);
    setBulkLolos('lolos');
    setBulkCatatan('');
    setBulkHasil(null);
  }, []);

  const renderBulkActions = useCallback((checked: PsbCalon[], clear: () => void) => {
    const ids = checked.map((c) => c.id);
    const tombol = (label: string, id: string, aksi: BulkAksi, variant: 'default' | 'outline' | 'destructive', icon: React.ReactNode) => (
      <Button id={id} size="sm" variant={variant} onClick={() => { bukaBulk(aksi, ids); clear(); }}>
        {icon}
        {label}
      </Button>
    );

    if (tampilTerhapus) {
      return tombol('Pulihkan', 'btn_bulk_pulihkan_psb', 'pulihkan', 'outline', <RotateCcw size={14} />);
    }
    return (
      <>
        {stage === 'pendaftar' && tombol('Verifikasi', 'btn_bulk_verifikasi_psb', 'verifikasi', 'default', <CheckCircle2 size={14} />)}
        {stage === 'terdaftar' && tombol('Seleksi', 'btn_bulk_seleksi_psb', 'seleksi', 'default', <Gavel size={14} />)}
        {stage === 'daftar_ulang' && tombol('ACC jadi santri', 'btn_bulk_acc_psb', 'acc', 'default', <BadgeCheck size={14} />)}
        {tombol('Hapus', 'btn_bulk_hapus_psb', 'hapus', 'destructive', <Trash2 size={14} />)}
      </>
    );
  }, [stage, tampilTerhapus, bukaBulk]);

  const renderActions = useCallback((c: PsbCalon) => {
    if (c.deleted_at) {
      return (
        <ActionIcon id={`btn_pulihkan_psb_${c.id}`} title="Pulihkan" onClick={() => run(() => pulihkanCalon(c.id), 'Calon dipulihkan.')}>
          <RotateCcw size={16} />
        </ActionIcon>
      );
    }
    return (
      <>
        {c.status_pendaftaran === 'baru' && (
          <ActionIcon id={`btn_verifikasi_psb_${c.id}`} title="Verifikasi" onClick={() => run(() => verifikasiCalon(c.id), 'Calon terverifikasi.')}>
            <CheckCircle2 size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran === 'terverifikasi' && (
          <ActionIcon id={`btn_seleksi_psb_${c.id}`} title="Seleksi" onClick={() => { setSeleksiRow(c); setSeleksiLolos('lolos'); }}>
            <Gavel size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran === 'waiting_list' && (
          <ActionIcon id={`btn_promosi_psb_${c.id}`} title="Promosi dari waiting list" onClick={() => run(() => promosiCalon(c.id), 'Calon dipromosikan.')}>
            <UserCheck size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran === 'ajukan_daftar_ulang' && (
          <ActionIcon id={`btn_acc_psb_${c.id}`} title="ACC daftar ulang" onClick={() => run(() => accCalon(c.id), 'Daftar ulang disetujui (santri dibuat).')}>
            <BadgeCheck size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran !== 'daftar_ulang' && (
          <DeleteAction
            id={`btn_hapus_psb_${c.id}`}
            title="Hapus calon?"
            description={`${c.nama_lengkap} akan dihapus (soft delete). Tagihan pendaftaran yang belum dibayar ikut dibatalkan.`}
            onConfirm={() => run(() => hapusCalon(c.id), 'Calon dihapus.')}
          />
        )}
        <ActionIcon id={`btn_dokumen_psb_${c.id}`} title="Dokumen" onClick={() => openDokumen(c)}>
          <FolderOpen size={16} />
        </ActionIcon>
      </>
    );
  }, [run, openDokumen]);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_psb" title="PSB — Antrean Pendaftaran" />
      <ErrorNotice>{err}</ErrorNotice>

      {/* Timeline tahapan (pengganti combobox status) */}
      <ol id="timeline_psb" className="mb-3 flex flex-wrap items-center gap-y-2">
        {STAGES.map((s, i) => {
          const aktif = s.id === stage;
          const jumlah = s.statuses.reduce((n, st) => n + (badge[st] ?? 0), 0);
          return (
            <li key={s.id} className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-2 h-px w-5 bg-border sm:w-8" />}
              <button
                id={`stage_psb_${s.id}`}
                type="button"
                aria-pressed={aktif}
                onClick={() => { setStage(s.id); setSubStatus(''); pager.goFirst(); }}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                  aktif
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span className="whitespace-nowrap">{i + 1}. {s.label}</span>
                <Badge variant={aktif ? 'default' : 'secondary'} className="px-1.5 text-[10px]">
                  {jumlah}
                </Badge>
              </button>
            </li>
          );
        })}
      </ol>

      <ExcelTable
        tableKey="psb"
        fields={PSB_FIELDS}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText="Tidak ada calon pada tahap ini."
        canEdit={false}
        onCommit={onCommit}
        onSaved={onSaved}
        filter={(
          <>
            {stage === 'pendaftar' && (
              <Select
                value={subStatus === '' ? '_semua' : subStatus}
                onValueChange={(v) => { setSubStatus(v === '_semua' ? '' : v); pager.goFirst(); }}
              >
                <SelectTrigger id="select_substatus_pendaftar" title="Filter status pendaftar" aria-label="Filter status pendaftar" size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua pendaftar</SelectItem>
                    <SelectItem value="baru">Baru</SelectItem>
                    <SelectItem value="waiting_list">Waiting list</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <Select value={lembagaId === '' ? '_semua' : lembagaId} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
              <SelectTrigger id="select_lembaga_psb" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_semua">Semua lembaga</SelectItem>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <label htmlFor="chk_tampil_terhapus_psb" className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                id="chk_tampil_terhapus_psb"
                type="checkbox"
                checked={tampilTerhapus}
                onChange={(e) => { setTampilTerhapus(e.target.checked); pager.goFirst(); }}
                className="size-3.5 accent-[var(--accent)]"
              />
              Tampilkan terhapus
            </label>
          </>
        )}
        addButton={stage === 'pendaftar' ? (
          <>
            <Button
              id="btn_buka_tambah_pendaftar"
              variant="outline"
              onClick={() => { resetTambah(); setTambahOpen(true); }}
            >
              + Pendaftar
            </Button>
            <Button id="btn_buka_import_psb" onClick={() => setImportOpen(true)}>
              <Upload data-icon="inline-start" size={16} /> Import
            </Button>
          </>
        ) : undefined}
        renderActions={renderActions}
        renderBulkActions={renderBulkActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />

      <Dialog open={seleksiRow !== null} onOpenChange={(o) => { if (!o) setSeleksiRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleksi: {seleksiRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>Gelombang jalur seleksi — hasil langsung lolos/tidak lolos.</DialogDescription>
          </DialogHeader>
          <form id="form_seleksi_psb" onSubmit={onSeleksi} className="flex flex-col gap-3">
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_hasil_seleksi">Hasil</FieldLabel>
                <Select value={seleksiLolos} onValueChange={setSeleksiLolos}>
                  <SelectTrigger id="select_hasil_seleksi" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="lolos">Lolos</SelectItem>
                      <SelectItem value="tidak_lolos">Tidak lolos</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_catatan_seleksi">Catatan (opsional)</FieldLabel>
                <Input id="input_catatan_seleksi" value={seleksiCatatan} onChange={(e) => setSeleksiCatatan(e.target.value)} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSeleksiRow(null)}>Batal</Button>
              <Button id="btn_simpan_seleksi" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAksi !== null} onOpenChange={(o) => { if (!o) setBulkAksi(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAksi === 'verifikasi' ? 'Verifikasi massal'
                : bulkAksi === 'seleksi' ? 'Seleksi massal'
                  : bulkAksi === 'acc' ? 'ACC daftar ulang massal'
                    : bulkAksi === 'hapus' ? 'Hapus massal'
                      : 'Pulihkan massal'}
            </DialogTitle>
            <DialogDescription>
              {bulkIds.length} calon terpilih akan diproses.
              {bulkAksi === 'hapus' ? ' Calon dihapus (soft delete) dan tagihan pendaftaran yang belum dibayar dibatalkan.' : ''}
            </DialogDescription>
          </DialogHeader>
          {bulkAksi === 'seleksi' ? (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_bulk_hasil_seleksi">Hasil</FieldLabel>
                <Select value={bulkLolos} onValueChange={setBulkLolos}>
                  <SelectTrigger id="select_bulk_hasil_seleksi" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="lolos">Lolos</SelectItem>
                      <SelectItem value="tidak_lolos">Tidak lolos</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_bulk_catatan_seleksi">Catatan (opsional)</FieldLabel>
                <Input id="input_bulk_catatan_seleksi" value={bulkCatatan} onChange={(e) => setBulkCatatan(e.target.value)} />
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkAksi(null)}>Batal</Button>
            <Button
              id="btn_proses_bulk_psb"
              variant={bulkAksi === 'hapus' ? 'destructive' : 'default'}
              disabled={bulkProses}
              onClick={() => void jalankanBulk()}
            >
              {bulkProses ? 'Memproses…' : `Proses ${bulkIds.length} calon`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkHasil !== null} onOpenChange={(o) => { if (!o) setBulkHasil(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hasil proses massal</DialogTitle>
            <DialogDescription>
              {bulkHasil?.berhasil.length ?? 0} berhasil · {bulkHasil?.gagal.length ?? 0} gagal
            </DialogDescription>
          </DialogHeader>
          {bulkHasil && bulkHasil.gagal.length > 0 ? (
            <ul className="max-h-64 divide-y overflow-auto rounded-md border text-sm">
              {bulkHasil.gagal.map((g) => (
                <li key={g.id} className="flex flex-col gap-0.5 p-2">
                  <span className="font-medium">
                    {g.nama_lengkap ?? `#${g.id}`}{g.no_pendaftaran ? ` · ${g.no_pendaftaran}` : ''}
                  </span>
                  <span className="text-xs text-destructive">{g.pesan}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Semua calon berhasil diproses.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkHasil(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dokRow !== null} onOpenChange={(o) => { if (!o) setDokRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokumen: {dokRow?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">
              Daftar dokumen calon beserta status verifikasi dan aksinya.
            </DialogDescription>
          </DialogHeader>
          {dokumen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dokumen diupload.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {dokumen.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                  <span className="font-medium">{d.jenis_dokumen_santri}</span>
                  <span className="text-muted-foreground">{d.status_verifikasi}</span>
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      id={`btn_dok_valid_${d.id}`}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => verifikasiDokumen(d.id, { status: 'valid' }), 'Dokumen divalidasi.')}
                    >
                      Valid
                    </Button>
                    <Button
                      id={`btn_dok_tolak_${d.id}`}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(() => verifikasiDokumen(d.id, { status: 'ditolak' }), 'Dokumen ditolak.')}
                    >
                      Tolak
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDokRow(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data PSB (Excel/CSV)</DialogTitle>
            <DialogDescription>
              Gelombang menentukan tahun ajaran calon. Pakai template agar nama kolom sesuai.
            </DialogDescription>
          </DialogHeader>
          <form id="form_import_psb" onSubmit={onImport} className="flex flex-col gap-3">
            <Button
              id="btn_template_psb"
              type="button"
              variant="outline"
              size="sm"
              onClick={onTemplate}
            >
              Unduh template Excel
            </Button>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="select_gelombang_psb">Gelombang</FieldLabel>
                <Select value={importGelombang} onValueChange={setImportGelombang}>
                  <SelectTrigger id="select_gelombang_psb" className="w-full">
                    <SelectValue placeholder="Pilih gelombang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {gelombangs.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.nama}{g.tahun_ajaran ? ` — ${g.tahun_ajaran.nama}` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="select_import_psb_lembaga">Lembaga tujuan</FieldLabel>
                <Select value={importLembaga} onValueChange={setImportLembaga}>
                  <SelectTrigger id="select_import_psb_lembaga" className="w-full">
                    <SelectValue placeholder="Pilih lembaga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_file_psb">File (.xlsx/.xls/.csv, maks 5 MB)</FieldLabel>
                <Input
                  id="input_file_psb"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_import_psb" type="submit" disabled={busy || !importFile || !importGelombang || !importLembaga}>
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah pendaftar (input admin)</DialogTitle>
            <DialogDescription>
              Jalur manual tanpa pendaftaran publik. Kuota & dedup NIK tetap berlaku.
            </DialogDescription>
          </DialogHeader>
          <form id="form_tambah_pendaftar" onSubmit={onCreateCalon} className="flex flex-col gap-3">
            <FieldGroup className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="select_gelombang_pendaftar">Gelombang</FieldLabel>
                <Select value={tfGelombang} onValueChange={setTfGelombang}>
                  <SelectTrigger id="select_gelombang_pendaftar" className="w-full">
                    <SelectValue placeholder="Pilih gelombang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {gelombangs.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.nama}{g.tahun_ajaran ? ` — ${g.tahun_ajaran.nama}` : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="select_lembaga_pendaftar">Lembaga tujuan</FieldLabel>
                <Select value={tfLembaga} onValueChange={setTfLembaga}>
                  <SelectTrigger id="select_lembaga_pendaftar" className="w-full">
                    <SelectValue placeholder="Pilih lembaga" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="select_tipe_pendaftar">Tipe santri</FieldLabel>
                <Select value={tfTipe} onValueChange={(v) => setTfTipe(v as 'asrama' | 'non_asrama')}>
                  <SelectTrigger id="select_tipe_pendaftar" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="non_asrama">Non asrama</SelectItem>
                      <SelectItem value="asrama">Asrama</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_nik_pendaftar">NIK (16 digit)</FieldLabel>
                <Input
                  id="input_nik_pendaftar"
                  value={tfNik}
                  onChange={(e) => setTfNik(e.target.value)}
                  inputMode="numeric"
                  minLength={16}
                  maxLength={16}
                  required
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="input_nama_pendaftar">Nama lengkap</FieldLabel>
                <Input id="input_nama_pendaftar" value={tfNama} onChange={(e) => setTfNama(e.target.value)} required maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="select_jk_pendaftar">Jenis kelamin</FieldLabel>
                <Select value={tfJk === '' ? '_kosong' : tfJk} onValueChange={(v) => setTfJk(v === '_kosong' ? '' : v)}>
                  <SelectTrigger id="select_jk_pendaftar" className="w-full">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="_kosong">-</SelectItem>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="input_tgl_lahir_pendaftar">Tanggal lahir</FieldLabel>
                <Input id="input_tgl_lahir_pendaftar" type="date" value={tfTglLahir} onChange={(e) => setTfTglLahir(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_email_ortu_pendaftar">Email orang tua</FieldLabel>
                <Input id="input_email_ortu_pendaftar" type="email" value={tfEmail} onChange={(e) => setTfEmail(e.target.value)} maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_telp_ortu_pendaftar">No. HP orang tua</FieldLabel>
                <Input id="input_telp_ortu_pendaftar" value={tfTelp} onChange={(e) => setTfTelp(e.target.value)} maxLength={20} />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_ayah_pendaftar">Nama ayah</FieldLabel>
                <Input id="input_ayah_pendaftar" value={tfAyah} onChange={(e) => setTfAyah(e.target.value)} maxLength={100} />
              </Field>
              <Field>
                <FieldLabel htmlFor="input_ibu_pendaftar">Nama ibu</FieldLabel>
                <Input id="input_ibu_pendaftar" value={tfIbu} onChange={(e) => setTfIbu(e.target.value)} maxLength={100} />
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="check_pindahan_pendaftar" className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  id="check_pindahan_pendaftar"
                  type="checkbox"
                  checked={tfPindahan}
                  onChange={(e) => setTfPindahan(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Pindahan (bukan santri baru)
              </label>
              {tfPindahan && (
                <Field className="flex-1">
                  <FieldLabel htmlFor="input_tingkat_pendaftar">Masuk tingkat</FieldLabel>
                  <Input
                    id="input_tingkat_pendaftar"
                    value={tfTingkat}
                    onChange={(e) => setTfTingkat(e.target.value)}
                    maxLength={2}
                    placeholder="mis. 3"
                  />
                </Field>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button
                id="btn_simpan_pendaftar"
                type="submit"
                disabled={busy || !tfGelombang || !tfLembaga || tfNik.trim().length !== 16 || !tfNama.trim()}
              >
                Simpan pendaftar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
