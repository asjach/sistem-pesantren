import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createPsbGelombang,
  createPsbKegiatan,
  hapusDokumenWajib,
  deleteKuotaBiaya,
  deletePsbGelombang,
  deletePsbKegiatan,
  getKuotaBiaya,
  listDokumenWajib,
  listGelombangPsb,
  listLembagaPsb,
  listPsbKegiatan,
  simpanDokumenWajib,
  upsertKuotaBiaya,
  updatePsbGelombang,
  updatePsbKegiatan,
  type DokumenWajib,
  type KuotaBiayaInput,
  type PsbGelombangMaster,
  type PsbKegiatan,
  type PsbKuotaBiayaRow,
  type PsbLembagaOpsi,
} from '../api/psb';
import { listTahunAjaran, referensiList, type ReferensiRow, type TahunAjaran } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import MultiSelect from '@/components/MultiSelect';
import { useLembagaAktif } from '@/lembagaAktif';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteAction, EditAction } from '@/components/RowActions';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { tanggal } from '../lib/tanggal';
import { toast } from 'sonner';
import { Plus } from '@/icons';

function angkaInput(label: string) {
  return (v: string | null) => {
    const s = (v ?? '').trim();
    if (s === '') return null;
    return /^[0-9.]+$/.test(s) ? null : `${label} harus berupa angka.`;
  };
}

function angka(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  return new Intl.NumberFormat('id-ID').format(Number(v));
}

function parseAngka(s: string | null | undefined): number {
  const d = (s ?? '').replace(/\D/g, '');
  return d === '' ? 0 : Number(d);
}

const KEGIATAN_FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'nama', width: 220, kind: 'text', maxLength: 100,
    sumber: { tabel: 'psb_gelombang', kolom: 'nama' },
    validate: (v) => (!v || !v.trim() ? 'Nama gelombang wajib diisi.' : null),
  },
  { key: 'nomor', label: 'nomor', width: 80, kind: 'static', sumber: { tabel: 'psb_gelombang', kolom: 'nomor' } },
  { key: 'periode', label: 'Periode (tanggal lewat dialog Ubah)', width: 260, kind: 'static', sumber: null },
];

const KUOTA_FIELDS: ExcelField[] = [
  { key: 'lembaga', label: 'lembaga.jenjang', width: 180, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'tipe', label: 'tipe_santri', width: 110, kind: 'static', sumber: { tabel: 'psb_kuota_biaya', kolom: 'tipe_santri' } },
  { key: 'kuota', label: 'kuota', width: 130, kind: 'text', maxLength: 9, validate: angkaInput('Kuota'), sumber: { tabel: 'psb_kuota_biaya', kolom: 'kuota' } },
  {
    key: 'paket', label: 'paket_tersedia', width: 130, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'paket_tersedia' },
    choices: [
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
  {
    key: 'seleksi', label: 'membutuhkan_seleksi', width: 120, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'membutuhkan_seleksi' },
    choices: [
      { value: 'default', label: 'Ikut lembaga' },
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
  {
    key: 'pemberkasan', label: 'membutuhkan_pemberkasan', width: 120, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'membutuhkan_pemberkasan' },
    choices: [
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
];

const DOKUMEN_FIELDS: ExcelField[] = [
  { key: 'lembaga', label: 'lembaga.jenjang', width: 200, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'wajib', label: 'Dokumen wajib', width: 300, kind: 'static', sumber: null },
  { key: 'opsional', label: 'Dokumen opsional', width: 300, kind: 'static', sumber: null },
];

async function noopCommit() {}

function nilaiSelect(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return 'default';
  return v ? 'ya' : 'tidak';
}

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

  const [dokumenRows, setDokumenRows] = useState<DokumenWajib[]>([]);
  const [dokOpen, setDokOpen] = useState(false);
  const [dokLembagas, setDokLembagas] = useState<string[]>([]);
  const [dokJenis, setDokJenis] = useState('');
  const [dokJenisOpsi, setDokJenisOpsi] = useState<ReferensiRow[]>([]);
  const [dokSifat, setDokSifat] = useState<'wajib' | 'opsional'>('wajib');

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

  const loadDokumen = useCallback(async (kid: number | null) => {
    if (!kid) {
      setDokumenRows([]);
      return;
    }
    const res = await listDokumenWajib(kid);
    setDokumenRows(res.data);
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
          await loadDokumen(kegId);
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
      await loadDokumen(id);
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
      await loadDokumen(kid);
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
      await loadDokumen(kid);
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

  const dokumenGridRows = useMemo(() => {
    const peta = new Map<string, { id: string; lembaga: string; wajib: string[]; opsional: string[] }>();
    for (const d of dokumenRows) {
      if (!peta.has(d.jenjang)) {
        peta.set(d.jenjang, {
          id: d.jenjang,
          lembaga: d.lembaga?.jenjang ?? d.lembaga?.nama ?? lembagaTampil.find((l) => l.jenjang === d.jenjang)?.jenjang ?? lembagaTampil.find((l) => l.jenjang === d.jenjang)?.nama ?? String(d.jenjang),
          wajib: [],
          opsional: [],
        });
      }
      const grup = peta.get(d.jenjang)!;
      if (d.is_wajib) grup.wajib.push(d.jenis_dokumen_santri);
      else grup.opsional.push(d.jenis_dokumen_santri);
    }
    return [...peta.values()].sort((a, b) => a.lembaga.localeCompare(b.lembaga));
  }, [dokumenRows, lembagaTampil]);

  const getDokumenValues = useCallback(
    (d: { id: string; lembaga: string; wajib: string[]; opsional: string[] }) => ({
      lembaga: d.lembaga,
      wajib: d.wajib.join(', '),
      opsional: d.opsional.join(', '),
    }),
    [],
  );

  const reloadDokumen = useCallback(async () => {
    await loadDokumen(kegiatanId);
  }, [kegiatanId, loadDokumen]);

  async function hapusDokumenLembaga(row: { id: string; lembaga: string }) {
    try {
      const target = dokumenRows.filter((d) => d.jenjang === row.id);
      for (const d of target) await hapusDokumenWajib(d.id);
      toast.success(`Ketentuan dokumen ${row.lembaga} dihapus.`);
      await loadDokumen(kegiatanId);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  function bukaDokumen() {
    const awal = lembagaAwalDialog ? [lembagaAwalDialog] : [];
    setDokLembagas(awal);
    setDokJenis('');
    setDokJenisOpsi([]);
    setDokSifat('wajib');
    setDokOpen(true);
    // Lembaga sudah pasti (bertindak sebagai / satu lembaga) → langsung muat
    // pilihan jenis dokumennya tanpa perlu diklik dulu.
    if (awal.length) void pilihLembagaDokumen(awal);
  }

  async function pilihLembagaDokumen(v: string[]) {
    setDokLembagas(v);
    setDokJenis('');
    setDokJenisOpsi([]);
    if (v.length === 0) return;
    try {
      const hasil = await Promise.all(
        v.map((id) => referensiList('jenis_dokumen_santri', id)),
      );
      const gabung = new Map<string, ReferensiRow>();
      for (const list of hasil) {
        for (const r of list) {
          const nama = String(r.nama ?? r.kode);
          if (!gabung.has(nama)) gabung.set(nama, r);
        }
      }
      setDokJenisOpsi([...gabung.values()]);
    } catch {
      setDokJenisOpsi([]);
    }
  }

  async function simpanDokumenBaru(e: React.FormEvent) {
    e.preventDefault();
    if (!kegiatanId || dokLembagas.length === 0 || !dokJenis) return;
    setBusy(true);
    setErr('');
    try {
      for (const jenjang of dokLembagas) {
        await simpanDokumenWajib({
          psb_kegiatan_id: kegiatanId,
          jenjang: jenjang,
          jenis_dokumen_santri: dokJenis,
          is_wajib: dokSifat === 'wajib',
        });
      }
      toast.success(
        dokLembagas.length > 1
          ? `Ketentuan dokumen disimpan untuk ${dokLembagas.length} lembaga.`
          : 'Ketentuan dokumen disimpan.',
      );
      setDokOpen(false);
      await loadDokumen(kegiatanId);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

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
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dokumen per lembaga (berlaku kegiatan ini)
          </h2>
          <ExcelTable
            tableKey="kegiatan_psb_dokumen"
            maxRows={8}
            fields={DOKUMEN_FIELDS}
            rows={dokumenGridRows}
            getValues={getDokumenValues}
            loading={loading}
            emptyText="Belum ada ketentuan dokumen di kegiatan ini."
            canEdit={false}
            onCommit={noopCommit}
            onSaved={reloadDokumen}
            addButton={bisa(me, 'dokumen_wajib.tambah') ? (
              <Button id="btn_tambah_dokumen_psb" onClick={bukaDokumen} disabled={!kegiatanId}>+ Dokumen</Button>
            ) : undefined}
            renderActions={(r) => (
              bisa(me, 'dokumen_wajib.hapus') ? (
              <DeleteAction
                id={`btn_hapus_dokumen_psb_${r.id}`}
                title="Hapus ketentuan dokumen lembaga ini?"
                description={`Semua ketentuan dokumen ${r.lembaga} di kegiatan ini akan dihapus.`}
                onConfirm={() => hapusDokumenLembaga(r)}
              />
              ) : null
            )}
          />

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gelombang</h2>
          <ExcelTable
            tableKey="kegiatan_psb_gelombang"
            maxRows={3}
            fields={KEGIATAN_FIELDS}
            rows={gelombangs}
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
            rows={kuotaTampil}
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

      <Dialog open={kegOpen} onOpenChange={setKegOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{kegEdit ? 'Ubah kegiatan PSB' : 'Tambah kegiatan PSB'}</DialogTitle>
            <DialogDescription className="sr-only">Formulir kegiatan PSB.</DialogDescription>
          </DialogHeader>
          <form id="form_kegiatan_psb" onSubmit={simpanKegiatan} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_ta_kegiatan_psb" className="self-start pt-1.5">Tahun ajaran (pesantren)</FieldLabel>
            <div className="flex flex-col gap-1.5">
              <Select value={kegTa} onValueChange={pilihTahunAjaran} disabled={!!kegEdit}>
                <SelectTrigger id="select_ta_kegiatan_psb" className="w-full">
                  <SelectValue placeholder="Pilih tahun ajaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {taTersedia.map((t) => (
                      <SelectItem key={t.nama} value={t.nama}>{t.nama}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Satu tahun ajaran hanya untuk satu kegiatan PSB (se-pesantren).</p>
            </div>
            <FieldLabel htmlFor="input_nama_kegiatan_psb">Nama kegiatan (otomatis dari tahun ajaran)</FieldLabel>
            <Input id="input_nama_kegiatan_psb" value={kegNama} onChange={(e) => setKegNama(e.target.value)} required maxLength={100} placeholder="PSB 2026/2027" disabled={!kegTa} />
            <FieldLabel htmlFor="chk_aktif_kegiatan_psb">Aktif</FieldLabel>
            <label htmlFor="chk_aktif_kegiatan_psb" className="flex cursor-pointer items-center gap-2 text-sm">
              <input id="chk_aktif_kegiatan_psb" type="checkbox" checked={kegAktif} onChange={(e) => setKegAktif(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              <span className="text-muted-foreground">Jadikan kegiatan aktif (hanya satu kegiatan aktif)</span>
            </label>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setKegOpen(false)}>Batal</Button>
              <Button id="btn_simpan_kegiatan_psb" type="submit" disabled={busy || !kegTa}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={gelOpen} onOpenChange={setGelOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{gelEdit ? 'Ubah gelombang' : 'Tambah gelombang'}</DialogTitle>
            <DialogDescription className="sr-only">Formulir gelombang PSB.</DialogDescription>
          </DialogHeader>
          <form id="form_gelombang_psb" onSubmit={simpanGelombang} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_nama_gelombang_psb">Nama gelombang</FieldLabel>
            <Input id="input_nama_gelombang_psb" value={gelNama} onChange={(e) => setGelNama(e.target.value)} required maxLength={100} placeholder="Gelombang 1" />
            <FieldLabel htmlFor="input_buka_gelombang_psb">Tanggal buka</FieldLabel>
            <Input id="input_buka_gelombang_psb" type="date" value={gelBuka} onChange={(e) => setGelBuka(e.target.value)} required />
            <FieldLabel htmlFor="input_tutup_gelombang_psb">Tanggal tutup</FieldLabel>
            <Input id="input_tutup_gelombang_psb" type="date" value={gelTutup} onChange={(e) => setGelTutup(e.target.value)} required />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setGelOpen(false)}>Batal</Button>
              <Button id="btn_simpan_gelombang_psb" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={kuotaOpen} onOpenChange={setKuotaOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{kuotaEdit ? 'Ubah kuota' : 'Tambah kuota'}</DialogTitle>
            <DialogDescription className="sr-only">Formulir kuota per lembaga.</DialogDescription>
          </DialogHeader>
          <form id="form_kuota_psb" onSubmit={simpanKuota} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_lembaga_kuota">Lembaga (bisa pilih beberapa)</FieldLabel>
            <MultiSelect
              id="select_lembaga_kuota"
              title="Lembaga"
              values={qLembagas}
              onChange={setQLembagas}
              disabled={!!kuotaEdit || terkunci}
              placeholder="Pilih lembaga"
              options={lembagaDialog.map((l) => ({ value: l.jenjang, label: `${l.jenjang} — ${l.nama}` }))}
            />
            <FieldLabel htmlFor="select_tipe_kuota">Tipe santri</FieldLabel>
            <Select value={qTipe} onValueChange={(v) => setQTipe(v as 'semua' | 'asrama' | 'non_asrama')} disabled={!!kuotaEdit}>
              <SelectTrigger id="select_tipe_kuota" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="non_asrama">Non asrama</SelectItem>
                  <SelectItem value="asrama">Asrama</SelectItem>
                  <SelectItem value="semua">Semua</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="input_kuota_psb">Kuota pool (kosong = tanpa batas)</FieldLabel>
            <Input id="input_kuota_psb" type="number" min={0} value={qKuota} onChange={(e) => setQKuota(e.target.value)} placeholder="100" />
            <FieldLabel htmlFor="chk_paket_psb">Paket MI-MD</FieldLabel>
            <label htmlFor="chk_paket_psb" className="flex cursor-pointer items-center gap-2 text-sm">
              <input id="chk_paket_psb" type="checkbox" checked={qPaketTersedia} onChange={(e) => setQPaketTersedia(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              <span className="text-muted-foreground">Tawarkan paket MI-MD (baris primer MI)</span>
            </label>
            <FieldLabel htmlFor="select_seleksi_psb">Membutuhkan seleksi</FieldLabel>
            <Select value={qSeleksi} onValueChange={setQSeleksi}>
              <SelectTrigger id="select_seleksi_psb" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="default">Ikut lembaga</SelectItem>
                  <SelectItem value="ya">Ya</SelectItem>
                  <SelectItem value="tidak">Tidak</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="select_pemberkasan_psb">Membutuhkan pemberkasan</FieldLabel>
            <Select value={qPemberkasan} onValueChange={setQPemberkasan}>
              <SelectTrigger id="select_pemberkasan_psb" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ya">Ya</SelectItem>
                  <SelectItem value="tidak">Tidak</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setKuotaOpen(false)}>Batal</Button>
              <Button id="btn_simpan_kuota_psb" type="submit" disabled={busy}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dokOpen} onOpenChange={setDokOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah ketentuan dokumen</DialogTitle>
            <DialogDescription>Jenis dokumen diambil dari kamus aktif lembaga terpilih.</DialogDescription>
          </DialogHeader>
          <form id="form_dokumen_psb" onSubmit={simpanDokumenBaru} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_lembaga_dokumen_psb">Lembaga (bisa pilih beberapa)</FieldLabel>
            <MultiSelect
              id="select_lembaga_dokumen_psb"
              title="Lembaga"
              values={dokLembagas}
              onChange={(v) => void pilihLembagaDokumen(v)}
              placeholder="Pilih lembaga"
              disabled={terkunci}
              options={lembagaDialog.map((l) => ({ value: l.jenjang, label: `${l.jenjang} — ${l.nama}` }))}
            />
            <FieldLabel htmlFor="select_jenis_dokumen_psb">Jenis dokumen</FieldLabel>
            <Select value={dokJenis} onValueChange={setDokJenis} disabled={dokLembagas.length === 0}>
              <SelectTrigger id="select_jenis_dokumen_psb" className="w-full">
                <SelectValue placeholder={dokLembagas.length > 0 ? 'Pilih jenis' : 'Pilih lembaga dulu'} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {dokJenisOpsi.map((r) => (
                    <SelectItem key={r.id} value={String(r.nama ?? r.kode)}>
                      {String(r.nama ?? r.kode)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldLabel htmlFor="select_sifat_dokumen_psb">Sifat dokumen</FieldLabel>
            <Select value={dokSifat} onValueChange={(v) => setDokSifat(v as 'wajib' | 'opsional')}>
              <SelectTrigger id="select_sifat_dokumen_psb" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="wajib">Wajib</SelectItem>
                  <SelectItem value="opsional">Opsional</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setDokOpen(false)}>Batal</Button>
              <Button id="btn_simpan_dokumen_psb" type="submit" disabled={busy || dokLembagas.length === 0 || !dokJenis}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
