import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { listRiwayatBelajar, naikKelasMassal, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { FilterLembaga, FilterTahunAjaran, useLembagaTa } from '@/components/siklus/bersama';
import { toast } from 'sonner';

interface Baris { santri_id: number; nama: string; kelas: string | null; }

/** Kenaikan: kiri santri semester genap (non-tingkat-akhir) → kanan daftar naik / tidak naik. */
export default function KenaikanKelasPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [taBaru, setTaBaru] = useState('');
  const [tingkatBaru, setTingkatBaru] = useState('');
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [naik, setNaik] = useState<Baris[]>([]);
  const [tidakNaik, setTidakNaik] = useState<Baris[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const load = useCallback(async () => {
    if (!lembagaId) { setKiri([]); return; }
    setErr('');
    try {
      const res = await listRiwayatBelajar({ lembaga_id: Number(lembagaId), semester: '2', is_aktif: true, tingkat: tingkat || undefined, per_page: 500 });
      setKiri(res.data);
      setPilih(new Set());
      setNaik([]);
      setTidakNaik([]);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, tingkat]);

  useEffect(() => { void load(); }, [load]);

  const ke = (tujuan: 'naik' | 'tidak') => {
    const dipilih = kiri.filter((r) => pilih.has(r.santri_id));
    if (dipilih.length === 0) return;
    const baris: Baris[] = dipilih.map((r) => ({ santri_id: r.santri_id, nama: r.santri?.nama_lengkap ?? String(r.santri_id), kelas: r.kelas?.nama_kelas ?? null }));
    if (tujuan === 'naik') setNaik((prev) => [...prev, ...baris]);
    else setTidakNaik((prev) => [...prev, ...baris]);
    setKiri((prev) => prev.filter((r) => !pilih.has(r.santri_id)));
    setPilih(new Set());
  };

  const kembalikan = (dari: Baris[], set: (b: Baris[]) => void, b: Baris) => set(dari.filter((x) => x.santri_id !== b.santri_id));

  const totalTerpilih = naik.length + tidakNaik.length;

  const proses = async () => {
    if (!lembagaId || !taBaru || !tingkatBaru.trim() || totalTerpilih === 0) return;
    setBusy(true);
    try {
      const res = await naikKelasMassal({
        lembaga_id: Number(lembagaId),
        tahun_ajaran_baru_id: Number(taBaru),
        tingkat: tingkatBaru.trim(),
        siswa: [
          ...naik.map((b) => ({ santri_id: b.santri_id, status: 'naik' as const })),
          ...tidakNaik.map((b) => ({ santri_id: b.santri_id, status: 'tidak_naik' as const })),
        ],
      });
      toast.success(`Kenaikan selesai: ${res.berhasil} berhasil, ${res.gagal.length} gagal.`);
      if (res.gagal.length) toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const semuaTerpilih = useMemo(() => kiri.length > 0 && pilih.size === kiri.length, [kiri, pilih]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <FilterLembaga id="select_lembaga_kenaikan" value={lembagaId} onChange={(v) => { setLembagaId(v); setTaBaru(''); setTingkat(''); }} lembagas={lembagas} />
        <div>
          <FieldLabel htmlFor="input_tingkat_kenaikan">Tingkat asal (smstr 2)</FieldLabel>
          <Input id="input_tingkat_kenaikan" value={tingkat} onChange={(e) => setTingkat(e.target.value)} placeholder="mis. 5" className="w-28" />
        </div>
        <FilterTahunAjaran id="select_ta_baru_kenaikan" label="TA baru" value={taBaru} onChange={setTaBaru} tas={tas} />
        <div>
          <FieldLabel htmlFor="input_tingkat_baru_kenaikan">Tingkat baru</FieldLabel>
          <Input id="input_tingkat_baru_kenaikan" value={tingkatBaru} onChange={(e) => setTingkatBaru(e.target.value)} placeholder="mis. 6" className="w-28" />
        </div>
        <Button id="btn_proses_kenaikan" disabled={busy || totalTerpilih === 0 || !taBaru || !tingkatBaru.trim()} onClick={() => void proses()}>
          Proses kenaikan ({totalTerpilih})
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-md border">
          <header className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Santri semester genap ({kiri.length})</span>
            <div className="flex gap-2">
              <Button id="btn_pilih_semua_kenaikan" size="sm" variant="outline" onClick={() => setPilih(semuaTerpilih ? new Set() : new Set(kiri.map((r) => r.santri_id)))}>
                {semuaTerpilih ? 'Kosongkan' : 'Pilih semua'}
              </Button>
              <Button id="btn_ke_naik" size="sm" onClick={() => ke('naik')}>→ Naik</Button>
              <Button id="btn_ke_tidak_naik" size="sm" variant="outline" onClick={() => ke('tidak')}>→ Tidak naik</Button>
            </div>
          </header>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Pilih</th><th className="p-2">Nama</th><th className="p-2">Kelas</th><th className="p-2">Tingkat</th></tr></thead>
              <tbody>
                {kiri.length === 0 ? <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Tidak ada santri semester genap pada filter ini.</td></tr> : kiri.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <input id={`cek_kenaikan_${r.id}`} type="checkbox" checked={pilih.has(r.santri_id)} onChange={(e) => setPilih((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.santri_id); else next.delete(r.santri_id);
                        return next;
                      })} />
                    </td>
                    <td className="p-2">{r.santri?.nama_lengkap}</td>
                    <td className="p-2">{r.kelas?.nama_kelas ?? '—'}</td>
                    <td className="p-2">{r.tingkat ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-rows-2 gap-4">
          <PanelDaftar idPrefix="naik_kelas" judul={`Santri naik kelas (${naik.length})`} baris={naik} onKembalikan={(b) => kembalikan(naik, setNaik, b)} />
          <PanelDaftar idPrefix="tidak_naik_kelas" judul={`Santri tidak naik (${tidakNaik.length})`} baris={tidakNaik} onKembalikan={(b) => kembalikan(tidakNaik, setTidakNaik, b)} />
        </div>
      </div>
    </div>
  );
}

function PanelDaftar({ idPrefix, judul, baris, onKembalikan }: { idPrefix: string; judul: string; baris: Baris[]; onKembalikan: (b: Baris) => void }) {
  return (
    <section className="rounded-md border">
      <header className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{judul}</header>
      <div className="max-h-[28vh] overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            {baris.length === 0 ? <tr><td className="p-3 text-center text-muted-foreground">Belum ada.</td></tr> : baris.map((b) => (
              <tr key={b.santri_id} className="border-t">
                <td className="p-2">{b.nama}</td>
                <td className="p-2 text-muted-foreground">{b.kelas ?? '—'}</td>
                <td className="p-2 text-right">
                  <Button id={`btn_kembalikan_${idPrefix}_${b.santri_id}`} size="sm" variant="ghost" onClick={() => onKembalikan(b)}>Kembalikan</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
