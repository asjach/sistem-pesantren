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
import { Input } from '@/components/ui/input';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight, X } from '@/icons';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { toast } from 'sonner';

/** Halaman MI-MD: MI saja | MD semua | beda kelas by-nama + aksi samakan dua arah. */
export default function MiMdPage() {
  const { user } = useAuth();
  const canSamakan = bisa(user, 'pindah_kelas.ubah');
  const canDaftar = bisa(user, 'santri.tambah');
  const canHentikan = bisa(user, 'santri.ubah');
  const [data, setData] = useState<MiMdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [cariMi, setCariMi] = useState('');
  const [cariMd, setCariMd] = useState('');
  const [cariBeda, setCariBeda] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pilihMi, setPilihMi] = useState<Set<number>>(new Set());
  const [pilihMd, setPilihMd] = useState<Set<number>>(new Set());
  const [pilihBeda, setPilihBeda] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      setData(await listMiMd());
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const rowsMi = useMemo(() => saring(data?.mi_only ?? [], cariMi), [data, cariMi, saring]);
  const rowsMd = useMemo(() => saring(data?.md_semua ?? [], cariMd), [data, cariMd, saring]);
  const rowsBeda = useMemo(() => saring(data?.beda_kelas ?? [], cariBeda), [data, cariBeda, saring]);

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

  async function samakanBanyak(ids: number[], arah: 'ke_mi' | 'ke_md') {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await samakanKelasMiMd(ids.map((santri_id) => ({ santri_id, arah })));
      if (res.gagal.length > 0) {
        toast.error(`${res.pesan} ${res.gagal.map((g) => g.pesan).join(' · ')}`);
      } else {
        toast.success(res.pesan);
      }
      setPilihBeda(new Set());
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBulkBusy(false);
    }
  }

  async function daftarkanBanyak(ids: number[]) {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await daftarkanMdMiMd(ids.map((santri_id) => ({ santri_id })));
      if (res.gagal.length > 0) {
        toast.error(`${res.pesan} ${res.gagal.map((g) => g.pesan).join(' · ')}`);
      } else {
        toast.success(res.pesan);
      }
      setPilihMi(new Set());
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

  async function hentikanBanyak(ids: number[]) {
    // Hanya yang juga-MI yang bisa dikeluarkan; murni MD dilewati.
    const peta = new Map(rowsMd.map((r) => [r.santri_id, r]));
    const layak = ids.filter((id) => peta.get(id)?.juga_mi === true);
    const lewati = ids.length - layak.length;
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
      setPilihMd(new Set());
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
    cari: string,
    setCari: (v: string) => void,
    fields: ExcelField[],
    rows: Baris[],
    getValues: (r: Baris) => Record<string, string | null>,
    aksi?: (r: Baris) => ReactNode,
    aksiKepala?: ReactNode,
    terpilih?: (rows: Baris[]) => void,
  ) => (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{judul} ({jumlah})</span>
        {aksiKepala}
      </header>
      <div className="px-2 pt-2">
        <Input
          id={`input_cari_${key}`}
          placeholder="Cari nama…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>
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
          onCheckedChange={terpilih ? (rows) => terpilih(rows) : undefined}
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
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-4">
          {panel('mi', 'MI Only', data?.mi_only.length ?? 0, cariMi, setCariMi, FIELDS_MI, rowsMi, nilaiStatis,
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
              ? (
                <Button
                  id="btn_bulk_daftar_md"
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy || pilihMi.size === 0}
                  title="Daftarkan yang tercentang ke MD"
                  onClick={() => void daftarkanBanyak([...pilihMi])}
                >
                  Ke MD ({pilihMi.size})
                </Button>
              )
              : undefined,
            (rows) => setPilihMi(new Set(rows.map((r) => r.santri_id))),
          )}
          {panel('md', 'MD Semua', data?.md_semua.length ?? 0, cariMd, setCariMd, FIELDS_MD, rowsMd, nilaiStatis,
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
              ? (
                <Button
                  id="btn_bulk_hentikan_md"
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={bulkBusy || pilihMd.size === 0}
                  title="Keluarkan yang tercentang dari MD (murni MD dilewati)"
                  onClick={() => void hentikanBanyak([...pilihMd])}
                >
                  Keluarkan ({pilihMd.size})
                </Button>
              )
              : undefined,
            (rows) => setPilihMd(new Set(rows.map((r) => r.santri_id))),
          )}
          {panel(
            'beda',
            'Perbandingan Kelas',
            data?.beda_kelas.length ?? 0,
            cariBeda,
            setCariBeda,
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
                    title="Pindahkan MD ke kelas senama MI"
                    onClick={() => void samakan(r.santri_id, 'ke_md')}
                  >
                    Samakan dengan MI
                  </Button>
                  <Button
                    id={`btn_samakan_md_${r.santri_id}`}
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.santri_id}
                    title="Pindahkan MI ke kelas senama MD"
                    onClick={() => void samakan(r.santri_id, 'ke_mi')}
                  >
                    Samakan dengan MD
                  </Button>
                </div>
              )
              : undefined,
            canSamakan
              ? (
                <div className="flex gap-1">
                  <Button
                    id="btn_bulk_samakan_mi"
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy || pilihBeda.size === 0}
                    title="Samakan yang tercentang dengan MI"
                    onClick={() => void samakanBanyak([...pilihBeda], 'ke_md')}
                  >
                    Ikut MI ({pilihBeda.size})
                  </Button>
                  <Button
                    id="btn_bulk_samakan_md"
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy || pilihBeda.size === 0}
                    title="Samakan yang tercentang dengan MD"
                    onClick={() => void samakanBanyak([...pilihBeda], 'ke_mi')}
                  >
                    Ikut MD ({pilihBeda.size})
                  </Button>
                </div>
              )
              : undefined,
            (rows) => setPilihBeda(new Set(rows.map((r) => r.santri_id))),
          )}
        </div>
      )}
    </div>
  );
}

// Re-ekspor tipe agar konsisten dengan pola halaman lain.
export type { MiMdBarisMi, MiMdBarisMd, MiMdBarisBeda };
