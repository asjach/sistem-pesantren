import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { rekapSantri, type RekapSantri } from '../api/siklus';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import TabelRingkas from '@/components/TabelRingkas';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';

/** Rekap Santri: jumlah per tahun ajaran/tingkat/kelas + usia per kelas. */
export default function RekapSantriPage() {
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [data, setData] = useState<RekapSantri | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const res = await rekapSantri({ jenjang: jenjang ? jenjang : undefined, tahun_ajaran: taId || undefined });
      setData(res);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, taId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <span className="rounded-md border px-3 py-2 text-sm">Total santri aktif: <strong>{data?.total_aktif ?? 0}</strong></span>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <TabelRingkas
          tableKey="rekap_per_tahun_ajaran"
          judul="Per tahun ajaran"
          kolom={[{ key: 'ta', label: 'Tahun ajaran' }, { key: 'jumlah', label: 'Riwayat aktif' }]}
          baris={(data?.per_tahun_ajaran ?? []).map((r) => [r.tahun_ajaran ?? '—', r.jumlah_riwayat_aktif])}
        />
        <TabelRingkas
          tableKey="rekap_per_tingkat"
          judul="Per tingkat"
          kolom={[
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'tingkat', label: 'Tingkat' },
            { key: 'jumlah', label: 'Jumlah' },
          ]}
          baris={(data?.per_tingkat ?? []).map((r) => [r.lembaga ?? '—', r.tingkat ?? '—', r.jumlah])}
        />
      </section>

      <TabelRingkas
        tableKey="rekap_per_kelas"
        judul="Per kelas"
        kolom={[
          { key: 'kelas', label: 'Kelas' },
          { key: 'tingkat', label: 'Tingkat' },
          { key: 'lembaga', label: 'Lembaga' },
          { key: 'ta', label: 'TA' },
          { key: 'terisi', label: 'Terisi' },
          { key: 'kapasitas', label: 'Kapasitas' },
          { key: 'sisa', label: 'Sisa' },
        ]}
        baris={(data?.per_kelas ?? []).map((k) => [
          k.kelas,
          k.tingkat ?? '—',
          k.lembaga ?? '—',
          k.tahun_ajaran ?? '—',
          k.terisi,
          k.kapasitas ?? '—',
          k.sisa ?? '—',
        ])}
      />

      <TabelRingkas
        tableKey="rekap_usia_per_kelas"
        judul="Usia per kelas"
        emptyText="Belum ada data usia (tgl lahir kosong)."
        kolom={[
          { key: 'kelas', label: 'Kelas' },
          { key: 'jumlah', label: 'Jumlah' },
          { key: 'rata', label: 'Rata usia' },
          { key: 'min', label: 'Min' },
          { key: 'max', label: 'Max' },
          { key: 'k1', label: '<7' },
          { key: 'k2', label: '7-9' },
          { key: 'k3', label: '10-12' },
          { key: 'k4', label: '13-15' },
          { key: 'k5', label: '≥16' },
        ]}
        baris={(data?.usia_per_kelas ?? []).map((u) => [
          u.kelas ?? u.kelas_id,
          u.jumlah,
          u.rata_usia,
          u.min,
          u.max,
          u.kelompok['<7'] ?? 0,
          u.kelompok['7-9'] ?? 0,
          u.kelompok['10-12'] ?? 0,
          u.kelompok['13-15'] ?? 0,
          u.kelompok['>=16'] ?? 0,
        ])}
      />
    </div>
  );
}
