import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  daftarUlangCalon,
  batalkanFaseCalon,
  undurDiriCalon,
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
  listAntrean,
  listDokumenCalon,
  listGelombangPsb,
  promosiCalon,
  pulihkanCalon,
  verifikasiCalon,
  type BulkHasil,
  type PsbCalon,
  type PsbGelombang,
} from '../api/psb';
import { listLembaga, type Lembaga, type Paginate } from '../api/master';
import type { DokumenSantri } from '../api/santri';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable from '@/components/ExcelTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
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
import {
  BISA_BATAL,
  BISA_UNDUR,
  TAHAP_PSB,
  psbFields,
  psbGridValues,
  type BulkAksi,
} from '@/components/psb/bersama';
import {
  DialogAccSantri,
  DialogBatalkanFase,
  DialogDaftarUlangSeleksi,
  DialogUndurDiri,
} from '@/components/psb/dialogAksi';
import { DialogBulkHasil, DialogBulkKonfirmasi } from '@/components/psb/dialogBulk';
import { DialogDokumenCalon, DialogTambahPendaftar } from '@/components/psb/dialogTambahDanDokumen';
import { DialogImportPsb } from '@/components/psb/dialogImport';

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
  const { jenjangs } = useFilterGlobalAktif();
  const targetJenjang = targetTunggal(jenjangs);
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
        jenjang: jenjangs,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,

        terhapus: tampilTerhapus || undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      }).then((r) => ({ ...r.data, badge: r.badge }));
    },
    deps: [stage, subStatus, jenjangs, tampilTerhapus],
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

  const [tambahOpen, setTambahOpen] = useState(false);
  const [tf, setTf] = useState({
    gelombang: '', lembaga: '', tipe: 'non_asrama' as 'asrama' | 'non_asrama',
    nik: '', nama: '', jk: '', tglLahir: '', email: '', telp: '',
    ayah: '', ibu: '', pindahan: false, tingkat: '',
  });

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
    setTf({
      gelombang: '', lembaga: '', tipe: 'non_asrama',
      nik: '', nama: '', jk: '', tglLahir: '',
      email: '', telp: '', ayah: '', ibu: '',
      pindahan: false, tingkat: '',
    });
  }

  async function onCreateCalon(e: React.FormEvent) {
    e.preventDefault();
    if (!tf.gelombang || !tf.lembaga) return;
    setBusy(true);
    setErr('');
    try {
      const res = await createCalonPsb({
        gelombang_id: Number(tf.gelombang),
        jenjang: tf.lembaga,
        tipe_santri: tf.tipe,
        nik: tf.nik.trim(),
        nama_lengkap: tf.nama.trim(),
        jk: tf.jk === '' ? undefined : (tf.jk as 'L' | 'P'),
        tgl_lahir: tf.tglLahir || undefined,
        email_ortu: tf.email.trim() || undefined,
        telp_ortu: tf.telp.trim() || undefined,
        nama_ayah: tf.ayah.trim() || undefined,
        nama_ibu: tf.ibu.trim() || undefined,
        is_pindahan: tf.pindahan || undefined,
        masuk_tingkat: tf.pindahan && tf.tingkat ? tf.tingkat : undefined,
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
     if (!targetJenjang) {
       throw new Error('Pilih satu lembaga di TopBar untuk mode Input.');
     }
     if (!f.gelombang) {

      throw new Error('Gelombang wajib diisi.');
    }
    await createCalonPsb({
      gelombang_id: Number(f.gelombang),
       jenjang: targetJenjang,

      tipe_santri: f.tipe === 'asrama' ? 'asrama' : 'non_asrama',
      nik: (f.nik ?? '').trim(),
      nama_lengkap: (f.nama ?? '').trim(),
    });
    toast.success('Pendaftar dibuat.');
    await load(1);
   }, [targetJenjang, load]);


  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => x.jenjang === targetJenjang);
    return l?.jenjang ?? l?.nama ?? '';
   }, [lembagas, targetJenjang]);


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
        addButton={stage === 'pendaftar' && canTambahPsb ? (
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
        ) : undefined}
        filter={(
          <>
            {stage === 'pendaftar' && (
              <FilterField label="Status pendaftar" htmlFor="select_substatus_pendaftar">
              <Select
                value={subStatus === '' ? '_semua' : subStatus}
                onValueChange={(v) => { setSubStatus(v); pager.goFirst(); }}
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

      <DialogDaftarUlangSeleksi
        calon={seleksiRow}
        lolos={seleksiLolos}
        catatan={seleksiCatatan}
        busy={busy}
        onLolos={setSeleksiLolos}
        onCatatan={setSeleksiCatatan}
        onClose={() => setSeleksiRow(null)}
        onSubmit={onMasukDaftarUlang}
      />

      <DialogBatalkanFase
        calon={batalRow}
        catatan={batalCatatan}
        busy={busy}
        onCatatan={setBatalCatatan}
        onClose={() => setBatalRow(null)}
        onSubmit={onBatalkanFase}
      />

      <DialogUndurDiri
        calon={undurRow}
        catatan={undurCatatan}
        busy={busy}
        err={err}
        onCatatan={setUndurCatatan}
        onClose={() => { setUndurRow(null); setErr(''); }}
        onSubmit={onUndurDiri}
      />

      <DialogAccSantri
        rows={accRows}
        nis={accNis}
        proses={accProses}
        onNis={(id, v) => setAccNis((prev) => ({ ...prev, [String(id)]: v }))}
        onClose={() => setAccRows(null)}
        onSubmit={() => void jalankanAcc()}
      />

      <DialogBulkKonfirmasi
        aksi={bulkAksi}
        ids={bulkIds}
        lolos={bulkLolos}
        catatan={bulkCatatan}
        butuhSeleksi={bulkButuhSeleksi}
        proses={bulkProses}
        onLolos={setBulkLolos}
        onCatatan={setBulkCatatan}
        onClose={() => setBulkAksi(null)}
        onProses={() => void jalankanBulk()}
      />

      <DialogBulkHasil hasil={bulkHasil} onClose={() => setBulkHasil(null)} />

      <DialogDokumenCalon
        calon={dokRow}
        dokumen={dokumen}
        onClose={() => setDokRow(null)}
      />

      <DialogImportPsb
        open={importOpen}
        gelombangs={gelombangs}
        lembagas={lembagas}
        gelombang={importGelombang}
        lembaga={importLembaga}
        onGelombang={setImportGelombang}
        onLembaga={setImportLembaga}
        onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportGelombang(''); setImportLembaga(''); } }}
        onSelesai={() => {
          setImportOpen(false);
          setImportGelombang('');
          setImportLembaga('');
          void load(1);
        }}
        onTemplate={onTemplate}
      />

      <DialogTambahPendaftar
        open={tambahOpen}
        gelombangs={gelombangs}
        lembagas={lembagas}
        busy={busy}
        f={tf}
        set={{
          gelombang: (v) => setTf((s) => ({ ...s, gelombang: v })),
          lembaga: (v) => setTf((s) => ({ ...s, lembaga: v })),
          tipe: (v) => setTf((s) => ({ ...s, tipe: v })),
          nik: (v) => setTf((s) => ({ ...s, nik: v })),
          nama: (v) => setTf((s) => ({ ...s, nama: v })),
          jk: (v) => setTf((s) => ({ ...s, jk: v })),
          tglLahir: (v) => setTf((s) => ({ ...s, tglLahir: v })),
          email: (v) => setTf((s) => ({ ...s, email: v })),
          telp: (v) => setTf((s) => ({ ...s, telp: v })),
          ayah: (v) => setTf((s) => ({ ...s, ayah: v })),
          ibu: (v) => setTf((s) => ({ ...s, ibu: v })),
          pindahan: (v) => setTf((s) => ({ ...s, pindahan: v })),
          tingkat: (v) => setTf((s) => ({ ...s, tingkat: v })),
        }}
        onClose={() => setTambahOpen(false)}
        onSubmit={onCreateCalon}
      />
        </TabsContent>
      </Tabs>
    </div>
  );
}
