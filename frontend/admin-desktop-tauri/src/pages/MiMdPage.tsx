import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorMessage } from '../api/client';
import {
  daftarkanMdMiMd,
  hapusMdMiMd,
  listMiMd,
  samakanKelasMiMd,
  type MiMdBarisBeda,
  type MiMdBarisMd,
  type MiMdBarisMi,
  type MiMdData,
} from '../api/siklus';
import { bisa } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, X } from '@/icons';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { FilterMulti } from '@/components/FilterTingkatKelas';
import { TopBarFilter } from '@/components/TopBarFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { toast } from 'sonner';

/** Halaman MI-MD: MI saja | MD semua | beda kelas by-nama + aksi samakan dua arah.
 *  Daftar mengikuti tahun ajaran pilihan topbar (default TA aktif). */
export default function MiMdPage() {
  const { user } = useAuth();
  const canSamakan = bisa(user, 'pindah_kelas.ubah');
  const canDaftar = bisa(user, 'santri.tambah');
  const canHentikan = bisa(user, 'santri.ubah');
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [data, setData] = useState<MiMdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  /** Pencarian tunggal halaman (topBar) untuk ketiga tabel. */
  const [cari, setCari] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Filter kelas (multi-pilih) di topBar — gabungan kelas MI & MD. */
  const [kelasFilter, setKelasFilter] = useState<string[]>([]);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      setData(await listMiMd({ tahun_ajaran: taId || undefined }));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [taId]);

  useEffect(() => {
    void load();
  }, [load]);

  type Baris = { id: number; santri_id: number } & Record<string, string | boolean | number | null>;

  const saring = useCallback(
    <T extends { nama: string; santri_id: number }>(rows: T[], q: string): Baris[] =>
      rows
        .filter((r) => r.nama.toLowerCase().includes(q.trim().toLowerCase()))
        .map((r) => ({ ...(r as unknown as Record<string, string | boolean | number | null>), id: r.santri_id, santri_id: r.santri_id })),
    [],
  );

  const kelasOpsi = useMemo(() => {
    const unik = new Set<string>();
    for (const r of data?.mi_only ?? []) if (r.kelas_mi) unik.add(r.kelas_mi);
    for (const r of data?.md_semua ?? []) if (r.kelas_md) unik.add(r.kelas_md);
    for (const r of data?.beda_kelas ?? []) {
      if (r.kelas_mi) unik.add(r.kelas_mi);
      if (r.kelas_md) unik.add(r.kelas_md);
    }
    return [...unik].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [data]);

  /** Baris lolos bila salah satu kelasnya (MI atau MD) terpilih. */
  const cocokKelas = useCallback((r: Baris): boolean => (
    kelasFilter.length === 0
    || (typeof r.kelas_mi === 'string' && kelasFilter.includes(r.kelas_mi))
    || (typeof r.kelas_md === 'string' && kelasFilter.includes(r.kelas_md))
  ), [kelasFilter]);

  const rowsMi = useMemo(() => saring(data?.mi_only ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);
  const rowsMd = useMemo(() => saring(data?.md_semua ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);
  const rowsBeda = useMemo(() => saring(data?.beda_kelas ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);

  function togolKelas(v: string) {
    setKelasFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function samakan(santriId: number, arah: 'ke_mi' | 'ke_md') {
    setBusyId(santriId);
    try {
      const res = await samakanKelasMiMd([{ santri_id: santriId, arah }]);
      if (res.gagal.length > 0) {
        toast.error(res.gagal.map((g) => g.pesan).join(' · '));
      } else {
        toast.success(res.pesan);
      }
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function samakanBanyak(checked: Baris[], arah: 'ke_mi' | 'ke_md', clear: () => void) {
    const ids = checked.map((r) => r.santri_id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await samakanKelasMiMd(ids.map((santri_id) => ({ santri_id, arah })));
      if (res.gagal.length > 0) {
        toast.error(`${res.pesan} ${res.gagal.map((g) => g.pesan).join(' · ')}`);
      } else {
        toast.success(res.pesan);
      }
      clear();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function daftarkanBanyak(checked: Baris[], clear: () => void) {
    const ids = checked.map((r) => r.santri_id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await daftarkanMdMiMd(ids.map((santri_id) => ({ santri_id })));
      if (res.gagal.length > 0) {
        toast.error(`${res.pesan} ${res.gagal.map((g) => g.pesan).join(' · ')}`);
      } else {
        toast.success(res.pesan);
      }
      clear();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function hentikanMd(santriId: number) {
    setBusyId(santriId);
    try {
      const res = await hapusMdMiMd([{ santri_id: santriId }]);
      if (res.gagal.length > 0) {
        toast.error(res.gagal.map((g) => g.pesan).join(' · '));
      } else {
        toast.success(res.pesan);
      }
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function hentikanBanyak(checked: Baris[], clear: () => void) {
    // Hanya yang juga-MI yang bisa dikeluarkan; murni MD dilewati.
    const layak = checked.filter((r) => r.juga_mi === true).map((r) => r.santri_id);
    const lewati = checked.length - layak.length;
    if (layak.length === 0) {
      toast.error(lewati > 0 ? `${lewati} baris murni MD — tidak ada yang dikeluarkan.` : 'Tidak ada baris terpilih.');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await hapusMdMiMd(layak.map((santri_id) => ({ santri_id })));
      if (res.gagal.length > 0) {
        toast.error(`${res.pesan} ${res.gagal.map((g) => g.pesan).join(' · ')}`);
      } else {
        toast.success(lewati > 0 ? `${res.pesan} ${lewati} murni MD dilewati.` : res.pesan);
      }
      clear();
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function daftarkanKeMd(santriId: number) {
    setBusyId(santriId);
    try {
      const res = await daftarkanMdMiMd([{ santri_id: santriId }]);
      if (res.gagal.length > 0) {
        toast.error(res.gagal.map((g) => g.pesan).join(' · '));
      } else {
        toast.success(res.pesan);
      }
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const FIELDS_MI: ExcelField[] = useMemo(() => ([
    { key: 'nama', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
    { key: 'nis_mi', label: 'mi.nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
    { key: 'kelas_mi', label: 'KELAS MI', width: 100, kind: 'static', sumber: null },
  ]), []);
  const FIELDS_MD: ExcelField[] = useMemo(() => ([
    { key: 'nama', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
    { key: 'nis_md', label: 'md.nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
    { key: 'kelas_md', label: 'KELAS MD', width: 100, kind: 'static', sumber: null },
    { key: 'juga_mi', label: 'Juga MI', width: 80, kind: 'static', sumber: null },
  ]), []);
  const FIELDS_BEDA: ExcelField[] = useMemo(() => ([
    { key: 'nama', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
    { key: 'kelas_mi', label: 'KELAS MI', width: 100, kind: 'static', sumber: null },
    { key: 'kelas_md', label: 'KELAS MD', width: 100, kind: 'static', sumber: null },
  ]), []);

  const panel = (
    key: string,
    judul: string,
    jumlah: number,
    fields: ExcelField[],
    rows: Baris[],
    getValues: (r: Baris) => Record<string, string | null>,
    aksi?: (r: Baris) => ReactNode,
    renderBulk?: (checked: Baris[], clear: () => void) => ReactNode,
  ) => (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{judul} ({jumlah})</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <ExcelTable
          tableKey={`mi_md_${key}`}
          fields={fields}
          rows={rows}
          getValues={getValues}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={aksi ? (r) => aksi(r) : () => null}
          renderBulkActions={renderBulk}
          emptyText="Tidak ada data."
        />
      </div>
    </section>
  );

  const nilaiStatis = (r: Record<string, unknown>): Record<string, string | null> => {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === 'id' || k === 'santri_id') continue;
      out[k] = typeof v === 'boolean' ? (v ? 'Ya' : '—') : (v as string | null) ?? '—';
    }
    return out;
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama…" />
      <TopBarFilter>
        <FilterMulti
          id="filter_kelas_mi_md"
          label="Kelas"
          opsi={kelasOpsi}
          dipilih={kelasFilter}
          onToggle={togolKelas}
          onSemua={() => setKelasFilter([])}
        />
      </TopBarFilter>
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" id="info_ta_mi_md">
            Tahun ajaran: {data?.tahun_ajaran ?? 'Semua'}
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-4">
          {panel('mi', 'MI Only', rowsMi.length, FIELDS_MI, rowsMi, nilaiStatis,
            canDaftar
              ? (r) => (
                <ActionIcon
                  id={`btn_daftar_md_${r.santri_id}`}
                  title="Masukkan ke MD (buat keanggotaan, NIS mewarisi MI)"
                  onClick={() => { if (busyId !== r.santri_id) void daftarkanKeMd(r.santri_id); }}
                >
                  <ArrowRight size={16} />
                </ActionIcon>
              )
              : undefined,
            canDaftar
              ? (checked, clear) => (
                <Button
                  id="btn_bulk_daftar_md"
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy}
                  title="Daftarkan yang tercentang ke MD"
                  onClick={() => void daftarkanBanyak(checked, clear)}
                >
                  Ke MD ({checked.length})
                </Button>
              )
              : undefined,
          )}
          {panel('md', 'MD Semua', rowsMd.length, FIELDS_MD, rowsMd, nilaiStatis,
            canHentikan
              ? (r) => (r.juga_mi === true
                ? (
                  <ActionIcon
                    id={`btn_hentikan_md_${r.santri_id}`}
                    title="Hapus dari MD (fisik, tanpa arsip — kembali menjadi MI Only)"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (busyId !== r.santri_id) void hentikanMd(r.santri_id); }}
                  >
                    <X size={16} />
                  </ActionIcon>
                )
                : null)
              : undefined,
            canHentikan
              ? (checked, clear) => (
                <Button
                  id="btn_bulk_hentikan_md"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={bulkBusy}
                  title="Keluarkan yang tercentang dari MD (murni MD dilewati)"
                  onClick={() => void hentikanBanyak(checked, clear)}
                >
                  Keluarkan ({checked.length})
                </Button>
              )
              : undefined,
          )}
          {panel(
            'beda',
            'Perbandingan Kelas',
            rowsBeda.length,
            FIELDS_BEDA,
            rowsBeda,
            nilaiStatis,
            canSamakan
              ? (r) => (
                <div className="flex gap-1">
                  <Button
                    id={`btn_samakan_mi_${r.santri_id}`}
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.santri_id}
                    title="Samakan MD dengan MI (buatkan riwayat bila belum ada)"
                    onClick={() => void samakan(r.santri_id, 'ke_md')}
                  >
                    Samakan dengan MI
                  </Button>
                  <Button
                    id={`btn_samakan_md_${r.santri_id}`}
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.santri_id}
                    title="Samakan MI dengan MD (buatkan riwayat bila belum ada)"
                    onClick={() => void samakan(r.santri_id, 'ke_mi')}
                  >
                    Samakan dengan MD
                  </Button>
                </div>
              )
              : undefined,
            canSamakan
              ? (checked, clear) => (
                <div className="flex gap-1">
                  <Button
                    id="btn_bulk_samakan_mi"
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy}
                    title="Samakan yang tercentang dengan MI"
                    onClick={() => void samakanBanyak(checked, 'ke_md', clear)}
                  >
                    Ikut MI ({checked.length})
                  </Button>
                  <Button
                    id="btn_bulk_samakan_md"
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy}
                    title="Samakan yang tercentang dengan MD"
                    onClick={() => void samakanBanyak(checked, 'ke_mi', clear)}
                  >
                    Ikut MD ({checked.length})
                  </Button>
                </div>
              )
              : undefined,
          )}
          </div>
        </>
      )}
    </div>
  );
}

// Re-ekspor tipe agar konsisten dengan pola halaman lain.
export type { MiMdBarisMi, MiMdBarisMd, MiMdBarisBeda };
