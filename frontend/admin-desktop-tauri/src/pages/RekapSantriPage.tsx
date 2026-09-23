import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { rekapSantri, type RekapSantri } from '../api/siklus';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import TabelRingkas from '@/components/TabelRingkas';
import FilterField from '@/components/FilterField';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { useSemesterAwal } from '@/hooks/useSemesterAwal';

/** Rekap Santri: jumlah per tahun ajaran/tingkat/kelas + usia per kelas.
 *  "Aktif" = terdaftar di TA+semester itu dan tidak pindah keluar. */
export default function RekapSantriPage() {
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [semester, setSemester] = useState('');
  useSemesterAwal(setSemester);
  /** Keaktifan dari `status_akhir`: aktif (bawaan) | nonaktif | '' = semua. */
  const [keaktifan, setKeaktifan] = useState('aktif');
  const [data, setData] = useState<RekapSantri | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const res = await rekapSantri({
        jenjang: jenjang ? jenjang : undefined,
        tahun_ajaran: taId || undefined,
        semester: semester || undefined,
        keaktifan: keaktifan || undefined,
      });
      setData(res);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, taId, semester, keaktifan]);

  useEffect(() => { void load(); }, [load]);

  const perTingkat = data?.per_tingkat ?? [];
  const perKelas = data?.per_kelas ?? [];
  const totalTingkat = perTingkat.reduce(
    (a, r) => ({ l: a.l + r.l, p: a.p + r.p, jml: a.jml + r.jumlah }),
    { l: 0, p: 0, jml: 0 },
  );
  const totalKelas = perKelas.reduce(
    (a, k) => ({ l: a.l + k.l, p: a.p + k.p, jml: a.jml + k.terisi }),
    { l: 0, p: 0, jml: 0 },
  );

  const perUsia = data?.usia_per_tingkat ?? [];
  const KELOMPOK_USIA = ['<7', '7-9', '10-12', '13-15', '>=16'] as const;
  const totalUsia = perUsia.reduce(
    (a, u) => {
      for (const k of KELOMPOK_USIA) a.kelompok[k] = (a.kelompok[k] ?? 0) + (u.kelompok[k] ?? 0);
      return {
        jumlah: a.jumlah + u.jumlah,
        bobot: a.bobot + u.rata_usia * u.jumlah,
        min: Math.min(a.min, u.min),
        max: Math.max(a.max, u.max),
        kelompok: a.kelompok,
      };
    },
    { jumlah: 0, bobot: 0, min: Infinity, max: -Infinity, kelompok: {} as Record<string, number> },
  );
  const rataUsiaTotal = totalUsia.jumlah > 0 ? Math.round((totalUsia.bobot / totalUsia.jumlah) * 10) / 10 : 0;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Keaktifan" htmlFor="select_keaktifan_rekap">
          <Select value={keaktifan === '' ? '_semua' : keaktifan} onValueChange={(v) => setKeaktifan(v === '_semua' ? '' : v)}>
            <SelectTrigger id="select_keaktifan_rekap" title="Filter keaktifan" aria-label="Filter keaktifan" size="sm" className="w-40">
              <SelectValue placeholder="Aktif" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="nonaktif">Tidak aktif</SelectItem>
                <SelectItem value="_semua">Semua</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterField>
        <span className="rounded-md border px-3 py-2 text-sm">
          {keaktifan === 'nonaktif' ? 'Tidak aktif' : keaktifan === 'aktif' ? 'Aktif' : 'Semua status'}
          {' · '}{semester ? `semester ${semester}` : 'semua semester'}: <strong>{data?.total_aktif ?? 0}</strong>
        </span>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="mt-3 min-h-0 flex-1">
        <ResizablePanel defaultSize="34" minSize="15">
          <TabelRingkas
            className="h-full min-h-0"
            tableKey="rekap_per_tahun_ajaran"
            judul="Per tahun ajaran"
            kolom={[
              { key: 'ta', label: 'Tahun ajaran' },
              { key: 'l', label: 'L' },
              { key: 'p', label: 'P' },
              { key: 'jumlah', label: 'JML' },
            ]}
            baris={(data?.per_tahun_ajaran ?? []).map((r) => [r.tahun_ajaran ?? '—', r.l, r.p, r.jumlah_riwayat_aktif])}
          />
        </ResizablePanel>
        <ResizableHandle orientation="horizontal" withHandle />
        <ResizablePanel defaultSize="66" minSize="30">
          <ResizablePanelGroup orientation="vertical" className="h-full">
            <ResizablePanel defaultSize="67" minSize="20">
              <ResizablePanelGroup orientation="horizontal" className="h-full">
                <ResizablePanel defaultSize="50" minSize="20">
                  <TabelRingkas
                    className="h-full min-h-0"
                    tableKey="rekap_per_tingkat"
                    judul="Per tingkat"
                    kolom={[
                      { key: 'lembaga', label: 'Lembaga' },
                      { key: 'tingkat', label: 'Tingkat' },
                      { key: 'l', label: 'L' },
                      { key: 'p', label: 'P' },
                      { key: 'jumlah', label: 'JML' },
                    ]}
                    baris={[
                      ...perTingkat.map((r) => [r.lembaga ?? '—', r.tingkat ?? '—', r.l, r.p, r.jumlah]),
                      ['Jumlah', '', totalTingkat.l, totalTingkat.p, totalTingkat.jml],
                    ]}
                  />
                </ResizablePanel>
                <ResizableHandle orientation="horizontal" withHandle />
                <ResizablePanel defaultSize="50" minSize="20">
                  <TabelRingkas
                    className="h-full min-h-0"
                    tableKey="rekap_per_kelas"
                    judul="Per kelas"
                    kolom={[
                      { key: 'kelas', label: 'Kelas' },
                      { key: 'lembaga', label: 'Lembaga' },
                      { key: 'l', label: 'L' },
                      { key: 'p', label: 'P' },
                      { key: 'jml', label: 'JML' },
                    ]}
                    baris={[
                      ...perKelas.map((k) => [
                        k.kelas,
                        k.lembaga ?? '—',
                        k.l,
                        k.p,
                        k.terisi,
                      ]),
                      ['Jumlah', '', totalKelas.l, totalKelas.p, totalKelas.jml],
                    ]}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle orientation="vertical" withHandle />
            <ResizablePanel defaultSize="33" minSize="20">
              <TabelRingkas
                className="h-full min-h-0"
                tableKey="rekap_usia_per_tingkat"
                judul="Usia per tingkat"
                emptyText="Belum ada data usia (tgl lahir kosong)."
                kolom={[
                  { key: 'tingkat', label: 'Tingkat' },
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
                baris={[
                  ...perUsia.map((u) => [
                    u.tingkat ?? '—',
                    u.jumlah,
                    u.rata_usia,
                    u.min,
                    u.max,
                    u.kelompok['<7'] ?? 0,
                    u.kelompok['7-9'] ?? 0,
                    u.kelompok['10-12'] ?? 0,
                    u.kelompok['13-15'] ?? 0,
                    u.kelompok['>=16'] ?? 0,
                  ]),
                  ...(perUsia.length > 0
                    ? [[
                        'Jumlah',
                        totalUsia.jumlah,
                        rataUsiaTotal,
                        Number.isFinite(totalUsia.min) ? totalUsia.min : '—',
                        Number.isFinite(totalUsia.max) ? totalUsia.max : '—',
                        totalUsia.kelompok['<7'] ?? 0,
                        totalUsia.kelompok['7-9'] ?? 0,
                        totalUsia.kelompok['10-12'] ?? 0,
                        totalUsia.kelompok['13-15'] ?? 0,
                        totalUsia.kelompok['>=16'] ?? 0,
                      ] as (string | number | null)[]]
                    : []),
                ]}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
