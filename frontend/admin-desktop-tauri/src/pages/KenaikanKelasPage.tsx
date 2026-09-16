import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { listRiwayatBelajar, naikKelasMassal, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExcelTable from '@/components/ExcelTable';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

interface Baris { santri_id: number; nama: string; kelas: string | null; }

/** Kenaikan: kiri santri semester genap (non-tingkat-akhir) → kanan daftar naik / tidak naik. */
export default function KenaikanKelasPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kenaikan.ubah');
  const [lembagaId, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [tingkat, setTingkat] = useState('');
  const [taBaru, setTaBaru] = useState('');
  useTahunAjaranAwalString(setTaBaru);
  const [tingkatBaru, setTingkatBaru] = useState('');
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [naik, setNaik] = useState<Baris[]>([]);
  const [tidakNaik, setTidakNaik] = useState<Baris[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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


  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <FieldLabel htmlFor="input_tingkat_kenaikan">Tingkat asal (smstr 2)</FieldLabel>
          <Input id="input_tingkat_kenaikan" value={tingkat} onChange={(e) => setTingkat(e.target.value)} placeholder="mis. 5" className="w-28" />
        </div>
        <div>
          <FieldLabel htmlFor="input_tingkat_baru_kenaikan">Tingkat baru</FieldLabel>
          <Input id="input_tingkat_baru_kenaikan" value={tingkatBaru} onChange={(e) => setTingkatBaru(e.target.value)} placeholder="mis. 6" className="w-28" />
        </div>
        {canUbah && (
        <Button id="btn_proses_kenaikan" disabled={busy || totalTerpilih === 0 || !taBaru || !tingkatBaru.trim()} onClick={() => void proses()}>
          Proses kenaikan ({totalTerpilih})
        </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-md border">
          <header className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Santri semester genap ({kiri.length})</span>
            <div className="flex gap-2">
              <Button id="btn_ke_naik" size="sm" onClick={() => ke('naik')}>→ Naik</Button>
              <Button id="btn_ke_tidak_naik" size="sm" variant="outline" onClick={() => ke('tidak')}>→ Tidak naik</Button>
            </div>
          </header>
          <div className="px-2 pb-1">
            <ExcelTable
              tableKey="kenaikan_santri_genap"
              fields={[
                { key: 'nama', label: 'Nama', kind: 'static' },
                { key: 'kelas', label: 'Kelas', kind: 'static' },
                { key: 'tingkat', label: 'Tingkat', kind: 'static' },
              ]}
              rows={kiri}
              getValues={(r) => ({
                nama: r.santri?.nama_lengkap ?? null,
                kelas: r.kelas?.nama_kelas ?? null,
                tingkat: r.tingkat ?? null,
              })}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              onCheckedChange={(rows) => setPilih(new Set(rows.map((r) => r.santri_id)))}
              maxRows={12}
              emptyText="Tidak ada santri semester genap pada filter ini."
            />
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
      <div className="px-2 pb-1">
        <ExcelTable
          tableKey={`kenaikan_${idPrefix}`}
          fields={[
            { key: 'nama', label: 'Nama', kind: 'static' },
            { key: 'kelas', label: 'Kelas', kind: 'static' },
          ]}
          rows={baris.map((b) => ({ ...b, id: b.santri_id }))}
          getValues={(b) => ({ nama: b.nama, kelas: b.kelas })}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={(b) => (
            <Button id={`btn_kembalikan_${idPrefix}_${b.santri_id}`} size="sm" variant="ghost" onClick={() => onKembalikan(b)}>Kembalikan</Button>
          )}
          hideCheckbox
          maxRows={6}
          emptyText="Belum ada."
        />
      </div>
    </section>
  );
}
