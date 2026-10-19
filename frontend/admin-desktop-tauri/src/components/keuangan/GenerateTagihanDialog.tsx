import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatTarif, generateTagihan, kandidatTagihan, pratinjauTagihan,
  type JenisTagihan, type KandidatTagihanRow, type KelompokKandidat, type PratinjauBaris,
  type Tarif, type PratinjauSantri,
} from '../../api/keuangan';
import { daftarGrupCustom, type GrupSantriCustom } from '../../api/grupCustom';
import RincianBulanKartu from './RincianBulanKartu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PresetKolom from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import LabeledCombobox from '@/components/LabeledCombobox';
import ErrorBoundary from '@/components/ErrorBoundary';
import LabeledInput from '@/components/LabeledInput';
import { hariIniIso, tanggalKeTampilan } from '@/lib/tanggal';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ActionIcon } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import { rincianPeriode } from '@/lib/dispensasi';
import { Trash2, X } from '@/icons';

const OPSI_KELOMPOK: { value: KelompokKandidat | ''; label: string; keterangan?: string }[] = [
  { value: '', label: 'Pilih kelompok…' },
  { value: 'aktif', label: 'Semua Santri MI-MD', keterangan: 'Semua santri MI-MD yang aktif' },
  { value: 'mi', label: 'MI (MI + MI-MD)', keterangan: 'Santri yang aktif di MI' },
  { value: 'md', label: 'MD (MD + MI-MD)', keterangan: 'Santri yang aktif di MD' },
  { value: 'mi_saja', label: 'MI Saja (tanpa MD)', keterangan: 'Santri yang aktif di MI Saja' },
  { value: 'md_saja', label: 'MD Saja (tanpa MI)', keterangan: 'Santri yang aktif di MD Saja' },
  { value: 'mi_md', label: 'MI-MD', keterangan: 'Santri yang aktif di MI sekaligus MD' },
  /* Keterangan dua terbawah dinamis (tingkat akhir mengikuti filter lembaga
     topBar) — diisi `opsiKelompok` di dalam komponen. */
  { value: 'kelas_akhir', label: 'Kelas Akhir' },
  { value: 'selain_kelas_akhir', label: 'Selain Kelas Akhir' },
  /* Anggota grup santri custom pilihan (daftar dari tab Santri Custom). */
  { value: 'custom', label: 'Custom', keterangan: 'Anggota grup custom pilihan' },
];

/** Tingkat akhir per jenjang (cermin backend `TINGKAT_AKHIR` + KelulusanPage). */
const TINGKAT_AKHIR_JENJANG: Record<string, string> = {
  MI: '6',
  MD: '6',
  MTS: '9',
  MLN: '12',
};

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
  /** Daftar jenjang lembaga (master) — dipakai opsi popover Buat Tarif agar
   *  tetap lengkap meski belum ada tarif di tahun ajaran terpilih. */
  jenjangs: string[];
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
/** Penanda langkah bernomor untuk baris kriteria di dialog Buat Tagihan.
 *  Angka + judul kecil; `aria-hidden` karena urutan kolom sudah menyiratkan
 *  urutan, sedangkan nama tiap langkah dibacakan lewat teks judulnya. */
function LangkahNomor({ n, judul }: { n: number; judul: string }) {
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-1.5" aria-hidden="true">
      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-foreground/40 text-[11px] font-semibold leading-none">
        {n}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{judul}</span>
    </div>
  );
}
/** Kerangka kartu langkah yang BELUM aktif (menunggu tarif/kelompok dipilih).
 *
 *  Tanpa ini area atas terlihat kosong sebelum ada yang dipilih — padahal
 *  kartunya empat. Kerangka memakai bentuk & lebar yang SAMA dengan kartu
 *  aslinya (240px kartu 1; 300px kartu 2 & 3; 120px Generate) supaya tata letak tidak melompat
 *  saat kartu sungguhan muncul. Tinggi tiap slot SAMA dengan kartu aslinya
 *  (keempatnya 136px, dipatok di tiap `Card`) agar tak ada pergeseran.
 *
 *  Tanpa nomor langkah: kerangka murni penanda ruang, bukan informasi. */
function KartuKerangka({ lebar, tinggi, baris }: { lebar: number; tinggi: number; baris: number[] }) {
  return (
    <Card
      className="flex shrink-0 flex-col gap-2 p-2"
      style={{ width: lebar, height: tinggi }}
      aria-hidden="true"
    >
      {baris.map((h, i) => (
        <Skeleton key={i} className="w-full" style={{ height: h }} />
      ))}
    </Card>
  );
}

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

/** `DialogContent` + batas galat ISINYA.
 *
 *  Dialog ini satu layar penuh dan memuat tabel sendiri; galat render di salah
 *  satu tahapnya (kriteria → pratinjau → hasil) dulu naik ke batas halaman
 *  sehingga SELURUH halaman keuangan tergantikan panel galat. Sekarang yang
 *  gagal hanya isi dialognya, dan pengguna tetap bisa keluar: dialog ini
 *  memang tanpa tombol X (`showCloseButton={false}`), jadi tampilan galatnya
 *  menyediakan "Tutup dialog" (panggilan yang sama dengan tombol Tutup di
 *  kaki dialog). */
function IsiDialogGenerate({
  onTutup,
  children,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, 'children'> & {
  onTutup: () => void;
  children: ReactNode;
}) {
  return (
    <DialogContent {...props}>
      <ErrorBoundary
        judul="Dialog Buat Tagihan gagal ditampilkan"
        keterangan="Tidak ada tagihan yang ditulis dari dialog ini. Tutup, lalu buka lagi."
        onTutup={onTutup}
        labelTutup="Tutup dialog"
      >
        {children}
      </ErrorBoundary>
    </DialogContent>
  );
}

/** Dialog generate tagihan: daftar santri kelompok langsung jadi daftar
 *  final yang akan dibuatkan tagihan; nominal default dari tarif/manual,
 *  bisa dioverride per baris. */
export default function GenerateTagihanDialog({ open, onOpenChange, jenis, tarif, tahunAjaran, jenjangs, onSelesai, onTarifBaru }: Props) {
  const [kelompok, setKelompok] = useState<KelompokKandidat | ''>('');
  /** Grup custom terpilih (hanya dipakai bila kelompok = custom). */
  const [grupCustomId, setGrupCustomId] = useState<number | ''>('');
  /** Daftar grup custom lingkup topBar (dimuat saat kelompok = custom). */
  const [daftarGrup, setDaftarGrup] = useState<GrupSantriCustom[]>([]);
  const [loadingGrup, setLoadingGrup] = useState(false);
  const [jenisId, setJenisId] = useState<number | ''>('');
  const [tarifId, setTarifId] = useState<number | ''>('');
  const [nominalDefault, setNominalDefault] = useState('');
  const [periodeDari, setPeriodeDari] = useState('');
  const [periodeSampai, setPeriodeSampai] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');

  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(false);
  const kandidatReq = useRef(0);
  const kandidatAbort = useRef<AbortController | null>(null);
  const [err, setErr] = useState('');

  const [terpilih, setTerpilih] = useState<BarisTerpilih[]>([]);
  const [busy, setBusy] = useState(false);
  /** Hasil generate terakhir (panel persisten; null = mode susun). */
  const [hasil, setHasil] = useState<HasilGenerate | null>(null);
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

  /** Keterangan dinamis dua opsi kelas akhir: tingkat akhir dari jenjang yang
   *  terpilih di filter lembaga topBar (mis. MI → "6", MI+MTS → "6/9"). */
  const tingkatAkhirKet = useMemo(() => {
    const daftar = jenjangs.length > 0 ? jenjangs : Object.keys(TINGKAT_AKHIR_JENJANG);
    const unik = [...new Set(daftar.map((j) => TINGKAT_AKHIR_JENJANG[j]).filter((t) => t !== undefined))];
    return unik.length > 0 ? unik.join('/') : 'akhir';
  }, [jenjangs]);
  const opsiKelompok = useMemo(() => OPSI_KELOMPOK.map((o) => {
    if (o.value === 'kelas_akhir') return { ...o, keterangan: `Santri tingkat ${tingkatAkhirKet}` };
    if (o.value === 'selain_kelas_akhir') return { ...o, keterangan: `Santri selain tingkat ${tingkatAkhirKet}` };
    return o;
  }), [tingkatAkhirKet]);

  /** Opsi combobox grup custom (label = nama; keterangan = anggota). */
  const opsiGrupCustom = useMemo(() => daftarGrup.map((g) => ({
    label: g.nama,
    keterangan: `${g.santri.length} santri${g.keterangan ? ` · ${g.keterangan}` : ''}`,
    nilai: String(g.id),
  })), [daftarGrup]);

  // Kelompok = custom → muat daftar grup lingkup topBar untuk combobox kedua.
  useEffect(() => {
    if (!open || kelompok !== 'custom') return;
    let hidup = true;
    setLoadingGrup(true);
    daftarGrupCustom({ jenjang: jenjangs, tahun_ajaran: tahunAjaran ?? undefined })
      .then((d) => { if (hidup) setDaftarGrup(d); })
      .catch(() => { if (hidup) setDaftarGrup([]); })
      .finally(() => { if (hidup) setLoadingGrup(false); });
    return () => { hidup = false; };
  }, [open, kelompok, jenjangs, tahunAjaran]);

  /** Opsi tarif = bawaan induk + yang baru dibuat di popover (anti-duplikat id). */
  const daftarTarifPilih = useMemo(() => {
    const ids = new Set(tarif.map((t) => t.id));
    return [...tarif, ...tarifLokal.filter((t) => !ids.has(t.id))];
  }, [tarif, tarifLokal]);
  /** Pilihan jenjang popover: master lembaga + tarif yang ada + jenis
   *  yang berjenjang — tetap lengkap walau di TA terpilih belum ada tarif. */
  const opsiJenjangBaru = useMemo(() => {
    const s = new Set<string>(jenjangs);
    for (const t of daftarTarifPilih) s.add(t.jenjang);
    for (const j of jenis) if (j.jenjang !== null) s.add(j.jenjang);
    return [...s].sort((a, b) => a.localeCompare(b, 'id'));
  }, [jenjangs, daftarTarifPilih, jenis]);
  /** Opsi tarif untuk combobox. Tanpa entri "kosong": teks placeholder
   *  sudah menyatakan keadaan kosong, dan entri kosong akan ikut jadi nilai
   *  terpilih sehingga ikut terisi di input. */
  const opsiTarif = useMemo(
    () => daftarTarifPilih.map((t) => ({
      /* `label` dipakai Base UI untuk pencarian & nilai terpilih, jadi ia tetap
         memuat seluruh teks agar ketikan "MI" / "Infaq" / nominal tetap
         menemukan baris ini. `keterangan` hanya tampilan. */
      label: `${t.jenjang} · ${t.jenis?.nama ?? t.jenis_id} · Rp ${t.nominal.toLocaleString('id')}`,
      nama: `${t.jenjang} · ${t.jenis?.nama ?? t.jenis_id}`,
      keterangan: `Rp ${t.nominal.toLocaleString('id')} · ${t.tahun_ajaran}`,
      nilai: String(t.id),
    })),
    [daftarTarifPilih],
  );
  const opsiJenisBaru = useMemo(
    () => jenis.filter((j) => baruJenjang === '' || j.jenjang === null || j.jenjang === baruJenjang),
    [jenis, baruJenjang],
  );
  /** Opsi berobjek untuk LabeledCombobox popover (label + nilai string). */
  const opsiJenjangItem = useMemo(
    () => opsiJenjangBaru.map((j) => ({ label: j, nilai: j })),
    [opsiJenjangBaru],
  );
  const opsiJenisItem = useMemo(
    () => opsiJenisBaru.map((j) => ({ label: j.nama, nilai: String(j.id) })),
    [opsiJenisBaru],
  );

  // Buka dialog: bersihkan pilihan; isi default periode setahun dari TA.
  useEffect(() => {
    if (!open) return;
    setTerpilih([]); setCari(''); setKelompok(''); setGrupCustomId(''); setDaftarGrup([]);
    setJenisId(''); setTarifId('');
    setNominalDefault(''); setJatuhTempo(''); setErr(''); setHasil(null);
    setGalat([]); setGalatDaftar([]); setGalatNominal(null);
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
  }, [open, terpilih, jenisId, nominalDefault, periodeDari, periodeSampai, jatuhTempo, tarifId, kelompok, grupCustomId]);

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
  /** Urutan dari PresetUrut (kode kolom berurutan + arah). Kosong = urutan
   *  bawaan (kelas A-Z lalu nama A-Z). */
  const [urutKolom, setUrutKolom] = useState<string[]>([]);
  const [arahUrutKolom, setArahUrutKolom] = useState<'naik' | 'turun'>('naik');
  const [statusFilter, setStatusFilter] = useState<'' | 'aktif' | 'nonaktif'>('');
  /** Susunan kolom dari PresetKolom card filter (tersimpan backend). */
  const [presetLuar, setPresetLuar] = useState<{
    keys: string[] | null; presetId: number | null;
  } | undefined>(undefined);
  const terapkanKolomLuar = useCallback(
    (keys: string[] | null, presetId?: number | null) => {
      setPresetLuar({ keys, presetId: presetId ?? null });
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
    if (urutKolom.length === 0) {
      rows.sort(bandingNama);
      return rows;
    }
    // Urut berjenjang mengikuti kode kolom dari PresetUrut; nilai dibandingkan
    // sebagai teks supaya kunci apa pun (nama, kelas, status) aman.
    const nilaiKolom = (r: BarisTerpilih, k: string): string => {
      if (k === 'nama') return r.nama_lengkap;
      if (k === 'kelas') return [r.tingkat, r.kelas].filter(Boolean).join(' / ');
      if (k === 'status_akhir') return r.status_akhir ?? '';
      return String((r as unknown as Record<string, unknown>)[k] ?? '');
    };
    rows.sort((a, b) => {
      for (const k of urutKolom) {
        const c = nilaiKolom(a, k).localeCompare(nilaiKolom(b, k), 'id');
        if (c !== 0) return arahUrutKolom === 'turun' ? -c : c;
      }
      return 0;
    });
    return rows;
  }, [terpilih, cari, statusFilter, urutKolom, arahUrutKolom]);

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
    const req = ++kandidatReq.current;
    kandidatAbort.current?.abort();
    const ac = new AbortController();
    kandidatAbort.current = ac;
    if (!open || tahunAjaran === null) { setLoading(false); return; }
    // Belum pilih kelompok → daftar kosong, tanpa request.
    if (kelompok === '') { setTerpilih([]); setLoading(false); return; }
    // Custom tanpa grup terpilih → daftar kosong, tanpa request.
    if (kelompok === 'custom' && grupCustomId === '') { setTerpilih([]); setLoading(false); return; }
    setErr(''); setLoading(true);
    try {
      const res = await kandidatTagihan({
        tahun_ajaran: tahunAjaran,
        kelompok,
        grup_custom_id: kelompok === 'custom' ? grupCustomId : undefined,
        jenis_id: jenisId,
        periode: bulanan ? (periodeDari || undefined) : undefined,
        periode_sampai: bulanan ? (periodeSampai || undefined) : undefined,
        page: 1,
        per_page: 'all', signal: ac.signal,
      });
      if (req !== kandidatReq.current || ac.signal.aborted) return;
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
    } catch (e) {
      if (req === kandidatReq.current && !ac.signal.aborted) setErr(errorMessage(e));
    } finally {
      if (req === kandidatReq.current) setLoading(false);
    }
  }, [open, tahunAjaran, kelompok, grupCustomId, jenisId, bulanan, periodeDari, periodeSampai]);

  // Buka dialog / kriteria berubah → muat ulang (tahan 250ms).
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => { void muatSantri(); }, 250);
    const batalkan = () => { kandidatReq.current++; kandidatAbort.current?.abort(); };
    return () => { clearTimeout(t); batalkan(); };
  }, [open, muatSantri]);

  const ubahNominalDefault = (v: string) => {
    setNominalDefault(v);
    setGalatNominal(null);
  };

  /** Tarif = patokan: nominal default + jenis (+tipe bulanan) mengikutinya.
   *  Non-bulanan: jatuh tempo bawaan = hari ini (masih bisa diubah atau
   *  dikosongkan); bulanan: dikosongkan (otomatis tanggal 10 per periode). */
  const pilihTarif = (id: number | '', daftar: Tarif[] = daftarTarifPilih) => {
    setTarifId(id);
    if (id === '') { setJenisId(''); return; }
    const t = daftar.find((x) => x.id === id);
    if (t) {
      ubahNominalDefault(String(t.nominal));
      setJenisId(t.jenis_id);
      if (jenis.find((j) => j.id === t.jenis_id)?.tipe === 'bulanan') {
        setJatuhTempo('');
      } else {
        setJatuhTempo((lama) => (lama === '' ? hariIniIso() : lama));
      }
    }
  };

  /** Buka popover: isian di-reset (kosong = belum pilih). */
  /** Terapkan urutan dari PresetUrut (kode kolom + arah). */
  const terapkanUrutKolom = (nilai: string[], arah: 'naik' | 'turun') => {
    setUrutKolom(nilai);
    setArahUrutKolom(arah);
  };

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

  /** Validasi siap-generate (dipakai tombol Generate & eksekusi). */
  const siapGenerate = (): boolean => {
    // Layar tunggal: kriteria & daftar berdampingan, jadi galat ditampilkan
    // apa adanya tanpa memindahkan layar.
    const g = validasiKriteria();
    if (g.length > 0) { setGalat(g); return false; }
    if (kelompok === '') {
      setGalatDaftar([{ pesan: 'Pilih kelompok santri pada filter daftar.', targetId: 'sel_gen_kelompok' }]);
      return false;
    }
    if (kelompok === 'custom' && grupCustomId === '') {
      setGalatDaftar([{ pesan: 'Pilih grup custom pada filter daftar.', targetId: 'sel_gen_grup_custom' }]);
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
    // Gagal validasi: cukup kembalikan galat — masing-masing RingkasanGalat
    // sudah memindahkan fokus ke dirinya lewat efeknya sendiri.
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
    : `TA ${tahunAjaran ?? '—'}${jatuhTempo !== '' ? ` · JT ${tanggalKeTampilan(jatuhTempo)}` : ' · tanpa JT (langsung tunggakan)'}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <IsiDialogGenerate
        onTutup={() => onOpenChange(false)}
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b px-2 py-2">
          <div className="flex items-center gap-3">
            <DialogTitle>Buat Tagihan</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Satu layar: isi kriteria, pilih kelompok santri, periksa daftar, lalu generate.</DialogDescription>
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
            <Button type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => { setHasil(null); setKonfirmasi(false); }}>Kembali ke Daftar</Button>
            <Button type="button" className="h-[26px]" disabled={busy} onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
                {/* Konfirmasi ringkas: satu paragraf + tombol. Rekap angka tak
                    diulang karena footer sudah menampilkannya. */}
                {konfirmasi ? (
                <div className="flex flex-col gap-3">
                  <h3 id="judul_konfirmasi_gen" tabIndex={-1} className="text-sm font-semibold focus:outline-none">Konfirmasi Generate</h3>
                  <p className="max-w-prose text-sm">
                    Akan dibuat <span className="font-semibold">{ringkasan.baris} tagihan</span>
                    {teksPeriode !== '' ? ` untuk ${teksPeriode}` : ''}
                    {tarifTerpilih !== null ? ` (${tarifTerpilih.jenjang} · ${tarifTerpilih.jenis?.nama ?? tarifTerpilih.jenis_id})` : ''}
                    , estimasi <span className="font-semibold">Rp {ringkasan.total.toLocaleString('id')}</span>.
                    Tagihan yang sudah ada tidak diduplikasi: yang nominalnya sama tetap, yang berubah diperbarui, yang tak layak dilewati beserta sebabnya.
                    {hitungManual > 0 ? ` ${hitungManual} baris memakai nominal manual (dispensasi tak diterapkan).` : ''}
                  </p>
                  {/* Rekap angka ikut ke popup konfirmasi supaya angka yang
                      disetujui terbaca tepat di sebelah tombolnya. */}
                  <p id="rekap_konfirmasi_gen" className="text-sm text-muted-foreground">
                    {terpilih.length} santri × {jumlahPeriode} bulan = {ringkasan.baris} tagihan · estimasi Rp {ringkasan.total.toLocaleString('id')}
                  </p>
                </div>
                ) : (
                <>
                  <RingkasanGalat id="ringkas_galat_gen" daftar={galat} />

              {/* Empat kartu sejajar: (1) tarif & nominal, (2) periode &
                  jatuh tempo, (3) kelompok santri, (4) generate. */}
              <div className="flex flex-wrap items-stretch gap-3">

                {/* -- Kartu 1: Tarif + Nominal -- */}
                <Card className="flex h-[136px] w-[240px] shrink-0 flex-col gap-2 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <LangkahNomor n={1} judul="Tarif" />
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
                          <LabeledCombobox label="Jenjang" htmlFor="sel_tarif_baru_jenjang">
                            <ComboboxRoot
                              items={opsiJenjangItem}
                              itemToStringLabel={(o) => o.label}
                              isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                              value={opsiJenjangItem.find((o) => o.nilai === baruJenjang) ?? null}
                              onValueChange={(o) => { if (o !== null) { setBaruJenjang(o.nilai); setBaruJenisId(''); } }}
                            >
                              <ComboboxInput id="sel_tarif_baru_jenjang" aria-label="Jenjang" placeholder="Pilih jenjang…" />
                              <ComboboxTrigger aria-label="Buka daftar jenjang" />
                              <ComboboxContent>
                                <ComboboxEmpty>Belum ada jenjang.</ComboboxEmpty>
                                <ComboboxList>
                                  {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                                </ComboboxList>
                              </ComboboxContent>
                            </ComboboxRoot>
                          </LabeledCombobox>
                          <LabeledCombobox label="Jenis" htmlFor="sel_tarif_baru_jenis">
                            <ComboboxRoot
                              items={opsiJenisItem}
                              itemToStringLabel={(o) => o.label}
                              isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                              value={opsiJenisItem.find((o) => o.nilai === String(baruJenisId)) ?? null}
                              onValueChange={(o) => { if (o !== null) setBaruJenisId(Number(o.nilai)); }}
                            >
                              <ComboboxInput id="sel_tarif_baru_jenis" aria-label="Jenis" placeholder="Pilih jenis…" />
                              <ComboboxTrigger aria-label="Buka daftar jenis" />
                              <ComboboxContent>
                                <ComboboxEmpty>Belum ada jenis.</ComboboxEmpty>
                                <ComboboxList>
                                  {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                                </ComboboxList>
                              </ComboboxContent>
                            </ComboboxRoot>
                          </LabeledCombobox>
                          <LabeledInput
                            nama="nominal"
                            tipeKontrol="nominal"
                            tipeTerkunci
                            label="Nominal"
                            htmlFor="inp_tarif_baru_nominal"
                            min={0}
                            value={baruNominal}
                            onChange={(e) => setBaruNominal(e.target.value)} required
                          />
                          <Button id="btn_tarif_baru_simpan" type="submit" size="sm" className="h-[26px]">
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
                    kelolaLebar={false}
                    className="w-full"
                  >
                    <ComboboxRoot
                      items={opsiTarif}
                      autoHighlight
                      /* Base UI memakai prop ini untuk DUA hal: teks kotak
                         input DAN kunci penyaringan — jadi keduanya tak bisa
                         dibedakan. Dipilih NAMA saja: kotak bersih, pencarian
                         cukup pada nama tarif. Keterangan (nominal, tahun)
                         hanya tampil di baris kedua tiap item. */
                      itemToStringLabel={(o) => o.nama}
                      isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                      value={opsiTarif.find((o) => o.nilai === String(tarifId)) ?? null}
                      onValueChange={(o) => { if (o !== null) pilihTarif(Number(o.nilai)); }}
                    >
                      <ComboboxInput id="sel_gen_tarif" aria-label="Tarif" placeholder="Pilih tarif…" />
                      <ComboboxTrigger aria-label="Buka daftar tarif" />
                      <ComboboxContent>
                        <ComboboxEmpty>Belum ada tarif.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => (
                            <ComboboxItem key={o.nilai} value={o} className="flex-col items-start gap-0">
                              <span>{o.nama}</span>
                              <span className="text-[11px] text-muted-foreground">{o.keterangan}</span>
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </LabeledCombobox>
                  <LabeledInput
                    nama="nominal"
                    tipeKontrol="nominal"
                    tipeTerkunci
                    label="Nominal"
                    kelolaLebar={false}
                    className="w-full"
                    htmlFor="inp_gen_nominal"
                    min={0} value={nominalDefault}
                    onChange={(e) => ubahNominalDefault(e.target.value)}
                    onBlur={() => setGalatNominal(validasiNominal(nominalDefault))}
                    aria-invalid={galatNominal !== null}
                    aria-describedby={galatNominal !== null ? 'galat_nominal_gen' : undefined}
                    required
                  />
                  <p id="galat_nominal_gen" className="min-h-4 text-xs text-destructive">{galatNominal ?? ''}</p>
                </Card>

                {tarifId === '' ? (
                <>
                  {/* Kartu 2 & 3 belum bisa diisi (periode & kelompok
                      bergantung pada tarif), jadi ruangnya ditandai kerangka
                      — bukan dibiarkan kosong. Ukurannya SAMA dengan kartu
                      asli (lebar tiap kartu, tinggi 136px). */}
                  <KartuKerangka lebar={300} tinggi={136} baris={[26, 26, 26, 16]} />
                  <KartuKerangka lebar={300} tinggi={136} baris={[26, 26, 26, 16]} />
                </>
                ) : (
                <>
                {/* -- Kartu 2: Periode + Jatuh Tempo -- */}
                <Card className="flex h-[136px] w-[300px] shrink-0 flex-col gap-2 p-2">
                  <LangkahNomor n={2} judul="Periode & Jatuh Tempo" />
                  {/* Periode. Bulanan = dua baris (Awal / Akhir) bertumpuk;
                      non-bulanan = satu baris keterangan. Slot yang sama. */}
                  {bulanan ? (
                    <div className="flex items-center gap-1">
                      <LabeledInput
                        label="Periode"
                        lebarLabel={52} tinggi={26}
                        htmlFor="inp_gen_dari"
                        tipeKontrol="bulan" tipeTerkunci
                        value={periodeDari}
                        onChange={(e) => setPeriodeDari(e.target.value)}
                        kelolaLebar={false} className="min-w-0 flex-1"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground" aria-hidden="true">-</span>
                      <LabeledInput
                        label="Sampai Bulan"
                        tanpaLabel
                        tinggi={26}
                        htmlFor="inp_gen_sampai"
                        tipeKontrol="bulan" tipeTerkunci
                        value={periodeSampai}
                        onChange={(e) => setPeriodeSampai(e.target.value)}
                        kelolaLebar={false} className="min-w-0 flex-1"
                      />
                    </div>
                  ) : (
                    <LabeledInput
                      label="Periode"
                      lebarLabel={52} tinggi={26}
                      htmlFor="info_gen_periode"
                      tipeKontrol="teks" tipeTerkunci
                      value={'Otomatis ' + (tahunAjaran ?? '—')}
                      disabled
                      kelolaLebar={false} className="w-full"
                    />
                  )}
                  {/* Baris 2: Jatuh Tempo. Bulanan = otomatis (mati); non-bulanan
                      = bisa diisi. Slot sama, kontrol bergantian. */}
                  <LabeledInput
                    label="Jatuh Tempo"
                    lebarLabel={56} tinggi={26}
                    htmlFor="inp_gen_jatuh_tempo"
                    tipeKontrol="tanggal" tipeTerkunci
                    disabled={bulanan}
                    placeholder={bulanan ? 'Otomatis tanggal 10' : undefined}
                    value={jatuhTempo}
                    onChange={(e) => setJatuhTempo(e.target.value)}
                    lebarKotak="100%" kelolaLebar={false}
                  />
                </Card>

                {/* -- Kartu 3: Kelompok Santri -- */}
                <Card className="flex h-[136px] w-[300px] shrink-0 flex-col gap-2 p-2">
                  <LangkahNomor n={3} judul="Kelompok Santri" />
                  <LabeledCombobox label="Kelompok" htmlFor="sel_gen_kelompok" tinggi={26} kelolaLebar={false} className="w-full">
                    <ComboboxRoot
                      items={opsiKelompok}
                      itemToStringLabel={(o) => o.label}
                      isItemEqualToValue={(a, b) => a.value === b.value}
                      value={opsiKelompok.find((o) => o.value === kelompok) ?? opsiKelompok[0]}
                      onValueChange={(o) => { if (o !== null) { setKelompok(o.value); setGrupCustomId(''); } }}
                    >
                      <ComboboxInput id="sel_gen_kelompok" aria-label="Kelompok Santri" placeholder="Pilih kelompok…" />
                      <ComboboxTrigger aria-label="Buka daftar kelompok" />
                      <ComboboxContent>
                        <ComboboxEmpty>Belum ada kelompok.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => (
                            <ComboboxItem key={o.value} value={o} className="flex-col items-start gap-0">
                              <span>{o.label}</span>
                              {o.keterangan !== undefined && (
                                <span className="text-[11px] text-muted-foreground">{o.keterangan}</span>
                              )}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </LabeledCombobox>
                  {/* Custom → combobox kedua: pilih grupnya; daftar santri
                      dimuat dari anggotanya. */}
                  {kelompok === 'custom' && (
                    <LabeledCombobox label="Grup" htmlFor="sel_gen_grup_custom" tinggi={26} kelolaLebar={false} className="w-full">
                      <ComboboxRoot
                        items={opsiGrupCustom}
                        itemToStringLabel={(o) => o.label}
                        isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                        value={opsiGrupCustom.find((o) => o.nilai === String(grupCustomId)) ?? null}
                        onValueChange={(o) => { if (o !== null) setGrupCustomId(Number(o.nilai)); }}
                      >
                        <ComboboxInput
                          id="sel_gen_grup_custom"
                          aria-label="Grup custom"
                          placeholder={loadingGrup ? 'Memuat grup…' : 'Pilih grup…'}
                        />
                        <ComboboxTrigger aria-label="Buka daftar grup custom" />
                        <ComboboxContent>
                          <ComboboxEmpty>{loadingGrup ? 'Memuat…' : 'Belum ada grup pada lingkup ini.'}</ComboboxEmpty>
                          <ComboboxList>
                            {(o) => (
                              <ComboboxItem key={o.nilai} value={o} className="flex-col items-start gap-0">
                                <span>{o.label}</span>
                                <span className="text-[11px] text-muted-foreground">{o.keterangan}</span>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </ComboboxRoot>
                    </LabeledCombobox>
                  )}
                </Card>
                </>
                )}

                {kelompok === '' ? (
                /* Kartu 4 menunggu kelompok dipilih; kerangka lebarnya sama
                   (120px) supaya tata letak tidak melompat saat muncul. */
                <KartuKerangka lebar={120} tinggi={136} baris={[26, 26, 16]} />
                ) : (
                <Card className="flex h-[136px] w-[120px] shrink-0 flex-col gap-2 p-2">
                  <LangkahNomor n={4} judul="Generate" />
                  <Button
                    id="btn_gen_generate" type="button" className="h-[26px]"
                    disabled={busy || loading || terpilih.length === 0}
                    aria-describedby={terpilih.length === 0 ? 'ket_gen_generate' : undefined}
                    onClick={mintaKonfirmasi}
                  >
                    Generate
                  </Button>
                  <p id="ket_gen_generate" className="min-h-4 text-xs text-muted-foreground">
                    {terpilih.length === 0
                      ? 'Belum ada santri pada kelompok ini.'
                      : `${ringkasan.baris} tagihan siap dibuat.`}
                  </p>
                </Card>
                )}
              </div>
              <RingkasanGalat id="ringkas_galat_daftar" daftar={galatDaftar} />
              {err !== '' && <ErrorNotice>{err}</ErrorNotice>}
              <div className="flex min-h-0 flex-1 flex-col">
                <ExcelTable<BarisTerpilih & { id: number }>
                  tableKey="keuangan_gen_terpilih"
                  header={(
                    <span id="judul_daftar_gen" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                      Daftar Santri ({terpilih.length}{cari.trim() !== '' || statusFilter !== '' ? `, tampil ${tampil.length}` : ''})
                    </span>
                  )}
                  awalanToolbar={(
                    <>
                    <LabeledInput
                      label="Cari"
                      lebarLabel={32} tinggi={26}
                      htmlFor="inp_gen_cari"
                      tipeKontrol="pencarian" tipeTerkunci
                      placeholder="Cari nama / NIS…"
                      value={cari}
                      onChange={(e) => setCari(e.target.value)}
                      lebarKotak={160}
                    />
                    <LabeledCombobox label="Status" htmlFor="sel_gen_status" tinggi={26}>
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
                    <PresetUrut
                      tableKey="keuangan_gen_terpilih"
                      urutAktif={urutKolom}
                      arahUrut={arahUrutKolom}
                      onUrut={terapkanUrutKolom}
                    />
                    <PresetKolom
                      tableKey="keuangan_gen_terpilih"
                      fields={FIELDS_TERPILIH}
                      onApply={terapkanKolomLuar}
                      triggerClassName="h-[26px] w-24 text-xs"
                    />
                    </>
                  )}
                  fields={FIELDS_TERPILIH}
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
              {pratinjauGagal && !konfirmasi && (
                <p className="border-t px-2 py-1 text-[11px] text-muted-foreground">
                  Pratinjau potongan gagal dimuat — nominal tampil sebelum dispensasi. Angka final dihitung saat Generate.
                </p>
              )}
                </>
                )}
              </div>
              <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-2 py-2 sm:justify-between">
                {konfirmasi ? (
                <div className="flex gap-2">
                  <Button id="btn_gen_periksa" type="button" variant="outline" className="h-[26px]" disabled={busy} onClick={() => setKonfirmasi(false)}>Periksa lagi</Button>
                  <Button id="btn_gen_ya" type="button" className="h-[26px]" disabled={busy || loading} onClick={() => void simpan()}>
                    {busy ? 'Memproses…' : `Ya, buat ${ringkasan.baris} tagihan`}
                  </Button>
                </div>
                ) : null}
              </DialogFooter>
            </div>
          </>
        )}
      </IsiDialogGenerate>
    </Dialog>
  );
}
