import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { daftarKelas, pindahKelas, salinGenapMassal, type RiwayatRow } from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { FilterLembaga, FilterSemester, FilterTahunAjaran, useLembagaTa } from '@/components/siklus/bersama';
import { toast } from 'sonner';

interface Kelompok { kelasId: number | null; kelas: string; tingkat: string | null; baris: RiwayatRow[]; }

/** Pindah Kelas: tabel per kelas (dikelompokkan per tingkat) + salin ganjil→genap. */
export default function PindahKelasPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const [salinOpen, setSalinOpen] = useState(false);
  const [tanggalSalin, setTanggalSalin] = useState('');

  const load = useCallback(async () => {
    if (!lembagaId) { setRows([]); return; }
    setErr('');
    try {
      const res = await daftarKelas({ lembaga_id: Number(lembagaId), tahun_ajaran_id: taId ? Number(taId) : undefined, semester: semester || undefined });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [lembagaId, taId, semester]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!lembagaId) { setKelas([]); return; }
    listKelas({ lembaga_id: Number(lembagaId), tahun_ajaran_id: taId ? Number(taId) : undefined, per_page: 1000 })
      .then((p) => setKelas(p.data))
      .catch(() => setKelas([]));
  }, [lembagaId, taId]);

  const kelompok = useMemo<Kelompok[]>(() => {
    const peta = new Map<string, Kelompok>();
    for (const r of rows) {
      const kunci = `${r.tingkat ?? ''}|${r.kelas_id ?? ''}`;
      if (!peta.has(kunci)) {
        peta.set(kunci, { kelasId: r.kelas_id, kelas: r.kelas?.nama_kelas ?? 'Tanpa kelas', tingkat: r.tingkat, baris: [] });
      }
      peta.get(kunci)!.baris.push(r);
    }
    return [...peta.values()].sort((a, b) => String(a.tingkat ?? '').localeCompare(String(b.tingkat ?? '')) || a.kelas.localeCompare(b.kelas));
  }, [rows]);

  const pindah = async (r: RiwayatRow, kelasBaru: string) => {
    if (!kelasBaru) return;
    setBusy(true);
    try {
      await pindahKelas(r.id, Number(kelasBaru));
      toast.success('Santri dipindah kelas.');
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="flex flex-wrap items-end gap-3">
        <FilterLembaga id="select_lembaga_pindah_kelas" value={lembagaId} onChange={(v) => { setLembagaId(v); setTaId(''); }} lembagas={lembagas} />
        <FilterTahunAjaran id="select_ta_pindah_kelas" value={taId} onChange={setTaId} tas={tas} />
        <FilterSemester id="select_semester_pindah_kelas" value={semester} onChange={setSemester} />
        <Button id="btn_buka_salin_genap" variant="outline" disabled={!lembagaId} onClick={() => { setTanggalSalin(''); setSalinOpen(true); }}>
          Salin ke genap
        </Button>
      </div>

      {kelompok.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada santri aktif pada filter ini.</p>
      ) : kelompok.map((g) => (
        <section key={`${g.tingkat}-${g.kelasId}`} className="rounded-md border">
          <header className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            <span>Kelas {g.kelas}</span>
            <span className="text-xs text-muted-foreground">Tingkat {g.tingkat ?? '—'} · {g.baris.length} santri</span>
          </header>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Nama</th><th className="p-2">NIS lokal</th><th className="p-2">Absen</th><th className="p-2">Pindah ke</th></tr></thead>
            <tbody>
              {g.baris.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.santri?.nama_lengkap}</td>
                  <td className="p-2">{r.nis_lokal ?? '—'}</td>
                  <td className="p-2">{r.no_absen ?? '—'}</td>
                  <td className="p-2">
                    <PindahSelect idPrefix={`pindah_${r.id}`} kelas={kelas} disabled={busy} onPilih={(v) => void pindah(r, v)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <Dialog open={salinOpen} onOpenChange={setSalinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salin ganjil → genap</DialogTitle>
            <DialogDescription>Semua baris semester 1 aktif di lembaga ini disalin ke semester 2.</DialogDescription>
          </DialogHeader>
          <FieldLabel htmlFor="input_tanggal_salin_genap">Tanggal masuk semester 2</FieldLabel>
          <Input id="input_tanggal_salin_genap" type="date" value={tanggalSalin} onChange={(e) => setTanggalSalin(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSalinOpen(false)}>Batal</Button>
            <Button id="btn_proses_salin_genap" disabled={busy || !tanggalSalin} onClick={async () => {
              setBusy(true);
              try {
                const res = await salinGenapMassal({ lembaga_id: Number(lembagaId), tanggal_masuk: tanggalSalin });
                toast.success(`Salin genap: ${res.berhasil} berhasil, ${res.gagal.length} gagal.`);
                if (res.gagal.length) toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
                setSalinOpen(false);
                await load();
              } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
            }}>Proses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PindahSelect({ idPrefix, kelas, disabled, onPilih }: { idPrefix: string; kelas: Kelas[]; disabled: boolean; onPilih: (v: string) => void }) {
  const [nilai, setNilai] = useState('');
  return (
    <div className="flex items-center gap-2">
      <Select value={nilai || '_kosong'} onValueChange={(v) => setNilai(v === '_kosong' ? '' : v)}>
        <SelectTrigger id={`select_${idPrefix}`} className="w-40" size="sm"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="_kosong">Pilih kelas</SelectItem>
            {kelas.map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama_kelas}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button id={`btn_${idPrefix}`} size="sm" disabled={disabled || !nilai} onClick={() => { onPilih(nilai); setNilai(''); }}>Pindah</Button>
    </div>
  );
}
