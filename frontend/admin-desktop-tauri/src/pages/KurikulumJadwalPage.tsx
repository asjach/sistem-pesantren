import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField, type GridRow } from '@/components/ExcelTable';
import type { BarisSel } from '@/components/excel/types';
import type { BlokIsi } from '@/components/excel/seretIsiSel';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import LabeledCombobox from '@/components/LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { Copy } from '@/icons';
import { jamPendek } from '@/lib/jadwal';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, listTahunAjaran, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  GAYA_GARIS, formatGuruBaris, formatMapelBaris, garisSelMatriks,
  type FormatGuru, type FormatMapel, type GarisSel, type TampilanJadwal,
} from './matriksJadwal';
import { klipSeragam, sasaranBlokJadwal, sasaranKosongkanBlok, type BlokGrid, type KlipJadwal } from './jadwalKlip';
import PanelTemplate, { FIELDS_KERANGKA } from './TemplateJadwalPanel';
import PanelHariLibur from './HariLiburPanel';
import {
  daftarGuruAktif, daftarJadwal, daftarMapel, daftarTemplateJadwal, pratinjauSalinJadwal, salinJadwal,
  simpanSelJadwal, terapkanTemplate,
  HARI_LABEL, JENIS_SLOT_LABEL,
  type GuruAktif, type HasilSalinJadwal, type JadwalBaris, type MataPelajaran, type SlotJadwal,
  type TemplateJadwal, type TerapkanHasil,
} from '@/api/kurikulum';

/** Satu baris matriks = satu kelas × satu nomor JP. Slot tiap hari bisa
 *  berbeda (jumlah, jam, jenis), jadi frame disusun per hari lalu digabung
 *  per nomor JP. */
interface BarisMatriks {
  /** `${kelasId}:${urutan}` — unik lintas kelas. */
  id: string;
  kelasId: number;
  kelasNama: string;
  urutan: number;
  /** Baris pertama sebuah kelas (selain kelas pertama) — diberi pembatas. */
  awalKelas: boolean;
  /** Isi kolom "Jam": rentang waktu (mis. `07:15–07:55`). */
  label: string;
  perHari: Record<string, SlotJadwal>;
}

/** Hasil muat jadwal satu kelas (sumber baris gabungan). */
interface JadwalKelas {
  kelas: Kelas;
  slot: SlotJadwal[];
  hari: string[];
  baris: JadwalBaris[];
}

/** Satu sel pelajaran yang jadi sasaran dialog isi jadwal. */
interface SasaranJadwal {
  kelasId: number;
  kelasNama: string;
  slot: SlotJadwal;
  hari: string;
}

/** Pewarnaan sel: polos, per guru, atau per mapel. */
type WarnaJadwal = 'polos' | 'guru' | 'mapel';

/** Opsi keempat combo toolbar jadwal (dipakai `LabeledCombobox`). */
const OPSI_TAMPILAN: { nilai: TampilanJadwal; label: string }[] = [
  { nilai: 'keduanya', label: 'Mapel & guru' },
  { nilai: 'mapel', label: 'Mapel saja' },
  { nilai: 'guru', label: 'Guru saja' },
];
const OPSI_WARNA: { nilai: WarnaJadwal; label: string }[] = [
  { nilai: 'polos', label: 'Polos' },
  { nilai: 'guru', label: 'Guru' },
  { nilai: 'mapel', label: 'Mapel' },
];
const OPSI_FORMAT_MAPEL: { nilai: FormatMapel; label: string }[] = [
  { nilai: 'nama', label: 'Nama' },
  { nilai: 'kode', label: 'Kode' },
  { nilai: 'singkatan', label: 'Singkatan' },
];
const OPSI_FORMAT_GURU: { nilai: FormatGuru; label: string }[] = [
  { nilai: 'nama', label: 'Nama tanpa gelar' },
  { nilai: 'gelar', label: 'Nama + gelar' },
  { nilai: 'panggilan', label: 'Nama panggilan' },
  { nilai: 'singkat', label: 'Nama singkat' },
  { nilai: 'prefiks', label: 'Ust./Usth. tanpa gelar' },
  { nilai: 'prefiks_gelar', label: 'Ust./Usth. + gelar' },
  { nilai: 'kode', label: 'Kode guru' },
];

/** Jumlah kelas warna di index.css (simpes-warna-0 … -35). */
const JUMLAH_WARNA = 36;

function kelasWarna(id: number | null): string | undefined {
  return id === null ? undefined : `simpes-warna-${Math.abs(Math.trunc(id)) % JUMLAH_WARNA}`;
}

function namaGuru(g: GuruAktif): string {
  return `${g.gelar_depan ? `${g.gelar_depan} ` : ''}${g.nama_lengkap}${g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}`;
}

/** Halaman Jadwal Pelajaran: matriks jadwal per kelas (hari × JP) + tab
 *  template mingguan & hari libur. Kelas dipilih lewat rel Tingkat/Kelas di
 *  kiri tabel (satu kelas per matriks); klik kiri hanya memilih sel, klik
 *  kanan sel (satu atau blok) membuka dialog Guru + Mapel (guru boleh diisi
 *  lebih dulu, mapel menyusul). Tampilan memilih isi sel
 *  (keduanya/mapel/guru), Warna memilih pewarnaan polos/per guru/per mapel,
 *  dan Format memilih nama/kode/singkatan mapel serta
 *  nama/gelar/prefiks Ust.-Usth./kode/nama panggilan/nama singkat guru. */
export default function KurikulumJadwalPage() {
  const [tab, setTab] = useState('jadwal');
  const { jenjangs, tahunAjaranNames, tingkat: tingkatFilter, kelas: kelasFilter, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [dataKelas, setDataKelas] = useState<JadwalKelas[]>([]);
  const [mapelAktif, setMapelAktif] = useState<MataPelajaran[]>([]);
  const [guruAktif, setGuruAktif] = useState<GuruAktif[]>([]);
  const [templateOpsi, setTemplateOpsi] = useState<TemplateJadwal[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [timpaKelas, setTimpaKelas] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [hasilKelas, setHasilKelas] = useState<TerapkanHasil | null>(null);
  const [editSel, setEditSel] = useState<SasaranJadwal[] | null>(null);
  const [selMapel, setSelMapel] = useState<number | ''>('');
  const [selGuru, setSelGuru] = useState<number | ''>('');
  const [selBusy, setSelBusy] = useState(false);
  const [tampilan, setTampilan] = useState<TampilanJadwal>('keduanya');
  const [warna, setWarna] = useState<WarnaJadwal>('polos');
  const [formatMapel, setFormatMapel] = useState<FormatMapel>('nama');
  const [formatGuru, setFormatGuru] = useState<FormatGuru>('nama');
  const [err, setErr] = useState('');
  /** Dialog salin jadwal antar tahun ajaran (berlaku untuk satu jenjang). */
  const [salinOpen, setSalinOpen] = useState(false);
  const [taSumber, setTaSumber] = useState('');
  const [taOpsi, setTaOpsi] = useState<string[]>([]);
  const [pratinjauSalin, setPratinjauSalin] = useState<HasilSalinJadwal | null>(null);
  const [salinBusy, setSalinBusy] = useState(false);

  /** Kelas yang ditampilkan dari rail Tingkat/Kelas. All/beberapa kelas =
   *  tampilan gabungan (satu baris per kelas × JP). */
  const kelasTampil = useMemo<Kelas[]>(() => {
    const dasar = kelasFilter.length === 0
      ? kelasOpsi
      : kelasOpsi.filter((k) => kelasFilter.includes(k.nama_kelas));
    return tingkatFilter.length === 0
      ? dasar
      : dasar.filter((k) => k.tingkat !== null && tingkatFilter.includes(k.tingkat));
  }, [kelasOpsi, kelasFilter, tingkatFilter]);
  /** Satu kelas = target pintasan template & label judul tunggal. */
  const kelasTunggal = kelasTampil.length === 1 ? kelasTampil[0] : null;
  const kelasId = kelasTunggal?.id ?? '';
  const hari = dataKelas[0]?.hari ?? [];

  /** Muat jadwal SEMUA kelas terpilih; slot id unik per kelas sehingga
   *  peta baris gabungan tidak bentrok. */
  const muatSeq = useRef(0);
  const muatJadwal = useCallback(async () => {
    const seq = ++muatSeq.current;
    if (kelasTampil.length === 0) { setDataKelas([]); return; }
    try {
      const hasil = await Promise.all(kelasTampil.map(async (k) => {
        const r = await daftarJadwal(k.id);
        return { kelas: k, slot: r.slot, hari: r.hari, baris: r.baris };
      }));
      if (seq !== muatSeq.current) return;
      setDataKelas(hasil);
    } catch (e) {
      if (seq === muatSeq.current) { setErr(errorMessage(e)); setDataKelas([]); }
    }
  }, [kelasTampil]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((k) => {
        if (hidup) setKelasOpsi(k.data);
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  useEffect(() => { void muatJadwal(); }, [muatJadwal]);

  /** Daftar TA untuk pemilih sumber salin jadwal. */
  useEffect(() => {
    if (!salinOpen) return;
    let hidup = true;
    listTahunAjaran({ per_page: 100, termasuk_nonaktif: true })
      .then((r) => { if (hidup) setTaOpsi(r.data.map((t) => t.nama)); })
      .catch(() => { if (hidup) setTaOpsi([]); });
    return () => { hidup = false; };
  }, [salinOpen]);

  /** Pratinjau otomatis saat TA sumber dipilih (tujuan = TA aktif). */
  useEffect(() => {
    if (!salinOpen || jenjang === null || ta === null || taSumber === '') {
      setPratinjauSalin(null);
      return;
    }
    let hidup = true;
    pratinjauSalinJadwal(jenjang, taSumber, ta)
      .then((r) => { if (hidup) setPratinjauSalin(r); })
      .catch((e) => { if (hidup) { setPratinjauSalin(null); setErr(errorMessage(e)); } });
    return () => { hidup = false; };
  }, [salinOpen, jenjang, ta, taSumber]);

  const bukaSalinJadwal = useCallback(() => {
    setTaSumber('');
    setPratinjauSalin(null);
    setSalinOpen(true);
  }, []);

  const jalankanSalinJadwal = useCallback(async () => {
    if (jenjang === null || ta === null || taSumber === '') return;
    if (pratinjauSalin === null || pratinjauSalin.hitung.jadwal === 0) {
      toast.error('Tidak ada jadwal baru untuk disalin.');
      return;
    }
    setSalinBusy(true);
    try {
      const r = await salinJadwal(jenjang, taSumber, ta);
      toast.success(r.pesan ?? 'Jadwal disalin.');
      setSalinOpen(false);
      await muatJadwal();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSalinBusy(false);
    }
  }, [jenjang, ta, taSumber, pratinjauSalin, muatJadwal]);

  useEffect(() => {
    if (jenjang === null || ta === null) { setMapelAktif([]); setGuruAktif([]); return; }
    let hidup = true;
    Promise.all([
      daftarMapel({ jenjang, keaktifan: 'aktif' }),
      daftarGuruAktif({ jenjang, tahun_ajaran: ta }),
    ]).then(([mapel, guru]) => {
      if (!hidup) return;
      setMapelAktif(mapel);
      setGuruAktif(guru);
    }).catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [jenjang, ta]);

  useEffect(() => {
    if (tab !== 'jadwal' || jenjang === null) return;
    let hidup = true;
    daftarTemplateJadwal(jenjang)
      .then((r) => { if (hidup) setTemplateOpsi(r); })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [tab, jenjang]);

  const templateSesuai = useMemo(() => {
    const tingkat = kelasOpsi.find((k) => k.id === kelasId)?.tingkat ?? null;
    return templateOpsi.filter((t) => (
      (t.kelas_id === null || t.kelas_id === kelasId)
      && (t.tingkat === null || t.tingkat === tingkat)
    ));
  }, [templateOpsi, kelasOpsi, kelasId]);

  useEffect(() => {
    setTemplateId((v) => {
      if (templateSesuai.some((t) => t.id === v)) return v;
      return templateSesuai.find((t) => t.is_active)?.id ?? templateSesuai[0]?.id ?? '';
    });
  }, [templateSesuai]);

  useEffect(() => { setHasilKelas(null); }, [kelasId, templateId]);

  const templateTerpilih = templateSesuai.find((t) => t.id === templateId) ?? null;
  const bisaTerapKelas = canTambah && templateTerpilih !== null
    && templateTerpilih.is_active && kelasId !== '' && !templateBusy;

  const jalankanTemplateKelas = async (mode: 'pratinjau' | 'eksekusi') => {
    if (templateTerpilih === null || kelasId === '') return;
    setTemplateBusy(true);
    try {
      const r = await terapkanTemplate(templateTerpilih.id, {
        sasaran: 'kelas',
        sasaran_id: String(kelasId),
        tahun_ajaran: ta,
        mode,
        timpa: timpaKelas,
      });
      setHasilKelas(r);
      toast.success(r.pesan);
      if (mode === 'eksekusi') await muatJadwal();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTemplateBusy(false);
    }
  };

  /** Frame SETIAP kelas: slot hari-null berlaku semua hari; slot hari
   *  tertentu menimpa slot umum pada nomor JP yang sama. Satu baris per
   *  kelas × JP agar beberapa kelas bisa tampil dalam satu tabel. */
  const barisMatriks = useMemo<BarisMatriks[]>(() => {
    const hasil: BarisMatriks[] = [];
    for (const [di, d] of dataKelas.entries()) {
      const perHari = new Map<string, Map<number, SlotJadwal>>();
      for (const h of hari) perHari.set(h, new Map());
      for (const s of d.slot) {
        if (s.hari === null) {
          for (const h of hari) perHari.get(h)?.set(s.urutan, s);
        } else {
          perHari.get(s.hari)?.set(s.urutan, s);
        }
      }
      const urutan = [...new Set([...perHari.values()].flatMap((m) => [...m.keys()]))]
        .sort((a, b) => a - b);
      for (const u of urutan) {
        const perHariBaris: Record<string, SlotJadwal> = {};
        for (const h of hari) {
          const s = perHari.get(h)?.get(u);
          if (s !== undefined) perHariBaris[h] = s;
        }
        const slots = Object.values(perHariBaris);
        const nama = [...new Set(slots.map((s) => s.nama_slot ?? `JP ${u}`))];
        const jam = [...new Set(slots
          .map((s) => `${jamPendek(s.jam_mulai) ?? ''}–${jamPendek(s.jam_selesai) ?? ''}`)
          .filter((t) => t !== '–'))];
        hasil.push({
          id: `${d.kelas.id}:${u}`,
          kelasId: d.kelas.id,
          kelasNama: d.kelas.nama_kelas,
          urutan: u,
          awalKelas: di > 0 && u === urutan[0] && hasil.length > 0,

          label: jam.length > 0 ? jam.join(' · ') : (nama.length === 1 ? nama[0] : `JP ${u}`),
          perHari: perHariBaris,
        });
      }
    }
    return hasil;
  }, [dataKelas, hari]);

  const petaBaris = useMemo(
    () => new Map(barisMatriks.map((r) => [String(r.id), r])),
    [barisMatriks],
  );
  const petaJadwal = useMemo(
    () => new Map(dataKelas.flatMap((d) => d.baris).map((b) => [`${b.slot_jam_id}|${b.hari}`, b])),
    [dataKelas],
  );

  /** Klik kanan DI DALAM blok seleksi: isi mapel + guru untuk semua sel
   *  pelajaran yang tercakup (hari dari kolom yang terseleksi). */
  const bukaBlok = useCallback((rowsBlok: BarisMatriks[], fieldsBlok: ExcelField[]) => {
    if (!canUbah) return;
    const hariBlok = fieldsBlok.map((f) => f.key).filter((k) => hari.includes(k));
    const sasaran: SasaranJadwal[] = [];
    for (const r of rowsBlok) {
      for (const h of hariBlok) {
        const s = r.perHari[h];
        if (s !== undefined && s.jenis === 'pelajaran') {
          sasaran.push({ kelasId: r.kelasId, kelasNama: r.kelasNama, slot: s, hari: h });
        }
      }
    }
    if (sasaran.length === 0) {
      toast.error('Blok terpilih tidak memuat sel pelajaran.');
      return;
    }
    const nilai = sasaran.map((t) => petaJadwal.get(`${t.slot.id}|${t.hari}`) ?? null);
    const mapelSama = nilai.every((n) => (n?.mata_pelajaran_id ?? null) === (nilai[0]?.mata_pelajaran_id ?? null));
    const guruSama = nilai.every((n) => (n?.keaktifan_pegawai_id ?? null) === (nilai[0]?.keaktifan_pegawai_id ?? null));
    setEditSel(sasaran);
    setSelMapel(mapelSama ? (nilai[0]?.mata_pelajaran_id ?? '') : '');

    setSelGuru(mapelSama && guruSama ? (nilai[0]?.keaktifan_pegawai_id ?? '') : '');
  }, [canUbah, hari, petaJadwal]);

  /** Klik kanan DI DALAM blok seleksi → "Kosongkan blok…": mapel + guru
   *  dihapus dari semua sel pelajaran yang tercakup. Sel yang sudah kosong
   *  dilewati supaya tak ada permintaan sia-sia ke server — dan jumlah
   *  "sel dikosongkan" pada pesan hasil jadi lebih jujur. */
  const kosongkanBlok = useCallback((rowsBlok: BarisMatriks[], fieldsBlok: ExcelField[]) => {
    if (!canUbah) return;
    const hariBlok = fieldsBlok.map((f) => f.key).filter((k) => hari.includes(k));

    const sasaran = sasaranKosongkanBlok(
      rowsBlok.length,
      hariBlok,
      (r, h) => {
        const baris = rowsBlok[r];
        const s = baris?.perHari[h];
        if (baris === undefined || s === undefined || s.jenis !== 'pelajaran') return null;
        return { kelasId: baris.kelasId, kelasNama: baris.kelasNama, id: s.id, nama: s.nama_slot };
      },
      (kelasId, slotId, h) => {
        const j = petaJadwal.get(`${slotId}|${h}`);
        return j !== undefined && (j.mata_pelajaran_id !== null || j.keaktifan_pegawai_id !== null);
      },
    );
    if (sasaran.length === 0) {
      toast.error('Blok terpilih sudah kosong.');
      return;
    }
    setSelBusy(true);
    void (async () => {
      let sukses = 0;
      let galatPertama = '';
      for (const t of sasaran) {
        try {
          await simpanSelJadwal({
            kelas_id: t.kelasId,
            slot_jam_id: t.slotId,
            hari: t.hari,
            mata_pelajaran_id: null,
            keaktifan_pegawai_id: null,
          });
          sukses++;
        } catch (e) {
          if (galatPertama === '') {
            galatPertama = `${t.kelasNama} · ${HARI_LABEL[t.hari] ?? t.hari} ${t.slotNama ?? ''}: ${errorMessage(e)}`;
          }
        }
      }
      setSelBusy(false);
      await muatJadwal();
      if (galatPertama === '') {
        toast.success(`${sukses} sel dikosongkan.`);
      } else {
        toast.error(`${sukses} dari ${sasaran.length} sel dikosongkan. ${galatPertama}`);
      }
    })();
  }, [canUbah, hari, petaJadwal, muatJadwal]);

  /** Baris-baris sel matriks hari `h` pada baris `id` — pitanya antara
   *  peta baris dan peta jadwal. */
  const garisSel = useCallback(
    (id: string | number, h: string): GarisSel[] => {
      const s = petaBaris.get(String(id))?.perHari[h];
      return garisSelMatriks(s, s === undefined ? undefined : petaJadwal.get(`${s.id}|${h}`), {
        tampilan,
        formatMapel,
        formatGuru,
      });
    },
    [petaBaris, petaJadwal, tampilan, formatMapel, formatGuru],
  );

  /** Isi sel dari `garisSel`: satu baris langsung, dua baris ditumpuk. */
  const renderSel = useCallback((id: string | number, h: string) => {
    const baris = garisSel(id, h);
    if (baris.length === 0) return null;
    if (baris.length === 1) {
      return <span className={GAYA_GARIS[baris[0].gaya].kelas}>{baris[0].teks}</span>;
    }
    return (
      <span className="flex min-w-0 max-w-full flex-col items-center justify-center leading-none">
        {baris.map((b, i) => (
          <span key={i} className={GAYA_GARIS[b.gaya].kelas}>{b.teks}</span>
        ))}
      </span>
    );
  }, [garisSel]);

  /** Bentuk `BarisSel` untuk AutoFit dari baris yang sama yang digambar. */
  const barisSelJadwal = useCallback(
    (id: string | number, h: string): BarisSel[] =>
      garisSel(id, h).map((b) => ({ teks: b.teks, ukuran: GAYA_GARIS[b.gaya].ukuran })),
    [garisSel],
  );

  /** Kelas warna sel sesuai mode: guru (per orang) atau mapel (per mapel).
   *  Sel tanpa guru/mapel dan slot non-pelajaran dibiarkan polos. */
  const kelasWarnaSel = useCallback((rowId: string | number, h: string) => {
    if (warna === 'polos') return undefined;
    const s = petaBaris.get(String(rowId))?.perHari[h];
    if (s === undefined || s.jenis !== 'pelajaran') return undefined;
    const j = petaJadwal.get(`${s.id}|${h}`);
    if (j === undefined) return undefined;
    if (warna === 'guru') {
      return kelasWarna(j.guru_pegawai_id ?? j.keaktifan_pegawai_id);
    }
    return kelasWarna(j.mata_pelajaran_id);
  }, [warna, petaBaris, petaJadwal]);

  /** Baris pertama sebuah kelas diberi garis pemisah kelompok. */
  const kelasAwalSel = useCallback((rowId: string | number) => (
    petaBaris.get(String(rowId))?.awalKelas ? 'simpes-dsg-kelas-awal' : undefined
  ), [petaBaris]);

  const fieldsMatriks = useMemo<ExcelField[]>(() => {
    const cls = (rowData: GridRow, ekstra?: string) => (
      [kelasAwalSel(rowData.id), ekstra].filter(Boolean).join(' ') || undefined
    );
    return [
      { key: '__kelas', label: 'Kelas', width: 140, kind: 'static', cellClass: (rowData) => cls(rowData) },
      { key: '__slot', label: 'Jam', width: 110, kind: 'static', cellClass: (rowData) => cls(rowData) },
      ...hari.map((h): ExcelField => ({
        key: h,
        label: HARI_LABEL[h] ?? h,
        width: 180,
        kind: 'static',
        renderCell: (rowData: GridRow) => renderSel(rowData.id, h),

        barisSel: (rowData) => barisSelJadwal(rowData.id, h),
        cellClass: (rowData: GridRow) => cls(rowData, kelasWarnaSel(rowData.id, h)),
      })),
    ];
  }, [hari, renderSel, barisSelJadwal, kelasWarnaSel, kelasAwalSel]);

  const nilaiMatriks = useCallback((r: BarisMatriks) => {
    const v: Record<string, string | null> = { __kelas: r.kelasNama, __slot: r.label };
    for (const h of hari) {
      const s = r.perHari[h];
      if (s === undefined) { v[h] = ''; continue; }
      if (s.jenis !== 'pelajaran') { v[h] = s.nama_slot ?? JENIS_SLOT_LABEL[s.jenis]; continue; }
      const j = petaJadwal.get(`${s.id}|${h}`);
      if (j === undefined) { v[h] = ''; continue; }
      const tanpaMapel = j.mata_pelajaran_id === null;
      const mapel = tanpaMapel ? '' : formatMapelBaris(j, formatMapel);
      const guru = formatGuruBaris(j, formatGuru);
      v[h] = tampilan === 'mapel'
        ? mapel
        : tampilan === 'guru'
          ? guru
          : tanpaMapel
            ? guru
            : `${mapel}${guru ? ` — ${guru}` : ''}`;
    }
    return v;
  }, [hari, petaJadwal, tampilan, formatMapel, formatGuru]);

  const sasaranTunggal = editSel !== null && editSel.length === 1 ? editSel[0] : null;
  const selJadwal = sasaranTunggal === null
    ? null
    : petaJadwal.get(`${sasaranTunggal.slot.id}|${sasaranTunggal.hari}`) ?? null;
  const mapelDialog = [...mapelAktif];
  if (selMapel !== '' && !mapelDialog.some((m) => m.id === selMapel)) {
    mapelDialog.unshift({
      id: Number(selMapel),
      jenjang: jenjang ?? '',
      nama_mapel: selJadwal?.nama_mapel ?? `#${selMapel}`,
      kode_mapel: null,
      singkatan: null,
      kelompok: 'formal',
      is_active: true,
      kkm: null,
      urutan: 0,
    });
  }
  const guruDialog = [...guruAktif];
  if (selGuru !== '' && !guruDialog.some((g) => g.keaktifan_pegawai_id === selGuru)) {
    guruDialog.unshift({
      keaktifan_pegawai_id: Number(selGuru),
      pegawai_id: 0,
      nama_lengkap: selJadwal?.guru ?? `#${selGuru}`,
      nip: null,
      gelar_depan: null,
      gelar_belakang: null,
      jenis_kelamin: null,
    });
  }

  /** Seret isi sel: tekan-tahan blok matriks lalu geser ke sel lain.
   *
   *  Sel matriks ber-`kind: 'static'` (isi lewat dialog), jadi jalur tulis
   *  bawaan tabel tak bisa dipakai — blok ditulis langsung ke API di sini.
   *  `mode` menentukan perlakuan asal: `salin` menulis isi sumber ke tiap sel
   *  tujuan, `pindah` menulisnya lalu mengosongkan sel sumber. */
  const seretIsiSel = useCallback((p: {
    mode: 'salin' | 'pindah';
    sumber: BlokIsi;
    target: BlokIsi;
    kunciKolom: string[];
    rows: BarisMatriks[];
  }) => {
    if (!canUbah) return;
    /** Sel pelajaran satu sel matriks: baris matriks × hari. */
    const sel = (blok: BlokIsi, dr: number, dc: number): SasaranJadwal | null => {
      const baris = p.rows[blok.r0 + dr];
      if (baris === undefined) return null;

      const key = p.kunciKolom[blok.kolom[dc]];
      if (key === undefined || !hari.includes(key)) return null;
      const slot = baris.perHari[key];
      if (slot === undefined || slot.jenis !== 'pelajaran') return null;
      return { kelasId: baris.kelasId, kelasNama: baris.kelasNama, slot, hari: key };
    };
    /** Semua sel pelajaran sebuah blok, urut baris lalu kolom. */
    const semuaSel = (blok: BlokIsi): SasaranJadwal[] => {
      const out: SasaranJadwal[] = [];
      for (let dr = 0; dr <= blok.r1 - blok.r0; dr += 1) {
        for (let dc = 0; dc < blok.kolom.length; dc += 1) {
          const t = sel(blok, dr, dc);
          if (t !== null) out.push(t);
        }
      }
      return out;
    };
    /** Kunci sel (`slotId|hari`) supaya tak ditulis dua kali. */
    const kunci = (t: SasaranJadwal) => `${t.slot.id}|${t.hari}`;

    const asal = semuaSel(p.sumber);
    if (asal.length === 0) {
      toast.error('Blok asal tidak memuat sel pelajaran.');
      return;
    }
    const isiAsal = asal.map((t) => petaJadwal.get(kunci(t)) ?? null);
    const mapel = isiAsal[0]?.mata_pelajaran_id ?? null;
    const guru = isiAsal[0]?.keaktifan_pegawai_id ?? null;

    const seragam = isiAsal.every((j) => (j?.mata_pelajaran_id ?? null) === mapel
      && (j?.keaktifan_pegawai_id ?? null) === guru);
    if (!seragam) {
      toast.error('Blok asal harus berisi mapel & guru yang sama.');
      return;
    }

    const tujuan = semuaSel(p.target);
    if (tujuan.length === 0) {
      toast.error('Blok tujuan tidak memuat sel pelajaran.');
      return;
    }

    const tujuanKunci = new Set(tujuan.map(kunci));

    setSelBusy(true);
    void (async () => {
      let sukses = 0;
      let galatPertama = '';
      const tulis = async (t: SasaranJadwal, m: number | null, g: number | null) => {
        try {
          await simpanSelJadwal({
            kelas_id: t.kelasId,
            slot_jam_id: t.slot.id,
            hari: t.hari,
            mata_pelajaran_id: m,
            keaktifan_pegawai_id: g,
          });
          return true;
        } catch (e) {
          if (galatPertama === '') {
            galatPertama = `${t.kelasNama} · ${HARI_LABEL[t.hari] ?? t.hari} ${t.slot.nama_slot ?? ''}: ${errorMessage(e)}`;
          }
          return false;
        }
      };
      for (const t of tujuan) {
        if (await tulis(t, mapel, guru)) sukses += 1;
      }
      if (p.mode === 'pindah') {
        for (const t of asal) {
          if (tujuanKunci.has(kunci(t))) continue;
          if (await tulis(t, null, null)) sukses += 1;
        }
      }
      setSelBusy(false);
      await muatJadwal();
      const total = tujuan.length + (p.mode === 'pindah' ? asal.length : 0);
      if (galatPertama === '') {
        toast.success(p.mode === 'pindah'
          ? `${total} sel diperbarui.`
          : `${total} sel disalin.`);
      } else {
        toast.error(`${sukses} dari ${total} sel tersimpan. ${galatPertama}`);
      }
    })();
  }, [canUbah, hari, petaJadwal, muatJadwal]);

  /** Sel pelajaran yang tercakup sebuah blok grid — dipakai jalur papan
   *  ketik (Ctrl/Cmd+C / Ctrl/Cmd+V) agar penerjemah indeks blok → sasaran
   *  persis sama dengan seret isi sel. */
  const sasaranDariBlok = useCallback(
    (blok: BlokGrid, kunciKolom: string[], rows: BarisMatriks[]) => sasaranBlokJadwal(
      blok, kunciKolom, hari, (r, h) => {
        const s = rows[r]?.perHari[h];
        return s !== undefined && s.jenis === 'pelajaran';
      },
    ),
    [hari],
  );

  /** Satu sel sebagai SasaranJadwal penuh (kelas + slot + hari). */
  const sasaranPenuh = useCallback((s: { baris: number; hari: string }, rows: BarisMatriks[]): SasaranJadwal | null => {
    const baris = rows[s.baris];
    const slot = baris?.perHari[s.hari];
    if (baris === undefined || slot === undefined || slot.jenis !== 'pelajaran') return null;
    return { kelasId: baris.kelasId, kelasNama: baris.kelasNama, slot, hari: s.hari };
  }, []);

  /** Papan klip internal halaman ini: isi SATU blok seragam (mapel + guru).
   *  Sengaja BUKAN clipboard sistem — nilai yang ditempel adalah id mapel/guru
   *  yang ditulis lewat API, bukan teks yang bisa ditempel ke sel mana pun. */
  const klipJadwalRef = useRef<KlipJadwal | null>(null);

  /** Ctrl/Cmd+C: rekam isi blok terpilih ke papan klip internal. */
  const salinBlokJadwal = useCallback((p: { blok: BlokGrid; kunciKolom: string[]; rows: BarisMatriks[] }) => {
    const sasaran = sasaranDariBlok(p.blok, p.kunciKolom, p.rows);
    if (sasaran.length === 0) {
      toast.error('Blok terpilih tidak memuat sel pelajaran.');
      return;
    }
    const klip = klipSeragam(sasaran, (s) => {
      const penuh = sasaranPenuh(s, p.rows);
      if (penuh === null) return null;
      const j = petaJadwal.get(`${penuh.slot.id}|${penuh.hari}`);
      return { mapel: j?.mata_pelajaran_id ?? null, guru: j?.keaktifan_pegawai_id ?? null };
    });
    if (klip === null) {
      toast.error('Blok asal harus berisi mapel & guru yang sama.');
      return;
    }

    klipJadwalRef.current = klip;
    toast.success(`${klip.jumlahSel} sel disalin. Tekan Ctrl/Cmd+V untuk menempel.`);
  }, [petaJadwal, sasaranDariBlok, sasaranPenuh]);

  /** Ctrl/Cmd+V: tulis isi papan klip ke seluruh sel pelajaran blok terpilih. */
  const tempelBlokJadwal = useCallback((p: { blok: BlokGrid; kunciKolom: string[]; rows: BarisMatriks[] }) => {
    if (!canUbah) return;
    const klip = klipJadwalRef.current;
    if (klip === null) {
      toast.warning('Belum ada sel yang disalin. Pilih blok lalu Ctrl/Cmd+C dulu.');
      return;
    }
    const sasaran = sasaranDariBlok(p.blok, p.kunciKolom, p.rows)
      .map((s) => sasaranPenuh(s, p.rows))
      .filter((t): t is SasaranJadwal => t !== null);
    if (sasaran.length === 0) {
      toast.error('Blok tujuan tidak memuat sel pelajaran.');
      return;
    }
    setSelBusy(true);
    void (async () => {
      let sukses = 0;
      let galatPertama = '';
      for (const t of sasaran) {
        try {
          await simpanSelJadwal({
            kelas_id: t.kelasId,
            slot_jam_id: t.slot.id,
            hari: t.hari,
            mata_pelajaran_id: klip.mata_pelajaran_id,
            keaktifan_pegawai_id: klip.keaktifan_pegawai_id,
          });
          sukses += 1;
        } catch (e) {
          if (galatPertama === '') {
            galatPertama = `${t.kelasNama} · ${HARI_LABEL[t.hari] ?? t.hari} ${t.slot.nama_slot ?? ''}: ${errorMessage(e)}`;
          }
        }
      }
      setSelBusy(false);
      await muatJadwal();
      if (galatPertama === '') {
        toast.success(`${sukses} sel ditempel.`);
      } else {
        toast.error(`${sukses} dari ${sasaran.length} sel ditempel. ${galatPertama}`);
      }
    })();
  }, [canUbah, muatJadwal, sasaranDariBlok, sasaranPenuh]);

  const simpanSel = async () => {
    if (editSel === null || editSel.length === 0) return;
    setSelBusy(true);
    const mapel = selMapel === '' ? null : Number(selMapel);
    const guru = selGuru === '' ? null : Number(selGuru);
    let sukses = 0;
    let galatPertama = '';
    for (const t of editSel) {
      try {
        await simpanSelJadwal({
          kelas_id: t.kelasId,
          slot_jam_id: t.slot.id,
          hari: t.hari,
          mata_pelajaran_id: mapel,
          keaktifan_pegawai_id: guru,
        });
        sukses++;
      } catch (e) {
        if (galatPertama === '') {
          galatPertama = `${t.kelasNama} · ${HARI_LABEL[t.hari] ?? t.hari} ${t.slot.nama_slot ?? ''}: ${errorMessage(e)}`;
        }
      }
    }
    setSelBusy(false);
    const jumlah = editSel.length;
    setEditSel(null);
    await muatJadwal();
    if (galatPertama === '') {
      toast.success(jumlah === 1 ? 'Jadwal disimpan.' : `${sukses} sel disimpan.`);
    } else {
      toast.error(`${sukses} dari ${jumlah} sel tersimpan. ${galatPertama}`);
    }
  };

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tabel={[
        { key: 'kurikulum_jadwal', judul: 'Jadwal', fields: fieldsMatriks },
        { key: 'kurikulum_template_jadwal', judul: 'Kerangka jam', fields: FIELDS_KERANGKA },
      ]} />
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="jadwal" id="tab_jadwal_pelajaran" className={KELAS_TRIGGER}>Jadwal</TabsTrigger>
          <TabsTrigger value="template" id="tab_template_jadwal" className={KELAS_TRIGGER}>Template Jadwal</TabsTrigger>
          <TabsTrigger value="libur" id="tab_hari_libur" className={KELAS_TRIGGER}>Hari Libur</TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal" className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-2">
            <LabeledCombobox
              label="Tampilan" htmlFor="select_tampilan_jadwal"
              tinggi={26} lebarKombo={130} kelolaLebar={false}
            >
              <ComboboxRoot
                items={OPSI_TAMPILAN}
                itemToStringLabel={(o) => o.label}
                isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                value={OPSI_TAMPILAN.find((o) => o.nilai === tampilan) ?? OPSI_TAMPILAN[0]}
                onValueChange={(o) => { if (o !== null) setTampilan(o.nilai); }}
              >
                <ComboboxInput id="select_tampilan_jadwal" aria-label="Tampilan isi sel jadwal" />
                <ComboboxTrigger aria-label="Buka daftar tampilan" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ada pilihan.</ComboboxEmpty>
                  <ComboboxList>
                    {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxRoot>
            </LabeledCombobox>
            <LabeledCombobox
              label="Warna" htmlFor="select_warna_jadwal"
              tinggi={26} lebarKombo={100} kelolaLebar={false}
            >
              <ComboboxRoot
                items={OPSI_WARNA}
                itemToStringLabel={(o) => o.label}
                isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                value={OPSI_WARNA.find((o) => o.nilai === warna) ?? OPSI_WARNA[0]}
                onValueChange={(o) => { if (o !== null) setWarna(o.nilai); }}
              >
                <ComboboxInput
                  id="select_warna_jadwal" aria-label="Pewarnaan sel jadwal"
                  title="Pewarnaan sel jadwal"
                />
                <ComboboxTrigger aria-label="Buka daftar warna" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ada pilihan.</ComboboxEmpty>
                  <ComboboxList>
                    {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxRoot>
            </LabeledCombobox>
            <LabeledCombobox
              label="Mapel" htmlFor="select_format_mapel"
              tinggi={26} lebarKombo={110} kelolaLebar={false}
            >
              <ComboboxRoot
                items={OPSI_FORMAT_MAPEL}
                itemToStringLabel={(o) => o.label}
                isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                value={OPSI_FORMAT_MAPEL.find((o) => o.nilai === formatMapel) ?? OPSI_FORMAT_MAPEL[0]}
                onValueChange={(o) => { if (o !== null) setFormatMapel(o.nilai); }}
                disabled={tampilan === 'guru'}
              >
                <ComboboxInput
                  id="select_format_mapel" aria-label="Format tampilan mapel"
                  title="Format tampilan mapel"
                  placeholder="Nama"
                />
                <ComboboxTrigger aria-label="Buka daftar format mapel" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ada pilihan.</ComboboxEmpty>
                  <ComboboxList>
                    {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxRoot>
            </LabeledCombobox>
            <LabeledCombobox
              label="Guru" htmlFor="select_format_guru"
              tinggi={26} lebarKombo={160} kelolaLebar={false}
            >
              <ComboboxRoot
                items={OPSI_FORMAT_GURU}
                itemToStringLabel={(o) => o.label}
                isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                value={OPSI_FORMAT_GURU.find((o) => o.nilai === formatGuru) ?? OPSI_FORMAT_GURU[0]}
                onValueChange={(o) => { if (o !== null) setFormatGuru(o.nilai); }}
                disabled={tampilan === 'mapel'}
              >
                <ComboboxInput
                  id="select_format_guru" aria-label="Format tampilan guru"
                  title="Format tampilan guru"
                  placeholder="Nama tanpa gelar"
                />
                <ComboboxTrigger aria-label="Buka daftar format guru" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ada pilihan.</ComboboxEmpty>
                  <ComboboxList>
                    {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxRoot>
            </LabeledCombobox>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canTambah && jenjang !== null && ta !== null && (
                <Button type="button" variant="outline" size="sm" id="btn_salin_jadwal_ta"
                  onClick={bukaSalinJadwal}>
                  <Copy data-icon="inline-start" size={14} /> Salin dari TA lain
                </Button>
              )}
              {kelasTunggal !== null && (
              <>
              <label className="text-xs text-muted-foreground" htmlFor="select_template_kelas">Template</label>
              <select
                id="select_template_kelas"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={templateId === '' ? '' : String(templateId)}
                onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">
                  {templateSesuai.length === 0 ? '— tidak ada template —' : '— pilih template —'}
                </option>
                {templateSesuai.map((t) => (
                  <option key={t.id} value={t.id}>{t.nama}{t.is_active ? '' : ' (nonaktif)'}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground" htmlFor="cek_timpa_kelas">
                <input
                  type="checkbox" id="cek_timpa_kelas" checked={timpaKelas}
                  onChange={(e) => setTimpaKelas(e.target.checked)}
                />
                Timpa
              </label>
              {canTambah && (
                <>
                  <Button type="button" variant="outline" size="sm" id="btn_pratinjau_template_kelas"
                    disabled={!bisaTerapKelas}
                    onClick={() => void jalankanTemplateKelas('pratinjau')}>
                    Pratinjau
                  </Button>
                  <Button type="button" variant="default" size="sm" id="btn_terapkan_template_kelas"
                    disabled={!bisaTerapKelas}
                    onClick={() => void jalankanTemplateKelas('eksekusi')}>
                    Terapkan
                  </Button>
                </>
              )}
              </>
              )}
            </div>
          </div>

          {hasilKelas !== null && hasilKelas.dilewati.length > 0 && (
            <div className="shrink-0 border-b border-border py-1 text-[11px] text-muted-foreground">
              <ul className="list-disc pl-5">
                {hasilKelas.dilewati.map((d, i) => (
                  <li key={i}><span className="font-medium text-foreground">{d.sel}</span>: {d.alasan}</li>
                ))}
              </ul>
            </div>
          )}

          <ExcelTable<BarisMatriks>
            key={`matriks-${dataKelas.map((d) => `${d.kelas.id}:${d.slot.map((s) => s.id).join('.')}`).join('|')}`}
            tableKey="kurikulum_jadwal"
            header={`Jadwal${kelasTampil.length === 1
              ? ` · ${kelasTampil[0].nama_kelas}`
              : kelasTampil.length > 1
                ? ` · ${kelasTampil.length} kelas`
                : ''}`}
            fields={fieldsMatriks}
            rows={barisMatriks}
            getValues={nilaiMatriks}
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
            hideActions
            rail
            onIsiBlok={canUbah ? bukaBlok : undefined}
            blokAksiLabel="Isi mapel & guru…"
            onKosongkanBlok={canUbah ? kosongkanBlok : undefined}
            kosongkanBlokLabel="Kosongkan mapel & guru…"
            onSeretIsi={canUbah ? seretIsiSel : undefined}
            onSalinBlok={canUbah ? salinBlokJadwal : undefined}
            onTempelBlok={canUbah ? tempelBlokJadwal : undefined}
            emptyText={kelasTampil.length === 0
              ? 'Pilih kelas pada rel Kelas.'
              : barisMatriks.length === 0
                ? 'Belum ada kerangka JP — terapkan template di tab Template Jadwal.'
                : 'Belum ada jadwal untuk kelas-kelas ini.'}
          />
        </TabsContent>

        <TabsContent value="template" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelTemplate
            jenjang={jenjang}
            ta={ta}
            kelasOpsi={kelasOpsi}
            kelasId={kelasId}
            canTambah={canTambah}
            canUbah={canUbah}
            canHapus={canHapus}
            onTerapkan={() => { void muatJadwal(); }}
          />
        </TabsContent>

        <TabsContent value="libur" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelHariLibur
            jenjang={jenjang}
            canUbah={canUbah}
            onSimpan={() => { void muatJadwal(); }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editSel !== null} onOpenChange={(o) => { if (!o && !selBusy) setEditSel(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editSel !== null && editSel.length > 1 ? 'Isi Blok Jadwal' : 'Isi Jadwal'}
            </DialogTitle>
            <DialogDescription>
              {editSel === null
                ? ''
                : editSel.length > 1
                  ? `${editSel.length} sel`
                  : `${HARI_LABEL[editSel[0].hari] ?? editSel[0].hari} · ${editSel[0].slot.nama_slot ?? ''} (${jamPendek(editSel[0].slot.jam_mulai) ?? ''}–${jamPendek(editSel[0].slot.jam_selesai) ?? ''})`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs" htmlFor="select_guru_sel">
              Guru pengampu
              <select
                id="select_guru_sel"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={selGuru === '' ? '' : String(selGuru)}
                onChange={(e) => setSelGuru(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— tanpa guru —</option>
                {guruDialog.map((g) => (
                  <option key={g.keaktifan_pegawai_id} value={g.keaktifan_pegawai_id}>{namaGuru(g)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" htmlFor="select_mapel_sel">
              Mapel
              <select
                id="select_mapel_sel"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={selMapel === '' ? '' : String(selMapel)}
                onChange={(e) => setSelMapel(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— kosong —</option>
                {mapelDialog.map((m) => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={selBusy} onClick={() => setEditSel(null)}>
              Batal
            </Button>
            <Button type="button" variant="default" id="btn_simpan_sel_jadwal" disabled={selBusy}
              onClick={() => void simpanSel()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={salinOpen} onOpenChange={setSalinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salin jadwal dari tahun ajaran lain</DialogTitle>
            <DialogDescription>
              Menyalin seluruh jadwal satu jenjang: kelas, slot jam, pengampu, dan sel jadwal.
              Hanya kelas yang sudah ada di tahun ajaran tujuan yang disalin; sel yang sudah terisi tidak ditimpa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground">
              Lembaga: <span className="font-medium text-foreground">{jenjang ?? '—'}</span>
              {' · '}Tujuan: <span className="font-medium text-foreground">{ta ?? '—'}</span>
            </div>
            <label className="flex flex-col gap-1 text-xs" htmlFor="sel_salin_jadwal_ta">
              Tahun ajaran sumber
              <select
                id="sel_salin_jadwal_ta"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={taSumber}
                onChange={(e) => { setTaSumber(e.target.value); setPratinjauSalin(null); }}
              >
                <option value="">— pilih tahun ajaran —</option>
                {taOpsi.filter((t) => t !== ta).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            {pratinjauSalin ? (
              <div className="border p-2 text-[11px]" style={{ borderColor: 'var(--divider)' }}>
                <p className="font-medium">
                  Kelas: {pratinjauSalin.kelas.length} · slot: {pratinjauSalin.hitung.slot} · pengampu: {pratinjauSalin.hitung.pengampu} · sel jadwal: {pratinjauSalin.hitung.jadwal}
                </p>
                {pratinjauSalin.hitung.jadwal_dilewati > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    Dilewati karena sel sudah terisi: {pratinjauSalin.hitung.jadwal_dilewati} sel.
                  </p>
                ) : null}
                {pratinjauSalin.hitung.guru_dikosongkan > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    Guru tanpa keaktifan di TA tujuan (dikosongkan): {pratinjauSalin.hitung.guru_dikosongkan}.
                  </p>
                ) : null}
                {pratinjauSalin.kelas_dilewati.length > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    Kelas dilewati (tidak ada di TA tujuan): {pratinjauSalin.kelas_dilewati.map((k) => k.nama).join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setSalinOpen(false)}>Batal</Button>
            <Button
              type="button"
              size="sm"
              id="btn_salin_jadwal_jalankan"
              disabled={salinBusy || pratinjauSalin === null || pratinjauSalin.hitung.jadwal === 0}
              onClick={() => void jalankanSalinJadwal()}
            >
              {pratinjauSalin ? `Salin ${pratinjauSalin.hitung.jadwal} sel` : 'Salin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
