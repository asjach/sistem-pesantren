import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createPsbGelombang,
  createPsbKegiatan,
  deleteKuotaBiaya,
  deletePsbGelombang,
  deletePsbKegiatan,
  getKuotaBiaya,
  listGelombangPsb,
  listLembagaPsb,
  listPsbKegiatan,
  upsertKuotaBiaya,
  updatePsbGelombang,
  updatePsbKegiatan,
  type KuotaBiayaInput,
  type PsbGelombangMaster,
  type PsbKegiatan,
  type PsbKuotaBiayaRow,
  type PsbLembagaOpsi,
} from '../api/psb';
import { listTahunAjaran, type TahunAjaran } from '../api/master';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable from '@/components/ExcelTable';
import { useLembagaAktif } from '@/lembagaAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { tanggal } from '../lib/tanggal';
import { toast } from 'sonner';
import { Plus } from '@/icons';
import {
  KEGIATAN_FIELDS,
  KUOTA_FIELDS,
  angka,
  parseAngka,
  nilaiSelect,
} from '@/components/psb/kegiatanBersama';
import {
  DialogGelombang,
  DialogKegiatan,
  DialogKuota,
} from '@/components/psb/kegiatanDialogs';

export default function KegiatanPsbPage() {
  const { user: me } = useAuth();
  /** Kelola kegiatan = admin pesantren EFEKTIF: super penuh, admin full, atau
   *  peran akar PST — mati untuk peran lembaga anak. */
  const { efektifSuper: isSuper } = useLembagaAktif();
  const isAdminFull = (me?.roles.some((r) => r.name === 'admin') ?? false) && (me?.lembagas?.length ?? 0) === 0;
  /** Admin pesantren (super_admin / admin tanpa batas lembaga): boleh kelola kegiatan & gelombang. */
  const isAdminPesantren = isSuper || isAdminFull;
  const lembagaAkses = me?.lembagas?.map((l) => l.jenjang) ?? [];
  const { jenjang: lembagaAktifId, terkunci } = useLembagaAktif();
  const [kegiatans, setKegiatans] = useState<PsbKegiatan[]>([]);
  const [tahunAjarans, setTahunAjarans] = useState<TahunAjaran[]>([]);
  const [kegiatanId, setKegiatanId] = useState<number | null>(null);
  const [gelombangs, setGelombangs] = useState<PsbGelombangMaster[]>([]);
  /** Pencarian tunggal halaman (topBar) untuk ketiga tabel. */
  const [cari, setCari] = useState('');
  const [gelombangId, setGelombangId] = useState<number | null>(null);
  const [lembagaOpsi, setLembagaOpsi] = useState<PsbLembagaOpsi[]>([]);
  const [kuotaRows, setKuotaRows] = useState<PsbKuotaBiayaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [kegOpen, setKegOpen] = useState(false);
  const [kegEdit, setKegEdit] = useState<PsbKegiatan | null>(null);
  const [kegNama, setKegNama] = useState('');
  const [kegTa, setKegTa] = useState('');
  const [kegAktif, setKegAktif] = useState(true);

  const [gelOpen, setGelOpen] = useState(false);
  const [gelEdit, setGelEdit] = useState<PsbGelombangMaster | null>(null);
  const [gelNama, setGelNama] = useState('');
  const [gelBuka, setGelBuka] = useState('');
  const [gelTutup, setGelTutup] = useState('');

  const [kuotaOpen, setKuotaOpen] = useState(false);
  const [kuotaEdit, setKuotaEdit] = useState<PsbKuotaBiayaRow | null>(null);
  const [qLembagas, setQLembagas] = useState<string[]>([]);
  const [qTipe, setQTipe] = useState<'semua' | 'asrama' | 'non_asrama'>('non_asrama');
  const [qKuota, setQKuota] = useState('');
  const [qPaketTersedia, setQPaketTersedia] = useState(false);
  const [qSeleksi, setQSeleksi] = useState('default');
  const [qPemberkasan, setQPemberkasan] = useState('ya');

  const kegiatan = useMemo(() => kegiatans.find((k) => k.id === kegiatanId) ?? null, [kegiatans, kegiatanId]);
  const gelombang = useMemo(() => gelombangs.find((g) => g.id === gelombangId) ?? null, [gelombangs, gelombangId]);
  const lembagaTampil = useMemo(
    () => (isAdminPesantren ? lembagaOpsi : lembagaOpsi.filter((l) => lembagaAkses.includes(l.jenjang))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdminPesantren, lembagaOpsi, me?.lembagas],
  );
  // Saat lembaga terkunci (bertindak sebagai lembaga / hanya 1 lembaga), seluruh
  // pilihan & daftar lembaga di halaman ini dibatasi ke lembaga aktif itu.
  const lembagaDialog = useMemo(
    () => (terkunci && lembagaAktifId != null
      ? lembagaTampil.filter((l) => l.jenjang === lembagaAktifId)
      : lembagaTampil),
    [terkunci, lembagaAktifId, lembagaTampil],
  );
  /** Nilai awal pemilih lembaga dialog ('' = belum ada / harus dipilih sendiri). */
  const lembagaAwalDialog = terkunci && lembagaDialog.length === 1 ? lembagaDialog[0].jenjang : '';

  const kuotaTampil = useMemo(() => {
    const dasar = isAdminPesantren ? kuotaRows : kuotaRows.filter((r) => lembagaAkses.includes(r.jenjang));
    return terkunci && lembagaAktifId != null
      ? dasar.filter((r) => r.jenjang === lembagaAktifId)
      : dasar;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminPesantren, kuotaRows, terkunci, lembagaAktifId, me?.lembagas]);

  const loadKegiatan = useCallback(async (pilihId?: number) => {
    const res = await listPsbKegiatan();
    setKegiatans(res.data);
    const target = pilihId ?? kegiatanId ?? res.data[0]?.id ?? null;
    setKegiatanId(target);
    return target;
  }, [kegiatanId]);

  const loadGelombang = useCallback(async (kid: number | null, pilihId?: number) => {
    if (!kid) {
      setGelombangs([]);
      setGelombangId(null);
      return null;
    }
    const res = await listGelombangPsb({ kegiatan_id: kid });
    setGelombangs(res.data as PsbGelombangMaster[]);
    const target = pilihId ?? res.data[0]?.id ?? null;
    setGelombangId(target);
    return target;
  }, []);

  const loadKuota = useCallback(async (gid: number | null) => {
    if (!gid) {
      setKuotaRows([]);
      return;
    }
    const res = await getKuotaBiaya(gid);
    setLembagaOpsi(res.data.lembaga);
    setKuotaRows(res.data.rows);
  }, []);

  /** Daftar lembaga PSB (tak terikat gelombang) — pengisi pemilih lembaga. */
  const loadLembaga = useCallback(async () => {
    const res = await listLembagaPsb();
    setLembagaOpsi(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const [kegId] = await Promise.all([
          loadKegiatan(),
          listTahunAjaran({ per_page: 100 }).then((r) => setTahunAjarans(r.data)),
          loadLembaga(),
        ]);
        if (kegId) {
          const gid = await loadGelombang(kegId);
          await loadKuota(gid);
        }
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pilihKegiatan(id: number) {
    setKegiatanId(id);
    try {
      const gid = await loadGelombang(id);
      await loadKuota(gid);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function pilihGelombang(id: number) {
    setGelombangId(id);
    try {
      await loadKuota(id);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function bukaKegiatan(k: PsbKegiatan | null) {
    setKegEdit(k);
    setKegNama(k?.nama ?? '');
    setKegTa(k ? k.tahun_ajaran : '');
    setKegAktif(k ? k.is_aktif : true);
    setKegOpen(true);
  }

  /** Pilih TA dulu; nama kegiatan otomatis memakai pola "PSB {tahun ajaran}". */
  function pilihTahunAjaran(v: string) {
    setKegTa(v);
    const ta = tahunAjarans.find((t) => t.nama === v);
    if (ta) setKegNama(`PSB ${ta.nama}`);
  }

  async function simpanKegiatan(e: React.FormEvent) {
    e.preventDefault();
    if (!kegNama.trim() || !kegTa) return;
    setBusy(true);
    setErr('');
    try {
      let targetId = kegEdit?.id ?? null;
      if (kegEdit) {
        await updatePsbKegiatan(kegEdit.id, { nama: kegNama.trim(), tahun_ajaran: kegTa, is_aktif: kegAktif });
        toast.success('Kegiatan PSB diubah.');
      } else {
        const res = await createPsbKegiatan({ nama: kegNama.trim(), tahun_ajaran: kegTa, is_aktif: kegAktif });
        targetId = res.data.id;
        toast.success('Kegiatan PSB dibuat.');
      }
      setKegOpen(false);
      const kid = await loadKegiatan(targetId ?? undefined);
      const gid = await loadGelombang(kid);
      await loadKuota(gid);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function hapusKegiatan(k: PsbKegiatan) {
    try {
      await deletePsbKegiatan(k.id);
      toast.success('Kegiatan PSB dihapus.');
      const kid = await loadKegiatan();
      const gid = await loadGelombang(kid);
      await loadKuota(gid);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function bukaGelombang(g: PsbGelombangMaster | null) {
    setGelEdit(g);
    setGelNama(g?.nama ?? '');
    setGelBuka(g?.tgl_buka ?? '');
    setGelTutup(g?.tgl_tutup ?? '');
    setGelOpen(true);
  }

  async function simpanGelombang(e: React.FormEvent) {
    e.preventDefault();
    if (!kegiatanId || !gelNama.trim() || !gelBuka || !gelTutup) return;
    setBusy(true);
    setErr('');
    try {
      let targetId = gelEdit?.id ?? null;
      if (gelEdit) {
        await updatePsbGelombang(gelEdit.id, { nama: gelNama.trim(), tgl_buka: gelBuka, tgl_tutup: gelTutup });
        toast.success('Gelombang diubah.');
      } else {
        const res = await createPsbGelombang({
          psb_kegiatan_id: kegiatanId,
          nama: gelNama.trim(),
          tgl_buka: gelBuka,
          tgl_tutup: gelTutup,
        });
        targetId = res.data.id;
        toast.success('Gelombang dibuat.');
      }
      setGelOpen(false);
      await loadGelombang(kegiatanId, targetId ?? undefined);
      await loadKuota(targetId);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function hapusGelombang(g: PsbGelombangMaster) {
    try {
      await deletePsbGelombang(g.id);
      toast.success('Gelombang dihapus.');
      const gid = await loadGelombang(kegiatanId);
      await loadKuota(gid);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function bukaKuota(row: PsbKuotaBiayaRow | null) {
    setKuotaEdit(row);
    setQLembagas(row ? [String(row.jenjang)] : (lembagaAwalDialog ? [lembagaAwalDialog] : []));
    setQTipe((row?.tipe_santri as 'semua' | 'asrama' | 'non_asrama') ?? 'non_asrama');
    setQKuota(row?.kuota !== null && row?.kuota !== undefined ? String(row.kuota) : '');
    setQPaketTersedia(row ? !!row.paket_tersedia : false);
    setQSeleksi(nilaiSelect(row?.membutuhkan_seleksi));
    setQPemberkasan(row ? (row.membutuhkan_pemberkasan ? 'ya' : 'tidak') : 'ya');
    setKuotaOpen(true);
  }

  async function simpanKuota(e: React.FormEvent) {
    e.preventDefault();
    if (!gelombangId || qLembagas.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      const dasar = {
        gelombang_id: gelombangId,
        tipe_santri: qTipe,
        kuota: qKuota === '' ? null : Number(qKuota),
        paket_tersedia: qPaketTersedia,
        membutuhkan_seleksi: qSeleksi === 'default' ? null : qSeleksi === 'ya',
        membutuhkan_pemberkasan: qPemberkasan === 'ya',
      };
      for (const jenjang of qLembagas) {
        await upsertKuotaBiaya({ ...dasar, jenjang: jenjang });
      }
      toast.success(
        qLembagas.length > 1
          ? `Kuota tersimpan untuk ${qLembagas.length} lembaga.`
          : 'Kuota tersimpan.',
      );
      setKuotaOpen(false);
      await loadKuota(gelombangId);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function hapusKuota(row: PsbKuotaBiayaRow) {
    try {
      await deleteKuotaBiaya(row.id);
      toast.success('Baris kuota dihapus.');
      await loadKuota(gelombangId);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const getGelombangValues = useCallback((g: PsbGelombangMaster) => ({
    nama: g.nama,
    nomor: String(g.nomor ?? '-'),
    periode: `${tanggal(g.tgl_buka)} — ${tanggal(g.tgl_tutup)}`,
  }), []);

  const getKuotaValues = useCallback((r: PsbKuotaBiayaRow) => {
    const l = lembagaOpsi.find((x) => x.jenjang === r.jenjang);
    return {
      lembaga: l?.jenjang ?? l?.nama ?? String(r.jenjang),
      tipe: r.tipe_santri,
      kuota: r.kuota === null || r.kuota === undefined ? '' : angka(r.kuota),
      paket: r.paket_tersedia ? 'ya' : 'tidak',
      seleksi: nilaiSelect(r.membutuhkan_seleksi),
      pemberkasan: r.membutuhkan_pemberkasan ? 'ya' : 'tidak',
    };
  }, [lembagaOpsi]);

  const taTersedia = useMemo(
    () => (kegEdit ? tahunAjarans : tahunAjarans.filter((t) => !kegiatans.some((k) => k.tahun_ajaran === t.nama))),
    [kegEdit, tahunAjarans, kegiatans],
  );

  const commitGelombang = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    const payload: { nama?: string } = {};
    if (f.nama !== undefined) payload.nama = (f.nama ?? '').trim();
    await updatePsbGelombang(Number(id), payload);
  }, []);

  const commitKuota = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    const row = kuotaRows.find((r) => String(r.id) === String(id));
    if (!row) return;
    const payload: KuotaBiayaInput = {
      gelombang_id: row.gelombang_id,
      jenjang: row.jenjang,
      tipe_santri: row.tipe_santri,
    };
    if (f.kuota !== undefined) payload.kuota = (f.kuota ?? '').trim() === '' ? null : parseAngka(f.kuota);
    if (f.paket !== undefined) payload.paket_tersedia = f.paket === 'ya';
    if (f.seleksi !== undefined) payload.membutuhkan_seleksi = f.seleksi === 'default' ? null : f.seleksi === 'ya';
    if (f.pemberkasan !== undefined) payload.membutuhkan_pemberkasan = f.pemberkasan === 'ya';
    await upsertKuotaBiaya(payload);
  }, [kuotaRows]);

  const reloadGelombang = useCallback(async () => {
    await loadGelombang(kegiatanId, gelombangId ?? undefined);
  }, [kegiatanId, gelombangId, loadGelombang]);

  const reloadKuota = useCallback(async () => {
    await loadKuota(gelombangId);
  }, [gelombangId, loadKuota]);

  /** Filter kedua tabel dengan pencarian tunggal topBar (sisi klien). */
  const q = cari.trim().toLowerCase();
  const cocok = (...vals: (string | number | null | undefined)[]) =>
    q === '' || vals.some((v) => String(v ?? '').toLowerCase().includes(q));
  const gelombangTampil = useMemo(
    () => gelombangs.filter((g) => cocok(g.nama, g.nomor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gelombangs, q],
  );
  const kuotaFilter = useMemo(
    () => kuotaTampil.filter((r) => cocok(r.jenjang, r.tipe_santri)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kuotaTampil, q],
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'kegiatan_psb_gelombang', judul: 'Gelombang', fields: KEGIATAN_FIELDS }, { key: 'kegiatan_psb_kuota', judul: 'Kuota', fields: KUOTA_FIELDS }]} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-64">
          <Select value={kegiatanId ? String(kegiatanId) : ''} onValueChange={(v) => void pilihKegiatan(Number(v))}>
            <SelectTrigger id="select_kegiatan_psb" className="w-full min-w-64">
              <SelectValue placeholder={loading ? 'Memuat…' : 'Pilih kegiatan'} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {kegiatans.map((k) => (
                  <SelectItem key={k.id} value={String(k.id)}>
                    {k.nama}{k.is_aktif ? ' (aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {isAdminPesantren && (
          <Button id="btn_tambah_kegiatan_psb" variant="outline" onClick={() => bukaKegiatan(null)}>
            <Plus size={16} /> Kegiatan
          </Button>
        )}
        {kegiatan && (
          <>
            {isAdminPesantren && (
              <>
                <Button id="btn_ubah_kegiatan_psb" variant="outline" onClick={() => bukaKegiatan(kegiatan)}>Ubah</Button>
                <DeleteAction
                  id="btn_hapus_kegiatan_psb"
                  title="Hapus kegiatan?"
                  description={`${kegiatan.nama} beserta gelombangnya akan dihapus (gagal bila sudah ada pendaftar).`}
                  onConfirm={() => hapusKegiatan(kegiatan)}
                />
              </>
            )}
            {kegiatan.is_aktif && <Badge>Aktif</Badge>}
          </>
        )}
      </div>

      {kegiatanId ? (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gelombang</h2>
          <ExcelTable
            tableKey="kegiatan_psb_gelombang"
            maxRows={3}
            fields={KEGIATAN_FIELDS}
            rows={gelombangTampil}
            getValues={getGelombangValues}
            loading={loading}
            emptyText="Belum ada gelombang di kegiatan ini."
            canEdit={isAdminPesantren}
            onCommit={commitGelombang}
            onSaved={reloadGelombang}
            addButton={isAdminPesantren ? (
              <Button id="btn_tambah_gelombang_psb" onClick={() => bukaGelombang(null)}>+ Gelombang</Button>
            ) : undefined}
            renderActions={(g) => (
              isAdminPesantren ? (
                <>
                  <EditAction id={`btn_ubah_gelombang_${g.id}`} onClick={() => bukaGelombang(g)} />
                  <DeleteAction
                    id={`btn_hapus_gelombang_${g.id}`}
                    title="Hapus gelombang?"
                    description={`${g.nama} akan dihapus (gagal bila sudah ada pendaftar).`}
                    onConfirm={() => hapusGelombang(g)}
                  />
                </>
              ) : null
            )}
          />

          <div className="mb-2 mt-6 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kuota pendaftaran</h2>
            <div className="min-w-56">
              <Select value={gelombangId ? String(gelombangId) : ''} onValueChange={(v) => void pilihGelombang(Number(v))}>
                <SelectTrigger id="select_gelombang_psb" className="w-full">
                  <SelectValue placeholder="Pilih gelombang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {gelombangs.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nomor}. {g.nama}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {gelombang && (
              <span className="text-xs text-muted-foreground">
                {tanggal(gelombang.tgl_buka)} — {tanggal(gelombang.tgl_tutup)}
              </span>
            )}
          </div>
          <ExcelTable
            tableKey="kegiatan_psb_kuota"
            maxRows={6}
            fields={KUOTA_FIELDS}
            rows={kuotaFilter}
            getValues={getKuotaValues}
            loading={loading}
            emptyText="Belum ada konfigurasi kuota di gelombang ini."
            canEdit={bisa(me, 'kegiatan_psb.tambah')}
            onCommit={commitKuota}
            onSaved={reloadKuota}
            addButton={bisa(me, 'kegiatan_psb.tambah') ? (
              <Button id="btn_tambah_kuota_psb" onClick={() => bukaKuota(null)} disabled={!gelombangId}>+ Baris</Button>
            ) : undefined}
            renderActions={(r) => (
              <>
                {bisa(me, 'kegiatan_psb.tambah') && <EditAction id={`btn_ubah_kuota_${r.id}`} onClick={() => bukaKuota(r)} />}
                {bisa(me, 'kegiatan_psb.hapus') && (
                <DeleteAction
                  id={`btn_hapus_kuota_${r.id}`}
                  title="Hapus baris?"
                  description="Konfigurasi kuota baris ini akan dihapus."
                  onConfirm={() => hapusKuota(r)}
                />
                )}
              </>
            )}
          />
        </>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">Belum ada kegiatan PSB. Tambahkan kegiatan terlebih dahulu.</p>
      )}

      <DialogKegiatan
        open={kegOpen}
        edit={kegEdit}
        taTersedia={taTersedia}
        nama={kegNama}
        ta={kegTa}
        aktif={kegAktif}
        busy={busy}
        onNama={setKegNama}
        onTa={pilihTahunAjaran}
        onAktif={setKegAktif}
        onClose={() => setKegOpen(false)}
        onSubmit={simpanKegiatan}
      />

      <DialogGelombang
        open={gelOpen}
        edit={gelEdit}
        nama={gelNama}
        buka={gelBuka}
        tutup={gelTutup}
        busy={busy}
        onNama={setGelNama}
        onBuka={setGelBuka}
        onTutup={setGelTutup}
        onClose={() => setGelOpen(false)}
        onSubmit={simpanGelombang}
      />

      <DialogKuota
        open={kuotaOpen}
        edit={kuotaEdit}
        terkunci={terkunci}
        lembagaOpsi={lembagaDialog}
        lembagas={qLembagas}
        tipe={qTipe}
        kuota={qKuota}
        paket={qPaketTersedia}
        seleksi={qSeleksi}
        pemberkasan={qPemberkasan}
        busy={busy}
        onLembagas={setQLembagas}
        onTipe={setQTipe}
        onKuota={setQKuota}
        onPaket={setQPaketTersedia}
        onSeleksi={setQSeleksi}
        onPemberkasan={setQPemberkasan}
        onClose={() => setKuotaOpen(false)}
        onSubmit={simpanKuota}
      />
    </div>
  );
}
