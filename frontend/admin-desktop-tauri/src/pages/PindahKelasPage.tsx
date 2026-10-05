import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, pindahKelas, type RiwayatRow } from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { useTingkatAktif } from '@/tingkatAktif';
import { usePager } from '@/hooks/usePager';
import { PER_PAGE_ALL } from '@/prefs';
import { PengaturanHalaman, useVisibilitasFilter } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight } from '@/icons';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

/** Kolom tabel kelas — SAMA untuk semua kelas di halaman ini, jadi dipakai
 *  bersama oleh tiap grid dan oleh registrasi Kelola Tabel.
 *  `jk` dan `alamat` diambil dari profil santri (relasi `santri` sudah
 *  dimuat penuh oleh endpoint daftar-kelas), keduanya baca-saja karena
 *  halaman ini hanya berpindah kelas, bukan mengubah data Santri. */
const FIELDS_PINDAH_KELAS: ExcelField[] = [
  { key: 'nama', label: 'santri.nama_lengkap', kind: 'static' },
  { key: 'nis_lokal', label: 'nis_lokal', kind: 'static' },
  { key: 'no_absen', label: 'no_absen', kind: 'static' },
  { key: 'jk', label: 'jk', width: 60, kind: 'static' },
  { key: 'alamat', label: 'santri.alamat', width: 220, kind: 'static' },
];

interface KolomKelas {
  kelasId: number | null;
  kelas: string;
  baris: RiwayatRow[];
}

interface GrupTingkat {
  tingkat: string | null;
  kolom: KolomKelas[];
}

/** Pindah Kelas: tiap tingkat tampil sebagai baris kolom — satu tabel per
 *  kelas. Panah kiri/kanan tiap baris memindahkan ke kelas tetangga siklik
 *  (ujung bertemu ujung); satu kelas saja = tanpa panah. */
export default function PindahKelasPage() {
  const { user } = useAuth();
  const filterVis = useVisibilitasFilter();
  const canPindah = bisa(user, 'pindah_kelas.ubah');
  const {
    jenjangs,
    tahunAjaranNames,
    semesters,
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  const { pilih: pilihTingkat, loading: loadingTingkat } = useTingkatAktif();
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  /** Pencarian tunggal halaman (topBar) — disaring di tiap kolom kelas. */
  const [cari, setCari] = useState('');
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const defaultTerapkan = useRef(false);

  const load = useCallback(async () => {
    if (filterLoading || jenjangs.length === 0) { setRows([]); return; }
    setErr('');
    try {
      const lintasPeriode = tahunAjaranNames.length === 0 || semesters.length === 0;
      const res = await daftarKelas({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: semesters,
        tingkat: tingkatAktif,
        lintas_periode: lintasPeriode || undefined,
        per_page: 0,
      });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { setKelas([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelas(p.data); })
      .catch(() => { if (hidup) setKelas([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);

  const tingkatAwal = useMemo(() => {
    const tingkat = [...new Set(kelas
      .map((k) => k.tingkat == null ? '' : String(k.tingkat).trim())
      .filter((t) => t !== ''))];
    return tingkat.sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))[0] ?? '';
  }, [kelas]);

  useEffect(() => {
    if (defaultTerapkan.current || !filterVis?.siap || filterVis.mode.tingkat !== 'single' || loadingTingkat || filterLoading || jenjangs.length !== 1 || tahunAjaranNames.length !== 1 || !tingkatAwal) return;
    defaultTerapkan.current = true;
    if (tingkatAktif.length === 0) pilihTingkat([tingkatAwal]);
  }, [filterLoading, filterVis?.mode.tingkat, filterVis?.siap, jenjangs, loadingTingkat, pilihTingkat, tahunAjaranNames, tingkatAktif, tingkatAwal]);

  const grup = useMemo<GrupTingkat[]>(() => {
    const petaKelas = new Map<number, Kelas>();
    for (const k of kelas) petaKelas.set(k.id, k);
    // Kelompokkan kelas per tingkat, urut nama.
    const tingkatKeKelas = new Map<string, Kelas[]>();
    for (const k of kelas) {
      const t = k.tingkat != null && k.tingkat !== '' ? String(k.tingkat) : '';
      if (!tingkatKeKelas.has(t)) tingkatKeKelas.set(t, []);
      tingkatKeKelas.get(t)!.push(k);
    }
    for (const daftar of tingkatKeKelas.values()) {
      daftar.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true }));
    }
    // Baris per kelas; kelas tak dikenal + tanpa kelas menumpuk di kolom
    // "Tanpa kelas" tingkatnya masing-masing — kolom ini tampil PALING
    // DEPAN agar santri yang belum berdenah kelas langsung terlihat.
    const barisPerKelas = new Map<number, RiwayatRow[]>();
    const tanpaPerTingkat = new Map<string, RiwayatRow[]>();
    for (const r of rows) {
      if (r.kelas_id != null && petaKelas.has(r.kelas_id)) {
        if (!barisPerKelas.has(r.kelas_id)) barisPerKelas.set(r.kelas_id, []);
        barisPerKelas.get(r.kelas_id)!.push(r);
      } else {
        const t = r.tingkat != null && r.tingkat !== '' ? String(r.tingkat) : '';
        if (!tanpaPerTingkat.has(t)) tanpaPerTingkat.set(t, []);
        tanpaPerTingkat.get(t)!.push(r);
      }
    }
    const semuaTingkat = new Set([...tingkatKeKelas.keys(), ...tanpaPerTingkat.keys()]);
    const hasil: GrupTingkat[] = [];
    for (const t of semuaTingkat) {
      if (tingkatAktif.length > 0 && !tingkatAktif.includes(t)) continue;
      const tanpa = tanpaPerTingkat.get(t) ?? [];
      const kolom: KolomKelas[] = [];
      if (tanpa.length > 0 && kelasAktif.length === 0) {
        kolom.push({ kelasId: null, kelas: 'Tanpa kelas', baris: tanpa });
      }
      for (const k of tingkatKeKelas.get(t) ?? []) {
        if (kelasAktif.length > 0 && !kelasAktif.includes(k.nama_kelas)) continue;
        kolom.push({ kelasId: k.id, kelas: k.nama_kelas, baris: barisPerKelas.get(k.id) ?? [] });
      }
      if (kolom.length === 0) continue;
      hasil.push({ tingkat: t === '' ? null : t, kolom });
    }
    hasil.sort((a, b) => String(a.tingkat ?? '').localeCompare(String(b.tingkat ?? ''), 'id', { numeric: true }));
    return hasil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas, rows, tingkatAktif, kelasAktif]);

  const pindah = async (r: RiwayatRow, kelasBaruId: number) => {
    setBusyId(r.id);
    try {
      await pindahKelas(r.id, kelasBaruId);
      toast.success('Santri dipindah kelas.');
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman
        tampil={{ tingkat: true, kelas: true }}
        tabel={[{ key: 'pindah_kelas', judul: 'Pindah Kelas', fields: FIELDS_PINDAH_KELAS }]}
      />

      {grup.length === 0 ? (
        <p className="text-xs text-muted-foreground">Tidak ada santri aktif pada filter ini.</p>
      ) : grup.map((g, gi) => (
         <section key={g.tingkat ?? 'tanpa'} className="flex min-h-0 flex-1 flex-col gap-1">
           <div className="grid min-h-0 flex-1 gap-1 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {g.kolom.map((k, ki) => (
              <TabelKelas
                key={k.kelasId ?? 'tanpa'}
                tingkat={g.tingkat}
                kolom={k}
                rail={gi === 0 && ki === 0}
                tetangga={k.kelasId == null
                  // Kolom Tanpa kelas: kiri = kelas nyata terakhir,
                  // kanan = kelas nyata pertama.
                  ? (() => {
                      const nyata = g.kolom.filter((c) => c.kelasId != null);
                      if (nyata.length === 0) return { kiri: null, kanan: null };
                      return { kiri: nyata[nyata.length - 1], kanan: nyata[0] };
                    })()
                  : (() => {
                      const nyata = g.kolom.filter((c) => c.kelasId != null);
                      const i = nyata.findIndex((c) => c.kelasId === k.kelasId);
                      if (nyata.length < 2 || i < 0) return { kiri: null, kanan: null };
                      return {
                        kiri: nyata[(i - 1 + nyata.length) % nyata.length],
                        kanan: nyata[(i + 1) % nyata.length],
                      };
                    })()}
                bisaPindah={canPindah}
                busyId={busyId}
                cari={cari}
                onPindah={(r, tujuan) => void pindah(r, tujuan)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Satu kolom kelas: tabel santri + panah pindah ke tetangga siklik. */
function TabelKelas({ tingkat, kolom, tetangga, bisaPindah, busyId, cari, onPindah, rail }: {
  tingkat: string | null;
  kolom: KolomKelas;
  tetangga: { kiri: KolomKelas | null; kanan: KolomKelas | null };
  bisaPindah: boolean;
  busyId: number | null;
  /** Pencarian tunggal halaman (topBar) — disaring di tiap kolom. */
  cari: string;
  onPindah: (r: RiwayatRow, kelasBaruId: number) => void;
  /** Rel Tingkat/Kelas — hanya pada tabel pertama halaman. */
  rail?: boolean;
}) {
  const kunci = `${tingkat ?? 'tanpa'}_${kolom.kelasId ?? 'tanpa'}`;
  const { page, perPage, goFirst, setPage, setPerPage } = usePager(`pindah_kelas_${kunci}`);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return kolom.baris;
    return kolom.baris.filter((r) =>
      (r.santri?.nama_lengkap ?? '').toLowerCase().includes(q)
      || (r.nis_lokal ?? '').toLowerCase().includes(q));
  }, [kolom.baris, cari]);
  const lastPage = perPage === PER_PAGE_ALL ? 1 : Math.max(1, Math.ceil(tampil.length / perPage));
  const barisHalaman = perPage === PER_PAGE_ALL
    ? tampil
    : tampil.slice((page - 1) * perPage, page * perPage);
  const aksi = tetangga.kiri != null || tetangga.kanan != null;

  useEffect(() => {
    goFirst();
  }, [cari, goFirst]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);
  return (
     <section className="flex min-h-0 min-w-0 flex-col rounded-md">
       <div className="flex min-h-0 flex-1 flex-col pb-0">
        <ExcelTable
           tableKey="pindah_kelas"
           rail={rail}
           header={<span>{kolom.kelasId == null ? 'Santri Belum Masuk Kelas' : `Kelas ${kolom.kelas}`}</span>}
           fields={FIELDS_PINDAH_KELAS}
           rows={barisHalaman}
          getValues={(r) => ({
            nama: r.santri?.nama_lengkap ?? null,
            nis_lokal: r.nis_lokal ?? null,
            no_absen: r.no_absen != null ? String(r.no_absen) : null,
            jk: r.santri?.jk ?? null,
            alamat: r.santri?.alamat ?? null,
          })}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={(r) => (
            <>
              {aksi && bisaPindah && tetangga.kiri?.kelasId != null && tetangga.kiri.kelasId !== kolom.kelasId && (
                <ActionIcon
                  id={`btn_pindah_kiri_${r.id}`}
                  title={`Pindah ke ${tetangga.kiri.kelas}`}
                  aria-label={`Pindah ke ${tetangga.kiri.kelas}`}
                  disabled={busyId === r.id}
                  className="h-6 w-5 px-0"
                  onClick={() => onPindah(r, tetangga.kiri!.kelasId!)}
                >
                  <ArrowRight size={16} className="rotate-180" />
                </ActionIcon>
              )}
              {tetangga.kanan?.kelasId != null && tetangga.kanan.kelasId !== kolom.kelasId && (
                <ActionIcon
                  id={`btn_pindah_kanan_${r.id}`}
                  title={`Pindah ke ${tetangga.kanan.kelas}`}
                  aria-label={`Pindah ke ${tetangga.kanan.kelas}`}
                  disabled={busyId === r.id}
                  className="-ml-1 h-6 w-5 px-0"
                  onClick={() => onPindah(r, tetangga.kanan!.kelasId!)}
                >
                  <ArrowRight size={16} />
                </ActionIcon>
              )}
            </>
          )}
          hideCheckbox
           emptyText="Tidak ada santri pada kelas ini."
         />
         <Pager
           page={page}
           lastPage={lastPage}
           total={tampil.length}
           perPage={perPage}
           onPage={setPage}
           onPerPage={setPerPage}
         />
       </div>
    </section>
  );
}
