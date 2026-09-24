import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  createKelas,
  deleteKelas,
  importKelasFile,
  importNamaKelas,
  listKelas,
  listLembaga,
  listPegawaiAktif,
  listTahunAjaran,
  periksaImportKelas,
  unduhTemplateKelas,
  updateKelas,
  type ImportKelasHasil,
  type ImportNamaHasil,
  type Kelas,
  type Lembaga,
  type PegawaiAktif,
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
import { FilterMulti } from '@/components/FilterTingkatKelas';
import { TopBarFilter } from '@/components/TopBarFilter';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
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
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { X, FileUp, Download } from '@/icons';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { namaLembaga, namaTahunAjaran } from '@/lib/nilaiTampil';
import { toast } from 'sonner';

/** Opsi tingkat (tetap 1–12 seperti filter lama di header tabel). */
const TINGKAT_OPSI = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'nama_kelas', width: 160, kind: 'text', maxLength: 50,
    sumber: { tabel: 'kelas', kolom: 'nama_kelas' },
    required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama kelas wajib diisi.' : null),
  },
  {
    key: 'alias', label: 'nama_alias', width: 160, kind: 'text', maxLength: 50,
    sumber: { tabel: 'kelas', kolom: 'nama_alias' },
  },
  { key: 'wali', label: 'wali kelas', width: 180, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'lembaga', label: 'lembaga.jenjang', width: 110, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'ta', label: 'tahun_ajaran.nama', width: 160, kind: 'static', sumber: { tabel: 'tahun_ajaran', kolom: 'nama' } },
  {
    key: 'tingkat', label: 'tingkat', width: 120, kind: 'text', maxLength: 20,
  },
  {
    key: 'urutan', label: 'urutan', width: 90, kind: 'text', maxLength: 6,
    validate: (v) => {
      if (v === null || v === undefined || v.trim() === '') return null;
      const n = Number(v);
      return !Number.isInteger(n) || n < 0 ? 'Urutan bilangan bulat ≥ 0.' : null;
    },
  },
  {
    key: 'kapasitas', label: 'kapasitas', width: 120, kind: 'text', maxLength: 10,
    validate: (v) => {
      if (!v) return null;
      const n = Number(v);
      return !Number.isInteger(n) || n < 1 ? 'Kapasitas bilangan bulat ≥ 1.' : null;
    },
  },
];

/** Satu sub-form baris tambah kelas (nama wajib, alias/tingkat + kapasitas opsional). */
interface BarisKelas {
  nama: string;
  alias: string;
  tingkat: string;
  urutan: string;
  kapasitas: string;
}

function barisKelasKosong(): BarisKelas {
  return { nama: '', alias: '', tingkat: '', urutan: '', kapasitas: '' };
}

/** Normalisasi nama untuk pembanding duplikat (samakan dengan backend). */
function normKelas(nama: string): string {
  return nama.trim().replace(/\s+/g, ' ').toLowerCase();
}

function gridValues(k: Kelas): Record<string, string | null> {  return {
    nama: k.nama_kelas,
    alias: k.nama_alias,
    wali: k.walas?.nama_lengkap ?? '—',
    lembaga: namaLembaga(k.lembaga, k.jenjang),
    ta: namaTahunAjaran(k.tahun_ajaran) ?? namaTahunAjaran(k.tahunAjaran),
    tingkat: k.tingkat,
    urutan: String(k.urutan ?? 0),
    kapasitas: k.kapasitas === null || k.kapasitas === undefined ? '' : String(k.kapasitas),
  };
}

async function commitDraft(id: number, f: Record<string, string | null>) {
  await updateKelas(id, {
    ...(f.nama !== undefined ? { nama_kelas: f.nama ?? '' } : {}),
    ...(f.alias !== undefined ? { nama_alias: f.alias || null } : {}),
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
  const [jenjang, setLembagaId] = useState<string>('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState<string>('');
  useTahunAjaranAwalString(setTaId);
  const [tingkat, setTingkat] = useState<string[]>([]);
  function togolTingkat(v: string) {
    setTingkat((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
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
    onSaved,
  } = useDaftarTabel<Kelas>({
    tableKey: 'kelas',
    search: cari,
    ambil: (a) => listKelas({
      search: a.search || undefined,
      jenjang: jenjang === '' ? undefined : jenjang,
      tahun_ajaran: taId === '' ? undefined : taId,
      tingkat: tingkat.length ? tingkat : undefined,
      sort: a.urut.length ? a.urut : undefined,
      arah: a.urut.length ? a.arah : undefined,
      page: a.page,
      per_page: a.perPage,
      signal: a.signal,
    }),
    deps: [jenjang, taId, tingkat],
  });

  // Import nama kelas pasangan MI↔MD (pratinjau → eksekusi).
  const [imporOpen, setImporOpen] = useState(false);
  const [imporArah, setImporArah] = useState<'ambil' | 'copy'>('ambil');
  const [imporHasil, setImporHasil] = useState<ImportNamaHasil | null>(null);
  const [imporBusy, setImporBusy] = useState(false);

  // Import file kelas satu lingkup (filter lembaga+TA saat ini).
  const [fileOpen, setFileOpen] = useState(false);
  const [fileKelas, setFileKelas] = useState<File | null>(null);
  const [hasilFile, setHasilFile] = useState<ImportKelasHasil | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  /** Kode lembaga filter saat ini; tombol import hanya untuk MI/MD. */
  const kodeFilter = useMemo(() => {
    const l = lembagas.find((x) => x.jenjang === jenjang);
    return l?.jenjang ?? null;
  }, [lembagas, jenjang]);
  const dariKode = kodeFilter === 'MI' ? 'MD' : kodeFilter === 'MD' ? 'MI' : null;

  async function muatImpor(periksa: boolean, arah: 'ambil' | 'copy' = imporArah) {
    if (jenjang === '' || taId === '' || !dariKode) return;
    setImporBusy(true);
    try {
      const res = await importNamaKelas(
        arah === 'ambil'
          ? {
              jenjang: jenjang,
              tahun_ajaran: taId,
              dari_kode: dariKode,
              periksa,
            }
          : {
              dari_jenjang: jenjang,
              dari_tahun_ajaran: taId,
              ke_kode: dariKode,
              periksa,
            },
      );
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

  function bukaImpor(arah: 'ambil' | 'copy') {
    setImporArah(arah);
    setImporHasil(null);
    setImporOpen(true);
    void muatImpor(true, arah);
  }

  // Pilihan lembaga + TA khusus dialog Tambah (mandiri dari filter toolbar).
  const [tambahLembagaId, setTambahLembagaId] = useState<string>('');
  const [tambahTaId, setTambahTaId] = useState<string>('');
  const [tambahTas, setTambahTas] = useState<TahunAjaran[]>([]);
  /** Lembaga pemilik `tambahTas` (agar tahu daftar mana yang sudah termuat). */
  const [tambahTasUntuk, setTambahTasUntuk] = useState<string>('');
  const tambahTaReqRef = useRef(0);

  const [barisKelas, setBarisKelas] = useState<BarisKelas[]>([barisKelasKosong()]);
  const [tambahOpen, setTambahOpen] = useState(false);  const [viewRow, setViewRow] = useState<Kelas | null>(null);
  const [editRow, setEditRow] = useState<Kelas | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editWali, setEditWali] = useState('');
  const [waliOpsi, setWaliOpsi] = useState<PegawaiAktif[]>([]);
  const [editTingkat, setEditTingkat] = useState('');
  const [editUrutan, setEditUrutan] = useState('');
  const [editKapasitas, setEditKapasitas] = useState('');
  /** Nama kelas yang sudah ada pada satu lingkup (lembaga+TA) — cek duplikat di klien. */
  const [namaTerpakai, setNamaTerpakai] = useState<{ kunci: string; nama: string[] }>({ kunci: '', nama: [] });

  useEffect(() => {
    // Muat SEMUA lembaga terdaftar (batas maks backend) agar opsi selalu
    // mencakup lembaga baru di masa depan, bukan hanya halaman pertama.
    listLembaga({ per_page: 1000 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (jenjang === '') {
      setTas([]);
      return;
    }
    let alive = true;
    listTahunAjaran({ jenjang: jenjang })
      .then((p) => { if (alive) setTas(p.data); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); });
    return () => { alive = false; };
  }, [jenjang]);

  // Dialog Tambah: muat TA milik lembaga terpilih; **selalu** mengutamakan
  // tahun ajaran aktif (bila belum ada, pertahankan pilihan yang masih valid).
  useEffect(() => {
    const req = ++tambahTaReqRef.current;
    if (tambahLembagaId === '') {
      setTambahTas([]);
      setTambahTasUntuk('');
      return;
    }
    listTahunAjaran({ jenjang: tambahLembagaId, per_page: 100 })
      .then((p) => {
        if (req !== tambahTaReqRef.current) return;
        setTambahTas(p.data);
        setTambahTasUntuk(tambahLembagaId);
        setTambahTaId((prev) => {
          const aktif = p.data.find((t) => t.is_aktif);
          if (aktif) return aktif.nama;
          if (prev !== '' && p.data.some((t) => t.nama === prev)) return prev;
          return p.data[0] ? p.data[0].nama : '';
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
      ? user.lembagas![0].jenjang
      : null;

  const bukaTambah = useCallback(() => {
    const targetLembaga = singleLembagaId ?? jenjang;
    setTambahLembagaId(targetLembaga);
    // Nilai awal: tahun ajaran aktif lembaga tujuan. Daftar toolbar dipakai
    // sebagai cadangan saat daftar dialog belum termuat (efek pemuat mengoreksi).
    const daftar = tambahTasUntuk === targetLembaga
      ? tambahTas
      : (targetLembaga === jenjang ? tas : []);
    const aktif = daftar.find((t) => t.is_aktif);
    setTambahTaId(aktif ? aktif.nama : '');
    setBarisKelas([barisKelasKosong()]);
    setErr('');
    setTambahOpen(true);
  }, [singleLembagaId, jenjang, tambahTas, tambahTasUntuk, tas]);

  const openEdit = useCallback((k: Kelas) => {
    setEditRow(k);
    setEditNama(k.nama_kelas);
    setEditAlias(k.nama_alias ?? '');
    setEditWali(k.walas_id ? String(k.walas_id) : '');
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
  const muatNamaTerpakai = useCallback(async (lembaga: string, ta: string) => {
    if (lembaga === '' || ta === '') {
      setNamaTerpakai({ kunci: '', nama: [] });
      return;
    }
    const kunci = `${lembaga}:${ta}`;
    try {
      const res = await listKelas({ jenjang: lembaga, tahun_ajaran: ta, per_page: 1000 });
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
    void muatNamaTerpakai(editRow.jenjang, editRow.tahun_ajaran);
  }, [editRow, muatNamaTerpakai]);

  // Opsi dropdown wali: pegawai aktif di lembaga + TA kelas yang diubah.
  useEffect(() => {
    if (!editRow) return;
    listPegawaiAktif(editRow.jenjang, editRow.tahun_ajaran)
      .then(setWaliOpsi)
      .catch(() => setWaliOpsi([]));
  }, [editRow]);

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
      .filter((b) => b.nama.trim() !== '' || b.alias.trim() !== '' || b.tingkat.trim() !== '' || b.urutan.trim() !== '' || b.kapasitas.trim() !== '');
    if (terisi.length === 0) {
      setErr('Isi minimal 1 baris kelas (nama wajib).');
      return;
    }
    const kunciLingkup = `${efektifLembagaId}:${tambahTaId}`;
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
      const dasar = { jenjang: efektifLembagaId, tahun_ajaran: tambahTaId };
      if (terisi.length === 1) {
        const [satu] = terisi;
        await createKelas({
          ...dasar,
          nama_kelas: satu.nama.trim(),
          nama_alias: satu.alias.trim() || undefined,
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
            ...(b.alias.trim() ? { nama_alias: b.alias.trim() } : {}),
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
    if (jenjang === '' || taId === '') {
      throw new Error('Pilih filter lembaga & tahun ajaran dulu untuk mode Input.');
    }
    await createKelas({
      jenjang: jenjang,
      tahun_ajaran: taId,
      nama_kelas: (f.nama ?? '').trim(),
      nama_alias: f.alias || undefined,
      tingkat: f.tingkat || undefined,
      urutan: f.urutan ? Number(f.urutan) : undefined,
      kapasitas: f.kapasitas ? Number(f.kapasitas) : undefined,
    });
    toast.success('Kelas dibuat.');
    await load(1);
  }, [jenjang, taId, load]);

  const taTerpilih = useMemo(
    () => tas.find((t) => t.nama === taId)?.nama ?? '',
    [tas, taId],
  );

  const lembagaTerpilih = useMemo(() => {
    const l = lembagas.find((x) => x.jenjang === jenjang);
    return l?.jenjang ?? l?.nama ?? '';
  }, [lembagas, jenjang]);

  /** Row dialog Lihat: tampilkan nama/kode lembaga, sembunyikan jenjang mentah. */
  const viewRowTampil = useMemo(() => {
    if (!viewRow) return null;
    const { jenjang: _lembagaId, ...rest } = viewRow;
    return {
      ...rest,
      lembaga: namaLembaga(viewRow.lembaga, _lembagaId) ?? '',
    } as unknown as Record<string, unknown>;
  }, [viewRow]);

  const onUpdate = useCallback(async () => {
    if (!editRow) return;
    const namaRapi = normKelas(editNama);
    if (namaRapi === '') {
      setErr('Nama kelas wajib diisi.');
      return;
    }
    const kunciLingkup = `${editRow.jenjang}:${editRow.tahun_ajaran}`;
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
        nama_alias: editAlias.trim() || null,
        walas_id: editWali === '' ? null : Number(editWali),
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
  }, [editRow, editNama, editAlias, editWali, editTingkat, editUrutan, editKapasitas, namaTerpakai, load]);

  const onDelete = useCallback(async (id: number) => {
    try {
      await deleteKelas(id);
      toast.success('Kelas dihapus.');
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

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
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari kelas…" />
      <TopBarFilter>
        <FilterMulti
          id="filter_tingkat_kelas_topbar"
          label="Tingkat"
          opsi={TINGKAT_OPSI}
          dipilih={tingkat}
          onToggle={togolTingkat}
          onSemua={() => setTingkat([])}
        />
      </TopBarFilter>
      <ExcelTable
        tableKey="kelas"
        sumberTabel="kelas"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada kelas."
        canEdit={canUbahKelas}
        onCommit={commitDraft}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        onCreateRow={canTambahKelas ? createRow : undefined}
        inputRowValues={{ ta: taTerpilih, lembaga: lembagaTerpilih, urutan: '0' }}
        addButton={canTambahKelas ? (
          <>
            {dariKode && (
              <>
                <Button id="btn_ambil_nama_kelas" variant="outline" onClick={() => bukaImpor('ambil')}>
                  Ambil dari {dariKode}
                </Button>
                <Button id="btn_copy_nama_kelas" variant="outline" onClick={() => bukaImpor('copy')}>
                  Copy ke {dariKode}
                </Button>
              </>
            )}
            <Button
              id="btn_buka_import_kelas"
              variant="outline"
              title="Import file kelas (multi-lembaga & multi-tahun ajaran; izin per baris mengikuti akun)"
              onClick={() => { setFileKelas(null); setHasilFile(null); setFileOpen(true); }}
            >
              <FileUp data-icon="inline-start" size={16} /> Import
            </Button>
            <Button id="btn_buka_tambah_kelas" onClick={bukaTambah}>
              + Kelas
            </Button>
          </>
        ) : undefined}
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
                {lembagas.find((l) => l.jenjang === singleLembagaId)?.jenjang ?? lembagas.find((l) => l.jenjang === singleLembagaId)?.nama ?? singleLembagaId} (otomatis)
              </p>
            ) : (
              <Select
                value={tambahLembagaId === '' ? '' : String(tambahLembagaId)}
                onValueChange={(v) => { setTambahLembagaId(v); setTambahTaId(''); }}
              >
                <SelectTrigger id="select_tambah_lembaga_kelas" className="w-full">
                  <SelectValue placeholder="Pilih lembaga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {lembagas.map((l) => <SelectItem key={l.jenjang} value={l.jenjang}>{l.jenjang}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <FieldLabel htmlFor="select_tambah_ta_kelas" className="self-start pt-1.5">Tahun ajaran</FieldLabel>
            <div className="flex flex-col gap-1.5">
              <Select
                value={tambahTaId}
                onValueChange={(v) => setTambahTaId(v)}
                disabled={tambahLembagaId === ''}
              >
                <SelectTrigger id="select_tambah_ta_kelas" className="w-full">
                  <SelectValue placeholder={tambahLembagaId === '' ? 'Pilih lembaga dulu' : 'Pilih tahun ajaran'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {tambahTas.map((t) => <SelectItem key={t.nama} value={t.nama}>{t.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {tambahLembagaId !== '' && tambahTas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada tahun ajaran di lembaga ini.</p>
              ) : null}
            </div>
            <FieldLabel htmlFor="input_nama_kelas_0">Daftar kelas</FieldLabel>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1fr_100px_80px_100px_32px] items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
                <span>Nama kelas</span>
                <span>Alias</span>
                <span>Tingkat</span>
                <span>Urutan</span>
                <span>Kapasitas</span>
                <span />
              </div>
              {barisKelas.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_100px_80px_100px_32px] items-center gap-2">
                  <Input
                    id={`input_nama_kelas_${i}`}
                    aria-label={`Nama kelas baris ${i + 1}`}
                    value={b.nama}
                    onChange={(e) => ubahBaris(i, 'nama', e.target.value)}
                    required={i === 0}
                    maxLength={50}
                  />
                  <Input
                    id={`input_alias_kelas_${i}`}
                    aria-label={`Alias baris ${i + 1}`}
                    value={b.alias}
                    onChange={(e) => ubahBaris(i, 'alias', e.target.value)}
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
            <DialogTitle>
              {imporArah === 'ambil' ? `Ambil nama kelas dari ${dariKode}` : `Copy nama kelas ke ${dariKode}`}
            </DialogTitle>
            <DialogDescription>
              Menyalin nama + tingkat kelas. Nama yang sudah ada dilewati (tidak digandakan).
            </DialogDescription>
          </DialogHeader>
          {imporHasil ? (
            <div className="flex flex-col gap-3 text-sm" id="hasil_import_nama_kelas">
              <p className="font-medium">
                {imporHasil.sumber.kode} ({imporHasil.sumber.tahun_ajaran ?? '—'}) → {imporHasil.tujuan.kode} ({imporHasil.tujuan.tahun_ajaran ?? '—'}):{' '}
                {imporHasil.ringkasan.sumber} kelas ·{' '}
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
      {/* Import file kelas satu lingkup (Periksa → Import) */}
      <Dialog open={fileOpen} onOpenChange={setFileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import kelas</DialogTitle>
            <DialogDescription>
              Satu file boleh berisi banyak lembaga + tahun ajaran. Kolom: jenjang, tahun_ajaran,
              nama_kelas (wajib), nama_alias, walas (NIP/nama pegawai, opsional), tingkat, urutan,
              kapasitas. Nama yang sudah ada diperbarui (hanya kolom terisi; kosong = pertahankan);
              baris di luar lembaga Anda ditolak per baris.
            </DialogDescription>
          </DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!fileKelas || !hasilFile?.siap_import) return;
            setFileBusy(true);
            try {
              const res = await importKelasFile(fileKelas);
              if (res.errors?.length) toast.error(res.errors.map((x) => `Baris ${x.row} (${x.attribute}): ${x.errors.join(', ')}`).join(' · '));
              else {
                toast.success(res.pesan ?? 'Import selesai.');
                setFileOpen(false);
                pager.goFirst();
                await load(1);
              }
            } catch (e2) { toast.error(errorMessage(e2)); } finally { setFileBusy(false); }
          }}>
            <Button id="btn_unduh_template_kelas" type="button" variant="link" className="col-span-2 h-auto justify-start px-0"
              onClick={() => void unduhTemplateKelas().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> Unduh template Excel kelas
            </Button>
            <Input id="input_file_import_kelas" className="col-span-2" type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { setFileKelas(e.target.files?.[0] ?? null); setHasilFile(null); }} required />
            {hasilFile ? (
              <div className="col-span-2 rounded-md border p-3 text-sm" id="hasil_periksa_import_kelas">
                <p className="font-medium">
                  {hasilFile.ringkasan.baris_diproses} baris diperiksa · {hasilFile.ringkasan.dibuat} dibuat ·{' '}
                  {hasilFile.ringkasan.diperbarui} diperbarui · {hasilFile.ringkasan.dilewati} dilewati ·{' '}
                  {hasilFile.ringkasan.baris_gagal} bermasalah
                </p>
                {hasilFile.errors.length > 0 ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                    {hasilFile.errors.slice(0, 50).map((x, i) => <li key={`${x.row}-${x.attribute}-${i}`}>Baris {x.row} ({x.attribute}): {x.errors.join(', ')}</li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-emerald-600">Tidak ada masalah — siap diimport.</p>}
              </div>
            ) : null}
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setFileOpen(false)}>Batal</Button>
              <Button id="btn_periksa_import_kelas" type="button" variant="outline" disabled={!fileKelas || fileBusy}
                onClick={async () => {
                  if (!fileKelas) return;
                  setFileBusy(true);
                  try {
                    const res = await periksaImportKelas(fileKelas);
                    setHasilFile(res);
                    if (res.siap_import) toast.success(res.pesan); else toast.error(res.pesan);
                  } catch (e2) { setHasilFile(null); toast.error(errorMessage(e2)); } finally { setFileBusy(false); }
                }}>Periksa</Button>
              <Button id="btn_import_kelas" type="submit" disabled={fileBusy || !hasilFile?.siap_import}>Import</Button>
            </DialogFooter>
          </form>
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
            <FieldLabel htmlFor="input_ubah_alias_kelas">Alias (opsional)</FieldLabel>
            <Input id="input_ubah_alias_kelas" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} maxLength={50} />
            <FieldLabel htmlFor="select_ubah_wali_kelas">Wali kelas</FieldLabel>
            <Select value={editWali === '' ? '_kosong' : editWali} onValueChange={(v) => setEditWali(v === '_kosong' ? '' : v)}>
              <SelectTrigger id="select_ubah_wali_kelas" className="w-full">
                <SelectValue placeholder="Tanpa wali" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_kosong">— Tanpa wali —</SelectItem>
                  {waliOpsi.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nama_lengkap}{p.nip ? ` (${p.nip})` : ''}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
