import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { tanggal } from '../lib/tanggal';
import {
  accCalon,
  bulkAcc,
  bulkDaftarUlang,
  bulkHapus,
  bulkPulihkan,
  bulkBatalkanFase,
  bulkUndurDiri,
  bulkVerifikasi,
  createCalonPsb,
  downloadTemplatePsb,
  hapusCalon,
  importPsb,
  listAntrean,
  listDokumenCalon,
  listGelombangPsb,
  daftarUlangCalon,
  promosiCalon,
  pulihkanCalon,
  batalkanFaseCalon,
  undurDiriCalon,
  verifikasiCalon,
  verifikasiDokumen,
  type BulkHasil,
  type PsbCalon,
  type PsbGelombang,
} from '../api/psb';
import { listLembaga, type Lembaga, type Paginate } from '../api/master';
import type { DokumenSantri } from '../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelChoice, type ExcelField } from '@/components/ExcelTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FolderOpen,
  PlusCircle,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  UserCheck,
  UserX,
} from '@/icons';

// Tahapan timeline PSB → kumpulan status_pendaftaran (nilai enum di DB).
// Tiap tahap kini halamannya sendiri di bawah submenu Antrean.
export const TAHAP_PSB: { id: string; label: string; statuses: string[] }[] = [
  { id: 'pendaftar', label: 'Pendaftar', statuses: ['baru', 'waiting_list'] },
  { id: 'terdaftar', label: 'Terdaftar', statuses: ['terverifikasi'] },
  { id: 'daftar_ulang', label: 'Daftar Ulang', statuses: ['lolos', 'pemberkasan', 'ajukan_daftar_ulang'] },
  { id: 'diterima', label: 'Diterima', statuses: ['daftar_ulang'] },
  { id: 'mengundurkan_diri', label: 'Mengundurkan Diri', statuses: ['mengundurkan_diri'] },
  { id: 'ditolak', label: 'Ditolak', statuses: ['ditolak', 'tidak_lolos'] },
];

/** Definisi kolom grid PSB; pilihan gelombang mengikuti data (mode Input). */
function psbFields(gelombangChoices: ExcelChoice[]): ExcelField[] {
  return [
    { key: 'no', label: 'no_pendaftaran', width: 190, kind: 'static', sumber: { tabel: 'psb_calon_santri', kolom: 'no_pendaftaran' } },
    {
      key: 'nama', label: 'nama_lengkap', width: 200, kind: 'static',
      sumber: { tabel: 'psb_calon_santri', kolom: 'nama_lengkap' },
      inputKind: 'text', maxLength: 255, required: true,
    },
    {
      key: 'nik', label: 'nik', width: 160, kind: 'static',
      sumber: { tabel: 'psb_calon_santri', kolom: 'nik' },
      inputKind: 'text', maxLength: 16, required: true,
      validate: (v) => (!v || /^\d{16}$/.test(v.trim()) ? null : 'NIK harus 16 digit angka.'),
    },
    {
      key: 'tipe', label: 'tipe_santri', width: 110, kind: 'static',
      sumber: { tabel: 'psb_calon_santri', kolom: 'tipe_santri' },
      inputKind: 'select', required: true,
      inputChoices: [
        { value: 'asrama', label: 'asrama' },
        { value: 'non_asrama', label: 'non_asrama' },
      ],
    },
    { key: 'lembaga', label: 'lembaga.jenjang', width: 180, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
    {
      key: 'gelombang', label: 'psb_gelombang.nama', width: 140, kind: 'static',
      sumber: { tabel: 'psb_gelombang', kolom: 'nama' },
      inputKind: 'select', required: true, inputChoices: gelombangChoices,
    },
    { key: 'paket', label: 'Paket', width: 120, kind: 'static', sumber: null },
    { key: 'status', label: 'status_pendaftaran', width: 150, kind: 'static', sumber: { tabel: 'psb_calon_santri', kolom: 'status_pendaftaran' } },
    { key: 'daftar', label: 'tanggal_daftar', width: 110, kind: 'static', sumber: { tabel: 'psb_calon_santri', kolom: 'tanggal_daftar' } },
  ];
}

type BulkAksi = 'verifikasi' | 'daftar_ulang' | 'acc' | 'undur' | 'batal' | 'hapus' | 'pulihkan';

/** Fase yang boleh mengundurkan diri: terdaftar, daftar ulang, diterima. */
const BISA_UNDUR = ['terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'daftar_ulang'];

/** Fase yang bisa dibatalkan (kembali ke fase sebelumnya); fase diterima dikecualikan. */
const BISA_BATAL = ['terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'tidak_lolos', 'ditolak', 'mengundurkan_diri'];

/** Label tampilan kolom Status (nilai DB tetap snake_case). */
const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru',
  waiting_list: 'Waiting list',
  terverifikasi: 'Terverifikasi',
  lolos: 'Lolos',
  tidak_lolos: 'Tidak lolos',
  pemberkasan: 'Pemberkasan',
  ajukan_daftar_ulang: 'Ajukan daftar ulang',
  daftar_ulang: 'Daftar ulang',
  mengundurkan_diri: 'Mengundurkan diri',
  ditolak: 'Ditolak',
  terhapus: 'Terhapus',
};

function psbGridValues(c: PsbCalon): Record<string, string | null> {
  const detail = c.lembaga_detail ?? [];
  const kodeLembaga = detail.length > 0
    ? detail.map((d) => d.lembaga?.jenjang ?? String(d.jenjang)).join(' + ')
    : (c.lembaga_tujuan?.jenjang ?? String(c.jenjang));
  return {
    no: c.no_pendaftaran,
    nama: c.nama_lengkap,
    nik: c.nik,
    tipe: c.tipe_santri,
    lembaga: kodeLembaga,
    gelombang: c.gelombang?.nama ?? String(c.gelombang_id),
    paket: detail.length > 1 ? 'MI-MD' : null,
    status: c.deleted_at ? 'Terhapus' : (STATUS_LABEL[c.status_pendaftaran] ?? c.status_pendaftaran),
    daftar: tanggal(c.tanggal_daftar),
  };
}

// 100 PSB: antrean per tahapan timeline + verifikasi/seleksi/ACC/tolak/promosi + dokumen + import.
// Satu halaman dengan 6 tab tahap (rute memasok `tahap`; tab mengubah rute).
export default function PsbPage() {
  const navigate = useNavigate();
  const { tahap } = useParams<{ tahap?: string }>();
  const stage = useMemo(
    () => (TAHAP_PSB.some((t) => t.id === tahap) ? (tahap as string) : 'pendaftar'),
    [tahap],
  );
  /** Jumlah calon per status (dari respons antrean) untuk badge tab. */
  const [badge, setBadge] = useState<Record<string, number>>({});
  const { user: me } = useAuth();
  const canUbahPsb = bisa(me, 'psb.ubah');
  const canHapusPsb = bisa(me, 'psb.hapus');
  const canTambahPsb = bisa(me, 'psb.tambah');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [subStatus, setSubStatus] = useState('');
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const lembagaReqRef = useRef(0);
  const gelombangReqRef = useRef(0);
  const dokumenReqRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [tampilTerhapus, setTampilTerhapus] = useState(false);
  /** Pencarian tunggal halaman (topBar). */
  const [cari, setCari] = useState('');
  const {
    rows,
    loading,
    err,
    setErr,
    urut,
    arahUrut,
    terapkanUrut,
    load,
    lastPage,
    total,
    pager,
  } = useDaftarTabel<PsbCalon, Paginate<PsbCalon> & { badge?: Record<string, number> }>({
    tableKey: 'psb',
    search: cari,
    ambil: (a) => {
      const stageDef = TAHAP_PSB.find((x) => x.id === stage);
      let statuses = stageDef?.statuses ?? [];
      // Tahap Pendaftar dipisah: baru vs waiting_list.
      if (stage === 'pendaftar' && subStatus) statuses = [subStatus];
      return listAntrean({
        status: statuses.join(','),
        search: a.search || undefined,
        jenjang: jenjang ? jenjang : undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        terhapus: tampilTerhapus || undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      }).then((r) => ({ ...r.data, badge: r.badge }));
    },
    deps: [stage, subStatus, jenjang, tampilTerhapus],
    onData: (res) => setBadge(res.badge ?? {}),
  });

  const [seleksiRow, setSeleksiRow] = useState<PsbCalon | null>(null);
  const [seleksiLolos, setSeleksiLolos] = useState('lolos');
  const [seleksiCatatan, setSeleksiCatatan] = useState('');

  const [undurRow, setUndurRow] = useState<PsbCalon | null>(null);
  const [undurCatatan, setUndurCatatan] = useState('');

  const [batalRow, setBatalRow] = useState<PsbCalon | null>(null);
  const [batalCatatan, setBatalCatatan] = useState('');

  // ACC jadi santri: daftar calon + isian NIS opsional (tunggal maupun massal).
  const [accRows, setAccRows] = useState<PsbCalon[] | null>(null);
  const [accNis, setAccNis] = useState<Record<string, string>>({});
  const [accProses, setAccProses] = useState(false);

  const [bulkAksi, setBulkAksi] = useState<BulkAksi | null>(null);
  const [bulkIds, setBulkIds] = useState<number[]>([]);
  const [bulkLolos, setBulkLolos] = useState('lolos');
  const [bulkCatatan, setBulkCatatan] = useState('');
  const [bulkButuhSeleksi, setBulkButuhSeleksi] = useState(false);
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

  /** Kolom grid PSB dengan pilihan gelombang dinamis (mode Input). */
  const psbFieldsMemo = useMemo(
    () => psbFields(gelombangs.map((g) => ({ value: String(g.id), label: g.nama }))),
    [gelombangs],
  );

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
        jenjang: tfLembaga,
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

  async function onBatalkanFase(e: React.FormEvent) {
    e.preventDefault();
    if (!batalRow) return;
    setBusy(true);
    setErr('');
    try {
      const res = await batalkanFaseCalon(batalRow.id, batalCatatan || undefined);
      toast.success(res.pesan);
      setBatalRow(null);
      setBatalCatatan('');
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onUndurDiri(e: React.FormEvent) {
    e.preventDefault();
    if (!undurRow) return;
    setBusy(true);
    setErr('');
    try {
      const res = await undurDiriCalon(undurRow.id, undurCatatan || undefined);
      toast.success(res.pesan);
      setUndurRow(null);
      setUndurCatatan('');
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onMasukDaftarUlang(e: React.FormEvent) {
    e.preventDefault();
    if (!seleksiRow) return;
    setBusy(true);
    setErr('');
    try {
      const res = await daftarUlangCalon(seleksiRow.id, {
        lolos: seleksiLolos === 'lolos',
        catatan: seleksiCatatan || undefined,
      });
      toast.success(res.pesan);
      setSeleksiRow(null);
      setSeleksiCatatan('');
      await load();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || !importGelombang || !importLembaga) return;
    setBusy(true);
    setErr('');
    try {
      const res = await importPsb({
        gelombang_id: Number(importGelombang),
        jenjang: importLembaga,
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

  /** Mode Input (tahap pendaftar): daftarkan calon baru dari baris input. */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (!jenjang) {
      throw new Error('Pilih filter lembaga dulu untuk mode Input.');
    }
    if (!f.gelombang) {
      throw new Error('Gelombang wajib diisi.');
    }
    await createCalonPsb({
      gelombang_id: Number(f.gelombang),
      jenjang: jenjang,
      tipe_santri: f.tipe === 'asrama' ? 'asrama' : 'non_asrama',
      nik: (f.nik ?? '').trim(),
      nama_lengkap: (f.nama ?? '').trim(),
    });
    toast.success('Pendaftar dibuat.');
    await load(1);
  }, [jenjang, load]);

  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => x.jenjang === jenjang);
    return l?.jenjang ?? l?.nama ?? '';
  }, [lembagas, jenjang]);

  async function jalankanBulk() {
    if (!bulkAksi || bulkIds.length === 0) return;
    setBulkProses(true);
    setErr('');
    try {
      const res = bulkAksi === 'verifikasi'
        ? await bulkVerifikasi(bulkIds)
        : bulkAksi === 'daftar_ulang'
          ? await bulkDaftarUlang(
            bulkIds,
            bulkButuhSeleksi ? bulkLolos === 'lolos' : undefined,
            bulkCatatan || undefined,
          )
          : bulkAksi === 'undur'
              ? await bulkUndurDiri(bulkIds, bulkCatatan || undefined)
              : bulkAksi === 'batal'
                ? await bulkBatalkanFase(bulkIds, bulkCatatan || undefined)
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
    setBulkButuhSeleksi(ids.some((id) => rows.some((r) => r.id === id && r.butuh_seleksi)));
    setBulkHasil(null);
  }, [rows]);

  /** Buka dialog ACC jadi santri: daftar calon + isian NIS opsional per calon. */
  const bukaAcc = useCallback((list: PsbCalon[]) => {
    setAccRows(list);
    setAccNis({});
    setBulkHasil(null);
  }, []);

  async function jalankanAcc() {
    const list = accRows ?? [];
    if (list.length === 0) return;
    setAccProses(true);
    setErr('');
    try {
      if (list.length === 1) {
        const c = list[0];
        await accCalon(c.id, (accNis[String(c.id)] ?? '').trim() || undefined);
        toast.success('Daftar ulang disetujui (santri dibuat).');
      } else {
        const res = await bulkAcc(list.map((c) => c.id), accNis);
        setBulkHasil(res.data);
        if (res.data.gagal.length === 0) toast.success(res.pesan);
      }
      setAccRows(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setAccProses(false);
    }
  }

  const renderBulkActions = useCallback((checked: PsbCalon[], clear: () => void) => {
    const ids = checked.map((c) => c.id);
    const tombol = (label: string, id: string, aksi: BulkAksi, variant: 'default' | 'outline' | 'destructive', icon: React.ReactNode, idsOverride?: number[]) => (
      <Button id={id} size="sm" variant={variant} onClick={() => { bukaBulk(aksi, idsOverride ?? ids); clear(); }}>
        {icon}
        {label}
      </Button>
    );

    if (tampilTerhapus) {
      return canUbahPsb ? tombol('Pulihkan', 'btn_bulk_pulihkan_psb', 'pulihkan', 'outline', <RotateCcw size={14} />) : null;
    }
    if (!canUbahPsb && !canHapusPsb) return null;
    return (
      <>
        {canUbahPsb && stage === 'pendaftar' && tombol('Verifikasi', 'btn_bulk_verifikasi_psb', 'verifikasi', 'default', <CheckCircle2 size={14} />)}
        {canUbahPsb && stage === 'terdaftar'
          && tombol('Masuk daftar ulang', 'btn_bulk_daftar_ulang_psb', 'daftar_ulang', 'default', <ClipboardCheck size={14} />)}
        {canUbahPsb && stage === 'daftar_ulang' && checked.some((c) => c.status_pendaftaran === 'lolos')
          && tombol(
            'Masuk daftar ulang',
            'btn_bulk_daftar_ulang_psb',
            'daftar_ulang',
            'outline',
            <ClipboardCheck size={14} />,
            checked.filter((c) => c.status_pendaftaran === 'lolos').map((c) => c.id),
          )}
        {canUbahPsb && stage === 'daftar_ulang' && checked.some((c) => c.status_pendaftaran === 'pemberkasan' || c.status_pendaftaran === 'ajukan_daftar_ulang')
          && (
            <Button
              id="btn_bulk_acc_psb"
              size="sm"
              variant="default"
              onClick={() => {
                bukaAcc(checked.filter((c) => c.status_pendaftaran === 'pemberkasan' || c.status_pendaftaran === 'ajukan_daftar_ulang'));
                clear();
              }}
            >
              <BadgeCheck size={14} />
              ACC jadi santri
            </Button>
          )}
        {canUbahPsb && ['terdaftar', 'daftar_ulang', 'diterima'].includes(stage) && checked.some((c) => BISA_UNDUR.includes(c.status_pendaftaran))
          && tombol(
            'Mengundurkan Diri',
            'btn_bulk_undur_psb',
            'undur',
            'outline',
            <UserX size={14} />,
            checked.filter((c) => BISA_UNDUR.includes(c.status_pendaftaran)).map((c) => c.id),
          )}
        {canUbahPsb && checked.some((c) => BISA_BATAL.includes(c.status_pendaftaran))
          && tombol(
            'Batalkan',
            'btn_bulk_batal_fase_psb',
            'batal',
            'outline',
            <Undo2 size={14} />,
            checked.filter((c) => BISA_BATAL.includes(c.status_pendaftaran)).map((c) => c.id),
          )}
        {canHapusPsb && tombol('Hapus', 'btn_bulk_hapus_psb', 'hapus', 'destructive', <Trash2 size={14} />)}
      </>
    );
  }, [stage, tampilTerhapus, bukaBulk, bukaAcc, canUbahPsb, canHapusPsb]);

  const renderActions = useCallback((c: PsbCalon) => {
    if (c.deleted_at) {
      return canUbahPsb ? (
        <ActionIcon id={`btn_pulihkan_psb_${c.id}`} title="Pulihkan" onClick={() => run(() => pulihkanCalon(c.id), 'Calon dipulihkan.')}>
          <RotateCcw size={16} />
        </ActionIcon>
      ) : null;
    }
    return (
      <>
        {canUbahPsb && (
        <>
        {c.status_pendaftaran === 'baru' && (
          <ActionIcon id={`btn_verifikasi_psb_${c.id}`} title="Verifikasi" onClick={() => run(() => verifikasiCalon(c.id), 'Calon terverifikasi.')}>
            <CheckCircle2 size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran === 'terverifikasi' && (
          c.butuh_seleksi ? (
            <ActionIcon
              id={`btn_daftar_ulang_psb_${c.id}`}
              title="Masuk daftar ulang — konfirmasi hasil seleksi"
              onClick={() => { setSeleksiRow(c); setSeleksiLolos('lolos'); setSeleksiCatatan(''); }}
            >
              <ClipboardCheck size={16} />
            </ActionIcon>
          ) : (
            <ActionIcon
              id={`btn_daftar_ulang_langsung_psb_${c.id}`}
              title="Masuk daftar ulang"
              onClick={() => run(() => daftarUlangCalon(c.id), 'Calon masuk fase daftar ulang.')}
            >
              <ClipboardCheck size={16} />
            </ActionIcon>
          )
        )}
        {c.status_pendaftaran === 'lolos' && (
          <ActionIcon
            id={`btn_daftar_ulang_lolos_psb_${c.id}`}
            title="Masuk daftar ulang"
            onClick={() => run(() => daftarUlangCalon(c.id, { lolos: true }), 'Calon masuk fase daftar ulang.')}
          >
            <ClipboardCheck size={16} />
          </ActionIcon>
        )}
        {c.status_pendaftaran === 'waiting_list' && (
          <ActionIcon id={`btn_promosi_psb_${c.id}`} title="Promosi dari waiting list" onClick={() => run(() => promosiCalon(c.id), 'Calon dipromosikan.')}>
            <UserCheck size={16} />
          </ActionIcon>
        )}
        {(c.status_pendaftaran === 'pemberkasan' || c.status_pendaftaran === 'ajukan_daftar_ulang') && (
          <ActionIcon id={`btn_acc_psb_${c.id}`} title="ACC jadi santri" onClick={() => bukaAcc([c])}>
            <BadgeCheck size={16} />
          </ActionIcon>
        )}
        {BISA_UNDUR.includes(c.status_pendaftaran) && (
          <ActionIcon
            id={`btn_undur_psb_${c.id}`}
            title="Mengundurkan Diri"
            onClick={() => { setUndurRow(c); setUndurCatatan(''); setErr(''); }}
          >
            <UserX size={16} />
          </ActionIcon>
        )}
        {BISA_BATAL.includes(c.status_pendaftaran) && (
          <ActionIcon
            id={`btn_batal_fase_psb_${c.id}`}
            title="Batalkan"
            onClick={() => { setBatalRow(c); setBatalCatatan(''); }}
          >
            <Undo2 size={16} />
          </ActionIcon>
        )}
        </>
        )}
        {canHapusPsb && c.status_pendaftaran !== 'daftar_ulang' && (
          <DeleteAction
            id={`btn_hapus_psb_${c.id}`}
            title="Hapus calon?"
            description={`${c.nama_lengkap} akan dihapus (soft delete).`}
            onConfirm={() => run(() => hapusCalon(c.id), 'Calon dihapus.')}
          />
        )}
        <ActionIcon id={`btn_dokumen_psb_${c.id}`} title="Dokumen" onClick={() => openDokumen(c)}>
          <FolderOpen size={16} />
        </ActionIcon>
      </>
    );
  }, [run, openDokumen, bukaAcc, canUbahPsb, canHapusPsb]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari calon santri…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'psb', judul: 'Pendaftar', fields: psbFieldsMemo }]} />

      <Tabs value={stage} onValueChange={(v) => navigate(`/psb/${v}`)} className="contents">
        <TabsList id="tabs_psb" className="mb-2 h-auto w-fit gap-1 p-1">
          {TAHAP_PSB.map((t) => {
            const n = t.statuses.reduce((s, st) => s + (badge[st] ?? 0), 0);
            return (
              <TabsTrigger key={t.id} id={`tab_psb_${t.id}`} value={t.id} className="px-4 py-2">
                {t.label}
                {n > 0 && (
                  <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 text-[11px] tabular-nums">{n}</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={stage} className="contents">

      <ExcelTable
        tableKey="psb"
        fields={psbFieldsMemo}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText="Tidak ada calon pada tahap ini."
        canEdit={false}
        onCommit={onCommit}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCreateRow={stage === 'pendaftar' && canTambahPsb ? createRow : undefined}
        inputRowValues={{ lembaga: lembagaTerpilih }}
        filter={(
          <>
            {stage === 'pendaftar' && canTambahPsb && (
              <>
                <Button
                  id="btn_buka_tambah_pendaftar"
                  size="sm"
                  onClick={() => { resetTambah(); setTambahOpen(true); }}
                >
                  <PlusCircle data-icon="inline-start" size={16} /> Tambah
                </Button>
                <Button
                  id="btn_buka_import_psb"
                  size="sm"
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload data-icon="inline-start" size={16} /> Import
                </Button>
              </>
            )}
            {stage === 'pendaftar' && (
              <FilterField label="Status pendaftar" htmlFor="select_substatus_pendaftar">
              <Select
                value={subStatus === '' ? '_semua' : subStatus}
                onValueChange={(v) => { setSubStatus(v === '_semua' ? '' : v); pager.goFirst(); }}
              >
                <SelectTrigger id="select_substatus_pendaftar" title="Filter status pendaftar" aria-label="Filter status pendaftar" size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua</SelectItem>
                    <SelectItem value="baru">Baru</SelectItem>
                    <SelectItem value="waiting_list">Waiting list</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              </FilterField>
            )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Masuk daftar ulang: {seleksiRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>
              Lembaga ini memiliki tes/seleksi — tentukan hasilnya. Lolos = masuk fase daftar ulang; tidak lolos = ditolak.
            </DialogDescription>
          </DialogHeader>
          <form id="form_daftar_ulang_psb" onSubmit={onMasukDaftarUlang} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_hasil_seleksi">Hasil seleksi</FieldLabel>
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
            <FieldLabel htmlFor="input_catatan_seleksi">Catatan (opsional)</FieldLabel>
            <Input id="input_catatan_seleksi" value={seleksiCatatan} onChange={(e) => setSeleksiCatatan(e.target.value)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setSeleksiRow(null)}>Batal</Button>
              <Button id="btn_simpan_daftar_ulang_psb" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={batalRow !== null} onOpenChange={(o) => { if (!o) setBatalRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan fase: {batalRow?.nama_lengkap}</DialogTitle>
            <DialogDescription className="sr-only">
              Calon dikembalikan ke fase sebelumnya berdasarkan riwayat status.
            </DialogDescription>
          </DialogHeader>
          <form id="form_batal_fase_psb" onSubmit={onBatalkanFase} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_catatan_batal_fase">Catatan (opsional)</FieldLabel>
            <Input id="input_catatan_batal_fase" value={batalCatatan} onChange={(e) => setBatalCatatan(e.target.value)} maxLength={255} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setBatalRow(null)}>Tutup</Button>
              <Button id="btn_simpan_batal_fase_psb" type="submit" disabled={busy}>Batalkan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={undurRow !== null} onOpenChange={(o) => { if (!o) { setUndurRow(null); setErr(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pengunduran diri: {undurRow?.nama_lengkap}</DialogTitle>
            <DialogDescription>
              Calon dipindahkan ke fase Mengundurkan Diri / Ditolak. Catatan/alasan bersifat opsional.
            </DialogDescription>
          </DialogHeader>
          <form id="form_undur_diri_psb" onSubmit={onUndurDiri} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_catatan_undur">Catatan / alasan (opsional)</FieldLabel>
            <Input id="input_catatan_undur" value={undurCatatan} onChange={(e) => setUndurCatatan(e.target.value)} maxLength={255} />
            {err ? (
              <p id="error_undur_psb" className="col-span-2 text-sm text-destructive" role="alert">{err}</p>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setUndurRow(null)}>Batal</Button>
              <Button id="btn_simpan_undur_psb" type="submit" variant="destructive" disabled={busy}>Mengundurkan Diri</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accRows !== null} onOpenChange={(o) => { if (!o) setAccRows(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {accRows?.length === 1 ? `ACC jadi santri: ${accRows[0]?.nama_lengkap}` : 'ACC jadi santri (massal)'}
            </DialogTitle>
            <DialogDescription>
              Isi NIS bila sudah tersedia — boleh dikosongkan lalu diisi menyusul lewat import Excel.
              {accRows && accRows.length > 1 ? ` ${accRows.length} calon akan diproses.` : ''}
            </DialogDescription>
          </DialogHeader>
          <form id="form_acc_psb" onSubmit={(e) => { e.preventDefault(); void jalankanAcc(); }} className="flex flex-col gap-3">
            <ul className="max-h-72 divide-y overflow-auto rounded-md border">
              {(accRows ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-2 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nama_lengkap}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.no_pendaftaran ?? `#${c.id}`}</p>
                  </div>
                  <Input
                    id={`input_nis_acc_${c.id}`}
                    className="w-36"
                    maxLength={20}
                    placeholder="NIS (opsional)"
                    value={accNis[String(c.id)] ?? ''}
                    onChange={(e) => setAccNis((prev) => ({ ...prev, [String(c.id)]: e.target.value }))}
                  />
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccRows(null)}>Batal</Button>
              <Button id="btn_proses_acc_psb" type="submit" disabled={accProses}>
                {accProses ? 'Memproses…' : accRows && accRows.length > 1 ? `ACC ${accRows.length} calon` : 'ACC jadi santri'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAksi !== null} onOpenChange={(o) => { if (!o) setBulkAksi(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAksi === 'verifikasi' ? 'Verifikasi massal'
                : bulkAksi === 'daftar_ulang' ? 'Masuk daftar ulang massal'
                  : bulkAksi === 'acc' ? 'ACC daftar ulang massal'
                    : bulkAksi === 'undur' ? 'Pengunduran diri massal'
                      : bulkAksi === 'batal' ? 'Batalkan fase massal'
                        : bulkAksi === 'hapus' ? 'Hapus massal'
                          : 'Pulihkan massal'}
            </DialogTitle>
            <DialogDescription>
              {bulkIds.length} calon terpilih akan diproses.
              {bulkAksi === 'hapus' ? ' Calon dihapus (soft delete).' : ''}
              {bulkAksi === 'undur' ? ' Calon dipindahkan ke fase Mengundurkan Diri / Ditolak.' : ''}
              {bulkAksi === 'batal' ? ' Calon dikembalikan ke fase sebelumnya (fase diterima tidak bisa dibatalkan).' : ''}
              {bulkAksi === 'daftar_ulang' && bulkButuhSeleksi ? ' Sebagian lembaga memiliki seleksi — tentukan hasilnya.' : ''}
            </DialogDescription>
          </DialogHeader>
          {(bulkAksi === 'daftar_ulang' && bulkButuhSeleksi) || bulkAksi === 'undur' || bulkAksi === 'batal' ? (
            <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
              {bulkAksi === 'daftar_ulang' && bulkButuhSeleksi ? (
                <>
                  <FieldLabel htmlFor="select_bulk_hasil_seleksi">Hasil seleksi</FieldLabel>
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
                </>
              ) : null}
              <FieldLabel htmlFor="input_bulk_catatan_psb">Catatan (opsional)</FieldLabel>
              <Input id="input_bulk_catatan_psb" value={bulkCatatan} onChange={(e) => setBulkCatatan(e.target.value)} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkAksi(null)}>Batal</Button>
            <Button
              id="btn_proses_bulk_psb"
              variant={bulkAksi === 'hapus' || bulkAksi === 'undur' ? 'destructive' : 'default'}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import data PSB (Excel/CSV)</DialogTitle>
            <DialogDescription>
              Gelombang menentukan tahun ajaran calon. Pakai template agar nama kolom sesuai.
            </DialogDescription>
          </DialogHeader>
          <form id="form_import_psb" onSubmit={onImport} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <div className="col-span-2">
              <Button
                id="btn_template_psb"
                type="button"
                variant="outline"
                size="sm"
                onClick={onTemplate}
              >
                Unduh template Excel
              </Button>
            </div>
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
            <FieldLabel htmlFor="select_import_psb_lembaga">Lembaga tujuan</FieldLabel>
            <Select value={importLembaga} onValueChange={setImportLembaga}>
              <SelectTrigger id="select_import_psb_lembaga" className="w-full">
                <SelectValue placeholder="Pilih lembaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_file_psb">File (.xlsx/.xls/.csv, maks 5 MB)</FieldLabel>
            <Input
              id="input_file_psb"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              required
            />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button id="btn_import_psb" type="submit" disabled={busy || !importFile || !importGelombang || !importLembaga}>
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah pendaftar (input admin)</DialogTitle>
            <DialogDescription>
              Jalur manual tanpa pendaftaran publik. Kuota & dedup NIK tetap berlaku.
            </DialogDescription>
          </DialogHeader>
          <form id="form_tambah_pendaftar" onSubmit={onCreateCalon} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
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
            <FieldLabel htmlFor="select_lembaga_pendaftar">Lembaga tujuan</FieldLabel>
            <Select value={tfLembaga} onValueChange={setTfLembaga}>
              <SelectTrigger id="select_lembaga_pendaftar" className="w-full">
                <SelectValue placeholder="Pilih lembaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            <FieldLabel htmlFor="input_nama_pendaftar">Nama lengkap</FieldLabel>
            <Input id="input_nama_pendaftar" value={tfNama} onChange={(e) => setTfNama(e.target.value)} required maxLength={100} />
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
            <FieldLabel htmlFor="input_tgl_lahir_pendaftar">Tanggal lahir</FieldLabel>
            <Input id="input_tgl_lahir_pendaftar" type="date" value={tfTglLahir} onChange={(e) => setTfTglLahir(e.target.value)} />
            <FieldLabel htmlFor="input_email_ortu_pendaftar">Email orang tua</FieldLabel>
            <Input id="input_email_ortu_pendaftar" type="email" value={tfEmail} onChange={(e) => setTfEmail(e.target.value)} maxLength={100} />
            <FieldLabel htmlFor="input_telp_ortu_pendaftar">No. HP orang tua</FieldLabel>
            <Input id="input_telp_ortu_pendaftar" value={tfTelp} onChange={(e) => setTfTelp(e.target.value)} maxLength={20} />
            <FieldLabel htmlFor="input_ayah_pendaftar">Nama ayah</FieldLabel>
            <Input id="input_ayah_pendaftar" value={tfAyah} onChange={(e) => setTfAyah(e.target.value)} maxLength={100} />
            <FieldLabel htmlFor="input_ibu_pendaftar">Nama ibu</FieldLabel>
            <Input id="input_ibu_pendaftar" value={tfIbu} onChange={(e) => setTfIbu(e.target.value)} maxLength={100} />
            <FieldLabel htmlFor="check_pindahan_pendaftar">Pindahan</FieldLabel>
            <label htmlFor="check_pindahan_pendaftar" className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                id="check_pindahan_pendaftar"
                type="checkbox"
                checked={tfPindahan}
                onChange={(e) => setTfPindahan(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="text-muted-foreground">Bukan santri baru</span>
            </label>
            {tfPindahan && (
              <>
                <FieldLabel htmlFor="input_tingkat_pendaftar">Masuk tingkat</FieldLabel>
                <Input
                  id="input_tingkat_pendaftar"
                  value={tfTingkat}
                  onChange={(e) => setTfTingkat(e.target.value)}
                  maxLength={2}
                  placeholder="mis. 3"
                />
              </>
            )}
            <DialogFooter className="col-span-2">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
