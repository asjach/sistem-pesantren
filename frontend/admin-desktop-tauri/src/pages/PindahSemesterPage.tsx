import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  batalSalin,
  listBelumGenap,
  listRiwayatBelajar,
  salinGenapMassal,
  type RiwayatRow,
} from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { FilterTingkatKelas } from '@/components/FilterTingkatKelas';
import FilterField from '@/components/FilterField';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, Undo2 } from '@/icons';
import {
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
} from '@/components/siklus/bersama';
import { toast } from 'sonner';

/** Kolom panel kiri: ganjil aktif yang belum punya baris genap. */
const FIELDS_KIRI: ExcelField[] = [
  { key: 'santri', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'nis', label: 'nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
  { key: 'jk', label: 'santri.jk', width: 70, kind: 'static', sumber: { tabel: 'santri', kolom: 'jk' } },
  { key: 'tingkat', label: 'tingkat', width: 80, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
  { key: 'kelas', label: 'kelas.nama_kelas', width: 140, kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'masuk', label: 'tgl_masuk', width: 110, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tgl_masuk' } },
];

function kiriValues(r: RiwayatRow): Record<string, string | null> {
  return {
    santri: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis_lokal ?? null,
    jk: r.santri?.jk ?? null,
    tingkat: r.tingkat,
    kelas: r.kelas?.nama_kelas ?? '—',
    masuk: r.tgl_masuk ? r.tgl_masuk.slice(0, 10) : null,
  };
}

/**
 * Pindah Semester (ganjil → genap dalam tahun yang sama), dua panel sejajar:
 * kiri = semester 1 aktif yang sudah masuk kelas tetapi belum punya
 * semester 2 (aksi panah = salin; genap otomatis mewarisi kelas ganjil),
 * kanan = semester 2 aktif (tampil saja; kelas diwarisi dari ganjil).
 */
export default function PindahSemesterPage() {
  const { user } = useAuth();
  const canPindah = bisa(user, 'kenaikan.ubah');
  /** Lembaga + TA selalu mengikuti topbar (satu-satunya sumber). */
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  /** Filter tingkat & kelas (multi-pilih) di topBar, berlaku untuk kedua panel. */
  const [tingkatFilter, setTingkatFilter] = useState<string[]>([]);
  const [kelasFilter, setKelasFilter] = useState<string[]>([]);
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Baris tercentang per panel (diangkat via `onCheckedChange` agar tombol
   *  bulk bisa duduk di header panel). */
  const [centangKiri, setCentangKiri] = useState<RiwayatRow[]>([]);
  const [centangKanan, setCentangKanan] = useState<RiwayatRow[]>([]);
  /** Naikkan seusai aksi massal untuk me-remount grid (mereset centang internal). */
  const [nonceKiri, setNonceKiri] = useState(0);
  const [nonceKanan, setNonceKanan] = useState(0);
  /** Tgl masuk semester 2 bawaan untuk aksi panah; default hari ini (lokal). */
  const [tglMasuk, setTglMasuk] = useState(() => {
    const now = new Date();
    const lokal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return lokal.toISOString().slice(0, 10);
  });

  /** Opsi tingkat diturunkan dari daftar kelas (distinct, urut numerik). */
  const opsiTingkat = useMemo(() => {
    const unik = new Set<string>();
    for (const k of kelasOpsi) {
      if (k.tingkat !== null && k.tingkat !== undefined && String(k.tingkat) !== '') unik.add(String(k.tingkat));
    }
    return [...unik].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [kelasOpsi]);

  /** Id kelas terpilih (dari nama di filter topBar) untuk param server. */
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasFilter.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasFilter],
  );

  function togolTingkat(v: string) {
    setTingkatFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
  function togolKelas(v: string) {
    setKelasFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  const kiri = useDaftarTabel<RiwayatRow>({
    tableKey: 'pindah_semester_kiri',
    ambil: (a) => {
      if (!jenjang || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listBelumGenap({
        jenjang: jenjang,
        tahun_ajaran: taId,
        tingkat: tingkatFilter.length ? tingkatFilter : undefined,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        q: a.search || undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [jenjang, taId, tingkatFilter, kelasFilterIds],
  });

  const kanan = useDaftarTabel<RiwayatRow>({
    tableKey: 'pindah_semester_kanan',
    ambil: (a) => {
      if (!jenjang || !taId) {
        return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
      }
      return listRiwayatBelajar({
        jenjang: jenjang,
        tahun_ajaran: taId,
        semester: '2',
        tingkat: tingkatFilter.length ? tingkatFilter : undefined,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        is_active_riwayat: true,
        q: a.search || undefined,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      });
    },
    deps: [jenjang, taId, tingkatFilter, kelasFilterIds],
  });

  useEffect(() => {
    if (!jenjang || !taId) { setKelasOpsi([]); return; }
    listKelas({ jenjang: jenjang, tahun_ajaran: taId, per_page: 1000 })
      .then((p) => setKelasOpsi(p.data))
      .catch(() => setKelasOpsi([]));
    setTingkatFilter([]);
    setKelasFilter([]);
  }, [jenjang, taId]);

  const muatUlang = useCallback(async () => {
    setNonceKiri((n) => n + 1);
    setNonceKanan((n) => n + 1);
    await Promise.all([kiri.load(kiri.pager.page), kanan.load(kanan.pager.page)]);
  }, [kiri, kanan]);

  const laporkan = useCallback((berhasil: number, gagal: { santri_id: number | null; pesan: string }[]) => {
    if (gagal.length > 0) toast.error(`${berhasil} pindah, ${gagal.length} gagal: ${gagal.slice(0, 3).map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
    else toast.success(`${berhasil} santri dipindah ke semester 2.`);
  }, []);

  /** Batalkan salin: hapus baris genap, ganjil dibuka lagi (kembali ke kiri). */
  const batalkan = useCallback(async (rows: RiwayatRow[]) => {
    if (bulkBusy || busyId !== null || rows.length === 0 || !jenjang) return;
    if (rows.length === 1) setBusyId(rows[0].id);
    else setBulkBusy(true);
    let ok = 0;
    const gagal: string[] = [];
    try {
      for (const r of rows) {
        try {
          await batalSalin(r.santri_id, jenjang);
          ok++;
        } catch (e) {
          gagal.push(`${r.santri?.nama_lengkap ?? r.santri_id}: ${errorMessage(e)}`);
        }
      }
      if (gagal.length > 0) toast.error(`${ok} dibatalkan, ${gagal.length} gagal: ${gagal.slice(0, 3).join(' · ')}${gagal.length > 3 ? ' …' : ''}`);
      else toast.success(`${ok} salin dibatalkan; santri kembali ke semester 1.`);
      setCentangKanan([]);
      await muatUlang();
    } finally {
      setBusyId(null);
      setBulkBusy(false);
    }
  }, [bulkBusy, busyId, jenjang, muatUlang]);

  const pindahkan = useCallback(async (rows: RiwayatRow[]) => {
    if (bulkBusy || busyId !== null || rows.length === 0 || !jenjang || !taId) return;
    if (!tglMasuk) {
      toast.error('Isi tanggal masuk semester 2 dulu.');
      return;
    }
    if (rows.length === 1) setBusyId(rows[0].id);
    else setBulkBusy(true);
    try {
      const res = await salinGenapMassal({
        jenjang: jenjang,
        tanggal_masuk: tglMasuk,
        siswa: rows.map((r) => ({ santri_id: r.santri_id })),
      });
      laporkan(res.berhasil, res.gagal);
      setCentangKiri([]);
      await muatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
      await muatUlang();
    } finally {
      setBusyId(null);
      setBulkBusy(false);
    }
  }, [bulkBusy, busyId, jenjang, taId, tglMasuk, laporkan, muatUlang]);

  const siap = jenjang !== '' && taId !== '';

  const panel = (
    key: string,
    judul: string,
    jumlah: number,
    tabel: ReactNode,
    pagerNode: ReactNode,
    aksiKepala?: ReactNode,
  ) => (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{judul} ({jumlah})</span>
        {aksiKepala}
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        {tabel}
        {pagerNode}
      </div>
    </section>
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{kiri.err || kanan.err}</ErrorNotice>
      <FilterTingkatKelas
        filter={{
          tingkat: tingkatFilter,
          kelas: kelasFilter,
          tingkatOpsi: opsiTingkat,
          kelasOpsi: kelasOpsi.map((k) => k.nama_kelas),
          togolTingkat,
          togolKelas,
          kosongkanTingkat: () => setTingkatFilter([]),
          kosongkanKelas: () => setKelasFilter([]),
        }}
      />
      {!siap ? (
        <p className="text-sm text-muted-foreground">Pilih lembaga dan tahun ajaran di topbar dulu untuk memuat kedua tabel.</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4">
          {panel(
            'belum',
            'Belum pindah semester',
            kiri.total,
            <ExcelTable<RiwayatRow>
              tableKey="pindah_semester_kiri"
              fields={FIELDS_KIRI}
              rows={kiri.rows}
              getValues={kiriValues}
              loading={kiri.loading}
              emptyText="Semua santri berkelas sudah pindah ke semester 2."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canPindah ? (
                  <ActionIcon
                    id={`btn_pindah_semester_${r.id}`}
                    title="Pindahkan ke semester 2"
                    disabled={busyId !== null || bulkBusy || !tglMasuk}
                    onClick={() => void pindahkan([r])}
                  >
                    <ArrowRight size={16} />
                  </ActionIcon>
                ) : null
              )}
              searchValue={kiri.search}
              onSearchChange={kiri.onSearchChange}
              searchIds={{ form: 'form_cari_belum_genap', input: 'input_cari_belum_genap', button: 'btn_cari_belum_genap' }}
              key={`pindah_semester_kiri_${nonceKiri}`}
              onCheckedChange={setCentangKiri}
              awalanToolbar={(
                <FilterField label="Tgl masuk" htmlFor="input_tgl_masuk_genap">
                  <Input
                    id="input_tgl_masuk_genap"
                    type="date"
                    title="Tanggal masuk semester 2 untuk aksi panah"
                    aria-label="Tanggal masuk semester 2 untuk aksi panah"
                    className="w-30"
                    value={tglMasuk}
                    onChange={(e) => setTglMasuk(e.target.value)}
                  />
                </FilterField>
              )}
            />,
            <Pager
              page={kiri.pager.page}
              lastPage={kiri.lastPage}
              total={kiri.total}
              perPage={kiri.pager.perPage}
              onPage={(p) => { kiri.pager.setPage(p); void kiri.load(p); }}
              onPerPage={(pp) => { kiri.pager.setPerPage(pp); void kiri.load(1, pp); }}
            />,
            canPindah ? (
              <Button
                id="btn_bulk_pindah_semester"
                size="sm"
                disabled={bulkBusy || busyId !== null || centangKiri.length === 0 || !tglMasuk}
                title="Pindahkan yang tercentang ke semester 2"
                onClick={() => void pindahkan(centangKiri)}
              >
                Pindah ({centangKiri.length})
              </Button>
            ) : undefined,
          )}
          {panel(
            'sudah',
            'Sudah semester 2',
            kanan.total,
            <ExcelTable<RiwayatRow>
              tableKey="pindah_semester_kanan"
              fields={ROSTER_FIELDS}
              rows={kanan.rows}
              getValues={riwayatValues}
              loading={kanan.loading}
              emptyText="Belum ada santri semester 2 pada filter ini."
              canEdit={false}
              onCommit={noopCommit}
              onSaved={noopCommit}
              renderActions={(r) => (
                canPindah ? (
                  <ActionIcon
                    id={`btn_batal_salin_${r.id}`}
                    title="Batalkan salin (kembali ke semester 1)"
                    disabled={busyId !== null || bulkBusy}
                    onClick={() => void batalkan([r])}
                  >
                    <Undo2 size={16} />
                  </ActionIcon>
                ) : null
              )}
              searchValue={kanan.search}
              onSearchChange={kanan.onSearchChange}
              searchIds={{ form: 'form_cari_sudah_genap', input: 'input_cari_sudah_genap', button: 'btn_cari_sudah_genap' }}
              key={`pindah_semester_kanan_${nonceKanan}`}
              onCheckedChange={setCentangKanan}
            />,
            <Pager
              page={kanan.pager.page}
              lastPage={kanan.lastPage}
              total={kanan.total}
              perPage={kanan.pager.perPage}
              onPage={(p) => { kanan.pager.setPage(p); void kanan.load(p); }}
              onPerPage={(pp) => { kanan.pager.setPerPage(pp); void kanan.load(1, pp); }}
            />,
            canPindah ? (
              <Button
                id="btn_bulk_batal_salin"
                size="sm"
                variant="outline"
                disabled={bulkBusy || busyId !== null || centangKanan.length === 0}
                title="Batalkan salin yang tercentang (kembali ke semester 1)"
                onClick={() => void batalkan(centangKanan)}
              >
                Batalkan ({centangKanan.length})
              </Button>
            ) : undefined,
          )}
        </div>
      )}
    </div>
  );
}
