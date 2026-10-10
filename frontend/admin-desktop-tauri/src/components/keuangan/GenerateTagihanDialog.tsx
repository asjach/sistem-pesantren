import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PresetKolom from '@/components/PresetKolom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionIcon } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import { rincianPeriode } from '@/lib/dispensasi';
import { Trash2, X } from '@/icons';

const OPSI_KELOMPOK: { value: KelompokKandidat | ''; label: string }[] = [
  { value: '', label: 'Pilih kelompok…' },
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

/** Kelompok isian berbingkai di bilah filter: label grup + isi. */
function GrupLangkah({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border bg-muted/30 px-2 py-1.5', className)}>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Dialog generate tagihan: daftar santri kelompok langsung jadi daftar
 *  final yang akan dibuatkan tagihan; nominal default dari tarif/manual,
 *  bisa dioverride per baris. */
export default function GenerateTagihanDialog({ open, onOpenChange, jenis, tarif, tahunAjaran, onSelesai }: Props) {
  const [kelompok, setKelompok] = useState<KelompokKandidat | ''>('');
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [tarifId, setTarifId] = useState<number | ''>('');
  const [nominalDefault, setNominalDefault] = useState('');
  const [periodeDari, setPeriodeDari] = useState('');
  const [periodeSampai, setPeriodeSampai] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');

  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [terpilih, setTerpilih] = useState<BarisTerpilih[]>([]);
  const [busy, setBusy] = useState(false);
  /** Hasil generate terakhir (panel persisten; null = mode susun). */
  const [hasil, setHasil] = useState<HasilGenerate | null>(null);

  const jenisTerpilih = useMemo(() => jenis.find((j) => j.id === jenisId) ?? null, [jenis, jenisId]);
  const bulanan = jenisTerpilih?.tipe === 'bulanan';

  // Buka dialog: bersihkan pilihan; isi default periode setahun dari TA.
  useEffect(() => {
    if (!open) return;
    setTerpilih([]); setCari(''); setKelompok(''); setJenisId(''); setTarifId('');
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

  /** Cari hanya menyaring tampilan (tanpa request): daftar generate tetap
   *  seluruh `terpilih` — analog pencarian kandidat dulu yang tak menyentuh
   *  daftar generate. */
  const [urutDaftar, setUrutDaftar] = useState<'nama' | 'aktif'>('nama');
  const [statusFilter, setStatusFilter] = useState<'' | 'aktif' | 'nonaktif'>('');
  /** Susunan kolom dari PresetKolom card filter (tersimpan backend). */
  const [presetLuar, setPresetLuar] = useState<{
    keys: string[] | null; label: Record<string, string> | null; presetId: number | null;
  } | undefined>(undefined);
  const terapkanKolomLuar = useCallback(
    (keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => {
      setPresetLuar({ keys, label: label ?? null, presetId: presetId ?? null });
    },
    [],
  );
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const saring = terpilih.filter((r) =>
      (statusFilter === '' || (statusFilter === 'aktif') === (r.status_akhir === 'aktif'))
      && (q === ''
        || r.nama_lengkap.toLowerCase().includes(q)
        || (r.nisn ?? '').toLowerCase().includes(q)
        || (r.nis_lokal ?? '').toLowerCase().includes(q)));
    /* Urut tetap: Nama = kelas A-Z lalu nama A-Z; Keaktifan = aktif dulu
       lalu sama seperti Nama. Tanpa tombol arah. */
    const kunciKelas = (k: string | null) => (k === null ? '￿' : k);
    const bandingNama = (a: BarisTerpilih, b: BarisTerpilih) =>
      kunciKelas(a.kelas).localeCompare(kunciKelas(b.kelas), 'id')
      || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id');
    const rows = [...saring];
    if (urutDaftar === 'aktif') {
      rows.sort((a, b) =>
        Number(b.status_akhir === 'aktif') - Number(a.status_akhir === 'aktif') || bandingNama(a, b));
    } else {
      rows.sort(bandingNama);
    }
    return rows;
  }, [terpilih, cari, statusFilter, urutDaftar]);

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
  // agar tabel tak me-reset status edit tiap putaran.
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

  /* Akses stabil ke penyusun & nominal terkini untuk penggabung di bawah:
     keduanya berubah tiap pratinjau/ketikan, tapi muat-ulang server hanya
     boleh dipicu kriteria (buka/kelompok/jenis/periode) — bukan tiap hasilnya. */
  const susunRef = useRef(susunBaris);
  susunRef.current = susunBaris;
  const nominalDefaultRef = useRef(nominalDefault);
  nominalDefaultRef.current = nominalDefault;

  /** Muat daftar santri kelompok langsung ke tabel terpilih (semua baris).
   *  Baris manual dipertahankan (info tagihan sudah-ada disegarkan dari
   *  server); baris otomatis dibangun ulang dari data segar. Baris manual
   *  yang santrinya tak ada di hasil (mis. ganti kelompok) ikut terbuang —
   *  generate hanya memproses populasi yang tampil. */
  const muatSantri = useCallback(async () => {
    if (!open || tahunAjaran === null) return;
    // Belum pilih kelompok → daftar kosong, tanpa request.
    if (kelompok === '') { setTerpilih([]); return; }
    setErr(''); setLoading(true);
    try {
      const res = await kandidatTagihan({
        tahun_ajaran: tahunAjaran,
        kelompok,
        jenis_id: jenisId,
        periode: bulanan ? (periodeDari || undefined) : undefined,
        periode_sampai: bulanan ? (periodeSampai || undefined) : undefined,
        page: 1,
        per_page: 'all',
      });
      setTerpilih((lama) => {
        const manual = new Map(lama.filter((r) => r.nominalManual).map((r) => [r.santri_id, r]));
        return res.data.map((r) => {
          const m = manual.get(r.santri_id);
          if (m !== undefined) {
            return {
              ...m,
              tagihan_periode: r.tagihan_periode, tagihan_nominal: r.tagihan_nominal,
              tagihan_terbayar: r.tagihan_terbayar,
            };
          }
          return susunRef.current(r, nominalDefaultRef.current);
        });
      });
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [open, tahunAjaran, kelompok, jenisId, bulanan, periodeDari, periodeSampai]);

  // Buka dialog / kriteria berubah → muat ulang (tahan 250ms).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void muatSantri(); }, 250);
    return () => clearTimeout(t);
  }, [open, muatSantri]);

  const ubahNominalDefault = (v: string) => {
    setNominalDefault(v);
  };

  /** Tarif = patokan: nominal default + jenis (+tipe bulanan) mengikutinya. */
  const pilihTarif = (id: number | '') => {
    setTarifId(id);
    if (id === '') { setJenisId(''); return; }
    const t = tarif.find((x) => x.id === id);
    if (t) {
      ubahNominalDefault(String(t.nominal));
      setJenisId(t.jenis_id);
    }
  };

  const simpan = async () => {
    if (tahunAjaran === null) { toast.error('Pilih satu tahun ajaran pada filter di atas.'); return; }
    if (tarifId === '' || jenisId === '') { toast.error('Pilih tarif.'); return; }
    if (terpilih.length === 0) { toast.error('Pilih minimal satu santri pada daftar.'); return; }
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <DialogTitle>Buat Tagihan</DialogTitle>
          <DialogDescription className="sr-only">Pilih kelompok santri untuk memuat daftar, lalu generate tagihan.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_gen_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-wrap items-stretch gap-2 border-b px-2 py-2">
          <GrupLangkah label="Tagihan" className="w-full">
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="sel_gen_tarif">Tarif</FieldLabel>
              <Select value={tarifId === '' ? '' : String(tarifId)} onValueChange={(v) => pilihTarif(v === '' ? '' : Number(v))}>
                <SelectTrigger id="sel_gen_tarif" aria-label="Tarif" className="h-8 max-w-64 text-sm">
                  <SelectValue placeholder="Pilih tarif…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Pilih tarif…</SelectItem>
                  {tarif.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.jenjang} · {t.jenis?.nama ?? t.jenis_id} · Rp {t.nominal.toLocaleString('id')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div aria-hidden="true" className="hidden w-px self-stretch bg-border sm:block" />
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="inp_gen_nominal">Nominal Default</FieldLabel>
              <Input id="inp_gen_nominal" type="number" min={0} className="h-8 w-32" value={nominalDefault} onChange={(e) => ubahNominalDefault(e.target.value)} required />
            </div>
            {bulanan ? (
              <>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="inp_gen_dari">Dari Bulan</FieldLabel>
                  <Input id="inp_gen_dari" type="month" className="h-8" value={periodeDari} onChange={(e) => setPeriodeDari(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="inp_gen_sampai">Sampai Bulan</FieldLabel>
                  <Input id="inp_gen_sampai" type="month" className="h-8" value={periodeSampai} onChange={(e) => setPeriodeSampai(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="info_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
                  <p id="info_gen_jatuh_tempo" className="flex h-8 items-center text-xs text-muted-foreground">
                    Otomatis tgl 10
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="info_gen_periode">Periode</FieldLabel>
                  <p id="info_gen_periode" className="flex h-8 items-center text-xs text-muted-foreground">
                    Otomatis {tahunAjaran ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="inp_gen_jatuh_tempo">Jatuh Tempo</FieldLabel>
                  <Input id="inp_gen_jatuh_tempo" type="date" className="h-8" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-describedby="ket_gen_jatuh_tempo" />
                </div>
              </>
            )}
          </GrupLangkah>
          {/* Kelompok + filter tanpa card: baris pembungkus polos. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-0.5">
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="sel_gen_kelompok">Kelompok Santri</FieldLabel>
              <Select value={kelompok} onValueChange={(v) => setKelompok(v as KelompokKandidat | '')}>
                <SelectTrigger id="sel_gen_kelompok" aria-label="Kelompok Santri" className="h-8 text-sm">
                  <SelectValue placeholder="Pilih kelompok…" />
                </SelectTrigger>
                <SelectContent>
                  {OPSI_KELOMPOK.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="inp_gen_cari">Cari</FieldLabel>
              <div className="relative">
                <Input id="inp_gen_cari" placeholder="Cari nama / NIS…" className="h-8 w-56 pr-7" value={cari} onChange={(e) => setCari(e.target.value)} />
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
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="sel_gen_urut">Urutkan</FieldLabel>
              <Select value={urutDaftar} onValueChange={(v) => setUrutDaftar(v as 'nama' | 'aktif')}>
                <SelectTrigger
                  id="sel_gen_urut"
                  aria-label="Urutkan"
                  title="Nama: kelas A-Z lalu nama A-Z; Keaktifan: aktif dulu"
                  className="h-8 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nama">Nama</SelectItem>
                  <SelectItem value="aktif">Keaktifan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <FieldLabel htmlFor="sel_gen_status">Status</FieldLabel>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as '' | 'aktif' | 'nonaktif')}>
                <SelectTrigger id="sel_gen_status" aria-label="Status" className="h-8 text-sm">
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua status</SelectItem>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Tidak aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PresetKolom
              tableKey="keuangan_gen_terpilih"
              fields={FIELDS_TERPILIH}
              onApply={terapkanKolomLuar}
              triggerClassName="h-8 w-32 text-xs"
              sejajarLabel
            />
          </div>
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
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
              <p className="text-sm font-medium">
                Daftar Santri ({terpilih.length}{cari.trim() !== '' || statusFilter !== '' ? `, tampil ${tampil.length}` : ''})
              </p>
              <div className="flex min-h-0 flex-1 flex-col">
                <ExcelTable<BarisTerpilih & { id: number }>
                  tableKey="keuangan_gen_terpilih"
                  fields={FIELDS_TERPILIH}
                  hidePreset
                  presetLuar={presetLuar}
                  rows={tampil.map((r) => ({ ...r, id: r.santri_id }))}
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
                  loading={loading}
                  emptyText={kelompok === '' ? 'Pilih kelompok santri untuk memuat daftar.' : 'Tidak ada santri pada kelompok ini.'}
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
