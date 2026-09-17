import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createKelas,
  deleteKelas,
  importNamaKelas,
  listKelas,
  listLembaga,
  listTahunAjaran,
  updateKelas,
  type ImportNamaHasil,
  type Kelas,
  type Lembaga,
  type TahunAjaran,
} from '../api/master';
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
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useLembagaAwalNumber } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalNumber } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ViewDialog } from '@/components/ViewDialog';
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
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { X } from '@/icons';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'Nama', width: 160, kind: 'text', maxLength: 50,
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama kelas wajib diisi.' : null),
  },
  { key: 'lembaga', label: 'Lembaga', width: 110, kind: 'static' },
  { key: 'ta', label: 'TA', width: 160, kind: 'static' },
  {
    key: 'tingkat', label: 'Tingkat', width: 120, kind: 'text', maxLength: 20,
  },
  {
    key: 'urutan', label: 'Urutan', width: 90, kind: 'text', maxLength: 6,
    validate: (v) => {
      if (v === null || v === undefined || v.trim() === '') return null;
      const n = Number(v);
      return !Number.isInteger(n) || n < 0 ? 'Urutan bilangan bulat ≥ 0.' : null;
    },
  },
  {
    key: 'kapasitas', label: 'Kapasitas', width: 120, kind: 'text', maxLength: 10,
    validate: (v) => {
      if (!v) return null;
      const n = Number(v);
      return !Number.isInteger(n) || n < 1 ? 'Kapasitas bilangan bulat ≥ 1.' : null;
    },
  },
];

/** Satu sub-form baris tambah kelas (nama wajib, tingkat + kapasitas opsional). */
interface BarisKelas {
  nama: string;
  tingkat: string;
  urutan: string;
  kapasitas: string;
}

function barisKelasKosong(): BarisKelas {
  return { nama: '', tingkat: '', urutan: '', kapasitas: '' };
}

/** Normalisasi nama untuk pembanding duplikat (samakan dengan backend). */
function normKelas(nama: string): string {
  return nama.trim().replace(/\s+/g, ' ').toLowerCase();
}

function gridValues(k: Kelas): Record<string, string | null> {  return {
    nama: k.nama_kelas,
    lembaga: k.lembaga?.kode ?? k.lembaga?.nama ?? String(k.lembaga_id),
    ta: k.tahunAjaran?.nama ?? k.tahun_ajaran?.nama ?? String(k.tahun_ajaran_id),
    tingkat: k.tingkat,
    urutan: String(k.urutan ?? 0),
    kapasitas: k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas),
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateKelas(id, {
    ...(f.nama !== undefined ? { nama_kelas: f.nama ?? '' } : {}),
    ...(f.tingkat !== undefined ? { tingkat: f.tingkat || null } : {}),
    ...(f.urutan !== undefined ? { urutan: f.urutan ? Number(f.urutan) : 0 } : {}),
    ...(f.kapasitas !== undefined
      ? { kapasitas: f.kapasitas ? Number(f.kapasitas) : null }
      : {}),
  });
}

export default function KelasPage() {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState<number | ''>('');
  useLembagaAwalNumber(setLembagaId);
  const [taId, setTaId] = useState<number | ''>('');
  useTahunAjaranAwalNumber(setTaId);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Kelas[]>([]);
  const pager = usePager('kelas');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);

  // Import nama kelas pasangan MI↔MD (pratinjau → eksekusi).
  const [imporOpen, setImporOpen] = useState(false);
  const [imporHasil, setImporHasil] = useState<ImportNamaHasil | null>(null);
  const [imporBusy, setImporBusy] = useState(false);

  /** Kode lembaga filter saat ini; tombol import hanya untuk MI/MD. */
  const kodeFilter = useMemo(() => {
    const l = lembagas.find((x) => String(x.id) === String(lembagaId));
    return l?.kode ?? null;
  }, [lembagas, lembagaId]);
  const dariKode = kodeFilter === 'MI' ? 'MD' : kodeFilter === 'MD' ? 'MI' : null;

  async function muatImpor(periksa: boolean) {
    if (lembagaId === '' || taId === '' || !dariKode) return;
    setImporBusy(true);
    try {
      const res = await importNamaKelas({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_id: Number(taId),
        dari_kode: dariKode,
        periksa,
      });
      setImporHasil(res);
      if (!periksa) {
        toast.success(res.pesan);
        await load(1);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setImporBusy(false);
    }
  }

  function bukaImpor() {
    setImporHasil(null);
    setImporOpen(true);
    void muatImpor(true);
  }

  // Pilihan lembaga + TA khusus dialog Tambah (mandiri dari filter toolbar).
  const [tambahLembagaId, setTambahLembagaId] = useState<number | ''>('');
  const [tambahTaId, setTambahTaId] = useState<number | ''>('');
  const [tambahTas, setTambahTas] = useState<TahunAjaran[]>([]);
  /** Lembaga pemilik `tambahTas` (agar tahu daftar mana yang sudah termuat). */
  const [tambahTasUntuk, setTambahTasUntuk] = useState<number | ''>('');
  const tambahTaReqRef = useRef(0);

  const [barisKelas, setBarisKelas] = useState<BarisKelas[]>([barisKelasKosong()]);
  const [tambahOpen, setTambahOpen] = useState(false);  const [viewRow, setViewRow] = useState<Kelas | null>(null);
  const [editRow, setEditRow] = useState<Kelas | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editTingkat, setEditTingkat] = useState('');
  const [editUrutan, setEditUrutan] = useState('');
  const [editKapasitas, setEditKapasitas] = useState('');
  /** Nama kelas yang sudah ada pada satu lingkup (lembaga+TA) — cek duplikat di klien. */
  const [namaTerpakai, setNamaTerpakai] = useState<{ kunci: string; nama: string[] }>({ kunci: '', nama: [] });

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listKelas({
          search: search || undefined,
          lembaga_id: lembagaId === '' ? undefined : Number(lembagaId),
          tahun_ajaran_id: taId === '' ? undefined : Number(taId),
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
    [search, lembagaId, taId, pager.page, pager.perPage, pager.sync],
  );

  useEffect(() => {
    // Muat SEMUA lembaga terdaftar (batas maks backend) agar opsi selalu
    // mencakup lembaga baru di masa depan, bukan hanya halaman pertama.
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (lembagaId === '') {
      setTas([]);
      return;
    }
    let alive = true;
    listTahunAjaran({ lembaga_id: Number(lembagaId) })
      .then((p) => { if (alive) setTas(p.data); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); });
    return () => { alive = false; };
  }, [lembagaId]);

  // Dialog Tambah: muat TA milik lembaga terpilih; **selalu** mengutamakan
  // tahun ajaran aktif (bila belum ada, pertahankan pilihan yang masih valid).
  useEffect(() => {
    const req = ++tambahTaReqRef.current;
    if (tambahLembagaId === '') {
      setTambahTas([]);
      setTambahTasUntuk('');
      return;
    }
    listTahunAjaran({ lembaga_id: Number(tambahLembagaId), per_page: 100 })
      .then((p) => {
        if (req !== tambahTaReqRef.current) return;
        setTambahTas(p.data);
        setTambahTasUntuk(Number(tambahLembagaId));
        setTambahTaId((prev) => {
          const aktif = p.data.find((t) => t.is_aktif);
          if (aktif) return aktif.id;
          if (prev !== '' && p.data.some((t) => String(t.id) === String(prev))) return prev;
          return p.data[0] ? p.data[0].id : '';
        });
      })
      .catch((e) => {
        if (req !== tambahTaReqRef.current) return;
        setTambahTas([]);
        setTambahTasUntuk('');
        setErr(errorMessage(e));
      });
  }, [tambahLembagaId]);

  // Admin terhubung 1 lembaga: pilihannya dikunci (pola SantriPage).
  const { user } = useAuth();
  const canUbahKelas = bisa(user, 'kelas.ubah');
  const canTambahKelas = bisa(user, 'kelas.tambah');
  const canHapusKelas = bisa(user, 'kelas.hapus');
  const singleLembagaId =
    user && !user.roles.some((r) => r.name === 'super_admin') && (user.lembagas?.length ?? 0) === 1
      ? user.lembagas![0].id
      : null;

  const bukaTambah = useCallback(() => {
    const targetLembaga = singleLembagaId ?? lembagaId;
    setTambahLembagaId(targetLembaga);
    // Nilai awal: tahun ajaran aktif lembaga tujuan. Daftar toolbar dipakai
    // sebagai cadangan saat daftar dialog belum termuat (efek pemuat mengoreksi).
    const daftar = tambahTasUntuk === Number(targetLembaga)
      ? tambahTas
      : (Number(targetLembaga) === Number(lembagaId) ? tas : []);
    const aktif = daftar.find((t) => t.is_aktif);
    setTambahTaId(aktif ? aktif.id : '');
    setBarisKelas([barisKelasKosong()]);
    setErr('');
    setTambahOpen(true);
  }, [singleLembagaId, lembagaId, tambahTas, tambahTasUntuk, tas]);

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, search, lembagaId, taId]);

  const openEdit = useCallback((k: Kelas) => {
    setEditRow(k);
    setEditNama(k.nama_kelas);
    setEditTingkat(k.tingkat ?? '');
    setEditUrutan(String(k.urutan ?? 0));
    setEditKapasitas(k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas));
  }, []);

  const ubahBaris = useCallback((i: number, kunci: keyof BarisKelas, nilai: string) => {
    setBarisKelas((prev) => prev.map((b, j) => (j === i ? { ...b, [kunci]: nilai } : b)));
  }, []);

  const tambahBaris = useCallback(() => {
    setBarisKelas((prev) => [...prev, barisKelasKosong()]);
  }, []);

  const hapusBaris = useCallback((i: number) => {
    setBarisKelas((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }, []);

  /** Muat nama kelas aktif lingkup (lembaga+TA) untuk cek duplikat di klien. */
  const muatNamaTerpakai = useCallback(async (lembaga: number | '', ta: number | '') => {
    if (lembaga === '' || ta === '') {
      setNamaTerpakai({ kunci: '', nama: [] });
      return;
    }
    const kunci = `${lembaga}:${ta}`;
    try {
      const res = await listKelas({ lembaga_id: Number(lembaga), tahun_ajaran_id: Number(ta), per_page: 1000 });
      setNamaTerpakai({ kunci, nama: res.data.map((k) => normKelas(k.nama_kelas)) });
    } catch {
      // Gagal memuat → biarkan validasi server (422) yang menjaga.
      setNamaTerpakai({ kunci, nama: [] });
    }
  }, []);

  useEffect(() => {
    if (!tambahOpen) return;
    void muatNamaTerpakai(singleLembagaId ?? tambahLembagaId, tambahTaId);
  }, [tambahOpen, singleLembagaId, tambahLembagaId, tambahTaId, muatNamaTerpakai]);

  useEffect(() => {
    if (!editRow) return;
    void muatNamaTerpakai(editRow.lembaga_id, editRow.tahun_ajaran_id);
  }, [editRow, muatNamaTerpakai]);

  const onCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const efektifLembagaId = singleLembagaId ?? tambahLembagaId;
    if (efektifLembagaId === '' || tambahTaId === '') {
      setErr('Lembaga + tahun ajaran wajib (kelas se-lembaga dengan TA).');
      return;
    }
    const terisi = barisKelas
      .map((b, i) => ({ ...b, baris: i + 1 }))
      .filter((b) => b.nama.trim() !== '' || b.tingkat.trim() !== '' || b.urutan.trim() !== '' || b.kapasitas.trim() !== '');
    if (terisi.length === 0) {
      setErr('Isi minimal 1 baris kelas (nama wajib).');
      return;
    }
    const kunciLingkup = `${Number(efektifLembagaId)}:${Number(tambahTaId)}`;
    const terpakai = namaTerpakai.kunci === kunciLingkup ? new Set(namaTerpakai.nama) : new Set<string>();
    const dalamPayload = new Set<string>();
    for (const b of terisi) {
      if (b.nama.trim() === '') {
        setErr(`Baris ${b.baris}: nama kelas wajib diisi.`);
        return;
      }
      const namaRapi = normKelas(b.nama);
      if (dalamPayload.has(namaRapi)) {
        setErr(`Baris ${b.baris}: nama kelas "${b.nama.trim()}" duplikat di daftar ini.`);
        return;
      }
      if (terpakai.has(namaRapi)) {
        setErr(`Baris ${b.baris}: kelas "${b.nama.trim()}" sudah ada di lembaga + tahun ajaran ini.`);
        return;
      }
      dalamPayload.add(namaRapi);
      if (b.urutan.trim() !== '') {
        const u = Number(b.urutan);
        if (!Number.isInteger(u) || u < 0) {
          setErr(`Baris ${b.baris}: urutan bilangan bulat ≥ 0.`);
          return;
        }
      }
      if (b.kapasitas.trim() !== '') {
        const n = Number(b.kapasitas);
        if (!Number.isInteger(n) || n < 1) {
          setErr(`Baris ${b.baris}: kapasitas bilangan bulat ≥ 1.`);
          return;
        }
      }
    }
    try {
      const dasar = { lembaga_id: Number(efektifLembagaId), tahun_ajaran_id: Number(tambahTaId) };
      if (terisi.length === 1) {
        const [satu] = terisi;
        await createKelas({
          ...dasar,
          nama_kelas: satu.nama.trim(),
          tingkat: satu.tingkat.trim() || undefined,
          urutan: satu.urutan.trim() ? Number(satu.urutan) : undefined,
          kapasitas: satu.kapasitas.trim() ? Number(satu.kapasitas) : undefined,
        });
        toast.success('Kelas dibuat.');
      } else {
        const res = await createKelas({
          ...dasar,
          items: terisi.map((b) => ({
            nama_kelas: b.nama.trim(),
            ...(b.tingkat.trim() ? { tingkat: b.tingkat.trim() } : {}),
            ...(b.urutan.trim() ? { urutan: Number(b.urutan) } : {}),
            ...(b.kapasitas.trim() ? { kapasitas: Number(b.kapasitas) } : {}),
          })),
        });
        const jumlah = Array.isArray((res as { data?: unknown }).data)
          ? (res as { data: unknown[] }).data.length
          : terisi.length;
        toast.success(`${jumlah} kelas dibuat.`);
      }
      setBarisKelas([barisKelasKosong()]);
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e2) {
      setErr(errorMessage(e2));
    }
  }, [singleLembagaId, tambahLembagaId, tambahTaId, barisKelas, load, pager.goFirst]);

  /** Mode Input: buat kelas baru dari baris input (butuh filter lembaga+TA). */
  const createRow = useCallback(async (f: Record<string, string | null>) => {
    if (lembagaId === '' || taId === '') {
      throw new Error('Pilih filter lembaga & tahun ajaran dulu untuk mode Input.');
    }
    await createKelas({
      lembaga_id: Number(lembagaId),
      tahun_ajaran_id: Number(taId),
      nama_kelas: (f.nama ?? '').trim(),
      tingkat: f.tingkat || undefined,
      urutan: f.urutan ? Number(f.urutan) : undefined,
      kapasitas: f.kapasitas ? Number(f.kapasitas) : undefined,
    });
    toast.success('Kelas dibuat.');
    await load(1);
  }, [lembagaId, taId, load]);

  const taTerpilih = useMemo(
    () => tas.find((t) => String(t.id) === String(taId))?.nama ?? '',
    [tas, taId],
  );

  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => String(x.id) === String(lembagaId));
    return l?.kode ?? l?.nama ?? '';
  }, [lembagas, lembagaId]);

  /** Row dialog Lihat: tampilkan nama/kode lembaga, sembunyikan lembaga_id mentah. */
  const viewRowTampil = useMemo(() => {
    if (!viewRow) return null;
    const { lembaga_id: _lembagaId, ...rest } = viewRow;
    return {
      ...rest,
      lembaga: viewRow.lembaga?.kode ?? viewRow.lembaga?.nama ?? String(_lembagaId),
    } as unknown as Record<string, unknown>;
  }, [viewRow]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    const namaRapi = normKelas(editNama);
    if (namaRapi === '') {
      setErr('Nama kelas wajib diisi.');
      return;
    }
    const kunciLingkup = `${editRow.lembaga_id}:${editRow.tahun_ajaran_id}`;
    if (
      namaTerpakai.kunci === kunciLingkup
      && namaTerpakai.nama.includes(namaRapi)
      && namaRapi !== normKelas(editRow.nama_kelas)
    ) {
      setErr(`Kelas "${editNama.trim()}" sudah ada di lembaga + tahun ajaran ini.`);
      return;
    }
    try {
      await updateKelas(editRow.id, {
        nama_kelas: editNama.trim(),
        tingkat: editTingkat || null,
        urutan: editUrutan ? Number(editUrutan) : 0,
        kapasitas: editKapasitas ? Number(editKapasitas) : null,
      });
      toast.success('Kelas diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [editRow, editNama, editTingkat, editUrutan, editKapasitas, namaTerpakai, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteKelas(id);
      toast.success('Kelas dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const onSearchChange = useCallback((v: string) => {
    setSearch(v);
    pager.goFirst();
  }, [pager.goFirst]);

  const onSearchSubmit = useCallback(() => {
    pager.goFirst();
  }, [pager.goFirst]);

  const onSaved = useCallback(() => load(), [load]);

  const renderActions = useCallback((k: Kelas) => (
    <>
      <ViewAction id={`btn_lihat_kelas_${k.id}`} onClick={() => setViewRow(k)} />
      {canUbahKelas && <EditAction id={`btn_ubah_kelas_${k.id}`} onClick={() => openEdit(k)} />}
      {canHapusKelas && (
      <DeleteAction
        id={`btn_hapus_kelas_${k.id}`}
        title="Hapus kelas?"
        description={`${k.nama_kelas} akan dihapus permanen.`}
        onConfirm={() => onDelete(k.id)}
      />
      )}
    </>
  ), [openEdit, onDelete, canUbahKelas, canHapusKelas]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable
        tableKey="kelas"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada kelas."
        canEdit={canUbahKelas}
        onCommit={commitDraft}
        onSaved={onSaved}
        onCreateRow={canTambahKelas ? createRow : undefined}
        inputRowValues={{ ta: taTerpilih, lembaga: lembagaTerpilih, urutan: '0' }}
        searchValue={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder="Nama kelas"
        addButton={canTambahKelas ? (
          <>
            {dariKode && (
              <Button id="btn_buka_import_nama_kelas" variant="outline" onClick={bukaImpor}>
                Import nama kelas dari {dariKode}
              </Button>
            )}
            <Button id="btn_buka_tambah_kelas" onClick={bukaTambah}>
              + Kelas
            </Button>
          </>
        ) : undefined}
        searchIds={{ form: 'form_filter_kelas', input: 'input_cari_kelas', button: 'btn_cari_kelas' }}
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
      <Dialog open={tambahOpen} onOpenChange={setTambahOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah kelas</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan kelas baru.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_kelas" onSubmit={onCreate} className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="select_tambah_lembaga_kelas">Lembaga</FieldLabel>
            {singleLembagaId !== null ? (
              <p className="text-sm text-muted-foreground">
                {lembagas.find((l) => l.id === singleLembagaId)?.kode
                  ?? lembagas.find((l) => l.id === singleLembagaId)?.nama
                  ?? `#${singleLembagaId}`} (otomatis)
              </p>
            ) : (
              <Select
                value={tambahLembagaId === '' ? '' : String(tambahLembagaId)}
                onValueChange={(v) => { setTambahLembagaId(Number(v)); setTambahTaId(''); }}
              >
                <SelectTrigger id="select_tambah_lembaga_kelas" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <FieldLabel htmlFor="select_tambah_ta_kelas" className="self-start pt-1.5">Tahun ajaran</FieldLabel>
            <div className="flex flex-col gap-1.5">
              <Select
                value={tambahTaId === '' ? '' : String(tambahTaId)}
                onValueChange={(v) => setTambahTaId(Number(v))}
                disabled={tambahLembagaId === ''}
              >
                <SelectTrigger id="select_tambah_ta_kelas" className="w-full">
                  <SelectValue placeholder={tambahLembagaId === '' ? 'Pilih lembaga dulu' : 'Pilih tahun ajaran'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {tambahTas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {tambahLembagaId !== '' && tambahTas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada tahun ajaran di lembaga ini.</p>
              ) : null}
            </div>
            <FieldLabel htmlFor="input_nama_kelas_0">Daftar kelas</FieldLabel>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_100px_80px_100px_32px] items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
                <span>Nama kelas</span>
                <span>Tingkat</span>
                <span>Urutan</span>
                <span>Kapasitas</span>
                <span />
              </div>
              {barisKelas.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_80px_100px_32px] items-center gap-2">
                  <Input
                    id={`input_nama_kelas_${i}`}
                    aria-label={`Nama kelas baris ${i + 1}`}
                    value={b.nama}
                    onChange={(e) => ubahBaris(i, 'nama', e.target.value)}
                    required={i === 0}
                    maxLength={50}
                  />
                  <Input
                    id={`input_tingkat_kelas_${i}`}
                    aria-label={`Tingkat baris ${i + 1}`}
                    value={b.tingkat}
                    onChange={(e) => ubahBaris(i, 'tingkat', e.target.value)}
                    maxLength={20}
                  />
                  <Input
                    id={`input_urutan_kelas_${i}`}
                    aria-label={`Urutan baris ${i + 1}`}
                    type="number"
                    min={0}
                    value={b.urutan}
                    onChange={(e) => ubahBaris(i, 'urutan', e.target.value)}
                  />
                  <Input
                    id={`input_kapasitas_kelas_${i}`}
                    aria-label={`Kapasitas baris ${i + 1}`}
                    type="number"
                    min={1}
                    value={b.kapasitas}
                    onChange={(e) => ubahBaris(i, 'kapasitas', e.target.value)}
                  />
                  <Button
                    id={`btn_hapus_baris_kelas_${i}`}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Hapus baris"
                    aria-label={`Hapus baris ${i + 1}`}
                    disabled={barisKelas.length <= 1}
                    onClick={() => hapusBaris(i)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
              <Button
                id="btn_tambah_baris_kelas"
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={tambahBaris}
              >
                + Tambah baris
              </Button>
            </div>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahOpen(false)}>Batal</Button>
              <Button
                id="btn_tambah_kelas"
                type="submit"
                disabled={(singleLembagaId ?? tambahLembagaId) === '' || tambahTaId === '' || !barisKelas.some((b) => b.nama.trim())}
              >
                Tambah
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ViewDialog
        open={viewRow !== null}
        onOpenChange={(o) => { if (!o) setViewRow(null); }}
        title={viewRow ? `Kelas: ${viewRow.nama_kelas}` : 'Kelas'}
        row={viewRowTampil}
      />
      {/* Import nama kelas pasangan MI↔MD */}
      <Dialog open={imporOpen} onOpenChange={setImporOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import nama kelas dari {dariKode}</DialogTitle>
            <DialogDescription>
              Menyalin nama + tingkat kelas. Nama yang sudah ada dilewati (tidak digandakan).
            </DialogDescription>
          </DialogHeader>
          {imporHasil ? (
            <div className="flex flex-col gap-3 text-sm" id="hasil_import_nama_kelas">
              <p className="font-medium">
                Sumber {imporHasil.sumber.kode} ({imporHasil.sumber.tahun_ajaran ?? '—'}): {imporHasil.ringkasan.sumber} kelas ·{' '}
                {imporHasil.ringkasan.dibuat} dibuat · {imporHasil.ringkasan.dilewati} dilewati
              </p>
              {imporHasil.rincian.length > 0 ? (
                <ul className="max-h-64 space-y-1.5 overflow-auto text-xs">
                  {imporHasil.rincian.slice(0, 100).map((r) => (
                    <li key={r.nama}>
                      {r.nama}{r.tingkat ? ` (tingkat ${r.tingkat})` : ''} —{' '}
                      {r.status === 'dibuat'
                        ? <span className="text-emerald-600">dibuat</span>
                        : <span className="text-muted-foreground">sudah ada, dilewati</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Tidak ada kelas di sumber.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{imporBusy ? 'Memuat pratinjau…' : '—'}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImporOpen(false)}>Tutup</Button>
            <Button
              id="btn_eksekusi_import_nama_kelas"
              disabled={imporBusy || !imporHasil?.periksa || (imporHasil?.ringkasan.dibuat ?? 0) === 0}
              onClick={() => void muatImpor(false)}
            >
              {imporBusy ? 'Memproses…' : `Eksekusi (${imporHasil?.ringkasan.dibuat ?? 0})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ubah kelas</DialogTitle>
            <DialogDescription className="sr-only">Formulir perubahan data kelas.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
            <FieldLabel htmlFor="input_ubah_nama_kelas">Nama kelas</FieldLabel>
            <Input id="input_ubah_nama_kelas" value={editNama} onChange={(e) => setEditNama(e.target.value)} required maxLength={50} />
            <FieldLabel htmlFor="input_ubah_tingkat_kelas">Tingkat (kamus, opsional)</FieldLabel>
            <Input id="input_ubah_tingkat_kelas" value={editTingkat} onChange={(e) => setEditTingkat(e.target.value)} />
            <FieldLabel htmlFor="input_ubah_urutan_kelas">Urutan tampil</FieldLabel>
            <Input id="input_ubah_urutan_kelas" type="number" min={0} value={editUrutan} onChange={(e) => setEditUrutan(e.target.value)} />
            <FieldLabel htmlFor="input_ubah_kapasitas_kelas">Kapasitas</FieldLabel>
            <Input id="input_ubah_kapasitas_kelas" type="number" min={1} value={editKapasitas} onChange={(e) => setEditKapasitas(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button id="btn_simpan_kelas" onClick={onUpdate}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
