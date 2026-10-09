import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  generateTagihan, kandidatTagihan, pratinjauTagihan,
  type JenisTagihan, type KandidatTagihanRow, type KelompokKandidat, type PratinjauBaris,
  type Tarif, type PratinjauSantri,
} from '../../api/keuangan';
import RincianBulanKartu from './RincianBulanKartu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionIcon } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { bacaPerPageGlobal, langgananPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { rincianPeriode } from '@/lib/dispensasi';
import { ArrowRight, Trash2, X } from '@/icons';
import { type PerPage } from '@/prefs';

const OPSI_KELOMPOK: { value: KelompokKandidat; label: string }[] = [
  { value: 'aktif', label: 'Semua (kecuali pindah keluar)' },
  { value: 'mi', label: 'MI (MI + MI-MD)' },
  { value: 'md', label: 'MD (MD + MI-MD)' },
  { value: 'mi_saja', label: 'MI Saja (tanpa MD)' },
  { value: 'md_saja', label: 'MD Saja (tanpa MI)' },
  { value: 'mi_md', label: 'MI-MD' },
  { value: 'kelas_akhir', label: 'Kelas Akhir' },
  { value: 'selain_kelas_akhir', label: 'Selain Kelas Akhir' },
  { value: 'custom', label: 'Custom' },
];

/** Jumlah periode bulanan yang akan digenerate (1 bila hanya "Dari Bulan"). */
function hitungJumlahPeriode(dari: string, sampai: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dari)) return 0;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(sampai)) return 1;
  const [y1, b1] = dari.split('-').map(Number);
  const [y2, b2] = sampai.split('-').map(Number);
  return Math.min(24, Math.max(0, (y2 - y1) * 12 + (b2 - b1) + 1));
}

/** Ringkasan tagihan yang sudah ada: "3/3 bulan · Rp 225.000", atau "—". */
function ringkasSudahAda(r: KandidatTagihanRow, jumlahPeriode: number): string {
  if (r.tagihan_periode <= 0) return 'Belum ada';
  const bulan = jumlahPeriode > 1 ? `${r.tagihan_periode}/${jumlahPeriode} bulan` : 'ada';
  return `${bulan} · Rp ${r.tagihan_nominal.toLocaleString('id')}`;
}

const FIELDS_KANDIDAT: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'jk', label: 'JK', kind: 'static', width: 40 },
  { key: 'nis', label: 'NIS/NISN', kind: 'static', width: 110 },
  { key: 'tingkat', label: 'Tkt', kind: 'static', width: 50 },
  { key: 'kelas', label: 'Kelas', kind: 'static', width: 90 },
  { key: 'sudah', label: 'Tagihan', kind: 'static', width: 130 },
  { key: 'status_akhir', label: 'Status', kind: 'static', width: 90 },
];

const FIELDS_HASIL: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'periode', label: 'Periode', kind: 'static', width: 110 },
  { key: 'sebab', label: 'Sebab Dilewati', kind: 'static' },
  { key: 'terbayar', label: 'Sudah Dibayar', kind: 'static', width: 130 },
];

interface AlasanHasil {
  id: string; nama: string; periode: string | null; sebab: string; terbayar: number; nominal_sekarang: number;
}

interface HasilGenerate {
  dibuat: number; diperbarui: number; tetap: number; dilewati: number;
  alasan: AlasanHasil[];
}

const FIELDS_TERPILIH: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'kelas', label: 'Tkt / Kelas', kind: 'static', width: 120 },
  { key: 'sekarang', label: 'Nominal sekarang', kind: 'static', width: 150 },
  { key: 'nominal', label: 'Nominal baru', kind: 'text', width: 110 },
  { key: 'mode', label: 'Mode', kind: 'static', width: 80 },
  {
    key: 'rincian', label: 'Rincian Bulan', kind: 'static', width: 220,
    // Teks sel kerap terpotong lebar kolom → detail lengkapnya di kartu hover.
    kartuHover: (row) => {
      const periode = (row as unknown as BarisTerpilih).periode;
      return periode === null || periode === undefined
        ? null
        : <RincianBulanKartu periode={periode} />;
    },
  },
  { key: 'dispensasi', label: 'Dispensasi', kind: 'static', width: 170 },
];

type KandidatRow = KandidatTagihanRow & { id: number };
type BarisTerpilih = KandidatTagihanRow & {
  nominal: string; nominalManual: boolean;
  potongan: number; dispensasiIds: number[] | null; dispensasiLabel: string | null;
  /** Potongan per bulan dari pratinjau (null = satu bulan / belum dimuat). */
  rincian: string | null;
  /** Periode mentah dari pratinjau — isi kartu hover kolom Rincian Bulan. */
  periode: PratinjauBaris[] | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jenis: JenisTagihan[];
  tarif: Tarif[];
  tahunAjaran: string | null;
  onSelesai: () => void | Promise<void>;
}

/** Kelompok isian berlangkah di bilah filter: lencana angka + label grup. */
function GrupLangkah({ no, label, children }: { no: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
      <span aria-hidden className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{no}</span>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Dialog generate tagihan: kandidat per kelompok santri (tabel kiri, bisa
 *  dicari & dipilih) dipindahkan ke daftar final (tabel kanan) yang akan
 *  dibuatkan tagihan; nominal default dari tarif/manual, bisa dioverride. */
export default function GenerateTagihanDialog({ open, onOpenChange, jenis, tarif, tahunAjaran, onSelesai }: Props) {
  const [kelompok, setKelompok] = useState<KelompokKandidat>('aktif');
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [tarifId, setTarifId] = useState<number | ''>('');
  const [nominalDefault, setNominalDefault] = useState('');
  const [periodeDari, setPeriodeDari] = useState('');
  const [periodeSampai, setPeriodeSampai] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');

  const [cari, setCari] = useState('');
  const [kandidat, setKandidat] = useState<KandidatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(50);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  /** Urut header tabel kandidat (perubahan memicu muat ulang via effect). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);

  /** Klik header: simpan urut baru + kembali ke halaman 1 (effect memuat ulang). */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    setUrut(nilai);
    setArahUrut(arah);
    setArahKolom(nilai.length > 0 ? peta : undefined);
    setPage(1);
  }

  const [terpilih, setTerpilih] = useState<BarisTerpilih[]>([]);
  const [busy, setBusy] = useState(false);
  /** Hasil generate terakhir (panel persisten; null = mode susun). */
  const [hasil, setHasil] = useState<HasilGenerate | null>(null);

  const jenisTerpilih = useMemo(() => jenis.find((j) => j.id === jenisId) ?? null, [jenis, jenisId]);
  const bulanan = jenisTerpilih?.tipe === 'bulanan';

  // Buka dialog: bersihkan pilihan; isi default periode setahun dari TA.
  useEffect(() => {
    if (!open) return;
    setTerpilih([]); setCari(''); setKelompok('aktif'); setJenisId(''); setTarifId('');
    setNominalDefault(''); setJatuhTempo(''); setErr(''); setHasil(null);
    const m = (tahunAjaran ?? '').match(/^(\d{4})\/(\d{4})$/);
    if (m) { setPeriodeDari(`${m[1]}-07`); setPeriodeSampai(`${m[2]}-06`); }
    else { setPeriodeDari(''); setPeriodeSampai(''); }
  }, [open, tahunAjaran]);

  // Kriteria diubah → hasil lama basi (kembali ke mode susun).
  // Aman dari loop: setHasil(null) saat sudah null tidak me-render ulang.
  useEffect(() => {
    if (!open) return;
    setHasil(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, terpilih, jenisId, nominalDefault, periodeDari, periodeSampai, jatuhTempo, tarifId, kelompok]);

  const muatKandidat = useCallback(async (halaman: number, jumlah: PerPage) => {
    if (!open || tahunAjaran === null) return;
    setErr(''); setLoading(true);
    try {
      const res = await kandidatTagihan({
        tahun_ajaran: tahunAjaran,
        kelompok,
        jenis_id: jenisId,
        periode: bulanan ? (periodeDari || undefined) : undefined,
        periode_sampai: bulanan ? (periodeSampai || undefined) : undefined,
        q: cari.trim() || undefined,
        page: halaman,
        per_page: jumlah === 0 ? 'all' : String(jumlah),
        sort: urut.length ? tokenUrut(urut, arahKolom) : undefined,
        arah: urut.length ? arahUrut : undefined,
      });
      setKandidat(res.data.map((r) => ({ ...r, id: r.santri_id })));
      setPage(res.current_page); setLastPage(res.last_page); setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [open, tahunAjaran, kelompok, jenisId, bulanan, periodeDari, periodeSampai, cari, urut, arahUrut, arahKolom]);

  // Ketikan ditahan sebentar agar tidak memanggil API tiap karakter.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void muatKandidat(1, perPage); }, 250);
    return () => clearTimeout(t);
  }, [open, muatKandidat, perPage]);

  /* Jumlah baris mengikuti pengaturan global (lihat `usePager`): baca saat
     dialog dibuka + ikut bila tabel lain mengubahnya selagi terbuka. Effect
     muat di atas otomatis memuat ulang dari halaman 1. */
  useEffect(() => {
    if (!open) return;
    let hidup = true;
    void bacaPerPageGlobal().then((pp) => { if (hidup) setPerPage(pp); });
    const berhenti = langgananPerPageGlobal((pp) => { if (hidup) setPerPage(pp); });
    return () => { hidup = false; berhenti(); };
  }, [open]);

  /** Baris kandidat yang sudah pindah ke tabel kanan disembunyikan. */
  const idTerpilih = useMemo(() => new Set(terpilih.map((r) => r.santri_id)), [terpilih]);
  const kandidatTampil = useMemo(() => kandidat.filter((r) => !idTerpilih.has(r.santri_id)), [kandidat, idTerpilih]);

  /** Berapa periode yang akan digenerate — dipakai ringkasan "N/M bulan" + konsumsi kuota. */
  const jumlahPeriode = useMemo(
    () => (bulanan ? hitungJumlahPeriode(periodeDari, periodeSampai) : 1),
    [bulanan, periodeDari, periodeSampai],
  );

  /** Santri baris otomatis — baris bernominal manual tak perlu pratinjau. */
  const santriAuto = useMemo(
    () => [...new Set(terpilih.filter((r) => !r.nominalManual).map((r) => r.santri_id))].sort((a, b) => a - b),
    [terpilih],
  );
  /** Tanda isi otomatis (stabil terhadap identitas array): pratinjau hanya
   *  dimuat ulang bila HIMPUNAN santrinya berubah — bukan tiap render. */
  const sigAuto = useMemo(() => santriAuto.join(','), [santriAuto]);
  const santriAutoRef = useRef(santriAuto);
  santriAutoRef.current = santriAuto;

  const nominalAngkaDefault = Number(nominalDefault);
  // Field kosong bukan 0: jangan minta pratinjau (dan jangan tampilkan
  // potongan) sebelum nominalnya diisi.
  const pratinjauSiap = jenisId !== '' && tahunAjaran !== null && nominalDefault.trim() !== ''
    && Number.isInteger(nominalAngkaDefault) && nominalAngkaDefault >= 0
    && (!bulanan || hitungJumlahPeriode(periodeDari, periodeSampai) > 0);

  /** Potongan & dispensasi dari backend — hitungan yang sama dengan generate
   *  (aturan grup/kuota tak lagi dicerminkan di sini). Nilai lama dibiarkan
   *  tampil sampai jawaban baru datang supaya tabel tak berkedip. */
  const [pratinjau, setPratinjau] = useState<Record<number, PratinjauSantri>>({});
  const [pratinjauGagal, setPratinjauGagal] = useState(false);
  useEffect(() => {
    if (!open || !pratinjauSiap) { setPratinjau({}); setPratinjauGagal(false); return; }
    if (sigAuto === '') { setPratinjau({}); setPratinjauGagal(false); return; }
    let hidup = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const h = await pratinjauTagihan({
            tahun_ajaran: tahunAjaran, jenis_id: Number(jenisId),
            periode: bulanan ? periodeDari : null,
            periode_sampai: bulanan ? (periodeSampai || null) : null,
            nominal: nominalAngkaDefault,
            santri: santriAutoRef.current.map((id) => ({ santri_id: id })),
          });
          if (!hidup) return;
          setPratinjau(Object.fromEntries(h.map((p) => [p.santri_id, p])));
          setPratinjauGagal(false);
        } catch {
          if (hidup) { setPratinjau({}); setPratinjauGagal(true); }
        }
      })();
    }, 300);
    return () => { hidup = false; clearTimeout(t); };
  }, [open, pratinjauSiap, jenisId, tahunAjaran, bulanan, periodeDari, periodeSampai, nominalAngkaDefault, sigAuto]);

  /** Susun baris otomatis dari jawaban pratinjau (manual tak diubah). */
  const susunBaris = useCallback((r: KandidatTagihanRow, nominalStr: string): BarisTerpilih => {
    const p = pratinjau[r.santri_id];
    if (p === undefined) {
      return { ...r, nominal: nominalStr, nominalManual: false, potongan: 0, dispensasiIds: null, dispensasiLabel: null, rincian: null, periode: null };
    }
    const catatan = [
      p.tak_kebagian.length > 0 ? `tak kebagian kuota: ${p.tak_kebagian.join(', ')}` : null,
      p.periode.find((b) => b.sebab !== null)?.sebab ?? null,
      p.seragam === false ? 'nominal bervariasi per bulan (lihat Rincian)' : null,
    ].filter((x): x is string => x !== null);
    const label = [p.dispensasi_nama.join(', ') || null, ...catatan]
      .filter((x): x is string => x !== null).join(' · ') || null;
    return {
      ...r, nominal: String(p.nominal), nominalManual: false,
      potongan: p.potongan, dispensasiIds: p.dispensasi_ids, dispensasiLabel: label,
      rincian: rincianPeriode(p.periode), periode: p.periode,
    };
  }, [pratinjau]);

  // Nominal default / dispensasi berubah → baris otomatis dihitung ulang.
  // Hanya baris yang nilainya berubah diganti (identitas dipertahankan)
  // agar tabel kandidat tak me-reset centangan tiap putaran.
  useEffect(() => {
    if (!open) return;
    setTerpilih((rows) => {
      let berubah = false;
      const hasil = rows.map((r) => {
        if (r.nominalManual) return r;
        const b = susunBaris(r, nominalDefault);
        if (b.nominal === r.nominal && b.potongan === r.potongan
          && b.dispensasiLabel === r.dispensasiLabel && b.rincian === r.rincian
          && b.periode === r.periode
          && JSON.stringify(b.dispensasiIds) === JSON.stringify(r.dispensasiIds)) return r;
        berubah = true;
        return b;
      });
      return berubah ? hasil : rows;
    });
  }, [open, nominalDefault, susunBaris]);

  const ubahNominalDefault = (v: string) => {
    setNominalDefault(v);
  };

  const pindahkan = useCallback((rows: KandidatRow[]) => {
    if (rows.length === 0) return;
    setTerpilih((lama) => {
      const ada = new Set(lama.map((r) => r.santri_id));
      const baru = rows
        .filter((r) => !ada.has(r.santri_id))
        .map((r) => susunBaris(r, nominalDefault));
      return [...lama, ...baru];
    });
  }, [nominalDefault, susunBaris]);

  const pilihTarif = (id: number | '') => {
    setTarifId(id);
    if (id !== '') {
      const t = tarif.find((x) => x.id === id);
      if (t) ubahNominalDefault(String(t.nominal));
      if (t && jenisId === '') setJenisId(t.jenis_id);
    }
  };

  const ubahJenis = (id: number | '') => {
    setJenisId(id);
    if (id !== '' && tarifId !== '') {
      const t = tarif.find((x) => x.id === tarifId);
      if (t && t.jenis_id !== id) setTarifId('');
    }
  };

  const simpan = async () => {
    if (tahunAjaran === null) { toast.error('Pilih satu tahun ajaran pada filter di atas.'); return; }
    if (jenisId === '') { toast.error('Pilih jenis tagihan.'); return; }
    if (terpilih.length === 0) { toast.error('Pindahkan minimal satu santri ke daftar generate.'); return; }
    if (bulanan && periodeDari === '') { toast.error('Isi Dari Bulan untuk jenis bulanan.'); return; }
    const nominal = Number(nominalDefault);
    if (!Number.isInteger(nominal) || nominal < 0) { toast.error('Nominal default tidak valid.'); return; }

    const santri: { santri_id: number; nominal?: number }[] = [];
    for (const r of terpilih) {
      // Baris otomatis: nominal dihitung backend (termasuk dispensasi);
      // baris hasil edit manual dikirim apa adanya (dispensasi tidak diterapkan).
      if (!r.nominalManual) { santri.push({ santri_id: r.santri_id }); continue; }
      const n = Number(r.nominal);
      if (!Number.isInteger(n) || n < 0) { toast.error(`Nominal ${r.nama_lengkap} tidak valid.`); return; }
      santri.push({ santri_id: r.santri_id, nominal: n });
    }

    setBusy(true);
    try {
      const r = await generateTagihan({
        tahun_ajaran: tahunAjaran, jenis_id: Number(jenisId),
        periode: bulanan ? periodeDari : null,
        periode_sampai: bulanan ? (periodeSampai || null) : null,
        jatuh_tempo: jatuhTempo || null, nominal, santri,
      });
      // Hasil tampil persisten di panel (bukan cuma toast) — nama santri
      // disalin saat ini agar tetap benar walau daftar diubah sesudahnya.
      const nama = new Map(terpilih.map((x) => [x.santri_id, x.nama_lengkap]));
      setHasil({
        dibuat: r.dibuat, diperbarui: r.diperbarui, tetap: r.tetap, dilewati: r.dilewati,
        alasan: r.alasan.map((a) => ({
          id: `${a.santri_id}-${a.periode ?? 'sekali'}`,
          nama: nama.get(a.santri_id) ?? `Santri #${a.santri_id}`,
          periode: a.periode, sebab: a.sebab, terbayar: a.terbayar,
          nominal_sekarang: a.nominal_sekarang,
        })),
      });
      await onSelesai();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  /** Ringkasan pra-generate: N santri × M bulan = K tagihan, estimasi total.
   *  Baris otomatis memakai rincian per-periode pratinjau (tepat); manual
   *  memakai nominal ketikan × jumlah periode. */
  const ringkasan = useMemo(() => {
    let total = 0, baris = 0;
    for (const r of terpilih) {
      if (r.nominalManual) {
        total += (Number(r.nominal) || 0) * jumlahPeriode;
        baris += jumlahPeriode;
      } else if (r.periode !== null && r.periode.length > 0) {
        total += r.periode.reduce((s, b) => s + b.nominal, 0);
        baris += r.periode.length;
      } else {
        total += (Number(r.nominal) || 0) * jumlahPeriode;
        baris += jumlahPeriode;
      }
    }
    return { total, baris };
  }, [terpilih, jumlahPeriode]);
  const tarifTampil = jenisId === '' ? tarif : tarif.filter((t) => t.jenis_id === jenisId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <DialogTitle>Buat Tagihan</DialogTitle>
          <DialogDescription className="sr-only">Pilih kandidat santri per kelompok, lalu generate tagihan untuk daftar terpilih.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_gen_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-wrap items-stretch gap-2 border-b px-2 py-2">
          <GrupLangkah no="1" label="Santri">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="sel_gen_kelompok">Kelompok Santri</FieldLabel>
              <select id="sel_gen_kelompok" className="h-8 rounded border px-2 text-sm" value={kelompok} onChange={(e) => setKelompok(e.target.value as KelompokKandidat)}>
                {OPSI_KELOMPOK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </GrupLangkah>
          <GrupLangkah no="2" label="Tagihan">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="sel_gen_jenis">Jenis Tagihan</FieldLabel>
              <select id="sel_gen_jenis" className="h-8 rounded border px-2 text-sm" value={jenisId} onChange={(e) => ubahJenis(e.target.value === '' ? '' : Number(e.target.value))} required>
                <option value="">Jenis…</option>
                {jenis.map((j) => <option key={j.id} value={j.id}>{j.nama}{j.jenjang ? ` (${j.jenjang})` : ''}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="sel_gen_tarif">Tarif (opsional)</FieldLabel>
              <select id="sel_gen_tarif" className="h-8 max-w-64 rounded border px-2 text-sm" value={tarifId} onChange={(e) => pilihTarif(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">Manual…</option>
                {tarifTampil.map((t) => <option key={t.id} value={t.id}>{t.jenjang} · {t.jenis?.nama ?? t.jenis_id} · Rp {t.nominal.toLocaleString('id')}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="inp_gen_nominal">Nominal Default</FieldLabel>
              <Input id="inp_gen_nominal" type="number" min={0} className="h-8 w-32" value={nominalDefault} onChange={(e) => ubahNominalDefault(e.target.value)} required />
            </div>
          </GrupLangkah>
          <GrupLangkah no="3" label="Periode">
            {bulanan ? (
              <>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="inp_gen_dari">Dari Bulan</FieldLabel>
                  <Input id="inp_gen_dari" type="month" className="h-8" value={periodeDari} onChange={(e) => setPeriodeDari(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="inp_gen_sampai">Sampai Bulan</FieldLabel>
                  <Input id="inp_gen_sampai" type="month" className="h-8" value={periodeSampai} onChange={(e) => setPeriodeSampai(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="info_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
                  <p id="info_gen_jatuh_tempo" className="flex h-8 items-center text-xs text-muted-foreground">
                    Otomatis tgl 10
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="info_gen_periode">Periode</FieldLabel>
                  <p id="info_gen_periode" className="flex h-8 items-center text-xs text-muted-foreground">
                    Otomatis {tahunAjaran ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="inp_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
                  <Input id="inp_gen_jatuh_tempo" type="date" className="h-8" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-describedby="ket_gen_jatuh_tempo" />
                </div>
              </>
            )}
          </GrupLangkah>
          <p className="self-center pb-0 text-xs text-muted-foreground">
            {tahunAjaran === null
              ? <span className="text-destructive">Pilih satu tahun ajaran pada filter di atas.</span>
              : <>TA {tahunAjaran} · {bulanan ? 'tunggakan dihitung setelah tgl 10 lewat' : 'kosongkan jatuh tempo = langsung tunggakan'} · nominal per baris bisa diketik ulang (manual menang).</>}
          </p>
        </div>

        {err !== '' && <div className="px-2 pt-2"><ErrorNotice>{err}</ErrorNotice></div>}

        {hasil !== null ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Dibuat', nilai: hasil.dibuat, id: 'hasil_gen_dibuat' },
                { label: 'Diperbarui', nilai: hasil.diperbarui, id: 'hasil_gen_diperbarui' },
                { label: 'Tetap', nilai: hasil.tetap, id: 'hasil_gen_tetap' },
                { label: 'Dilewati', nilai: hasil.dilewati, id: 'hasil_gen_dilewati' },
              ].map((k) => (
                <div key={k.id} id={k.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-2xl font-semibold">{k.nilai}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>
            {hasil.alasan.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <p className="text-sm font-medium">Dilewati ({hasil.alasan.length})</p>
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExcelTable<AlasanHasil>
                    tableKey="keuangan_gen_hasil"
                    fields={FIELDS_HASIL}
                    rows={hasil.alasan}
                    getValues={(r) => ({
                      nama: r.nama, periode: r.periode ?? 'sekali', sebab: r.sebab,
                      terbayar: `Rp ${r.terbayar.toLocaleString('id')}`,
                    })}
                    emptyText="—"
                    canEdit={false}
                    onCommit={async () => {}}
                    onSaved={() => {}}
                    hideCheckbox
                    hideActions
                    renderActions={() => null}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Semua baris terproses tanpa ada yang dilewati.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setHasil(null)}>Susun lagi</Button>
              <Button type="button" disabled={busy} onClick={() => onOpenChange(false)}>Tutup</Button>
            </div>
          </div>
        ) : (
        <ResizablePanelGroup orientation="horizontal" id="grup_gen_tagihan" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel defaultSize="50%" minSize="25%" id="panel_gen_kandidat" className="min-h-0 min-w-0">
            <div className="flex h-full min-h-0 flex-col gap-1 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Kandidat</p>
                <div className="relative max-w-56">
                  <Input id="inp_gen_cari" placeholder="Cari nama / NIS…" className="h-8 w-full pr-7" value={cari} onChange={(e) => setCari(e.target.value)} />
                  {cari !== '' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          id="btn_hapus_cari_gen"
                          aria-label="Bersihkan pencarian"
                          onClick={() => setCari('')}
                          className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bersihkan pencarian</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <ExcelTable<KandidatRow>
                  tableKey="keuangan_gen_kandidat"
                  fields={FIELDS_KANDIDAT}
                  rows={kandidatTampil}
                  urutAktif={urut}
                  arahUrut={arahUrut}
                  onUrut={terapkanUrut}
                  getValues={(r) => ({
                    nama: r.nama_lengkap, jk: r.jk, nis: r.nis_lokal ?? r.nisn,
                    tingkat: r.tingkat, kelas: r.kelas, status_akhir: r.status_akhir,
                    sudah: ringkasSudahAda(r, jumlahPeriode),
                  })}
                  loading={loading}
                  emptyText={jenisId === '' ? 'Pilih jenis tagihan untuk menghitung tagihan yang sudah ada.' : 'Tidak ada kandidat untuk kriteria ini.'}
                  canEdit={false}
                  onCommit={async () => {}}
                  onSaved={() => {}}
                  aksiLangsung
                  renderActions={(r) => (
                    <ActionIcon id={`btn_gen_pindah_${r.santri_id}`} title="Pindahkan ke daftar generate" onClick={() => pindahkan([r])}>
                      <ArrowRight size={16} />
                    </ActionIcon>
                  )}
                  renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                    <Button id="btn_gen_pindah" size="sm" disabled={busy} onClick={() => { pindahkan(checked); clear(); }}>
                      <ArrowRight data-icon="inline-start" size={14} /> Pindahkan ({checked.length})
                    </Button>
                  )}
                pager={<Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage)} onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))} />}
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle orientation="horizontal" withHandle id="gagang_gen_tagihan" aria-label="Atur lebar kandidat dan daftar generate" />
<ResizablePanel defaultSize="50%" minSize="25%" id="panel_gen_terpilih" className="min-h-0 min-w-0">
              <div className="flex h-full min-h-0 flex-col gap-1 p-2">
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExcelTable<BarisTerpilih & { id: number }>
                    tableKey="keuangan_gen_terpilih"
                    fields={FIELDS_TERPILIH}
                    rows={terpilih.map((r) => ({ ...r, id: r.santri_id }))}
                    getValues={(r) => ({
                      nama: r.nominalManual ? `● ${r.nama_lengkap}` : r.nama_lengkap,
                      kelas: [r.tingkat, r.kelas].filter(Boolean).join(' / ') || '—',
                      sekarang: ringkasSudahAda(r, jumlahPeriode),
                      nominal: r.nominal,
                      mode: r.nominalManual ? 'Manual' : 'Otomatis',
                      rincian: r.nominalManual ? 'Nominal manual — dispensasi tak diterapkan' : r.rincian,
                      dispensasi: r.dispensasiLabel === null
                        ? null
                        : `${r.potongan > 0 ? `−Rp ${r.potongan.toLocaleString('id')} · ` : ''}${r.dispensasiLabel}`,
                    })}
                    emptyText="Pindahkan santri dari daftar kandidat (centang lalu Pindahkan, atau ikon →)."
                    canEdit
                    onCommit={async (id, fields) => {
                      setTerpilih((rows) => rows.map((x) => x.santri_id === id
                        ? { ...x, nominal: fields.nominal ?? x.nominal, nominalManual: true, potongan: 0, dispensasiIds: null, dispensasiLabel: null, rincian: null, periode: null }
                        : x));
                    }}
                    onSaved={() => {}}
                    aksiLangsung
                    hideCheckbox
                    renderActions={(r) => (
                      <span className="flex items-center gap-1">
                        {r.nominalManual && (
                          <ActionIcon id={`btn_gen_otomatis_${r.santri_id}`} title="Kembalikan ke otomatis (hitung ulang + dispensasi)" onClick={() => setTerpilih((rows) => rows.map((x) => x.santri_id === r.santri_id
                            ? { ...x, nominal: nominalDefault, nominalManual: false, potongan: 0, dispensasiIds: null, dispensasiLabel: null, rincian: null, periode: null }
                            : x))}>
                            <span className="text-[11px] font-semibold">Auto</span>
                          </ActionIcon>
                        )}
                        <ActionIcon id={`btn_gen_hapus_${r.santri_id}`} title="Keluarkan dari daftar" onClick={() => setTerpilih((rows) => rows.filter((x) => x.santri_id !== r.santri_id))}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </span>
                    )}
                  />
                </div>
              </div>
            </ResizablePanel>
        </ResizablePanelGroup>
        )}

        {pratinjauGagal && !hasil && (
          <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">
            Pratinjau potongan gagal dimuat — nominal tampil sebelum dispensasi. Angka final dihitung saat Generate.
          </p>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-2 py-2 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {terpilih.length} santri × {jumlahPeriode} bulan = {ringkasan.baris} tagihan · estimasi Rp {ringkasan.total.toLocaleString('id')}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_gen_generate" type="button" disabled={busy || terpilih.length === 0} onClick={() => void simpan()}>Generate</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
