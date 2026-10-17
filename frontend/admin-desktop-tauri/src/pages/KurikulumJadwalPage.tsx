import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField, type GridRow } from '@/components/ExcelTable';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { jamPendek } from '@/lib/jadwal';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import PanelTemplate, { FIELDS_KERANGKA } from './TemplateJadwalPanel';
import PanelHariLibur from './HariLiburPanel';
import {
  daftarGuruAktif, daftarJadwal, daftarMapel, daftarTemplateJadwal, simpanSelJadwal, terapkanTemplate,
  HARI_LABEL, JENIS_SLOT_LABEL,
  type GuruAktif, type JadwalBaris, type MataPelajaran, type SlotJadwal,
  type TemplateJadwal, type TerapkanHasil,
} from '@/api/kurikulum';

/** Satu baris matriks = satu nomor JP. Slot tiap hari bisa berbeda (jumlah,
 *  jam, jenis), jadi frame disusun per hari lalu digabung per nomor JP. */
interface BarisMatriks {
  id: number;
  urutan: number;
  label: string;
  perHari: Record<string, SlotJadwal>;
}

/** Satu sel pelajaran yang jadi sasaran dialog isi jadwal. */
interface SasaranJadwal {
  slot: SlotJadwal;
  hari: string;
}

/** Isi sel matriks: mapel + guru (dua baris), mapel saja, atau guru saja. */
type TampilanJadwal = 'keduanya' | 'mapel' | 'guru';

/** Format nama mapel: nama lengkap, kode, atau singkatan. */
type FormatMapel = 'nama' | 'kode' | 'singkatan';

/** Format guru: nama/gelar, panggilan/singkat, berprefiks Ust./Usth., atau kode. */
type FormatGuru = 'nama' | 'gelar' | 'panggilan' | 'singkat' | 'prefiks' | 'prefiks_gelar' | 'kode';

/** Pewarnaan sel: polos, per guru, atau per mapel. */
type WarnaJadwal = 'polos' | 'guru' | 'mapel';

/** Jumlah kelas warna di index.css (simpes-warna-0 … -35). */
const JUMLAH_WARNA = 36;

function kelasWarna(id: number | null): string | undefined {
  return id === null ? undefined : `simpes-warna-${Math.abs(Math.trunc(id)) % JUMLAH_WARNA}`;
}

function namaGuru(g: GuruAktif): string {
  return `${g.gelar_depan ? `${g.gelar_depan} ` : ''}${g.nama_lengkap}${g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}`;
}

/** Nama mapel sesuai format; kode/singkatan kosong kembali ke nama. */
function formatMapelBaris(j: JadwalBaris, format: FormatMapel): string {
  if (format === 'kode') return j.kode_mapel?.trim() || j.nama_mapel || '';
  if (format === 'singkatan') return j.singkatan?.trim() || j.nama_mapel || '';
  return j.nama_mapel || '';
}

/** Nama guru sesuai format. Prefiks mengikuti jenis kelamin Pegawai. */
function formatGuruBaris(j: JadwalBaris, format: FormatGuru): string {
  const nama = j.guru?.trim();
  if (!nama) return '';
  if (format === 'kode') {
    return j.guru_pegawai_id !== null ? String(j.guru_pegawai_id) : '';
  }
  if (format === 'panggilan') return j.guru_nama_panggilan?.trim() || nama;
  if (format === 'singkat') return j.guru_nama_singkat?.trim() || nama;
  const depan = j.guru_gelar_depan?.trim();
  const belakang = j.guru_gelar_belakang?.trim();
  const denganGelar = `${depan ? `${depan} ` : ''}${nama}${belakang ? `, ${belakang}` : ''}`;
  if (format === 'gelar') return denganGelar;
  if (format === 'nama') return nama;
  const prefiks = j.guru_jenis_kelamin === 'P' ? 'Usth.' : 'Ust.';
  return format === 'prefiks_gelar' ? `${prefiks} ${denganGelar}` : `${prefiks} ${nama}`;
}

/** Halaman Jadwal Pelajaran: matriks jadwal per kelas (hari × JP) + tab
 *  template mingguan & hari libur. Klik kiri hanya memilih sel; klik kanan
 *  sel (satu atau blok) membuka dialog Guru + Mapel (guru boleh diisi lebih
 *  dulu, mapel menyusul). Tampilan memilih isi sel (keduanya/mapel/guru),
 *  Warna memilih pewarnaan polos/per guru/per mapel, dan Format memilih
 *  nama/kode/singkatan mapel serta nama/gelar/prefiks Ust.-Usth./kode/nama
 *  panggilan/nama singkat guru. */
export default function KurikulumJadwalPage() {
  const [tab, setTab] = useState('jadwal');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [slot, setSlot] = useState<SlotJadwal[]>([]);
  const [hari, setHari] = useState<string[]>([]);
  const [hariLibur, setHariLibur] = useState<string[]>([]);
  const [baris, setBaris] = useState<JadwalBaris[]>([]);
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

  const muatJadwal = useCallback(async () => {
    if (kelasId === '') { setSlot([]); setBaris([]); setHari([]); setHariLibur([]); return; }
    try {
      const r = await daftarJadwal(Number(kelasId));
      setSlot(r.slot); setHari(r.hari); setHariLibur(r.hari_libur ?? []); setBaris(r.baris);
    } catch (e) { setErr(errorMessage(e)); }
  }, [kelasId]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); setKelasId(''); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((k) => {
        if (!hidup) return;
        setKelasOpsi(k.data);
        setKelasId((v) => (k.data.some((x) => x.id === v) ? v : (k.data[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  useEffect(() => { void muatJadwal(); }, [muatJadwal]);

  // Pilihan mapel & guru master untuk dialog pengisian jadwal.
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

  // Daftar template untuk tombol Terapkan di tab Jadwal; muat ulang setiap
  // kembali ke tab ini agar template baru dari tab Template langsung tampil.
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

  /** Frame kelas: slot hari-null berlaku semua hari; slot hari tertentu
   *  menimpa slot umum pada nomor JP yang sama. */
  const barisMatriks = useMemo<BarisMatriks[]>(() => {
    const perHari = new Map<string, Map<number, SlotJadwal>>();
    for (const h of hari) perHari.set(h, new Map());
    for (const s of slot) {
      if (s.hari === null) {
        for (const h of hari) perHari.get(h)?.set(s.urutan, s);
      } else {
        perHari.get(s.hari)?.set(s.urutan, s);
      }
    }
    const urutan = [...new Set([...perHari.values()].flatMap((m) => [...m.keys()]))]
      .sort((a, b) => a - b);

    return urutan.map((u) => {
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
      return {
        id: u,
        urutan: u,
        label: `${nama.length === 1 ? nama[0] : `JP ${u}`}${jam.length === 1 ? ` · ${jam[0]}` : ''}`,
        perHari: perHariBaris,
      };
    });
  }, [slot, hari]);

  const petaBaris = useMemo(() => new Map(barisMatriks.map((r) => [r.id, r])), [barisMatriks]);
  const petaJadwal = useMemo(
    () => new Map(baris.map((b) => [`${b.slot_jam_id}|${b.hari}`, b])),
    [baris],
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
        if (s !== undefined && s.jenis === 'pelajaran') sasaran.push({ slot: s, hari: h });
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
    // Guru hanya diisi otomatis saat mapel seragam: blok dengan mapel campur
    // jangan sampai berubah jadi guru-saja hanya karena guru ikut terbawa.
    setSelGuru(mapelSama && guruSama ? (nilai[0]?.keaktifan_pegawai_id ?? '') : '');
  }, [canUbah, hari, petaJadwal]);

  /** Isi sel: mapel + guru (dua baris, gaya berbeda), mapel saja, atau guru
   *  saja sesuai pilihan Tampilan. Slot non-pelajaran tetap terkunci. */
  const renderSel = useCallback((id: string | number, h: string) => {
    const s = petaBaris.get(Number(id))?.perHari[h];
    if (s === undefined) return null;
    if (s.jenis !== 'pelajaran') {
      return (
        <span className="max-w-full truncate text-[10px] text-muted-foreground">
          {s.nama_slot ?? JENIS_SLOT_LABEL[s.jenis]}
        </span>
      );
    }
    const j = petaJadwal.get(`${s.id}|${h}`);
    if (j === undefined) return null;
    const tanpaMapel = j.mata_pelajaran_id === null;
    const mapel = tanpaMapel ? '' : formatMapelBaris(j, formatMapel);
    const guru = formatGuruBaris(j, formatGuru);
    if (tampilan === 'mapel') {
      return mapel === '' ? null : <span className="max-w-full truncate">{mapel}</span>;
    }
    if (tampilan === 'guru') {
      return <span className="max-w-full truncate">{guru || '—'}</span>;
    }
    // Guru dulu, mapel menyusul: tampilkan guru saja sampai mapel diisi.
    if (tanpaMapel) {
      return guru === '' ? null : <span className="max-w-full truncate">{guru}</span>;
    }
    return (
      <span className="flex min-w-0 max-w-full flex-col items-center justify-center leading-none">
        <span className="max-w-full truncate text-[10px] leading-[1.15]">{mapel}</span>
        {guru ? (
          <span className="max-w-full truncate text-[9px] leading-[1.15] text-muted-foreground">{guru}</span>
        ) : null}
      </span>
    );
  }, [petaBaris, petaJadwal, tampilan, formatMapel, formatGuru]);

  /** Kelas warna sel sesuai mode: guru (per orang) atau mapel (per mapel).
   *  Sel tanpa guru/mapel dan slot non-pelajaran dibiarkan polos. */
  const kelasWarnaSel = useCallback((rowId: string | number, h: string) => {
    if (warna === 'polos') return undefined;
    const s = petaBaris.get(Number(rowId))?.perHari[h];
    if (s === undefined || s.jenis !== 'pelajaran') return undefined;
    const j = petaJadwal.get(`${s.id}|${h}`);
    if (j === undefined) return undefined;
    if (warna === 'guru') {
      return kelasWarna(j.guru_pegawai_id ?? j.keaktifan_pegawai_id);
    }
    return kelasWarna(j.mata_pelajaran_id);
  }, [warna, petaBaris, petaJadwal]);

  const fieldsMatriks = useMemo<ExcelField[]>(() => [
    { key: '__slot', label: 'Jam', width: 170, kind: 'static' },
    ...hari.map((h): ExcelField => ({
      key: h,
      label: HARI_LABEL[h] ?? h,
      width: 180,
      kind: 'static',
      renderCell: (rowData: GridRow) => renderSel(rowData.id, h),
      cellClass: (rowData: GridRow) => kelasWarnaSel(rowData.id, h),
    })),
  ], [hari, renderSel, kelasWarnaSel]);

  const nilaiMatriks = useCallback((r: BarisMatriks) => {
    const v: Record<string, string | null> = { __slot: r.label };
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
          kelas_id: Number(kelasId),
          slot_jam_id: t.slot.id,
          hari: t.hari,
          mata_pelajaran_id: mapel,
          keaktifan_pegawai_id: guru,
        });
        sukses++;
      } catch (e) {
        if (galatPertama === '') {
          galatPertama = `${HARI_LABEL[t.hari] ?? t.hari} ${t.slot.nama_slot ?? ''}: ${errorMessage(e)}`;
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

  const kelasTerpilih = kelasOpsi.find((k) => k.id === kelasId) ?? null;

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

        <TabsContent value="jadwal" className="flex min-h-0 flex-1 flex-col gap-0 p-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-2">
            <label className="text-xs text-muted-foreground" htmlFor="select_kelas_jadwal">Kelas</label>
            <select
              id="select_kelas_jadwal"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={kelasId === '' ? '' : String(kelasId)}
              onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— pilih kelas —</option>
              {kelasOpsi.map((k) => (
                <option key={k.id} value={k.id}>{k.nama_kelas} (tingkat {k.tingkat ?? '-'})</option>
              ))}
            </select>
            {hariLibur.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Libur: {hariLibur.map((h) => HARI_LABEL[h] ?? h).join(', ')}
              </span>
            )}
            <label className="text-xs text-muted-foreground" htmlFor="select_tampilan_jadwal">Tampilan</label>
            <select
              id="select_tampilan_jadwal"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={tampilan}
              onChange={(e) => setTampilan(e.target.value as TampilanJadwal)}
            >
              <option value="keduanya">Mapel &amp; guru</option>
              <option value="mapel">Mapel saja</option>
              <option value="guru">Guru saja</option>
            </select>
            <label className="text-xs text-muted-foreground" htmlFor="select_warna_jadwal">Warna</label>
            <select
              id="select_warna_jadwal"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={warna}
              title="Pewarnaan sel jadwal"
              onChange={(e) => setWarna(e.target.value as WarnaJadwal)}
            >
              <option value="polos">Polos</option>
              <option value="guru">Guru</option>
              <option value="mapel">Mapel</option>
            </select>
            <label className="text-xs text-muted-foreground" htmlFor="select_format_mapel">Mapel</label>
            <select
              id="select_format_mapel"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={formatMapel}
              disabled={tampilan === 'guru'}
              title="Format tampilan mapel"
              onChange={(e) => setFormatMapel(e.target.value as FormatMapel)}
            >
              <option value="nama">Nama</option>
              <option value="kode">Kode</option>
              <option value="singkatan">Singkatan</option>
            </select>
            <label className="text-xs text-muted-foreground" htmlFor="select_format_guru">Guru</label>
            <select
              id="select_format_guru"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={formatGuru}
              disabled={tampilan === 'mapel'}
              title="Format tampilan guru"
              onChange={(e) => setFormatGuru(e.target.value as FormatGuru)}
            >
              <option value="nama">Nama tanpa gelar</option>
              <option value="gelar">Nama + gelar</option>
              <option value="panggilan">Nama panggilan</option>
              <option value="singkat">Nama singkat</option>
              <option value="prefiks">Ust./Usth. tanpa gelar</option>
              <option value="prefiks_gelar">Ust./Usth. + gelar</option>
              <option value="kode">Kode guru</option>
            </select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
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

          {kelasId === '' ? (
            <p className="p-4 text-xs text-muted-foreground">Pilih kelas untuk mengatur jadwal.</p>
          ) : hari.length === 0 ? (
            <div className="min-h-0 flex-1" />
          ) : (
            <ExcelTable<BarisMatriks>
              key={`matriks-${kelasId}-${slot.map((s) => s.id).join('-')}`}
              tableKey="kurikulum_jadwal"
              header={`Jadwal${kelasTerpilih ? ` · ${kelasTerpilih.nama_kelas}` : ''}`}
              fields={fieldsMatriks}
              rows={barisMatriks}
              getValues={nilaiMatriks}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              hideCheckbox
              hideActions
              onIsiBlok={canUbah ? bukaBlok : undefined}
              blokAksiLabel="Isi mapel & guru…"
              emptyText={barisMatriks.length === 0
                ? 'Belum ada kerangka JP — terapkan template di tab Template Jadwal.'
                : 'Belum ada jadwal untuk kelas ini.'}
            />
          )}
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
    </div>
  );
}
