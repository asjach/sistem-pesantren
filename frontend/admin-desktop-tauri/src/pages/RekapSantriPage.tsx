import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { rekapSantri, type RekapSantri } from '../api/siklus';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { FilterLembaga, FilterTahunAjaran, useLembagaTa } from '@/components/siklus/bersama';

/** Rekap Santri: jumlah per tahun ajaran/tingkat/kelas + usia per kelas. */
export default function RekapSantriPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [data, setData] = useState<RekapSantri | null>(null);
  const [err, setErr] = useState('');
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const load = useCallback(async () => {
    setErr('');
    try {
      const res = await rekapSantri({ lembaga_id: lembagaId ? Number(lembagaId) : undefined, tahun_ajaran_id: taId ? Number(taId) : undefined });
      setData(res);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, taId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <FilterLembaga id="select_lembaga_rekap" value={lembagaId} onChange={(v) => { setLembagaId(v); setTaId(''); }} lembagas={lembagas} />
        <FilterTahunAjaran id="select_ta_rekap" value={taId} onChange={setTaId} tas={tas} />
        <span className="rounded-md border px-3 py-2 text-sm">Total santri aktif: <strong>{data?.total_aktif ?? 0}</strong></span>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <Tabel judul="Per tahun ajaran" kolom={['Tahun ajaran', 'Riwayat aktif']} baris={(data?.per_tahun_ajaran ?? []).map((r) => [r.tahun_ajaran ?? '—', String(r.jumlah_riwayat_aktif)])} />
        <Tabel judul="Per tingkat" kolom={['Lembaga', 'Tingkat', 'Jumlah']} baris={(data?.per_tingkat ?? []).map((r) => [r.lembaga ?? '—', r.tingkat ?? '—', String(r.jumlah)])} />
      </section>

      <section className="rounded-md border">
        <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Per kelas</header>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Kelas</th><th className="p-2">Tingkat</th><th className="p-2">Lembaga</th><th className="p-2">TA</th><th className="p-2">Terisi</th><th className="p-2">Kapasitas</th><th className="p-2">Sisa</th></tr>
            </thead>
            <tbody>
              {(data?.per_kelas ?? []).length === 0 ? <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Belum ada data.</td></tr> : data!.per_kelas.map((k) => (
                <tr key={k.kelas_id} className="border-t">
                  <td className="p-2">{k.kelas}</td>
                  <td className="p-2">{k.tingkat ?? '—'}</td>
                  <td className="p-2">{k.lembaga ?? '—'}</td>
                  <td className="p-2">{k.tahun_ajaran ?? '—'}</td>
                  <td className="p-2">{k.terisi}</td>
                  <td className="p-2">{k.kapasitas ?? '—'}</td>
                  <td className="p-2">{k.sisa ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border">
        <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Usia per kelas</header>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Kelas</th><th className="p-2">Jumlah</th><th className="p-2">Rata usia</th><th className="p-2">Min</th><th className="p-2">Max</th><th className="p-2">&lt;7</th><th className="p-2">7-9</th><th className="p-2">10-12</th><th className="p-2">13-15</th><th className="p-2">≥16</th></tr>
            </thead>
            <tbody>
              {(data?.usia_per_kelas ?? []).length === 0 ? <tr><td colSpan={10} className="p-3 text-center text-muted-foreground">Belum ada data usia (tgl lahir kosong).</td></tr> : data!.usia_per_kelas.map((u) => (
                <tr key={u.kelas_id} className="border-t">
                  <td className="p-2">{u.kelas ?? u.kelas_id}</td>
                  <td className="p-2">{u.jumlah}</td>
                  <td className="p-2">{u.rata_usia}</td>
                  <td className="p-2">{u.min}</td>
                  <td className="p-2">{u.max}</td>
                  <td className="p-2">{u.kelompok['<7'] ?? 0}</td>
                  <td className="p-2">{u.kelompok['7-9'] ?? 0}</td>
                  <td className="p-2">{u.kelompok['10-12'] ?? 0}</td>
                  <td className="p-2">{u.kelompok['13-15'] ?? 0}</td>
                  <td className="p-2">{u.kelompok['>=16'] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tabel({ judul, kolom, baris }: { judul: string; kolom: string[]; baris: (string | number)[][] }) {
  return (
    <section className="rounded-md border">
      <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{judul}</header>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>{kolom.map((k) => <th key={k} className="p-2">{k}</th>)}</tr></thead>
        <tbody>
          {baris.length === 0 ? <tr><td colSpan={kolom.length} className="p-3 text-center text-muted-foreground">Belum ada data.</td></tr> : baris.map((b, i) => (
            <tr key={i} className="border-t">{b.map((v, j) => <td key={j} className="p-2">{v}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
