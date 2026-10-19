import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { listKelas, type Kelas } from '@/api/master';
import { errorMessage } from '@/api/client';
import { Download, RefreshCw } from '@/icons';
import {
  daftarPeristiwa, hitungUlang, legerNilai, unduhLeger,
  type LegerResp, type PeristiwaNilai,
} from '@/api/penilaian';

/** Halaman Leger Nilai: crosstab santri × mapel untuk SATU PERISTIWA. */
export default function PenilaianLegerPage() {
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'penilaian.ubah');
  const pager = usePager('penilaian_leger');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && ta !== null && semester !== null;

  const [peristiwa, setPeristiwa] = useState<PeristiwaNilai[]>([]);
  const [peristiwaId, setPeristiwaId] = useState<number | ''>('');
  const [data, setData] = useState<LegerResp | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setPeristiwa([]); setPeristiwaId(''); return; }
    let hidup = true;
    daftarPeristiwa({ jenjang, tahun_ajaran: ta })
      .then((r) => {
        if (!hidup) return;
        setPeristiwa(r.peristiwa);
        setPeristiwaId((v) => (r.peristiwa.some((p) => p.id === v) ? v : (r.peristiwa[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) { setPeristiwa([]); setPeristiwaId(''); setErr(errorMessage(e)); } });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  const kelasIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  useEffect(() => {
    const bersih = cari.trim();
    const t = setTimeout(() => setCariTertunda(bersih), bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
  }, [cari]);

  const reqRef = useRef(0);
  const muat = useCallback(async (page: number, perPage: number) => {
    if (peristiwaId === '' || semester === null) { setData(null); return; }
    const req = ++reqRef.current;
    setErr(''); setLoading(true);
    try {
      const res = await legerNilai({
        peristiwa_id: Number(peristiwaId),
        semester,
        tingkat: tingkat.length ? tingkat : undefined,
        kelas_id: kelasIds.length ? kelasIds : undefined,
        q: cariTertunda || undefined,
        page, per_page: perPage === 0 ? 'all' : String(perPage),
      });
      if (req !== reqRef.current) return;
      setData(res);
      pager.sync(res.current_page, res.last_page);
    } catch (e) {
      if (req !== reqRef.current) return;
      setErr(errorMessage(e));
      setData(null);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [peristiwaId, semester, tingkat, kelasIds, cariTertunda, pager]);

  useEffect(() => {
    if (!pager.ready || filterLoading) return;
    void muat(pager.page, pager.perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, filterLoading, peristiwaId, semester, tingkat, kelasIds, cariTertunda, pager.perPage]);

  const unduh = useCallback(() => {
    if (peristiwaId === '') return;
    void unduhLeger({
      peristiwa_id: Number(peristiwaId), semester: semester ?? undefined,
      tingkat: tingkat.length ? tingkat : undefined,
      kelas_id: kelasIds.length ? kelasIds : undefined,
      q: cariTertunda || undefined,
    }).catch((e) => toast.error(errorMessage(e)));
  }, [peristiwaId, semester, tingkat, kelasIds, cariTertunda]);

  const hitung = useCallback(async () => {
    if (peristiwaId === '' || semester === null) return;
    try {
      const r = await hitungUlang({
        peristiwa_id: Number(peristiwaId), semester,
        kelas_id: kelasIds.length === 1 ? kelasIds[0] : null,
      });
      toast.success(r.pesan);
      await muat(pager.page, pager.perPage);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [peristiwaId, semester, kelasIds, muat, pager.page, pager.perPage]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_peristiwa_leger">Peristiwa</label>
        <select
          id="select_peristiwa_leger"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={peristiwaId === '' ? '' : String(peristiwaId)}
          onChange={(e) => { setPeristiwaId(e.target.value === '' ? '' : Number(e.target.value)); pager.goFirst(); }}
        >
          <option value="">— pilih peristiwa —</option>
          {peristiwa.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kode} — {p.nama}{p.jenis_rapor === 'tidak_ada' ? ' (nilai ujian, tanpa rapor)' : ''}
            </option>
          ))}
        </select>
        <Input
          id="input_cari_leger"
          aria-label="Cari nama / NIS"
          placeholder="Cari nama / NIS…"
          className="h-8 w-56 text-xs"
          value={cari}
          onChange={(e) => { setCari(e.target.value); pager.goFirst(); }}
        />
        <span className="text-xs text-muted-foreground">
          {!siap ? 'Pilih satu jenjang, TA, dan semester pada filter di atas.'
            : peristiwa.length === 0 ? 'Belum ada peristiwa — muat bawaan di halaman Master Penilaian.'
              : `${data?.total ?? 0} santri · ${data?.kolom.length ?? 0} mapel`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" id="btn_hitung_ulang" disabled={!canUbah || peristiwaId === ''}
            title="Hitung ulang nilai akhir dari komponen (baris hasil impor dilewati)"
            onClick={() => void hitung()}>
            <RefreshCw data-icon="inline-start" size={16} /> Hitung ulang
          </Button>
          <Button type="button" variant="outline" size="sm" id="btn_unduh_leger" disabled={peristiwaId === ''} onClick={unduh}>
            <Download data-icon="inline-start" size={16} /> Unduh Excel
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && <p className="p-3 text-xs text-muted-foreground">Memuat…</p>}
        {!loading && data !== null && (
          <table className="w-max border-collapse text-xs" id="tabel_leger_nilai">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr>
                <th className="sticky left-0 z-20 border border-border bg-muted/80 px-2 py-1 text-left">NIS</th>
                <th className="sticky left-[70px] z-20 border border-border bg-muted/80 px-2 py-1 text-left">Nama</th>
                <th className="border border-border px-2 py-1 text-left">Kelas</th>
                {data.kolom.map((k) => (
                  <th key={k.key} className="border border-border px-2 py-1 text-center" title={k.nama_mapel}>
                    {k.nama_mapel}
                  </th>
                ))}
                <th className="border border-border px-2 py-1 text-center">Rata²</th>
              </tr>
            </thead>
            <tbody>
              {data.baris.map((b) => (
                <tr key={b.santri_id} className="hover:bg-muted/40">
                  <td className="sticky left-0 z-10 border border-border bg-background px-2 py-1 font-mono">{b.nis_lokal ?? '—'}</td>
                  <td className="sticky left-[70px] z-10 border border-border bg-background px-2 py-1">{b.nama}</td>
                  <td className="border border-border px-2 py-1">{b.kelas ?? '—'}</td>
                  {data.kolom.map((k) => {
                    const sel = b.sel[k.key] ?? null;
                    return (
                      <td key={k.key} className="border border-border px-2 py-1 text-center">
                        {sel === null || sel.nilai === null ? (
                          <span className="text-muted-foreground">·</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            {sel.nilai}
                            {sel.sumber === 'impor' && (
                              <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-700 dark:text-amber-300" title="Diisi lewat impor">I</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-border px-2 py-1 text-center font-medium">{b.rata_rata ?? '—'}</td>
                </tr>
              ))}
              {data.baris.length === 0 && (
                <tr>
                  <td colSpan={4 + data.kolom.length} className="border border-border px-3 py-6 text-center text-muted-foreground">
                    Tidak ada santri pada lingkup ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data !== null && (
        <Pager
          page={pager.page}
          lastPage={data.last_page ?? 1}
          total={data.total ?? 0}
          perPage={pager.perPage}
          onPage={(p) => { pager.setPage(p); void muat(p, pager.perPage); }}
          onPerPage={(pp) => { pager.setPerPage(pp); void muat(1, pp); }}
        />
      )}
    </div>
  );
}
