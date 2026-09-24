import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { daftarKelas, pindahKelas, salinGenapMassal, type RiwayatRow } from '../api/siklus';
import { listKelas, type Kelas } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExcelTable from '@/components/ExcelTable';
import { useTingkatAktif } from '@/tingkatAktif';
import { useKelasAktif } from '@/kelasAktif';
import { VisibilitasFilter } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { ActionIcon } from '@/components/RowActions';
import { ArrowRight } from '@/icons';
import { useLembagaAwalString } from '@/hooks/useLembagaAwal';
import { useTahunAjaranAwalString } from '@/hooks/useTahunAjaranAwal';
import { useSemesterAwal } from '@/hooks/useSemesterAwal';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

interface KolomKelas {
  kelasId: number | null;
  kelas: string;
  baris: RiwayatRow[];
}

interface GrupTingkat {
  tingkat: string | null;
  kolom: KolomKelas[];
}

/** Pindah Kelas: tiap tingkat tampil sebagai baris kolom — satu tabel per
 *  kelas. Panah kiri/kanan tiap baris memindahkan ke kelas tetangga siklik
 *  (ujung bertemu ujung); satu kelas saja = tanpa panah. */
export default function PindahKelasPage() {
  const { user } = useAuth();
  const canSalin = bisa(user, 'kenaikan.ubah');
  const canPindah = bisa(user, 'pindah_kelas.ubah');
  const [jenjang, setLembagaId] = useState('');
  useLembagaAwalString(setLembagaId);
  const [taId, setTaId] = useState('');
  useTahunAjaranAwalString(setTaId);
  const [semester, setSemester] = useState('');
  useSemesterAwal(setSemester);
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  /** Pencarian tunggal halaman (topBar) — disaring di tiap kolom kelas. */
  const [cari, setCari] = useState('');
  /** Tingkat & Kelas = filter global topBar (setara lembaga/TA/semester). */
  const { tingkat: tingkatAktif } = useTingkatAktif();
  const { kelas: kelasAktif } = useKelasAktif();
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [salinOpen, setSalinOpen] = useState(false);
  const [tanggalSalin, setTanggalSalin] = useState('');

  const load = useCallback(async () => {
    if (!jenjang) { setRows([]); return; }
    setErr('');
    try {
      const res = await daftarKelas({ jenjang: jenjang, tahun_ajaran: taId || undefined, semester: semester || undefined });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [jenjang, taId, semester]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!jenjang) { setKelas([]); return; }
    listKelas({ jenjang: jenjang, tahun_ajaran: taId || undefined, per_page: 1000 })
      .then((p) => setKelas(p.data))
      .catch(() => setKelas([]));
  }, [jenjang, taId]);

  const grup = useMemo<GrupTingkat[]>(() => {
    const petaKelas = new Map<number, Kelas>();
    for (const k of kelas) petaKelas.set(k.id, k);
    // Kelompokkan kelas per tingkat, urut nama.
    const tingkatKeKelas = new Map<string, Kelas[]>();
    for (const k of kelas) {
      const t = k.tingkat != null && k.tingkat !== '' ? String(k.tingkat) : '';
      if (!tingkatKeKelas.has(t)) tingkatKeKelas.set(t, []);
      tingkatKeKelas.get(t)!.push(k);
    }
    for (const daftar of tingkatKeKelas.values()) {
      daftar.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true }));
    }
    // Baris per kelas; kelas tak dikenal + tanpa kelas menumpuk di kolom
    // "Tanpa kelas" tingkatnya masing-masing — kolom ini tampil PALING
    // DEPAN agar santri yang belum berdenah kelas langsung terlihat.
    const barisPerKelas = new Map<number, RiwayatRow[]>();
    const tanpaPerTingkat = new Map<string, RiwayatRow[]>();
    for (const r of rows) {
      if (r.kelas_id != null && petaKelas.has(r.kelas_id)) {
        if (!barisPerKelas.has(r.kelas_id)) barisPerKelas.set(r.kelas_id, []);
        barisPerKelas.get(r.kelas_id)!.push(r);
      } else {
        const t = r.tingkat != null && r.tingkat !== '' ? String(r.tingkat) : '';
        if (!tanpaPerTingkat.has(t)) tanpaPerTingkat.set(t, []);
        tanpaPerTingkat.get(t)!.push(r);
      }
    }
    const semuaTingkat = new Set([...tingkatKeKelas.keys(), ...tanpaPerTingkat.keys()]);
    const hasil: GrupTingkat[] = [];
    for (const t of semuaTingkat) {
      if (tingkatAktif.length > 0 && !tingkatAktif.includes(t)) continue;
      const tanpa = tanpaPerTingkat.get(t) ?? [];
      const kolom: KolomKelas[] = [];
      if (tanpa.length > 0 && kelasAktif.length === 0) {
        kolom.push({ kelasId: null, kelas: 'Tanpa kelas', baris: tanpa });
      }
      for (const k of tingkatKeKelas.get(t) ?? []) {
        if (kelasAktif.length > 0 && !kelasAktif.includes(k.nama_kelas)) continue;
        kolom.push({ kelasId: k.id, kelas: k.nama_kelas, baris: barisPerKelas.get(k.id) ?? [] });
      }
      if (kolom.length === 0) continue;
      hasil.push({ tingkat: t === '' ? null : t, kolom });
    }
    hasil.sort((a, b) => String(a.tingkat ?? '').localeCompare(String(b.tingkat ?? ''), 'id', { numeric: true }));
    return hasil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas, rows, tingkatAktif, kelasAktif]);

  const pindah = async (r: RiwayatRow, kelasBaruId: number) => {
    setBusyId(r.id);
    try {
      await pindahKelas(r.id, kelasBaruId);
      toast.success('Santri dipindah kelas.');
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      <VisibilitasFilter tampil={{ tingkat: true, kelas: true }} />
      <div className="flex flex-wrap items-end gap-3">
        {canSalin && (
        <Button id="btn_buka_salin_genap" variant="outline" disabled={!jenjang} onClick={() => { setTanggalSalin(''); setSalinOpen(true); }}>
          Salin ke genap
        </Button>
        )}
      </div>

      {grup.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada santri aktif pada filter ini.</p>
      ) : grup.map((g) => (
        <section key={g.tingkat ?? 'tanpa'} className="flex min-h-0 flex-1 flex-col gap-2">
          <h2 className="shrink-0 text-sm font-semibold">Tingkat {g.tingkat ?? '—'}</h2>
          <div className="grid min-h-0 flex-1 gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {g.kolom.map((k) => (
              <TabelKelas
                key={k.kelasId ?? 'tanpa'}
                tingkat={g.tingkat}
                kolom={k}
                tetangga={k.kelasId == null
                  // Kolom Tanpa kelas: kiri = kelas nyata terakhir,
                  // kanan = kelas nyata pertama.
                  ? (() => {
                      const nyata = g.kolom.filter((c) => c.kelasId != null);
                      if (nyata.length === 0) return { kiri: null, kanan: null };
                      return { kiri: nyata[nyata.length - 1], kanan: nyata[0] };
                    })()
                  : (() => {
                      const nyata = g.kolom.filter((c) => c.kelasId != null);
                      const i = nyata.findIndex((c) => c.kelasId === k.kelasId);
                      if (nyata.length < 2 || i < 0) return { kiri: null, kanan: null };
                      return {
                        kiri: nyata[(i - 1 + nyata.length) % nyata.length],
                        kanan: nyata[(i + 1) % nyata.length],
                      };
                    })()}
                bisaPindah={canPindah}
                busyId={busyId}
                cari={cari}
                onPindah={(r, tujuan) => void pindah(r, tujuan)}
              />
            ))}
          </div>
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
            <Button id="btn_proses_salin_genap" disabled={busyId !== null || !tanggalSalin} onClick={async () => {
              setBusyId(-1);
              try {
                const res = await salinGenapMassal({ jenjang: jenjang, tanggal_masuk: tanggalSalin });
                toast.success(`Salin genap: ${res.berhasil} berhasil, ${res.gagal.length} gagal.`);
                if (res.gagal.length) toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
                setSalinOpen(false);
                await load();
              } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); }
            }}>Proses</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Satu kolom kelas: tabel santri + panah pindah ke tetangga siklik. */
function TabelKelas({ tingkat, kolom, tetangga, bisaPindah, busyId, cari, onPindah }: {
  tingkat: string | null;
  kolom: KolomKelas;
  tetangga: { kiri: KolomKelas | null; kanan: KolomKelas | null };
  bisaPindah: boolean;
  busyId: number | null;
  /** Pencarian tunggal halaman (topBar) — disaring di tiap kolom. */
  cari: string;
  onPindah: (r: RiwayatRow, kelasBaruId: number) => void;
}) {
  const kunci = `${tingkat ?? 'tanpa'}_${kolom.kelasId ?? 'tanpa'}`;
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return kolom.baris;
    return kolom.baris.filter((r) =>
      (r.santri?.nama_lengkap ?? '').toLowerCase().includes(q)
      || (r.nis_lokal ?? '').toLowerCase().includes(q));
  }, [kolom.baris, cari]);
  const aksi = tetangga.kiri != null || tetangga.kanan != null;
  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-md border">
      <header className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{kolom.kelasId == null ? 'Santri Belum Masuk Kelas' : `Kelas ${kolom.kelas}`}</span>
        <span className="text-xs text-muted-foreground">{kolom.baris.length} santri</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <ExcelTable
          tableKey={`pindah_kelas_${kunci}`}
          fields={[
            { key: 'nama', label: 'santri.nama_lengkap', kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
            { key: 'nis_lokal', label: 'nis_lokal', kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
            { key: 'no_absen', label: 'no_absen', kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'no_absen' } },
          ]}
          rows={tampil}
          getValues={(r) => ({
            nama: r.santri?.nama_lengkap ?? null,
            nis_lokal: r.nis_lokal ?? null,
            no_absen: r.no_absen != null ? String(r.no_absen) : null,
          })}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={aksi && bisaPindah ? (r) => (
            <>
              {tetangga.kiri?.kelasId != null && tetangga.kiri.kelasId !== kolom.kelasId && (
                <ActionIcon
                  id={`btn_pindah_kiri_${r.id}`}
                  title={`Pindah ke ${tetangga.kiri.kelas}`}
                  aria-label={`Pindah ke ${tetangga.kiri.kelas}`}
                  disabled={busyId === r.id}
                  onClick={() => onPindah(r, tetangga.kiri!.kelasId!)}
                >
                  <ArrowRight size={16} className="rotate-180" />
                </ActionIcon>
              )}
              {tetangga.kanan?.kelasId != null && tetangga.kanan.kelasId !== kolom.kelasId && (
                <ActionIcon
                  id={`btn_pindah_kanan_${r.id}`}
                  title={`Pindah ke ${tetangga.kanan.kelas}`}
                  aria-label={`Pindah ke ${tetangga.kanan.kelas}`}
                  disabled={busyId === r.id}
                  onClick={() => onPindah(r, tetangga.kanan!.kelasId!)}
                >
                  <ArrowRight size={16} />
                </ActionIcon>
              )}
            </>
          ) : () => null}
          hideCheckbox
          emptyText="Tidak ada santri pada kelas ini."
        />
      </div>
    </section>
  );
}
