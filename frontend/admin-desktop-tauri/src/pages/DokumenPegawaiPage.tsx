import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { listPegawai, type Pegawai } from '@/api/pegawai';
import { listDokumen } from '@/api/dokumen';
import { Badge } from '@/components/ui/badge';
import { FieldLabel } from '@/components/ui/field';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import PanelDokumen from '@/components/dokumen/PanelDokumen';
import TambahDokumenPegawaiDialog from '@/components/dokumen/TambahDokumenPegawaiDialog';

/** Halaman Dokumen Pegawai — tata letak sama dengan Tambah Dokumen.
 *  Kolom 1 baris 1: tabel Daftar Pegawai; baris 2: daftar dokumen milik
 *  pegawai terpilih (klik baris = pratinjau di kolom 2).
 *  Kolom 2: pratinjau baca-saja + aksi Unduh/Ganti per baris.
 *  Logika & tampilan dokumen dipakai bersama Dokumen Santri lewat
 *  PanelDokumen; halaman ini hanya mengurus panel subjek (pegawai). */
export default function DokumenPegawaiPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'dokumen_pegawai.ubah');
  const canHapus = bisa(user, 'dokumen_pegawai.hapus');
  const canTambah = bisa(user, 'dokumen_pegawai.tambah');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();

  // ----- Daftar pegawai (kolom 1, baris 1) -----
  const [cari, setCari] = useState('');
  const [cariTunda, setCariTunda] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCariTunda(cari), 350);
    return () => clearTimeout(t);
  }, [cari]);

  /** Sumber daftar: filter pegawai topBar vs buku induk (scope admin). */
  const [sumber, setSumber] = useState<'filter' | 'buku'>('filter');

  const [pegawais, setPegawais] = useState<Pegawai[]>([]);
  const [loadingPegawai, setLoadingPegawai] = useState(false);
  const [err, setErr] = useState('');

  /** True bila pegawai punya penempatan aktif di lembaga_pegawai. Saat
   *  `jenjang` tidak kosong, penempatan aktif harus di salah satu jenjang itu. */
  function punyaPenempatanAktif(p: Pegawai, jenjang: readonly string[]): boolean {
    return (p.penempatan ?? []).some((t) => t.is_active_lembaga === 'Ya'
      && (jenjang.length === 0 || jenjang.includes(t.jenjang)));
  }

  /** Daftar pegawai dimuat utuh tanpa pagination (per_page=0 = semua baris).
   *  Filter kosong (mode "Semua") = tanpa filter, bukan daftar kosong.
   *  Mode "Filter Pegawai" hanya menampilkan pegawai dengan penempatan AKTIF
   *  di lembaga_pegawai (dalam lingkup jenjang filter); mode "Buku Induk"
   *  menampilkan seluruh baris pegawai, aktif maupun tidak. */
  const muatPegawai = useCallback(async (signal?: AbortSignal) => {
    if (filterLoading) { setPegawais([]); return; }
    setLoadingPegawai(true);
    setErr('');
    try {
      const res = await listPegawai({
        ...(sumber === 'filter'
          ? {
              jenjang: jenjangs.length ? jenjangs : undefined,
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
            }
          : {}),
        q: cariTunda || undefined,
        per_page: 0,
        signal,
      });
      const urut = [...res.data].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id'));
      setPegawais(sumber === 'filter' ? urut.filter((p) => punyaPenempatanAktif(p, jenjangs)) : urut);
    } catch (e) {
      if (signal?.aborted) return;
      setErr(errorMessage(e));
    } finally {
      setLoadingPegawai(false);
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, cariTunda]);

  useEffect(() => {
    const c = new AbortController();
    void muatPegawai(c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, cariTunda]);

  const [pegawaiId, setPegawaiId] = useState<number | null>(null);

  /** Jumlah dokumen per pegawai (kunci: pegawai_id) — satu fetch; tanpa
   *  filter = seluruh lingkup akses. */
  const [jumlahPegawai, setJumlahPegawai] = useState<Record<number, number>>({});
  // Tanpa filter jenjang + satu baris per dokumen: sama dengan daftar dokumen
  // per pegawai (yang hanya disaring pegawai_id), sehingga badge "Dok"
  // tidak pernah lebih kecil dari isi daftar.
  const muatJumlahPegawai = useCallback(async (): Promise<Record<number, number>> => {
    try {
      const p = await listDokumen('pegawai', { per_page: 0 });
      const hitung: Record<number, number> = {};
      for (const d of p.data) {
        const pid = d.pegawai_id;
        if (pid != null) hitung[pid] = (hitung[pid] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, []);
  useEffect(() => {
    let hidup = true;
    void muatJumlahPegawai().then((h) => { if (hidup) setJumlahPegawai(h); });
    return () => { hidup = false; };
  }, [muatJumlahPegawai]);

  /** Pegawai terpilih (fallback nama guru bila baris tak memuat join). */
  const pegawaiDipilih = useMemo(() => pegawais.find((p) => p.id === pegawaiId) ?? null, [pegawais, pegawaiId]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari pegawai…" />
      <PengaturanHalaman tampil={{}} />
      <PanelDokumen
        entitas="pegawai"
        subjekId={pegawaiId}
        subjekTerpilih={pegawaiDipilih ? { namaLengkap: pegawaiDipilih.nama_lengkap } : null}
        jenjangs={jenjangs}
        filterLoading={filterLoading}
        bolehUbah={canUbah}
        bolehHapus={canHapus}
        bolehTambah={canTambah}
        segarkanJumlah={() => { void muatJumlahPegawai().then(setJumlahPegawai); }}
        panelSubjek={(
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <FieldLabel id="label_sumber_pegawai_lihat">Daftar pegawai</FieldLabel>
            <div id="radio_sumber_pegawai_lihat" role="radiogroup" aria-labelledby="label_sumber_pegawai_lihat" className="flex flex-wrap gap-2">
              {([
                ['filter', 'Filter Pegawai'],
                ['buku', 'Buku Induk'],
              ] as const).map(([nilai, label]) => (
                <label
                  key={nilai}
                  htmlFor={'radio_sumber_lihat_pegawai_' + nilai}
                  className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                >
                  <input
                    type="radio"
                    id={'radio_sumber_lihat_pegawai_' + nilai}
                    name="sumber_pegawai_lihat"
                    value={nilai}
                    checked={sumber === nilai}
                    onChange={() => { setSumber(nilai); setPegawaiId(null); }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="min-h-[120px] flex-1 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Nama</th>
                    <th className="px-2 py-1 font-medium">NIPP</th>
                    <th className="px-2 py-1 font-medium">Dok</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPegawai ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">Memuat…</td></tr>
                  ) : pegawais.length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">{sumber === 'filter' ? 'Tidak ada pegawai pada filter ini.' : 'Tidak ada pegawai.'}</td></tr>
                  ) : pegawais.map((p) => {
                    const aktif = p.id === pegawaiId;
                    const n = jumlahPegawai[p.id] ?? 0;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setPegawaiId(p.id)}
                        title="Klik untuk memilih"
                        aria-selected={aktif}
                        className={cn(
                          'cursor-pointer border-t',
                          aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                        )}
                      >
                        <td className="px-2 py-1">
                          {p.nama_lengkap}
                          {p.status_aktif !== 'Ya' && <Badge variant="destructive" className="ml-1 py-0 align-middle text-[9px] leading-3">Nonaktif</Badge>}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{p.nipp ?? '—'}</td>
                        <td className="px-2 py-1"><Badge variant={n > 0 ? 'secondary' : 'outline'} className="py-0 leading-4">{n}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        dialogTambah={({ terbuka, onTutup, onSelesai }) => (pegawaiDipilih ? (
          <TambahDokumenPegawaiDialog
            terbuka={terbuka}
            pemilik={{
              id: pegawaiDipilih.id,
              namaLengkap: pegawaiDipilih.nama_lengkap,
              nipp: pegawaiDipilih.nipp,
              penempatanAktif: [...new Set((pegawaiDipilih.penempatan ?? [])
                .filter((t) => t.is_active_lembaga === 'Ya')
                .map((t) => t.jenjang))],
            }}
            onTutup={onTutup}
            onSelesai={onSelesai}
          />
        ) : null)}
      />
    </div>
  );
}
