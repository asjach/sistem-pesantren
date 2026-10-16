import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { errorMessage } from '@/api/client';
import { ambilRapor, raporKelas, type RaporKelasResp, type RaporResp } from '@/api/penilaian';

/** Halaman Rapor: pilih kelas → daftar santri (+ kelengkapan) → pratinjau & cetak. */
export default function PenilaianRaporPage() {
  const { jenjangs, tahunAjaranNames, semesters, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && ta !== null && semester !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [daftar, setDaftar] = useState<RaporKelasResp | null>(null);
  const [rapor, setRapor] = useState<RaporResp | null>(null);
  const [santriAktif, setSantriAktif] = useState<number | null>(null);
  const [peringkat, setPeringkat] = useState<'3' | '10' | 'semua'>('10');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((p) => {
        if (!hidup) return;
        setKelasOpsi(p.data);
        // Kelas dari rail (bila satu) jadi pilihan awal.
        const dariRail = p.data.find((k) => kelasAktif.includes(k.nama_kelas));
        setKelasId((v) => (v !== '' ? v : (dariRail?.id ?? p.data[0]?.id ?? '')));
      })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta, kelasAktif]);

  const muatDaftar = useCallback(async () => {
    if (jenjang === null || ta === null || semester === null || kelasId === '') { setDaftar(null); return; }
    setErr(''); setLoading(true);
    try {
      setDaftar(await raporKelas({ jenjang, tahun_ajaran: ta, semester, kelas_id: Number(kelasId) }));
    } catch (e) {
      setErr(errorMessage(e)); setDaftar(null);
    } finally { setLoading(false); }
  }, [jenjang, ta, semester, kelasId]);

  useEffect(() => { void muatDaftar(); }, [muatDaftar]);

  const bukaRapor = useCallback(async (santriId: number, urut: '3' | '10' | 'semua' = peringkat) => {
    if (ta === null || semester === null) return;
    setSantriAktif(santriId); setErr('');
    try {
      setRapor(await ambilRapor({ santri_id: santriId, tahun_ajaran: ta, semester, peringkat: urut }));
    } catch (e) {
      setErr(errorMessage(e)); setRapor(null);
    }
  }, [ta, semester, peringkat]);

  const ubahPeringkat = useCallback((v: '3' | '10' | 'semua') => {
    setPeringkat(v);
    if (santriAktif !== null) void bukaRapor(santriAktif, v);
  }, [santriAktif, bukaRapor]);

  const kelasNama = useMemo(
    () => kelasOpsi.find((k) => k.id === kelasId)?.nama_kelas ?? '',
    [kelasOpsi, kelasId],
  );

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 print:hidden">
        <label className="text-xs text-muted-foreground" htmlFor="select_kelas_rapor">Kelas</label>
        <select
          id="select_kelas_rapor"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={kelasId === '' ? '' : String(kelasId)}
          onChange={(e) => { setKelasId(e.target.value === '' ? '' : Number(e.target.value)); setSantriAktif(null); setRapor(null); }}
        >
          <option value="">— pilih kelas —</option>
          {kelasOpsi.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
        </select>
        <label className="ml-2 text-xs text-muted-foreground" htmlFor="select_peringkat_rapor">Peringkat</label>
        <select
          id="select_peringkat_rapor"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={peringkat}
          onChange={(e) => ubahPeringkat(e.target.value as '3' | '10' | 'semua')}
        >
          <option value="3">3 besar</option>
          <option value="10">10 besar</option>
          <option value="semua">Semua</option>
        </select>
        {daftar && (
          <span className="text-xs text-muted-foreground">
            {daftar.ringkasan.santri} santri · {daftar.ringkasan.lengkap} lengkap · {daftar.ringkasan.mapel} mapel
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" id="btn_cetak_rapor" disabled={rapor === null}
            onClick={() => window.print()}>
            Cetak / PDF
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Daftar santri kelas + kelengkapan (kiri) */}
        <div className="min-h-0 w-72 shrink-0 overflow-auto border-r border-border print:hidden">
          {!siap && <p className="p-3 text-xs text-muted-foreground">Pilih satu jenjang, TA, dan semester pada filter di atas.</p>}
          {loading && <p className="p-3 text-xs text-muted-foreground">Memuat…</p>}
          {!loading && daftar?.baris.map((b) => (
            <button
              key={b.santri_id}
              type="button"
              onClick={() => void bukaRapor(b.santri_id)}
              className={`flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-xs hover:bg-muted/50 ${santriAktif === b.santri_id ? 'bg-muted' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.nama}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">{b.nis_lokal ?? '—'}</span>
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${b.lengkap ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/15 text-destructive'}`}
                title={`${b.mapel_terisi}/${b.mapel_total} mapel terisi${b.ada_catatan ? '' : ' · catatan wali kosong'}`}
              >
                {b.mapel_terisi}/{b.mapel_total}
              </span>
            </button>
          ))}
          {!loading && daftar !== null && daftar.baris.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Tidak ada santri di kelas ini.</p>
          )}
        </div>

        {/* Pratinjau rapor */}
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          {rapor === null ? (
            <p className="text-xs text-muted-foreground">Pilih santri di kiri untuk melihat pratinjau rapor.</p>
          ) : (
            <RaporCetak rapor={rapor} kelasNama={kelasNama} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Pratinjau rapor siap-cetak (satu halaman per jenjang; spesimen MI/MD). */
function RaporCetak({ rapor, kelasNama }: { rapor: RaporResp; kelasNama: string }) {
  const r = rapor;
  return (
    <div id="area_cetak_rapor" className="mx-auto max-w-[800px] bg-white p-6 text-black shadow-sm print:shadow-none">
      {/* Kop */}
      <div className="flex items-center gap-3 border-b-2 border-black pb-2">
        {r.kop.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.kop.logo_url} alt="" className="h-14 w-14 object-contain" />
        )}
        <div className="flex-1 text-center">
          <p className="text-sm font-bold uppercase">{r.kop.nama}</p>
          {r.kop.alamat && <p className="text-[11px]">{r.kop.alamat}</p>}
          {r.kop.kab_kota && <p className="text-[11px]">{r.kop.kab_kota}</p>}
        </div>
      </div>

      {/* Identitas */}
      <table className="mt-3 w-full text-[12px]">
        <tbody>
          <tr>
            <td className="w-40 py-0.5">Nama</td><td className="w-3">:</td><td className="font-semibold">{r.santri.nama}</td>
            <td className="w-28">Kelas</td><td className="w-3">:</td><td>{r.identitas.kelas ?? kelasNama} / {r.identitas.semester === '2' ? 'Genap' : 'Ganjil'}</td>
          </tr>
          <tr>
            <td className="py-0.5">NIS</td><td>:</td><td>{r.santri.nis_lokal ?? '—'}</td>
            <td>Tahun Ajaran</td><td>:</td><td>{r.identitas.tahun_ajaran}</td>
          </tr>
          {r.santri.nisn && (
            <tr><td className="py-0.5">NISN</td><td>:</td><td>{r.santri.nisn}</td><td /></tr>
          )}
        </tbody>
      </table>

      {/* Tabel nilai */}
      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-1 py-1 w-8">NO</th>
            <th className="border border-black px-2 py-1 text-left">MATA PELAJARAN</th>
            <th className="border border-black px-1 py-1 w-20">NILAI AKHIR</th>
            <th className="border border-black px-2 py-1 text-left w-56">TERBILANG</th>
          </tr>
        </thead>
        <tbody>
          {r.mapel.map((m, i) => (
            <tr key={`${m.nama_mapel}-${i}`}>
              <td className="border border-black px-1 py-1 text-center">{i + 1}</td>
              <td className="border border-black px-2 py-1">
                <span className="font-medium">{m.nama_mapel}</span>
                {m.guru && <span className="block text-[10px] italic">Guru: {m.guru}</span>}
              </td>
              <td className="border border-black px-1 py-1 text-center font-semibold">{m.nilai_akhir ?? '—'}</td>
              <td className="border border-black px-2 py-1 italic">{m.terbilang}</td>
            </tr>
          ))}
          {r.mapel.length === 0 && (
            <tr><td colSpan={4} className="border border-black px-2 py-3 text-center">Belum ada nilai.</td></tr>
          )}
        </tbody>
      </table>

      {/* Rekap */}
      <table className="mt-1 w-full border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 w-40">Jumlah</td>
            <td className="border border-black px-2 py-1 text-center w-24">{r.rekap.jumlah ?? '—'}</td>
            <td className="border border-black px-2 py-1 w-40">Rata-Rata</td>
            <td className="border border-black px-2 py-1 text-center">{r.rekap.rata_rata ?? '—'}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">Peringkat</td>
            <td className="border border-black px-2 py-1 text-center" colSpan={3}>
              {r.rekap.peringkat === null ? '—' : `${r.rekap.peringkat} (${r.rekap.peringkat_ordinal}) dari ${r.rekap.peringkat_total}`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Halaman 2 */}
      <div className="mt-4 border-t-2 border-dashed border-black pt-3 text-[12px]">
        <p className="mb-2 font-bold uppercase">Keterangan</p>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 w-40">Status Kenaikan</td>
              <td className="border border-black px-2 py-1">{r.catatan_wali.status_kenaikan ?? '—'}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1">Ketidakhadiran</td>
              <td className="border border-black px-2 py-1">
                Sakit: {r.catatan_wali.sakit} hari · Izin: {r.catatan_wali.izin} hari · Alpa: {r.catatan_wali.alpa} hari
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">Ekstrakurikuler</td>
              <td className="border border-black px-2 py-1">
                {r.ekskul.length === 0 ? '—' : (
                  <ul className="list-disc pl-4">
                    {r.ekskul.map((e, i) => (
                      <li key={`${e.nama}-${i}`}>
                        {e.nama}{e.pembimbing ? ` (${e.pembimbing})` : ''} — {e.predikat ?? e.nilai ?? '—'}{e.deskripsi ? `: ${e.deskripsi}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">Prestasi</td>
              <td className="border border-black px-2 py-1">
                {r.prestasi.length === 0 ? '—' : (
                  <ul className="list-disc pl-4">
                    {r.prestasi.map((p, i) => (
                      <li key={`${p.prestasi}-${i}`}>{p.prestasi}{p.level ? ` (${p.level})` : ''}{p.keterangan ? ` — ${p.keterangan}` : ''}</li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">Catatan Wali</td>
              <td className="border border-black px-2 py-1">{r.catatan_wali.catatan ?? '—'}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 align-top">Tanggapan Orang Tua</td>
              <td className="border border-black px-2 py-1 h-16" />
            </tr>
          </tbody>
        </table>

        {/* Tanda tangan */}
        <div className="mt-6 flex justify-between text-center text-[12px]">
          <div className="w-56">
            <p>Orang Tua/Wali</p>
            <div className="h-14" />
            <p className="border-t border-black">(………………………)</p>
          </div>
          <div className="w-56">
            <p>Wali Kelas</p>
            <div className="h-14" />
            <p className="border-t border-black">{r.penandatangan.wali_kelas ?? '(………………………)'}</p>
          </div>
          <div className="w-56">
            <p>Kepala Madrasah</p>
            <div className="h-14" />
            <p className="border-t border-black">{r.penandatangan.kepala ?? '(………………………)'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
