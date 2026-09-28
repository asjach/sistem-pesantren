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
import { ResizableAutoHidePanel, ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, X } from '@/icons';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import type { PetaArahKolom } from '@/lib/urut';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { toast } from 'sonner';
import { useAksiProfilSantri } from '@/components/santri/useAksiProfilSantri';

/** Halaman MI-MD: MI saja | MD semua | beda kelas by-nama + aksi samakan dua arah.
 *  Daftar mengikuti tahun ajaran pilihan topbar (default TA aktif). */
export default function MiMdPage() {
  const { user } = useAuth();
  const canSamakan = bisa(user, 'pindah_kelas.ubah');
  const canDaftar = bisa(user, 'santri.tambah');
  const canHentikan = bisa(user, 'santri.ubah');
  const { tahunAjaranNames, semesters, tingkat: tingkatFilter, kelas: kelasFilter, loading: filterLoading } = useFilterGlobalAktif();
  const [data, setData] = useState<MiMdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  /** Pencarian tunggal halaman (topBar) untuk ketiga tabel. */
  const [cari, setCari] = useState('');
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (filterLoading) return;
    setErr('');
    setLoading(true);
    try {
      setData(await listMiMd({ tahun_ajaran: tahunAjaranNames, semester: semesters, tingkat: tingkatFilter }));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filterLoading, tahunAjaranNames, semesters, tingkatFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  type Baris = { id: number; santri_id: number } & Record<string, string | boolean | number | null>;
  const [urutTabel, setUrutTabel] = useState<Record<string, { kolom: string[]; arah: 'naik' | 'turun'; arahKolom?: PetaArahKolom }>>({
    mi: { kolom: ['nama'], arah: 'naik' },
    md: { kolom: ['nama'], arah: 'naik' },
    beda: { kolom: ['nama'], arah: 'naik' },
  });

  const terapkanUrut = useCallback((tableKey: string, kolom: string[], arah: 'naik' | 'turun', arahKolom?: PetaArahKolom) => {
    setUrutTabel((saatIni) => ({ ...saatIni, [tableKey]: { kolom, arah, arahKolom: kolom.length > 0 ? arahKolom : undefined } }));
  }, []);

  const urutkan = useCallback((rows: Baris[], kolom: string[], arah: 'naik' | 'turun', arahKolom?: PetaArahKolom): Baris[] => {
    if (kolom.length === 0) return rows;
    const nilai = (v: string | boolean | number | null) => v == null ? '' : String(v).trim().toLocaleLowerCase('id');
    return [...rows].sort((a, b) => {
      for (const key of kolom) {
        const bandingkan = nilai(a[key]).localeCompare(nilai(b[key]), 'id', { numeric: true, sensitivity: 'base' });
        if (bandingkan !== 0) {
          // Arah per kolom menimpa arah global (mis. aktif turun, nama naik).
          const arahKey = arahKolom?.[key] ?? arah;
          return arahKey === 'turun' ? -bandingkan : bandingkan;
        }
      }
      return a.santri_id - b.santri_id;
    });
  }, []);

  const saring = useCallback(
    <T extends { nama: string; santri_id: number }>(rows: T[], q: string): Baris[] =>
      rows
        .filter((r) => r.nama.toLowerCase().includes(q.trim().toLowerCase()))
        .map((r) => ({ ...(r as unknown as Record<string, string | boolean | number | null>), id: r.santri_id, santri_id: r.santri_id })),
    [],
  );

  /** Baris lolos bila salah satu kelasnya (MI atau MD) terpilih. */
  const cocokKelas = useCallback((r: Baris): boolean => (
    kelasFilter.length === 0
    || (typeof r.kelas_mi === 'string' && kelasFilter.includes(r.kelas_mi))
    || (typeof r.kelas_md === 'string' && kelasFilter.includes(r.kelas_md))
  ), [kelasFilter]);

  const rowsMi = useMemo(() => saring(data?.mi_only ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);
  const rowsMd = useMemo(() => saring(data?.md_semua ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);
  const rowsBeda = useMemo(() => saring(data?.beda_kelas ?? [], cari).filter(cocokKelas), [data, cari, saring, cocokKelas]);

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
  ) => {
    // Urutan tampil dipakai baris tabel DAN daftar tetangga dialog profil,
    // supaya "Berikutnya" mengikuti urutan yang sedang dilihat.
    const tampil = urutkan(rows, urutTabel[key].kolom, urutTabel[key].arah, urutTabel[key].arahKolom);
    return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <ExcelTable
        tableKey={`mi_md_${key}`}
        fields={fields}
        rows={tampil}
        getValues={getValues}
         header={<span>{judul}</span>}
        urutAktif={urutTabel[key].kolom}
        arahUrut={urutTabel[key].arah}
        onUrut={(kolom, arah, arahKolom) => terapkanUrut(key, kolom, arah, arahKolom)}
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => {}}
        renderActions={(r) => (<>{aksiProfil(r.santri_id, { prefix: key, daftar: tampil.map((x) => x.santri_id) })}{aksi?.(r)}</>)}
        renderBulkActions={renderBulk}
        emptyText="Tidak ada data."
      />
    </section>
    );
  };

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
      <PengaturanHalaman
        tampil={{ kelas: true }}
        tabel={[
          { key: 'mi_md_mi', judul: 'MI Only', fields: FIELDS_MI },
          { key: 'mi_md_md', judul: 'MD Semua', fields: FIELDS_MD },
          { key: 'mi_md_beda', judul: 'Perbandingan Kelas', fields: FIELDS_BEDA },
        ]}
      />
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
           <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_mi_md">
            <ResizableAutoHidePanel defaultSize="50%" minSize="25%" id="panel_mi_md_kiri">
              <ResizablePanelGroup orientation="vertical" className="min-h-0" id="grup_mi_md_kiri">
                <ResizableAutoHidePanel defaultSize="66.67%" minSize="30%" id="panel_mi_md_mi">
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
                </ResizableAutoHidePanel>
                <ResizableHandle withHandle orientation="vertical" id="gagang_mi_md_mi_beda" aria-label="Atur tinggi tabel MI Only dan Perbandingan Kelas" />
                <ResizablePanel defaultSize="33.33%" minSize="15%" id="panel_mi_md_beda">
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
                            <ArrowRight data-icon="inline-start" />
                            MI
                          </Button>
                          <Button
                            id={`btn_samakan_md_${r.santri_id}`}
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.santri_id}
                            title="Samakan MI dengan MD (buatkan riwayat bila belum ada)"
                            onClick={() => void samakan(r.santri_id, 'ke_mi')}
                          >
                            <ArrowRight data-icon="inline-start" />
                            MD
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
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizableAutoHidePanel>
            <ResizableHandle withHandle orientation="horizontal" id="gagang_mi_md_kiri_md" aria-label="Atur lebar kolom MI-MD dan MD Semua" />
            <ResizablePanel defaultSize="50%" minSize="25%" id="panel_mi_md_md">
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
            </ResizablePanel>
          </ResizablePanelGroup>
        </>
      )}
      {dialogProfil}
    </div>
  );
}

// Re-ekspor tipe agar konsisten dengan pola halaman lain.
export type { MiMdBarisMi, MiMdBarisMd, MiMdBarisBeda };
