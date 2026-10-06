import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { listSantri, type Santri } from '@/api/santri';
import { listDokumen } from '@/api/dokumen';
import { listKelas, type Kelas } from '@/api/master';
import { listRiwayatBelajar } from '@/api/siklus';
import { Badge } from '@/components/ui/badge';
import { FieldLabel } from '@/components/ui/field';
import FilterRail from '@/components/FilterRail';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ProfilSantriDialog } from '@/components/ProfilSantriDialog';
import { cn } from '@/lib/utils';
import { jenjangTampilSantri, urutSantriFilter, type InfoUrutSantri } from '@/lib/urut';
import PanelDokumen from '@/components/dokumen/PanelDokumen';
import TambahDokumenSantriDialog from '@/components/dokumen/TambahDokumenSantriDialog';

/** Halaman Dokumen Santri — tata letak sama dengan Tambah Dokumen.
 *  Kolom 1 baris 1: tabel Daftar Santri; baris 2: daftar dokumen milik
 *  santri terpilih (klik baris = pratinjau di kolom 2).
 *  Kolom 2: pratinjau baca-saja + aksi Unduh/Ganti per baris.
 *  Logika & tampilan dokumen dipakai bersama Dokumen Pegawai lewat
 *  `PanelDokumen`; halaman ini hanya mengurus panel subjek (santri). */
export default function DokumenSantriPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'dokumen_santri.ubah');
  const canHapus = bisa(user, 'dokumen_santri.hapus');
  const canTambah = bisa(user, 'dokumen_santri.tambah');
  const {
    jenjangs,
    tahunAjaranNames,
    semesters,
    tingkat: tingkatAktif,
    kelas: kelasAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();

  // ----- Daftar santri (kolom 1, baris 1) -----
  const [cari, setCari] = useState('');
  const [cariTunda, setCariTunda] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCariTunda(cari), 350);
    return () => clearTimeout(t);
  }, [cari]);

  /** Sumber daftar: filter akademik topBar vs buku induk (scope admin). */
  const [sumber, setSumber] = useState<'filter' | 'buku'>('filter');
  /** Opsi kelas untuk memetakan nama filter global → id param server. */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  useEffect(() => {
    if (sumber !== 'filter' || filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames]);
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  const [santris, setSantris] = useState<Santri[]>([]);
  const [loadingSantri, setLoadingSantri] = useState(false);
  const [err, setErr] = useState('');

  /** Daftar santri dimuat utuh tanpa pagination (per_page=0 = semua baris). */
  const muatSantri = useCallback(async (signal?: AbortSignal) => {
    if (filterLoading || jenjangs.length === 0) { setSantris([]); return; }
    setLoadingSantri(true);
    setErr('');
    try {
      const res = await listSantri({
        jenjang: jenjangs,
        ...(sumber === 'filter'
          ? {
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
              semester: semesters.length ? semesters : undefined,
              tingkat: tingkatAktif.length ? tingkatAktif : undefined,
              kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
            }
          : {}),
        q: cariTunda || undefined,
        per_page: 0,
        signal,
      });
      setSantris(res.data);
    } catch (e) {
      if (signal?.aborted) return;
      setErr(errorMessage(e));
    } finally {
      setLoadingSantri(false);
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds, cariTunda]);

  useEffect(() => {
    const c = new AbortController();
    void muatSantri(c.signal);
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds, cariTunda]);

  const [santriId, setSantriId] = useState<number | null>(null);
  /** Profil yang dibuka via klik kanan baris (verifikasi identitas). */
  const [profilId, setProfilId] = useState<number | null>(null);

  /** Kelas per santri (kunci: santri_id) dari riwayat belajar sesuai filter. */
  const [kelasSantri, setKelasSantri] = useState<Record<number, string>>({});
  /** Tingkat per santri (kunci: santri_id) — segmen urut mode filter. */
  const [tingkatSantri, setTingkatSantri] = useState<Record<number, string>>({});
  const muatKelasSantri = useCallback(async (): Promise<{ kelas: Record<number, string>; tingkat: Record<number, string> }> => {
    try {
      if (filterLoading || jenjangs.length === 0) return { kelas: {}, tingkat: {} };
      const p = await listRiwayatBelajar({
        jenjang: jenjangs,
        ...(sumber === 'filter'
          ? {
              tahun_ajaran: tahunAjaranNames.length ? tahunAjaranNames : undefined,
              semester: semesters.length ? semesters : undefined,
              tingkat: tingkatAktif.length ? tingkatAktif : undefined,
              kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
            }
          : {}),
        // Bawaan backend hanya baris aktif (kosong untuk filter historis) —
        // minta semua, lalu utamakan yang aktif per santri di bawah.
        is_active_riwayat: 'semua',
        per_page: 0,
      });
      const peta: Record<number, { nama: string; tingkat: string; aktif: boolean }> = {};
      for (const r of p.data) {
        const nama = r.kelas?.nama_kelas?.trim();
        if (!nama) continue;
        const aktif = r.is_active_riwayat === 'Ya';
        if (!peta[r.santri_id] || (aktif && !peta[r.santri_id].aktif)) {
          peta[r.santri_id] = { nama, tingkat: r.tingkat?.trim() ?? '', aktif };
        }
      }
      return {
        kelas: Object.fromEntries(Object.entries(peta).map(([k, v]) => [Number(k), v.nama])),
        tingkat: Object.fromEntries(Object.entries(peta).map(([k, v]) => [Number(k), v.tingkat])),
      };
    } catch {
      return { kelas: {}, tingkat: {} };
    }
  }, [sumber, filterLoading, jenjangs, tahunAjaranNames, semesters, tingkatAktif, kelasFilterIds]);
  useEffect(() => {
    let hidup = true;
    void muatKelasSantri().then((m) => { if (hidup) { setKelasSantri(m.kelas); setTingkatSantri(m.tingkat); } });
    return () => { hidup = false; };
  }, [muatKelasSantri]);

  /** Jumlah dokumen per santri (kunci: santri_id) — satu fetch per jenjang. */
  const [jumlahSantri, setJumlahSantri] = useState<Record<number, number>>({});
  const muatJumlahSantri = useCallback(async (): Promise<Record<number, number>> => {
    try {
      if (jenjangs.length === 0) return {};
      const p = await listDokumen('santri', { jenjang: jenjangs, per_page: 0 });
      const hitung: Record<number, number> = {};
      for (const d of p.data) {
        const sid = d.santri_id;
        if (sid != null) hitung[sid] = (hitung[sid] ?? 0) + 1;
      }
      return hitung;
    } catch {
      return {};
    }
  }, [jenjangs]);
  useEffect(() => {
    let hidup = true;
    void muatJumlahSantri().then((h) => { if (hidup) setJumlahSantri(h); });
    return () => { hidup = false; };
  }, [muatJumlahSantri]);

  /** Santri terpilih (fallback nama bila baris tak memuat join). */
  const santriDipilih = useMemo(() => santris.find((p) => p.id === santriId) ?? null, [santris, santriId]);
  const daftarIds = useMemo(() => santris.map((s) => s.id), [santris]);

  /** Mode filter: urut jenjang → tingkat → kelas → nama → jk. */
  const infoUrutSantri = useMemo(() => {
    const m: Record<number, InfoUrutSantri> = {};
    for (const s of santris) {
      m[s.id] = {
        jenjang: jenjangTampilSantri(s),
        tingkat: tingkatSantri[s.id] ?? '',
        kelas: kelasSantri[s.id] ?? '',
      };
    }
    return m;
  }, [santris, tingkatSantri, kelasSantri]);
  const santriTampil = useMemo(
    () => (sumber === 'filter' ? urutSantriFilter(santris, infoUrutSantri) : santris),
    [sumber, santris, infoUrutSantri],
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <PengaturanHalaman tampil={sumber === 'filter' ? { tahun_ajaran: true, semester: true, tingkat: true, kelas: true } : {}} />
      {/* Rel Tingkat/Kelas di kiri konten (halaman tanpa grid: sejajar atas
          panel dokumen) — hanya saat sumber daftar = Filter Santri. */}
      <div className="flex min-h-0 flex-1">
        {sumber === 'filter' ? <FilterRail /> : null}
        <PanelDokumen
          entitas="santri"
          subjekId={santriId}
          subjekTerpilih={santriDipilih ? { namaLengkap: santriDipilih.nama_lengkap } : null}
          jenjangs={jenjangs}
          filterLoading={filterLoading}
          bolehUbah={canUbah}
          bolehHapus={canHapus}
          bolehTambah={canTambah}
          segarkanJumlah={() => { void muatJumlahSantri().then(setJumlahSantri); }}
          panelSubjek={(
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <FieldLabel id="label_sumber_santri_lihat">Daftar santri</FieldLabel>
              <div id="radio_sumber_santri_lihat" role="radiogroup" aria-labelledby="label_sumber_santri_lihat" className="flex flex-wrap gap-2">
                {([
                  ['filter', 'Filter Santri'],
                  ['buku', 'Buku Induk'],
                ] as const).map(([nilai, label]) => (
                  <label
                    key={nilai}
                    htmlFor={'radio_sumber_lihat_' + nilai}
                    className="inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold"
                  >
                    <input
                      type="radio"
                      id={'radio_sumber_lihat_' + nilai}
                      name="sumber_santri_lihat"
                      value={nilai}
                      checked={sumber === nilai}
                      onChange={() => { setSumber(nilai); setSantriId(null); }}
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
                      <th className="px-2 py-1 font-medium">Kelas</th>
                      <th className="px-2 py-1 font-medium">Dok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSantri ? (
                      <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">Memuat…</td></tr>
                    ) : santriTampil.length === 0 ? (
                      <tr><td colSpan={3} className="px-2 py-1 text-center text-muted-foreground">{sumber === 'filter' ? 'Tidak ada santri pada filter ini.' : 'Tidak ada santri.'}</td></tr>
                    ) : santriTampil.map((s) => {
                      const aktif = s.id === santriId;
                      const n = jumlahSantri[s.id] ?? 0;
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSantriId(s.id)}
                          onContextMenu={(e) => { e.preventDefault(); setProfilId(s.id); }}
                          title="Klik untuk memilih, klik kanan untuk profil"
                          aria-selected={aktif}
                          className={cn(
                            'cursor-pointer border-t',
                            aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                          )}
                        >
                          <td className="px-2 py-1">
                            {s.nama_lengkap}
                            {s.is_active_pst !== 'Ya' && <Badge variant="destructive" className="ml-1 py-0 align-middle text-[9px] leading-3">Nonaktif</Badge>}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">{kelasSantri[s.id] ?? '—'}</td>
                          <td className="px-2 py-1"><Badge variant={n > 0 ? 'secondary' : 'outline'} className="py-0 leading-4">{n}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          dialogTambah={({ terbuka, onTutup, onSelesai }) => (santriDipilih ? (
            <TambahDokumenSantriDialog
              terbuka={terbuka}
              pemilik={{ id: santriDipilih.id, namaLengkap: santriDipilih.nama_lengkap }}
              onTutup={onTutup}
              onSelesai={onSelesai}
            />
          ) : null)}
        />
      </div>
      <ProfilSantriDialog
        target={profilId != null ? { id: profilId, daftar: daftarIds } : null}
        onGanti={(id) => setProfilId(id)}
        onOpenChange={(o) => { if (!o) setProfilId(null); }}
      />
    </div>
  );
}
