import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Copy, Save } from '@/icons';
import {
  daftarGuruAktif, daftarKurikulum, daftarKelasKurikulum, daftarPengampu,
  generatePengampu, simpanKelasKurikulum, simpanPengampu,
  type GuruAktif, type Kurikulum, type PengampuBaris,
} from '@/api/kurikulum';

/** Halaman Pengampu: peta kelas→kurikulum + pengampu (kelas × mapel → guru). */
export default function KurikulumPengampuPage() {
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'kurikulum.ubah');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([]);
  const [kurikulumIds, setKurikulumIds] = useState<number[]>([]);
  const [guru, setGuru] = useState<GuruAktif[]>([]);
  const [baris, setBaris] = useState<PengampuBaris[]>([]);
  /** Suntingan guru per mata_pelajaran_id (belum disimpan). */
  const [sunting, setSunting] = useState<Record<number, number | null>>({});
  const [berubah, setBerubah] = useState(false);
  const [err, setErr] = useState('');

  // Daftar kelas + kurikulum jenjang.
  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); setKelasId(''); return; }
    let hidup = true;
    Promise.all([
      listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 }),
      daftarKurikulum(jenjang),
    ])
      .then(([k, kur]) => {
        if (!hidup) return;
        setKelasOpsi(k.data);
        setKurikulum(kur);
        setKelasId((v) => (k.data.some((x) => x.id === v) ? v : (k.data[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  // Guru aktif jenjang+TA.
  useEffect(() => {
    if (jenjang === null || ta === null) { setGuru([]); return; }
    let hidup = true;
    daftarGuruAktif({ jenjang, tahun_ajaran: ta })
      .then((g) => { if (hidup) setGuru(g); })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [jenjang, ta]);

  // Peta kelas→kurikulum milik kelas terpilih.
  const muatPetaKelas = useCallback(async () => {
    if (jenjang === null || ta === null || kelasId === '') return;
    try {
      const { kelas } = await daftarKelasKurikulum({ jenjang, tahun_ajaran: ta });
      setKurikulumIds(kelas.find((k) => k.id === kelasId)?.kurikulum_ids ?? []);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [jenjang, ta, kelasId]);

  useEffect(() => { void muatPetaKelas(); }, [muatPetaKelas]);

  // Pengampu kelas terpilih.
  useEffect(() => {
    if (kelasId === '') { setBaris([]); setSunting({}); setBerubah(false); return; }
    let hidup = true;
    daftarPengampu(kelasId)
      .then((r) => {
        if (!hidup) return;
        setBaris(r.baris);
        setSunting(Object.fromEntries(
          r.baris.map((b) => [b.mata_pelajaran_id, b.keaktifan_pegawai_id]),
        ));
        setBerubah(false);
      })
      .catch((e) => { if (hidup) { setErr(errorMessage(e)); setBaris([]); } });
    return () => { hidup = false; };
  }, [kelasId]);

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string, lalu?: () => void) => {
    try { await kerja(); toast.success(sukses); lalu?.(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, []);

  const muatPengampuKelas = useCallback(async (id: number) => {
    try {
      const r = await daftarPengampu(id);
      setBaris(r.baris);
      setSunting(Object.fromEntries(r.baris.map((b) => [b.mata_pelajaran_id, b.keaktifan_pegawai_id])));
      setBerubah(false);
    } catch (e) { setErr(errorMessage(e)); }
  }, []);

  const simpanKurikulum = useCallback(async () => {
    if (kelasId === '') return;
    await jalankan(
      () => simpanKelasKurikulum(Number(kelasId), kurikulumIds),
      'Kurikulum kelas disimpan.',
      async () => {
        await muatPetaKelas();
        // Muat ulang pengampu agar baris mengikuti kurikulum baru.
        await muatPengampuKelas(Number(kelasId));
      },
    );
  }, [kelasId, kurikulumIds, jalankan, muatPetaKelas, muatPengampuKelas]);

  const simpanSemua = useCallback(async () => {
    if (kelasId === '') return;
    const dikirim = baris
      .filter((b) => sunting[b.mata_pelajaran_id] !== undefined)
      .map((b) => ({ mata_pelajaran_id: b.mata_pelajaran_id, keaktifan_pegawai_id: sunting[b.mata_pelajaran_id] }));
    await jalankan(
      () => simpanPengampu(Number(kelasId), dikirim),
      'Pengampu disimpan.',
      async () => { await muatPengampuKelas(Number(kelasId)); },
    );
  }, [kelasId, baris, sunting, jalankan, muatPengampuKelas]);

  const generate = useCallback(async () => {
    if (kelasId === '') return;
    await jalankan(
      () => generatePengampu(Number(kelasId)),
      'Baris pengampu dibuat.',
      async () => { await muatPengampuKelas(Number(kelasId)); },
    );
  }, [kelasId, jalankan, muatPengampuKelas]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_kelas_pengampu">Kelas</label>
        <select
          id="select_kelas_pengampu"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={kelasId === '' ? '' : String(kelasId)}
          onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— pilih kelas —</option>
          {kelasOpsi.map((k) => (
            <option key={k.id} value={k.id}>{k.nama_kelas} (tingkat {k.tingkat ?? '-'})</option>
          ))}
        </select>
        {kelasId !== '' && (
          <>
            <div className="ml-auto flex gap-2">
              {canUbah && (
                <Button type="button" variant="outline" size="sm" id="btn_generate_pengampu"
                  onClick={() => void generate()}>
                  <Copy data-icon="inline-start" size={14} /> Generate dari kurikulum
                </Button>
              )}
              {canUbah && (
                <Button type="button" size="sm" id="btn_simpan_pengampu" disabled={!berubah}
                  onClick={() => void simpanSemua()}>
                  <Save data-icon="inline-start" size={16} /> Simpan Pengampu
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {kelasId === '' ? (
        <p className="p-4 text-xs text-muted-foreground">Pilih kelas untuk mengatur kurikulum & pengampunya.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {/* Kurikulum kelas */}
          <div className="mb-3 rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium">Kurikulum kelas ini</span>
              <div className="ml-auto">
                {canUbah && (
                  <Button type="button" variant="outline" size="sm" id="btn_simpan_kurikulum_kelas"
                    onClick={() => void simpanKurikulum()}>
                    Simpan kurikulum kelas
                  </Button>
                )}
              </div>
            </div>
            {kurikulum.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada kurikulum untuk jenjang ini — buat di halaman Kurikulum.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {kurikulum.map((k) => (
                  <label key={k.id} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      aria-label={`Kurikulum ${k.nama}`}
                      disabled={!canUbah}
                      checked={kurikulumIds.includes(k.id)}
                      onChange={(e) => setKurikulumIds((prev) =>
                        e.target.checked ? [...prev, k.id] : prev.filter((x) => x !== k.id),
                      )}
                    />
                    {k.nama}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Pengampu */}
          <table className="w-full border-collapse text-xs" id="tabel_pengampu">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Mapel</th>
                <th className="border border-border px-2 py-1 w-28 text-left">Kelompok</th>
                <th className="border border-border px-2 py-1 w-24">Sumber</th>
                <th className="border border-border px-2 py-1 text-left">Guru pengampu</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const nilai = sunting[b.mata_pelajaran_id] ?? null;
                return (
                  <tr key={b.mata_pelajaran_id}>
                    <td className="border border-border px-2 py-1">
                      {b.nama_mapel}
                      {!b.is_active && <span className="ml-1 text-muted-foreground">(nonaktif)</span>}
                    </td>
                    <td className="border border-border px-2 py-1">{b.kelompok === 'formal' ? 'Formal' : 'Pesantren'}</td>
                    <td className="border border-border px-2 py-1 text-center">
                      {b.dari_kurikulum
                        ? <span className="text-[10px] text-muted-foreground">dari kurikulum</span>
                        : <span className="text-[10px] text-muted-foreground">manual</span>}
                    </td>
                    <td className="border border-border px-1 py-0.5">
                      <select
                        className="h-7 w-full max-w-xs rounded-md border border-input bg-transparent px-1 text-xs"
                        aria-label={`Guru ${b.nama_mapel}`}
                        disabled={!canUbah}
                        value={nilai === null ? '' : String(nilai)}
                        onChange={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          setSunting((prev) => ({ ...prev, [b.mata_pelajaran_id]: v }));
                          setBerubah(true);
                        }}
                      >
                        <option value="">— belum ada guru —</option>
                        {guru.map((g) => (
                          <option key={g.keaktifan_pegawai_id} value={g.keaktifan_pegawai_id}>
                            {g.gelar_depan ? `${g.gelar_depan} ` : ''}{g.nama_lengkap}{g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {baris.length === 0 && (
                <tr><td colSpan={4} className="border border-border px-2 py-4 text-center text-muted-foreground">
                  Belum ada mapel untuk kelas ini — pasang kurikulum di atas, lalu klik “Generate dari kurikulum”.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
