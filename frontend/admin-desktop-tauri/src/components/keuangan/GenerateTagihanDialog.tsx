import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatTarif, generateTagihan, kandidatTagihan, pratinjauTagihan,
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
import LabeledCombobox from '@/components/LabeledCombobox';
import LabeledTextInput from '@/components/LabeledTextInput';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

/** Opsi filter status daftar Santri (label tampil + nilai ke state). */
const OPSI_STATUS_GEN: { nilai: '' | 'aktif' | 'nonaktif'; label: string }[] = [
  { nilai: '', label: 'Semua status' },
  { nilai: 'aktif', label: 'Aktif' },
  { nilai: 'nonaktif', label: 'Tidak aktif' },
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
  /** Dipanggil saat tarif baru dibuat dari popover, supaya halaman induk
   *  memuat ulang tabel Tarif (tanpa ini tarif baru hanya hidup di dialog). */
  onTarifBaru?: (t: Tarif) => void | Promise<void>;
}

/** Satu butir galat validasi; targetId = id elemen yang difokuskan saat diklik. */
interface GalatIsian {
  pesan: string;
  targetId?: string;
}

/** Ringkasan galat di atas form: fokus pindah ke sini setelah validasi gagal,
 *  tiap butir menaut ke isiannya (pengganti toast yang tak bisa diklik). */
function RingkasanGalat({ id, daftar }: { id: string; daftar: GalatIsian[] }) {
  if (daftar.length === 0) return null;
  return (
    <div
      id={id}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2"
    >
      <p className="text-sm font-semibold text-destructive">Ada yang perlu diperbaiki</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-destructive">
        {daftar.map((g, i) => (
          <li key={i}>
            {g.targetId !== undefined ? (
              <button
                type="button"
                className="underline underline-offset-2 hover:no-underline"
                onClick={() => document.getElementById(g.targetId!)?.focus()}
              >
                {g.pesan}
              </button>
            ) : g.pesan}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TAHAP = ['Kriteria', 'Daftar', 'Hasil'] as const;

/** Penunjuk langkah di header: nomor + label, tahap aktif ditandai. */
function PenunjukTahap({ aktif }: { aktif: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Langkah" className="flex items-center gap-1 text-xs">
      {TAHAP.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const selesai = n < aktif;
        const jalan = n === aktif;
        return (
          <li key={label} className="flex items-center gap-1" aria-current={jalan ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className="mx-0.5 h-px w-3 bg-border" />}
            <span
              aria-hidden="true"
              className={
                jalan
                  ? 'grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'
                  : selesai
                    ? 'grid size-4 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary'
                    : 'grid size-4 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground'
              }
            >
              {n}
            </span>
            <span className={jalan ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Dialog generate tagihan: daftar santri kelompok langsung jadi daftar
 *  final yang akan dibuatkan tagihan; nominal default dari tarif/manual,
 *  bisa dioverride per baris. */
export default function GenerateTagihanDialog({ open, onOpenChange, jenis, tarif, tahunAjaran, onSelesai, onTarifBaru }: Props) {
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
  /** Langkah wizard: 1 = kriteria, 2 = daftar (3 = hasil, mengikuti `hasil`). */
  const [langkah, setLangkah] = useState<1 | 2>(1);
  /** Konfirmasi generate: panel cek-ulang sebelum eksekusi. */
  const [konfirmasi, setKonfirmasi] = useState(false);
  /** Galat validasi langkah kriteria + langkah daftar. */
  const [galat, setGalat] = useState<GalatIsian[]>([]);
  const [galatDaftar, setGalatDaftar] = useState<GalatIsian[]>([]);
  /** Galat inline nominal (validasi saat blur). */
  const [galatNominal, setGalatNominal] = useState<string | null>(null);
  /** Tarif yang dibuat dari popover (menunggu reload induk). */
  const [tarifLokal, setTarifLokal] = useState<Tarif[]>([]);
  /** Popover Buat Tarif + isiannya. */
  const [popTarif, setPopTarif] = useState(false);
  const [baruJenjang, setBaruJenjang] = useState('');
  const [baruJenisId, setBaruJenisId] = useState<number | ''>('');
  const [baruNominal, setBaruNominal] = useState('');
  const [baruErr, setBaruErr] = useState('');
  const [baruBusy, setBaruBusy] = useState(false);

  const jenisTerpilih = useMemo(() => jenis.find((j) => j.id === jenisId) ?? null, [jenis, jenisId]);
  const bulanan = jenisTerpilih?.tipe === 'bulanan';

  /** Opsi tarif = bawaan induk + yang baru dibuat di popover (anti-duplikat id). */
  const daftarTarifPilih = useMemo(() => {
    const ids = new Set(tarif.map((t) => t.id));
    return [...tarif, ...tarifLokal.filter((t) => !ids.has(t.id))];
  }, [tarif, tarifLokal]);
  /** Pilihan jenjang popover: dari tarif yang ada + jenis yang berjenjang. */
  const opsiJenjangBaru = useMemo(() => {
    const s = new Set<string>();
    for (const t of daftarTarifPilih) s.add(t.jenjang);
    for (const j of jenis) if (j.jenjang !== null) s.add(j.jenjang);
    return [...s].sort((a, b) => a.localeCompare(b, 'id'));
  }, [daftarTarifPilih, jenis]);
  /** Opsi tarif untuk combobox. Tanpa entri "kosong": teks placeholder
   *  sudah menyatakan keadaan kosong, dan entri kosong akan ikut jadi nilai
   *  terpilih sehingga ikut terisi di input. */
  const opsiTarif = useMemo(
    () => daftarTarifPilih.map((t) => ({
      label: `${t.jenjang} · ${t.jenis?.nama ?? t.jenis_id} · Rp ${t.nominal.toLocaleString('id')}`,
      nilai: String(t.id),
    })),
    [daftarTarifPilih],
  );
  const opsiJenisBaru = useMemo(
    () => jenis.filter((j) => baruJenjang === '' || j.jenjang === null || j.jenjang === baruJenjang),
    [jenis, baruJenjang],
  );

  // Buka dialog: bersihkan pilihan; isi default periode setahun dari TA.
  useEffect(() => {
    if (!open) return;
    setTerpilih([]); setCari(''); setKelompok(''); setJenisId(''); setTarifId('');
    setNominalDefault(''); setJatuhTempo(''); setErr(''); setHasil(null);
    setLangkah(1); setGalat([]); setGalatDaftar([]); setGalatNominal(null);
    setKonfirmasi(false); setTarifLokal([]); setPopTarif(false);
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

  // Validasi gagal → fokus pindah ke ringkasan galat (sekali per perubahan).
  const galatKunci = galat.map((g) => g.pesan).join('|');
  useEffect(() => {
    if (galat.length === 0) return;
    document.getElementById('ringkas_galat_gen')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galatKunci]);
  const galatDaftarKunci = galatDaftar.map((g) => g.pesan).join('|');
  useEffect(() => {
    if (galatDaftar.length === 0) return;
    document.getElementById('ringkas_galat_daftar')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galatDaftarKunci]);

  // Generate selesai → fokus pindah ke judul hasil.
  useEffect(() => {
    if (hasil === null) return;
    setTimeout(() => document.getElementById('judul_hasil_gen')?.focus(), 0);
  }, [hasil]);

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
    setGalatNominal(null);
  };

  /** Tarif = patokan: nominal default + jenis (+tipe bulanan) mengikutinya. */
  const pilihTarif = (id: number | '', daftar: Tarif[] = daftarTarifPilih) => {
    setTarifId(id);
    if (id === '') { setJenisId(''); return; }
    const t = daftar.find((x) => x.id === id);
    if (t) {
      ubahNominalDefault(String(t.nominal));
      setJenisId(t.jenis_id);
    }
  };

  /** Buka popover: isian di-reset (kosong = belum pilih). */
  const resetFormTarif = () => {
    setBaruJenjang('');
    setBaruJenisId(''); setBaruNominal(''); setBaruErr('');
  };

  /** Simpan tarif baru → masuk opsi + langsung terpilih sebagai patokan. */
  const simpanTarifBaru = async (e: FormEvent) => {
    e.preventDefault();
    if (tahunAjaran === null) { setBaruErr('Pilih satu tahun ajaran pada filter di atas.'); return; }
    if (baruJenjang === '') { setBaruErr('Pilih jenjang.'); return; }
    if (baruJenisId === '') { setBaruErr('Pilih jenis.'); return; }
    const n = Number(baruNominal);
    if (baruNominal.trim() === '' || !Number.isInteger(n) || n < 0) {
      setBaruErr('Nominal harus bilangan bulat ≥ 0.'); return;
    }
    setBaruErr(''); setBaruBusy(true);
    try {
      const t = await buatTarif({
        jenjang: baruJenjang, tahun_ajaran: tahunAjaran,
        jenis_id: Number(baruJenisId), nominal: n,
      });
      setTarifLokal((l) => [...l, t]);
      await onTarifBaru?.(t);
      toast.success('Tarif dibuat.');
      setPopTarif(false);
      pilihTarif(t.id, [...daftarTarifPilih, t]);
    } catch (e2) { setBaruErr(errorMessage(e2)); } finally { setBaruBusy(false); }
  };

  /** Galat inline nominal: null = valid. */
  const validasiNominal = (v: string): string | null => {
    if (v.trim() === '') return 'Nominal default wajib diisi.';
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return 'Nominal default harus bilangan bulat ≥ 0.';
    return null;
  };

  /** Validasi langkah kriteria (dipakai tombol Lanjut & Generate). */
  const validasiKriteria = (): GalatIsian[] => {
    const g: GalatIsian[] = [];
    if (tahunAjaran === null) g.push({ pesan: 'Pilih satu tahun ajaran pada filter di atas.' });
    if (tarifId === '' || jenisId === '') g.push({ pesan: 'Pilih tarif.', targetId: 'sel_gen_tarif' });
    const gn = validasiNominal(nominalDefault);
    if (gn !== null) g.push({ pesan: gn, targetId: 'inp_gen_nominal' });
    if (bulanan) {
      if (periodeDari === '') g.push({ pesan: 'Isi Dari Bulan untuk jenis bulanan.', targetId: 'inp_gen_dari' });
      else if (hitungJumlahPeriode(periodeDari, periodeSampai) <= 0) {
        g.push({ pesan: 'Sampai Bulan tidak boleh sebelum Dari Bulan.', targetId: 'inp_gen_sampai' });
      }
    }
    return g;
  };

  /** Kriteria valid → maju ke daftar. */
  const lanjut = () => {
    const g = validasiKriteria();
    setGalat(g);
    if (g.length > 0) return;
    setGalatDaftar([]);
    setLangkah(2);
    setTimeout(() => document.getElementById('judul_daftar_gen')?.focus(), 0);
  };

  /** Validasi siap-generate (dipakai tombol Generate & eksekusi). */
  const siapGenerate = (): boolean => {
    // Kriteria dirusak via Kembali → kembalikan ke langkah 1 + tunjukkan galat.
    const g = validasiKriteria();
    if (g.length > 0) { setGalat(g); setLangkah(1); return false; }
    if (kelompok === '') {
      setGalatDaftar([{ pesan: 'Pilih kelompok santri pada filter daftar.', targetId: 'sel_gen_kelompok' }]);
      return false;
    }
    if (terpilih.length === 0) {
      setGalatDaftar([{ pesan: 'Daftar santri masih kosong. Pilih kelompok santri pada filter daftar.' }]);
      return false;
    }
    const rusak: GalatIsian[] = [];
    for (const r of terpilih) {
      if (!r.nominalManual) continue;
      const n = Number(r.nominal);
      if (!Number.isInteger(n) || n < 0) rusak.push({ pesan: `Nominal ${r.nama_lengkap} tidak valid.` });
    }
    if (rusak.length > 0) { setGalatDaftar(rusak); return false; }
    setGalatDaftar([]);
    return true;
  };

  /** Tombol Generate: lolos validasi → tampilkan panel konfirmasi. */
  const mintaKonfirmasi = () => {
    if (!siapGenerate()) return;
    setKonfirmasi(true);
    setTimeout(() => document.getElementById('judul_konfirmasi_gen')?.focus(), 0);
  };

  const simpan = async () => {
    if (!siapGenerate()) { setKonfirmasi(false); return; }

    const santri: { santri_id: number; nominal?: number }[] = [];
    for (const r of terpilih) {
      // Baris otomatis: nominal dihitung backend (termasuk dispensasi);
      // baris hasil edit manual dikirim apa adanya (dispensasi tidak diterapkan).
      if (!r.nominalManual) { santri.push({ santri_id: r.santri_id }); continue; }
      santri.push({ santri_id: r.santri_id, nominal: Number(r.nominal) });
    }

    const nominal = Number(nominalDefault);
    setBusy(true);
    try {
      const r = await generateTagihan({
        tahun_ajaran: tahunAjaran!, jenis_id: Number(jenisId),
        periode: bulanan ? periodeDari : null,
        periode_sampai: bulanan ? (periodeSampai || null) : null,
        jatuh_tempo: jatuhTempo || null, nominal, santri,
      });
      // Hasil tampil persisten di panel (bukan cuma toast) — nama santri
      // disalin saat ini agar tetap benar walau daftar diubah sesudahnya.
      const nama = new Map(terpilih.map((x) => [x.santri_id, x.nama_lengkap]));
      setKonfirmasi(false);
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

  /** Isian panel konfirmasi: tarif, periode, dan hitungan baris manual. */
  const tarifTerpilih = tarif.find((t) => t.id === tarifId) ?? null;
  const hitungManual = terpilih.filter((r) => r.nominalManual).length;
  const teksPeriode = bulanan
    ? (periodeSampai !== '' ? `${periodeDari} s.d. ${periodeSampai}` : periodeDari)
    : `TA ${tahunAjaran ?? '—'}${jatuhTempo !== '' ? ` · JT ${jatuhTempo}` : ' · tanpa JT (langsung tunggakan)'}`;

  const tahap = hasil !== null ? 3 : langkah;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className={
          tahap === 1
            // Kriteria isinya pendek: kartu kompak di tengah, bukan selebar layar.
            ? 'flex w-[calc(100vw-3rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl p-0'
            : 'flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none'
        }
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <div className="flex items-center gap-3">
            <DialogTitle>Buat Tagihan</DialogTitle>
            <PenunjukTahap aktif={tahap} />
          </div>
          <DialogDescription className="sr-only">Tiga langkah: isi kriteria tagihan, periksa daftar santri, lalu generate.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_gen_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        {hasil !== null ? (
          <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
            <h3 id="judul_hasil_gen" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
              {hasil.dilewati === 0 && hasil.alasan.length === 0
                ? 'Tagihan berhasil dibuat'
                : 'Generate selesai'}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Dibuat', ket: 'tagihan baru', nilai: hasil.dibuat, id: 'hasil_gen_dibuat' },
                { label: 'Diperbarui', ket: 'nominal berubah, ditulis ulang', nilai: hasil.diperbarui, id: 'hasil_gen_diperbarui' },
                { label: 'Tetap', ket: 'sudah sama, tidak diubah', nilai: hasil.tetap, id: 'hasil_gen_tetap' },
                { label: 'Dilewati', ket: 'tidak dibuat — sebab di bawah', nilai: hasil.dilewati, id: 'hasil_gen_dilewati' },
              ].map((k) => (
                <div key={k.id} id={k.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-2xl font-semibold">{k.nilai}</p>
                  <p className="text-sm font-medium">{k.label}</p>
                  <p className="text-xs text-muted-foreground">{k.ket}</p>
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
          </div>
          <DialogFooter className="flex-row items-center justify-end gap-2 border-t px-2 py-2 sm:justify-end">
            <Button type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => { setHasil(null); setLangkah(2); setKonfirmasi(false); }}>Kembali ke Daftar</Button>
            <Button type="button" className="h-[26px]" disabled={busy} onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
          </>
        ) : tahap === 1 ? (
          <>
            <div className="flex flex-col gap-3 p-3">
              <h3 id="judul_kriteria_gen" className="text-sm font-semibold">Kriteria Tagihan</h3>
              <RingkasanGalat id="ringkas_galat_gen" daftar={galat} />
              <div className="flex flex-col gap-3">
                {/* Baris 1: Tarif */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-end gap-2">
                    <Popover
                      open={popTarif}
                      onOpenChange={(o) => { if (baruBusy) return; if (o) resetFormTarif(); setPopTarif(o); }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="btn_buat_tarif" type="button" variant="outline" size="sm"
                          className="h-[26px] text-xs" disabled={tahunAjaran === null}
                          title={tahunAjaran === null ? 'Pilih tahun ajaran dulu' : 'Buat tarif baru'}
                        >
                          Buat Tarif
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent id="pop_buat_tarif" align="end" className="pointer-events-auto w-72 p-3">
                        <form onSubmit={(e) => void simpanTarifBaru(e)} className="flex flex-col gap-2">
                          <p className="text-sm font-semibold">Tarif Baru · TA {tahunAjaran ?? '—'}</p>
                          {baruErr !== '' && <p role="alert" className="text-xs text-destructive">{baruErr}</p>}
                          <div className="flex flex-col gap-1">
                            <FieldLabel htmlFor="sel_tarif_baru_jenjang">Jenjang</FieldLabel>
                            <Select
                              value={baruJenjang}
                              onValueChange={(v) => { setBaruJenjang(v); setBaruJenisId(''); }}
                            >
                              <SelectTrigger id="sel_tarif_baru_jenjang" aria-label="Jenjang" className="h-[26px] w-full text-sm">
                                <SelectValue placeholder="Pilih jenjang…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Pilih jenjang…</SelectItem>
                                {opsiJenjangBaru.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <FieldLabel htmlFor="sel_tarif_baru_jenis">Jenis</FieldLabel>
                            <Select
                              value={baruJenisId === '' ? '' : String(baruJenisId)}
                              onValueChange={(v) => setBaruJenisId(v === '' ? '' : Number(v))}
                            >
                              <SelectTrigger id="sel_tarif_baru_jenis" aria-label="Jenis" className="h-[26px] w-full text-sm">
                                <SelectValue placeholder="Pilih jenis…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Pilih jenis…</SelectItem>
                                {opsiJenisBaru.map((j) => <SelectItem key={j.id} value={String(j.id)}>{j.nama}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <FieldLabel htmlFor="inp_tarif_baru_nominal">Nominal</FieldLabel>
                            <Input
                              id="inp_tarif_baru_nominal" type="number" min={0} className="h-[26px]"
                              value={baruNominal} onChange={(e) => setBaruNominal(e.target.value)} required
                            />
                          </div>
                          <Button id="btn_tarif_baru_simpan" type="submit" size="sm" className="h-[26px]" disabled={baruBusy}>
                            {baruBusy ? 'Menyimpan…' : 'Simpan Tarif'}
                          </Button>
                        </form>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <LabeledCombobox
                    label="Tarif"
                    htmlFor="sel_gen_tarif"
                    bisaCari
                    tinggi={30}
                  >
                    <ComboboxRoot
                      items={opsiTarif}
                      autoHighlight
                      itemToStringLabel={(o) => o.label}
                      isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                      value={opsiTarif.find((o) => o.nilai === String(tarifId)) ?? null}
                      onValueChange={(o) => { if (o !== null) pilihTarif(Number(o.nilai)); }}
                    >
                      <ComboboxInput id="sel_gen_tarif" aria-label="Tarif" placeholder="Pilih tarif…" />
                      <ComboboxTrigger aria-label="Buka daftar tarif" />
                      <ComboboxContent>
                        <ComboboxEmpty>Belum ada tarif.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </LabeledCombobox>
                  <p className="min-h-4 text-xs text-muted-foreground">
                    {jenisTerpilih !== null && `Jenis: ${jenisTerpilih.nama} · ${bulanan ? 'bulanan' : 'sekali bayar'}`}
                  </p>
                </div>
                {/* Baris 2: Nominal Default */}
                <div className="flex flex-col gap-1">
                  <LabeledTextInput
                    label="Nominal Default"
                    htmlFor="inp_gen_nominal"
                    type="number" min={0} value={nominalDefault}
                    onChange={(e) => ubahNominalDefault(e.target.value)}
                    onBlur={() => setGalatNominal(validasiNominal(nominalDefault))}
                    aria-invalid={galatNominal !== null}
                    aria-describedby={galatNominal !== null ? 'galat_nominal_gen' : undefined}
                    required
                  />
                  <p id="galat_nominal_gen" className="min-h-4 text-xs text-destructive">{galatNominal ?? ''}</p>
                </div>
                {/* Baris 3: Periode */}
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium leading-none">Periode</p>
                  {bulanan ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="inp_gen_dari">Dari Bulan</FieldLabel>
                        <Input id="inp_gen_dari" type="month" className="h-[26px]" value={periodeDari} onChange={(e) => setPeriodeDari(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="inp_gen_sampai">Sampai Bulan</FieldLabel>
                        <Input id="inp_gen_sampai" type="month" className="h-[26px]" value={periodeSampai} onChange={(e) => setPeriodeSampai(e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <p id="info_gen_periode" className="flex h-[26px] items-center text-sm">Otomatis {tahunAjaran ?? '—'}</p>
                  )}
                </div>
                {/* Baris 4: Jatuh Tempo */}
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={bulanan ? 'info_gen_jatuh_tempo' : 'inp_gen_jatuh_tempo'}>Jatuh Tempo</FieldLabel>
                  {bulanan ? (
                    <p id="info_gen_jatuh_tempo" className="flex h-[26px] items-center text-sm text-muted-foreground">
                      Otomatis tanggal 10
                    </p>
                  ) : (
                    <Input id="inp_gen_jatuh_tempo" type="date" className="h-[26px]" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-describedby="ket_gen_jatuh_tempo" />
                  )}
                </div>
                {bulanan ? (
                  <p className="text-xs text-muted-foreground">
                    Tunggakan dihitung setelah tgl 10 lewat · TA {tahunAjaran ?? '—'}.
                  </p>
                ) : (
                  <p id="ket_gen_jatuh_tempo" className="text-xs text-muted-foreground">
                    Kosongkan jatuh tempo = langsung tunggakan · nominal per baris bisa diketik ulang di langkah Daftar (manual menang).
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="flex-row items-center justify-end gap-2 border-t px-2 py-2 sm:justify-end">
              <Button type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
              <Button id="btn_gen_lanjut" type="button" className="h-[26px]" disabled={busy} onClick={lanjut}>Lanjut</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {konfirmasi ? (
            <div className="flex flex-col gap-3 p-3">
              <h3 id="judul_konfirmasi_gen" tabIndex={-1} className="text-sm font-semibold focus:outline-none">Konfirmasi Generate</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">Tarif</dt>
                <dd>{tarifTerpilih !== null ? `${tarifTerpilih.jenjang} · ${tarifTerpilih.jenis?.nama ?? tarifTerpilih.jenis_id} · Rp ${tarifTerpilih.nominal.toLocaleString('id')}` : '—'}</dd>
                <dt className="text-muted-foreground">Periode</dt>
                <dd>{teksPeriode}</dd>
                <dt className="text-muted-foreground">Santri</dt>
                <dd>{terpilih.length} ({terpilih.length - hitungManual} otomatis · {hitungManual} manual)</dd>
                <dt className="text-muted-foreground">Akan dibuat</dt>
                <dd className="font-semibold">{ringkasan.baris} tagihan · estimasi Rp {ringkasan.total.toLocaleString('id')}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                Tagihan yang sudah ada tidak diduplikasi: yang nominalnya sama tetap, yang berubah diperbarui, yang tak layak dilewati beserta sebabnya.
              </p>
            </div>
            ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
              <h3 id="judul_daftar_gen" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Daftar Santri ({terpilih.length}{cari.trim() !== '' || statusFilter !== '' ? `, tampil ${tampil.length}` : ''})
              </h3>
              <RingkasanGalat id="ringkas_galat_daftar" daftar={galatDaftar} />
              {err !== '' && <ErrorNotice>{err}</ErrorNotice>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="sel_gen_kelompok">Kelompok Santri</FieldLabel>
                  <Select value={kelompok} onValueChange={(v) => setKelompok(v as KelompokKandidat | '')}>
                    <SelectTrigger id="sel_gen_kelompok" aria-label="Kelompok Santri" className="h-[26px] text-sm">
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
                    <Input id="inp_gen_cari" placeholder="Cari nama / NIS…" className="h-[26px] w-56 pr-7" value={cari} onChange={(e) => setCari(e.target.value)} />
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
                <LabeledCombobox label="Status" htmlFor="sel_gen_status">
                  <ComboboxRoot
                    items={OPSI_STATUS_GEN}
                    itemToStringLabel={(o) => o.label}
                    isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                    value={OPSI_STATUS_GEN.find((o) => o.nilai === statusFilter) ?? OPSI_STATUS_GEN[0]}
                    onValueChange={(o) => { if (o !== null) setStatusFilter(o.nilai); }}
                  >
                    <ComboboxInput id="sel_gen_status" aria-label="Status" placeholder="Cari status…" />
                    <ComboboxTrigger aria-label="Buka daftar status" />
                    <ComboboxContent>
                      <ComboboxEmpty>Tidak ada status.</ComboboxEmpty>
                      <ComboboxList>
                        {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                      </ComboboxList>
                    </ComboboxContent>
                  </ComboboxRoot>
                </LabeledCombobox>
                <div className="flex items-center gap-2">
                  <FieldLabel htmlFor="sel_gen_urut">Urutkan</FieldLabel>
                  <Select value={urutDaftar} onValueChange={(v) => setUrutDaftar(v as 'nama' | 'aktif')}>
                    <SelectTrigger
                      id="sel_gen_urut"
                      aria-label="Urutkan"
                      title="Nama: kelas A-Z lalu nama A-Z; Keaktifan: aktif dulu"
                      className="h-[26px] text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nama">Nama</SelectItem>
                      <SelectItem value="aktif">Keaktifan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PresetKolom
                  tableKey="keuangan_gen_terpilih"
                  fields={FIELDS_TERPILIH}
                  onApply={terapkanKolomLuar}
                  triggerClassName="h-[26px] w-32 text-xs"
                  sejajarLabel
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Klik sel Nominal baru untuk mengetik ulang (● = manual, menang atas hitungan otomatis; dispensasi tak diterapkan). Tombol Auto mengembalikan ke hitungan otomatis.
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

            {pratinjauGagal && !konfirmasi && (
              <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">
                Pratinjau potongan gagal dimuat — nominal tampil sebelum dispensasi. Angka final dihitung saat Generate.
              </p>
            )}

            <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-2 py-2 sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {terpilih.length} santri × {jumlahPeriode} bulan = {ringkasan.baris} tagihan · estimasi Rp {ringkasan.total.toLocaleString('id')}
              </p>
              {konfirmasi ? (
              <div className="flex gap-2">
                <Button id="btn_gen_periksa" type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => setKonfirmasi(false)}>Periksa lagi</Button>
                <Button id="btn_gen_ya" type="button" className="h-[26px]" disabled={busy} onClick={() => void simpan()}>
                  {busy ? 'Memproses…' : `Ya, buat ${ringkasan.baris} tagihan`}
                </Button>
              </div>
              ) : (
              <div className="flex gap-2">
                <Button id="btn_gen_kembali" type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => setLangkah(1)}>Kembali</Button>
                <Button id="btn_gen_batal" type="button" variant="ghost" className="h-[26px]" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
                <Button id="btn_gen_generate" type="button" className="h-[26px]" disabled={busy || terpilih.length === 0} onClick={mintaKonfirmasi}>Generate</Button>
              </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
