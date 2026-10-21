import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  checkboxColumn,
  keyColumn,
  type Column,
  type DataSheetGridRef,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { errorMessage, prefSet } from '@/api/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_FAMILY_DEFAULT, FONT_OPTIONS, useGridPrefs } from '@/components/GridPrefs';
import { useLembagaAktif } from '@/lembagaAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import { EVENT_TAMPILAN_PERANGKAT_BERUBAH, kabariPreset, kabariTampilanPerangkat, type AlignKolom } from '@/components/kelolaTabel/jenis';
import { setPresetAktif, updatePresetTabel } from '@/api/preset';
import FilterRail from '@/components/FilterRail';
import ScrollbarMelayang from './excel/ScrollbarMelayang';
import { gabungUrutan } from './excel/urutanKolom';
import { judulTabel } from './excel/judul';
import { useToolbarPresetState } from './excel/useToolbarPreset';
import { filterToolbarTersedia } from './excel/filterTabel';
import { komponenAktif, type InfoKomponenTabel } from './excel/komponenTabel';
import { useLebarKolom } from './excel/useLebarKolom';
import { useLebarWadah } from './excel/useLebarWadah';
import { useIsiLebar } from './excel/useIsiLebar';
import { skalaLebarIsi, RESIZER_OVERHANG } from './excel/lebarIsi';
import { targetGulirBeku } from './excel/beku';
import { useTinggiBaris } from './excel/useTinggiBaris';
import { useTinggiBarisSatuan } from './excel/useTinggiBarisSatuan';
import { TINGGI_BARIS_BAWAAN } from './excel/tinggiBaris';
import { useSalinTabel } from './excel/useSalinTabel';
import { useSalinClipboard } from './excel/useSalinClipboard';
import { useInteraksiSel } from './excel/useInteraksiSel';
import { useBarisInput } from './excel/useBarisInput';
import { KonteksLebarFilter } from './excel/lebarFilter';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ActionIcon } from '@/components/RowActions';
import { Pencil, Plus, PlusCircle, Save } from '@/icons';

/** Klik kanan di "corner button" (sel header gutter di sudut kiri-atas,
 *  bertanda segitiga `.dsg-corner-indicator`) → menu salin seluruh tabel. */
export function diCornerButton(target: Element | null): boolean {
  return !!target?.closest('.dsg-cell-gutter.dsg-cell-header');
}
/** Kolom gutter DSG (nomor urut): identitas stabil agar memo kolom DSG tak
 *  dihitung ulang tiap render (literal inline selalu dihitung ulang). */
const GUTTER_COLUMN = { basis: GUTTER_W };
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { labelKolom as labelKolomTeks } from '@/lib/labelKolom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { CheckAllCell, CheckAllContext, PillMode, TabelMemuat, type SakelarMode } from './excel/primitives';
import {
  ACTIONS_DEFAULT_W,
  ACTIONS_MIN_W,
  AKSI_RINGKAS,
  CHECK_W,
  GUTTER_W,
  INPUT_ROW_ID,
  MIN_COL_W,
  freezeKey,
  geserHeaderKey,
  hasOpenEditor,
  loadFreeze,
  loadGeserHeader,
  loadSakelarGestur,
  seretPindahKey,
  seretSalinKey,
  tinggiCache,
} from './excel/helpers';
import {
  InputStaticSelectCell,
  InputStaticTextCell,
  CheckCell,
  SelectRadixCell,
  StaticCell,
  TextCell,
  ToggleCell,
} from './excel/cells';
import { HeaderTitle } from './excel/header';
import { htmlAdaIsi } from '@/components/info/sanitasiHtml';
import { useSeretKolomHeader } from './excel/useSeretKolomHeader';
import { useSeretIsiSel } from './excel/useSeretIsiSel';
import { useSalinTempelBlok } from './excel/useSalinTempelBlok';
import { blokDariSeleksi, terapkanSeret, type BlokIsi, type ModeSeret } from './excel/seretIsiSel';
import { useAntreanSimpan } from './excel/useAntreanSimpan';
import JudulTabel from './excel/JudulTabel';
import { ActionsCell, flattenAksi } from './excel/actions';
import MenuKonteksGrid from './excel/konteksMenu';
import type { AksiMenu, CheckAllState, ExcelField, GridRow, GridSelection } from './excel/types';

export type { ExcelChoice, ExcelField, GridRow, GridSelection } from './excel/types';

export interface ExcelTableProps<T extends { id: string | number }> {
  /** Kunci unik tabel (persist tinggi baris, id elemen). */
  tableKey: string;
  /** Definisi kolom data (kolom checklist + Aksi ditambah otomatis). */
  fields: ExcelField[];
  rows: T[];
  /** Petakan baris domain ke nilai field grid. */
  getValues: (row: T) => Record<string, string | null>;
  loading?: boolean;
  emptyText?: string;
  /** Gerbang hak akses: bila false, grid selalu baca-saja (tanpa checkbox Edit). */
  canEdit: boolean;
  /** Simpan perubahan sel saat keluar Mode Ubah, bukan tiap sel berubah. */
  simpanSaatKeluarMode?: boolean;
  /** Lapor sel yang ditolak validasi tanpa membatalkan sel lain di baris yang sama. */
  onValidasiGagal?: (info: { id: string | number; key: string; pesan: string }) => void;
  /** Simpan satu baris hasil edit sel (auto-save, dipanggil saat sel berubah). */
  onCommit: (id: T['id'], fields: Record<string, string | null>) => Promise<void>;
  /** Dipanggil sekali setelah antrean auto-save selesai (biasanya reload halaman). */
  onSaved: () => Promise<void> | void;
  /** Isi kolom Aksi (ikon Lihat/Ubah/Hapus, sudah digerbang role oleh halaman). */
  renderActions: (row: T) => ReactNode;
  /** Aksi tambahan yang HANYA muncul di menu klik kanan (submenu AKSI), bukan
   *  di kolom Aksi — mis. tombol profil Santri yang membuka dialog navigasi
   *  sehingga ikonnya tak perlu tampil di setiap baris. Kosongkan bila menu
   *  klik kanan cukup memakai `renderActions`. */
  renderActionsKonteks?: (row: T) => ReactNode;
  filter?: ReactNode;
  /** Label info halaman di area judul tabel. */
  tengah?: ReactNode;
  header?: ReactNode;
  /** Kontrol di awal area judul (mis. pemilih
   *  tabel pada halaman pengaturannya). */
  awalanToolbar?: ReactNode;
  /** Kontrol di ujung KANAN area judul (sebelum tombol aksi utama halaman). */
  akhirToolbar?: ReactNode;
  /** Tombol aksi utama halaman (mis. "+ Tambah X"): diletakkan sebaris
   *  dengan pencarian/filter, di sisi kanan. */
  addButton?: ReactNode;
  /** Tampilkan `addButton` langsung (tanpa dibungkus menu hamburger Aksi). */
  addButtonLangsung?: boolean;
  /** Aksi massal untuk baris tercentang (mis. verifikasi/ACC/hapus).
   *  `clearSelection` memanggil ulang setelah aksi selesai. */
  renderBulkActions?: (checkedRows: T[], clearSelection: () => void) => ReactNode;
  /** Batasi tinggi grid maksimal N baris (tanpa flex-1, mengikuti isi). */
  maxRows?: number;
  /** Buat record baru dari baris input paling bawah (mode Input). Bila tidak
   *  diberikan, opsi mode Input tidak ditampilkan. Nilai memakai kunci field. */
  onCreateRow?: (fields: Record<string, string | null>) => Promise<void>;
  /** Nilai tampilan kolom statis pada baris input (mis. nama TA terpilih). */
  inputRowValues?: Record<string, string | null>;
  /** Tabel ringkas baca-saja: sembunyikan kolom centang (tanpa seleksi baris). */
  hideCheckbox?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan kolom Aksi. */
  hideActions?: boolean;
  /** Selalu tampilkan ikon aksi langsung (tanpa hamburger titik-tiga),
   *  mengabaikan status ringkas warisan tableKey yang dipakai bersama. */
  aksiLangsung?: boolean;
  /** Tabel ringkas baca-saja: sembunyikan pemilih preset kolom di toolbar. */
  hidePreset?: boolean;
  /** Susunan kolom dikendalikan dari luar (mis. PresetKolom di luar toolbar):
   *  menimpa preset internal sepenuhnya (termasuk label & id preset untuk
   *  menu konteks). `undefined` (bawaan) = perilaku lama. */
  presetLuar?: { keys: string[] | null; presetId?: number | null };
  /** Timpa lebar trigger dropdown Kolom (bawaan `w-44`), mis. tabel sempit. */
  presetKolomClassName?: string;
  /** Lebar kolom data diskalakan dengan satu rasio agar TOTAL tabel mengisi
   *  lebar pembungkusnya (kolom tetap: gutter/centang/Aksi tidak ikut).
   *
   *  Rasio = (lebar wadah − kolom tetap) / total lebar kolom data, dihitung
   *  dari lebar yang sedang dipakai (seret pengguna → AutoFit → lebar field),
   *  jadi perbandingan antar kolom tetap mencerminkan isi datanya:
   *  `50 + 150 + 200` di wadah 800 menjadi `100 + 300 + 400`.
   *
   *  Wadah yang lebih sempit menyusutkan kolom dengan rasio yang sama, tapi
   *  tak pernah di bawah lebar minimum kolom (tabel menggulir bila masih
   *  kelebihan). Bawaan `false`: sisa ruang di kanan dibiarkan kosong seperti
   *  Excel. Lihat `excel/lebarIsi.ts` untuk perhitungan + pembulatannya.
   *
   *  Prop ini hanya keadaan AWAL tabel. Pengguna bisa menyalakan/mematikannya
   *  sendiri per perangkat lewat **gerigi "Pengaturan tabel" → Umum → "Tabel
   *  mengisi lebar"** (pref `simpes_grid_<tableKey>_isi_lebar` menang atas
   *  prop). */
  isiLebarPenuh?: boolean;
  /** Tampilkan rel filter Tingkat/Kelas di kiri grid (di bawah bar judul
   *  tabel, sejajar judul kolom). Pakai hanya pada tabel utama halaman —
   *  satu rel per halaman. */
  rail?: boolean;
  /** Kabarkan baris tercentang setiap seleksi berubah (opsional). */
  onCheckedChange?: (rows: T[]) => void;
  /** Baris dipilih lewat klik sel (bukan centang): dipanggil saat sel aktif
   *  berpindah ke baris lain — termasuk lewat panah keyboard. Dipakai tabel
   *  pemilih yang isi panel sebelahnya mengikuti baris terpilih (mis. Daftar
   *  Dispensasi). Absen (bawaan) = perilaku lama, tanpa seleksi baris. */
  onBarisKlik?: (row: T) => void;
  /** Id baris yang sedang dipilih → barisnya disorot (`simpes-dsg-row-aktif`).
   *  Hanya berarti bila `onBarisKlik` dipakai. */
  barisAktifId?: T['id'] | null;
  /** Daftar nilai urut aktif berurutan (maks 3) + arah global. */
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** Niat urut dari dropdown Urutkan: halaman me-refetch lalu mengisi urutAktif.
   *  `arahKolom` = arah per kode dari preset (bila preset mengaturnya sendiri). */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, 'naik' | 'turun'>) => void;
  /** Tabel database utama grid ini: kolom tanpa `sumber` dianggap berasal dari
   *  tabel ini (nama kolom = key-nya), kecuali `sumber: null`. */
  sumberTabel?: string;
  /** Aksi massal untuk blok sel terpilih: dipanggil dari klik kanan DI DALAM
   *  seleksi. `blokAksiLabel` hanya mengubah teks item menunya. */
  onIsiBlok?: (rows: T[], fields: ExcelField[]) => void;
  blokAksiLabel?: string;
  /** Kosongkan isi blok sel terpilih (menulis nilai kosong), dari item menu
   *  yang berdampingan dengan aksi isi blok. Bentuk panggilannya sama dengan
   *  `onIsiBlok` — `rows` + `fields` — jadi halaman tak perlu tahu indeks
   *  grid. Item ini HANYA muncul saat Mode Ubah menyala: mengosongkan isi sel
   *  merusak data, jadi tak boleh tersedia dari tabel yang sedang dibaca
   *  (policy yang sama dengan seret isi sel). */
  onKosongkanBlok?: (rows: T[], fields: ExcelField[]) => void;
  kosongkanBlokLabel?: string;
  /** Tangani sendiri hasil seret isi sel (blok dalam indeks grid).
   *
   *  Tanpa prop ini seret ditulis lewat jalur biasa tabel (draft + auto-save),
   *  yang HANYA bisa menulis kolom non-`static`. Halaman yang isi selnya punya
   *  semantik sendiri — mis. matriks jadwal yang tiap selnya diisi lewat
   *  dialog "Isi Jadwal" dan kolomnya `static` — perlu menulis sendiri; blok
   *  sumber/tujuan sudah dibatasi hanya kolom data. */
  onSeretIsi?: (p: {
    mode: ModeSeret;
    /** Blok asal (indeks baris/kolom grid). */
    sumber: BlokIsi;
    /** Blok tujuan setelah digeser (indeks baris/kolom grid). */
    target: BlokIsi;
    /** Kunci kolom grid urut indeks — penerjemah indeks kolom blok → key. */
    kunciKolom: string[];
    /** Baris domain tabel saat seret dilepas. */
    rows: T[];
  }) => void;
  /** Salin blok sel terpilih ke papan klip internal (Ctrl/Cmd+C), HANYA saat
   *  Mode Ubah menyala. Bentuk argumennya sama dengan `onSeretIsi` (blok dalam
   *  indeks grid) supaya halaman memakai penerjemah yang sama. */
  onSalinBlok?: (p: {
    /** Blok sel terpilih (indeks baris/kolom grid). */
    blok: BlokIsi;
    /** Kunci kolom grid urut indeks — penerjemah indeks kolom blok → key. */
    kunciKolom: string[];
    /** Baris domain tabel saat salin ditekan. */
    rows: T[];
  }) => void;
  /** Tempel isi papan klip internal ke blok sel terpilih (Ctrl/Cmd+V), HANYA
   *  saat Mode Ubah menyala. Halaman yang menentukan isi papan klipnya sendiri
   *  (mis. matriks jadwal menyimpan id mapel/guru lalu menulisnya lewat API). */
  onTempelBlok?: (p: {
    /** Blok sel tujuan (indeks baris/kolom grid). */
    blok: BlokIsi;
    /** Kunci kolom grid urut indeks — penerjemah indeks kolom blok → key. */
    kunciKolom: string[];
    /** Baris domain tabel saat tempel ditekan. */
    rows: T[];
  }) => void;
  /** Kontrol paginasi halaman (mis. `<Pager/>`). Dirender di kaki tabel
   *  SEBARIS dengan tombol tinggi baris; tanpa prop ini kaki tabel hanya
   *  berisi tombol tinggi baris. */
  pager?: ReactNode;
}

type Drafts = Record<string, Record<string, string | null>>;

/** Identitas kelompok sakelar gestur di bilah Mode Ubah. Copy & Move satu
 *  grup karena saling mati; susunan kolom punya grupnya sendiri. Nanti ada
 *  grup baru cukup tambah konstanta + `grup` di sakelarnya — `PillMode`
 *  otomatis memberi garis pemisah antarnya. */
const GRUP_SERET_ISI = 'seret_isi';
const GRUP_SUSUNAN_KOLOM = 'susunan_kolom';

export default function ExcelTable<T extends { id: string | number }>({
  tableKey,
  fields,
  rows,
  getValues,
  loading = false,
  emptyText = 'Belum ada data.',
  canEdit,
  simpanSaatKeluarMode = false,
  onValidasiGagal,
  onCommit,
  onSaved,
  renderActions,
  renderActionsKonteks,
  filter,
  tengah,
  header,
  awalanToolbar,
  akhirToolbar,
  addButton,
  addButtonLangsung = false,
  renderBulkActions,
  maxRows,
  onCreateRow,
  inputRowValues,
  hideCheckbox = false,
  hideActions = false,
  aksiLangsung = false,
  hidePreset = false,
  isiLebarPenuh = false,
  presetLuar,
  presetKolomClassName,
  rail = false,
  onCheckedChange,
  onBarisKlik,
  barisAktifId = null,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  pager,
  onIsiBlok,
  blokAksiLabel = 'Isi blok…',
  onKosongkanBlok,
  kosongkanBlokLabel = 'Kosongkan blok…',
  onSeretIsi,
  onSalinBlok,
  onTempelBlok,
}: ExcelTableProps<T>) {
  // Preferensi tampilan tabel global (dikontrol dari top bar). `rowH` di sini

  const { rowH, headerH, fontPx, fontFamily } = useGridPrefs();

  /** MODE UBAH — satu sakelar untuk SELURUH tindakan yang mengubah tabel:
   *  editing sel, seret isi sel, dan fitur manipulasi tabel lain yang
   *  menyusul. Tanpa mode ini, gestur yang bisa merusak data (potong, geser
   *  isi) tak pernah aktif, sehingga tabel selalu aman sekadar dibaca. */
  const [modeUbah, setModeUbahRaw] = useState(false);
  const [inputMode, setInputModeRaw] = useState(false);
  const flushSaatKeluarRef = useRef<() => Promise<void>>(async () => {});
  /** Mode tabel saling eksklusif: hanya satu boleh aktif. Mengaktifkan mode
   *  Ubah mematikan mode Input, dan sebaliknya. */
  const setModeUbah = useCallback((v: boolean) => {
    if (!v && simpanSaatKeluarMode) void flushSaatKeluarRef.current();
    setModeUbahRaw(v);
    if (v) setInputModeRaw(false);
  }, [simpanSaatKeluarMode]);
  const setInputMode = useCallback((v: boolean) => {
    if (v && simpanSaatKeluarMode) void flushSaatKeluarRef.current();
    setInputModeRaw(v);
    if (v) setModeUbahRaw(false);
  }, [simpanSaatKeluarMode]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [checkedIds, setCheckedIds] = useState<Set<T['id']>>(new Set());
  const [range, setRange] = useState<GridSelection | null>(null);
  /** Area yang diklik kanan (context menu beda per area tabel). */
  const [ctx, setCtx] = useState<
    | { area: 'header'; colKey: string }
    | { area: 'row'; rowId: T['id']; rowLabel: string; colKey: string | null }
    | { area: 'sudut' }
    | { area: 'grid' }
  >({ area: 'grid' });
  const [ctxKonfirmasi, setCtxKonfirmasi] = useState<AksiMenu['konfirmasi'] | null>(null);
  /** Geser urutan kolom = super_admin EFEKTIF (global; mati saat bertindak). */
  const { efektifSuper: bolehGeser } = useLembagaAktif();
  const visHalaman = useVisibilitasFilter();
  const bolehKelolaHalaman = !!visHalaman?.registrasi && bolehGeser;
  const [kelolaTabelOpen, setKelolaTabelOpen] = useState(false);
  const { visibilitas, alignDb, urutanDb, simpanUrutan, labelDb, judulDb, infoHtmlDb, simpanAlign, konteksLebarFilter } = useToolbarPresetState(tableKey);

  const headerKolomTampil = komponenAktif(visibilitas, 'header_kolom');

  const sembunyiCentang = hideCheckbox || !komponenAktif(visibilitas, 'kolom_centang');
  const sembunyiAksi = hideActions || !komponenAktif(visibilitas, 'kolom_aksi');
  /** Baris input hanya tersedia bila halaman menyediakan onCreateRow.
   *  Tidak bergantung mode Edit: halaman boleh mendukung create saja. */
  const inputEnabled = !!onCreateRow;
  const showInput = inputEnabled && inputMode;

  const checkedRows = useMemo(() => rows.filter((r) => checkedIds.has(r.id)), [rows, checkedIds]);
  const clearSelection = useMemo(() => () => setCheckedIds(new Set<T['id']>()), []);

  const [presetKeysDalam, setPresetKeysDalam] = useState<string[] | null>(null);
  /** Id preset kolom yang sedang aktif (null = susunan Lengkap tanpa preset).
   *  Dipakai seret judul: bila preset aktif, urutan baru ditulis ke `kolom`
   *  preset itu; bila tidak, ke `toolbar_preset.urutan` global. */
  const [presetIdDalam, setPresetIdDalam] = useState<number | null>(null);

  const luar = presetLuar !== undefined;
  const presetKeys = luar ? presetLuar.keys : presetKeysDalam;
  const presetIdAktif = luar ? (presetLuar.presetId ?? null) : presetIdDalam;

  const terapkanPreset = useCallback((keys: string[] | null, presetId?: number | null) => {
    if (luar) return;
    setPresetKeysDalam(keys);
    setPresetIdDalam(presetId ?? null);
  }, [luar]);

  /** Nama tampilan kolom: label per TABEL dari DB (kalau ada) > label field.
   *  Label berupa nama kolom mentah di-humanize supaya header tidak pernah
   *  tampil apa adanya; lihat `lib/labelKolom`. */
  const labelKolom = useCallback((key: string, bawaan: string) => (
    labelKolomTeks(labelDb?.[key]?.trim() || bawaan || key)
  ), [labelDb]);
  /** Perataan efektif = standar global per tabel (DB; satu sumber dengan
   *  dialog Kelola Tabel); absen = tengah. */
  const alignEfektif = useCallback((key: string): AlignKolom => (
    alignDb[key] ?? 'center'
  ), [alignDb]);
  /** Seleksi bersifat per halaman/filter: baris berganti = seleksi dibersihkan. */
  useEffect(() => {
    setCheckedIds(new Set<T['id']>());
  }, [rows]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const onCheckedChangeRef = useRef<((rows: T[]) => void) | undefined>(undefined);
  onCheckedChangeRef.current = onCheckedChange;
  const renderRef = useRef(renderActions);
  renderRef.current = renderActions;
  /** Jumlah aksi maksimum pada data yang sedang dimuat (per baris, setelah
   *  kondisi halaman disaring). Dipakai menaikkan high-water mark `ringkas`
   *  di bawah — tidak untuk keputusan per baris. `renderActions` dibaca via
   *  ref: definisi inline halaman berganti identitas tiap render dan tidak
   *  boleh memicu hitung ulang (iterasi seluruh baris) sia-sia. */
  const aksiMaksBaris = useMemo(
    () => rows.reduce((m, r) => Math.max(m, flattenAksi(renderRef.current(r)).length), 0),
    [rows],
  );
  const [aksiRingkas, setAksiRingkas] = useState(() => (AKSI_RINGKAS.get(tableKey) ?? 0) > 3);
  useEffect(() => {
    if (aksiMaksBaris > 3 && !aksiRingkas) {
      AKSI_RINGKAS.set(tableKey, aksiMaksBaris);
      setAksiRingkas(true);
    }
  }, [aksiMaksBaris, aksiRingkas, tableKey]);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const checkedIdsRef = useRef(checkedIds);
  checkedIdsRef.current = checkedIds;
  /** Antrean simpan otomatis per baris (id → field yang belum dikirim). */
  const rangeRef = useRef(range);
  rangeRef.current = range;
  /** Cermin baris grid aktif (id → baris) untuk pengukuran AutoFit DOM. */
  const gridByIdRef = useRef(new Map<string, GridRow>());
  /** Cermin baris grid tampil (dipakai salin blok seleksi). */
  const gridValueRef = useRef<GridRow[]>([]);
  /** Jumlah kolom DATA pertama yang dibekukan (freeze pane kiri), per tabel. */
  const [freeze, setFreeze] = useState(0);
  const fieldsRef = useRef(fields);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onValidasiGagalRef = useRef(onValidasiGagal);
  onValidasiGagalRef.current = onValidasiGagal;
  const dropDraftRef = useRef<(idKey: string, keys: string[]) => void>(() => {});
  const { enqueueSave, flush } = useAntreanSimpan<T>({
    rowsRef, fieldsRef, onCommitRef, onSavedRef, dropDraftRef, onInvalidRef: onValidasiGagalRef,
    autoDrain: !simpanSaatKeluarMode,
  });
  flushSaatKeluarRef.current = flush;
  fieldsRef.current = fields;
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;
  const visibleFields = useMemo(() => {

    if (presetKeys !== null) {
      const byKey = new Map(fields.map((f) => [f.key, f]));
      const terpilih = presetKeys
        .map((k) => byKey.get(k))
        .filter((f): f is (typeof fields)[number] => !!f);
      if (terpilih.length > 0) return terpilih;
    }
    const dasar = fields;
    // Tanpa preset (Lengkap): urutan global tersimpan (super_admin) menata

    if (urutanDb !== null && urutanDb.length > 0) {
      const byKey = new Map(dasar.map((f) => [f.key, f]));
      const urut = gabungUrutan(urutanDb, dasar.map((f) => f.key));
      const hasil = urut.map((k) => byKey.get(k)).filter((f): f is (typeof dasar)[number] => !!f);
      return hasil.length > 0 ? hasil : dasar;
    }
    return dasar;
  }, [fields, presetKeys, urutanDb]);
  const visibleFieldsRef = useRef(visibleFields);
  const gridRef = useRef<DataSheetGridRef>(null);

  useEffect(() => {
    let batal = false;
    const muat = () => {
      loadFreeze(freezeKey(tableKey)).then((n) => {
        if (!batal) setFreeze(n);
      });
    };
    muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) muat();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    return () => {
      batal = true;
      window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    };
  }, [tableKey]);

  const freezeAktif = Math.min(freeze, visibleFields.length);
  const ubahFreeze = useCallback(
    (n: number) => {
      const v = Math.max(0, Math.min(visibleFields.length, Math.round(n)));
      setFreeze(v);
      prefSet(freezeKey(tableKey), String(v)).catch(() => {});
    },
    [tableKey, visibleFields.length],
  );

  const [geserHeader, setGeserHeader] = useState(false);
  const [seretSalin, setSeretSalin] = useState(false);
  const [seretPindah, setSeretPindah] = useState(false);
  useEffect(() => {
    let batal = false;
    const muat = () => {
      Promise.all([
        loadGeserHeader(geserHeaderKey(tableKey)),
        loadSakelarGestur(seretSalinKey(tableKey)),
        loadSakelarGestur(seretPindahKey(tableKey)),
      ]).then(([h, salin, pindah]) => {
        if (batal) return;
        setGeserHeader(h);
        setSeretSalin(salin);
        setSeretPindah(pindah);
      });
    };
    muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) muat();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    return () => {
      batal = true;
      window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    };
  }, [tableKey]);

  /** Ubah satu sakelar gestur + simpan ke pref perangkatnya. */
  const ubahSakelarGestur = useCallback(
    (key: string, nyala: boolean, set: (v: boolean) => void) => {
      set(nyala);
      prefSet(key, nyala ? '1' : '').catch(() => {});
      kabariTampilanPerangkat(tableKey);
    },
    [tableKey],
  );

  const ubahGeserHeader = useCallback(
    (aktif: boolean) => ubahSakelarGestur(geserHeaderKey(tableKey), aktif, setGeserHeader),
    [ubahSakelarGestur, tableKey],
  );

  /** Gestur seret isi sel yang berlaku sekarang, atau null = tak ada.
   *
   *  Copy & Move EKSKLUSIF: cara gesture-nya sama persis (tekan-tahan blok
   *  lalu geser), yang membedakan cuma akibat akhirnya. Jadi satu mode
   *  aktif untuk dua-duanya — modifier (Ctrl/Cmd) tak lagi dipakai. */
  const modeSeret: ModeSeret | null = seretSalin ? 'salin' : (seretPindah ? 'pindah' : null);

  const isiLebarAktif = useIsiLebar(tableKey, isiLebarPenuh);

  const geserHeaderHidup = geserHeader && modeUbah && !isiLebarAktif;
  const seretIsiHidup = modeSeret !== null && modeUbah;

  /** Nyalakan SALIN atau PINDIH — keduanya saling mematikan, jadi tak pernah
   *  menyala dua-duanya. Menoncentang yang aktif mematikan KEDUA-nya
   *  (kembal ke "tak ada seret isi sel"), karena itu keadaan bawaannya. */
  const ubahSeretIsi = useCallback(
    (mode: ModeSeret, nyala: boolean) => {
      const salin = mode === 'salin' ? nyala : false;
      const pindah = mode === 'pindah' ? nyala : false;
      setSeretSalin(salin);
      setSeretPindah(pindah);
      prefSet(seretSalinKey(tableKey), salin ? '1' : '').catch(() => {});
      prefSet(seretPindahKey(tableKey), pindah ? '1' : '').catch(() => {});
      kabariTampilanPerangkat(tableKey);
    },
    [tableKey],
  );

  visibleFieldsRef.current = visibleFields;
  const wrapRef = useRef<HTMLDivElement>(null);

  const jumlahKolomLalu = useRef(visibleFields.length);
  const [generasiKolom, setGenerasiKolom] = useState(0);
  if (visibleFields.length < jumlahKolomLalu.current) {
    setGenerasiKolom((g) => g + 1);
  }
  jumlahKolomLalu.current = visibleFields.length;

  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;

  const fontChoice = FONT_OPTIONS.find((f) => f.value === fontFamily);
  const [fontStack, fontStackWeight] =
    fontChoice && fontChoice.value !== FONT_FAMILY_DEFAULT
      ? fontChoice.value.split('|')
      : ['', ''];

  /** Tulis urutan hasil geser ke SUMBER YANG SEDANG AKTIF, supaya tabel dan
   *  Kelola Tabel selalu sinkron:
   *  - preset kolom bernama -> susunan `kolom` preset itu (tab Kolom);
   *  - susunan PRIBADI ("Lengkap kustom", mis. kolom yang dipilih sendiri
   *    tanpa preset bernama) -> susunan itu pula, bukan urutan global;
   *  - tanpa susunan apa pun -> `toolbar_preset.urutan` global, yang juga
   *    dibaca `visibleFields` di atas.
   *
   *  Dua sumber pertama WAJIB: `visibleFields` mengikuti susunan yang aktif,
   *  jadi menulis ke urutan global saat susunan pribadi aktif membuat geseran
   *  judul tidak terlihat sama sekali (kolom kembali ke tempat semula walau
   *  server sudah berubah). Preset dari halaman (`presetLuar`) tak bisa
   *  ditulis dari sini — halaman pemiliknya yang mengatur; itu tetap ke
   *  urutan global. */
  const simpanUrutanKolom = useCallback(
    (urutan: string[]) => {
      if (presetIdAktif !== null && presetKeys !== null) {
        void updatePresetTabel(presetIdAktif, { kolom: urutan })
          .then(() => {

            setPresetKeysDalam(urutan);
            kabariPreset(tableKey);
            kabariTampilanPerangkat(tableKey);
          })
          .catch((e: unknown) => toast.error(errorMessage(e)));

        setPresetKeysDalam(urutan);
        return;
      }
      if (!luar && presetKeys !== null) {
        void setPresetAktif(tableKey, null, urutan)
          .then(() => {
            setPresetKeysDalam(urutan);
            kabariPreset(tableKey);
            kabariTampilanPerangkat(tableKey);
          })
          .catch((e: unknown) => toast.error(errorMessage(e)));
        setPresetKeysDalam(urutan);
        return;
      }
      simpanUrutan(urutan);
    },
    [presetIdAktif, presetKeys, tableKey, simpanUrutan, luar],
  );

  const { status: statusSeret } = useSeretKolomHeader({
    terlihat: visibleFields.map((f) => f.key),
    wrapRef,

    aktif: geserHeaderHidup,
    onPindah: simpanUrutanKolom,
  });

  (window as unknown as Record<string, number>).__rend = ((window as unknown as Record<string, number>).__rend ?? 0) + 1;

  /** Diisi di bawah setelah tanda tinggi baris dihitung; dibaca gerbang lebar
   *  kolom agar tampilan pertama menunggu remount grid selesai (anti kedip). */
  const remountTertundaRef = useRef(true);

  /** Manajemen lebar kolom: state widths/autoWidths, persistensi, penahan
   *  lebarStabil, seret gagang, AutoFit, lebar Aksi, tinggi header otomatis. */
  /** Rasio skala "lebar mengisi wadah" yang sedang dipakai (1 = tak diskalakan).
   *  Dibaca seret gagang lebar: lebar TAMPIL = lebar basis × rasio, jadi
   *  gerakan kursor harus dibagi rasio agar kolom tetap menempel di kursor. */
  const skalaIsiRef = useRef(1);
  const {
    widths,
    sedangLebar,
    autoWidths,
    tampilGrid,
    headerAutoH,
    syncAutoWidths,
    startResize,
    onAutoFit,
    onAutoFitAll,
    fitActionsIfNeeded,
  } = useLebarKolom<T>({
    tableKey,
    fields,
    fieldsRef,
    rows,
    rowsRef,
    getValuesRef,
    remountTertundaRef,
    gridByIdRef,
    visibleFields,
    wrapRef,
    getSelectedColumnKeys: () => selectedColumnKeys(),
    labelKolom,
    hideActions: sembunyiAksi,
    hideCheckbox: sembunyiCentang,
    loading,
    headerH,
    fontPx,
    fontFamily,
    effectiveFont,
    fontStack,
    fontStackWeight,
    skalaRef: skalaIsiRef,
  });

  /** Lebar efektif area gulir (sudah dipotong scrollbar vertikal) — dasar
   *  penskalaan "lebar mengisi wadah". 0 = belum terukur. */
  const lebarWadah = useLebarWadah(wrapRef, isiLebarAktif);

  /** Lebar kolom data hasil skala rasio agar tabel mengisi wadah. `null` =
   *  pakai lebar basis apa adanya (fitur mati / wadah belum terukur). */
  const skalaIsi = useMemo(() => {
    if (!isiLebarAktif || lebarWadah <= 0) return null;
    /** Kolom tetap = chrome tabel yang lebarnya tak ikut diskalakan, plus
     *  overhang gagang seret kolom terakhir (kalau tidak dipotong, gulir
     *  horizontal muncul sendiri 5 px). */
    const lebarTetap = GUTTER_W
      + (sembunyiCentang ? 0 : CHECK_W)
      + (sembunyiAksi ? 0 : (widths.__aksi ?? autoWidths.__aksi ?? ACTIONS_DEFAULT_W))
      + RESIZER_OVERHANG;
    const kolom = visibleFields.map((f) => ({
      key: f.key,
      lebar: widths[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150,
    }));
    return skalaLebarIsi(kolom, lebarWadah, lebarTetap);
  }, [isiLebarAktif, lebarWadah, visibleFields, widths, autoWidths, syncAutoWidths, sembunyiCentang, sembunyiAksi]);
  skalaIsiRef.current = skalaIsi?.rasio ?? 1;

  /** Gerbang macet: `tampilGrid` false lebih dari 800ms. Jendela flash
   *  remount normal hanya ~2 bingkai (kartu kosong cukup) — kerangka skeleton
   *  baru ditampilkan bila penahanan berlarut (tabel yang semua kolomnya
   *  memang ~100px, atau mount awal yang lambat). */
  const [gateLama, setGateLama] = useState(false);
  useEffect(() => {
    if (tampilGrid) {
      setGateLama(false);
      return;
    }
    const t = setTimeout(() => setGateLama(true), 800);
    return () => clearTimeout(t);
  }, [tampilGrid, tableKey]);

  /** Tinggi baris per tabel: tinggi dasar + ikut isi + sisa tinggi manual
   *  per baris dari setelan lama. */
  const {
    manual: tinggiBarisManual,
    sigManual: sigTinggiBarisManual,
    autoIkut: barisIkutIsi,
    setAutoIkut: setBarisIkutIsi,
    dasar: tinggiBarisDasar,
    setDasar: setTinggiBarisDasar,
    resetBaris: resetTinggiBaris,
    resetSemua: resetSemuaTinggiBaris,
  } = useTinggiBaris(tableKey);

  /** Perintah salin (menu konteks, ribbon, Ctrl+C) + pemetaan kolom grid. */
  const {
    selectedColumnKeys,
    displayOf,
    salinBarisCtx,
    salinSelCtx,
    salinKolomCtx,
    salinSemuaCtx,
    salinFisik,
    teksSalinan,
  } = useSalinTabel<T>({
    hideCheckbox: sembunyiCentang,
    hideActions: sembunyiAksi,
    visibleFieldsRef,
    fieldsRef,
    rowsRef,
    gridValueRef,
    gridByIdRef,
    checkedIdsRef,
    rangeRef,
    labelKolom,
  });
  const [gridH, setGridH] = useState(() =>
    typeof window === 'undefined'
      ? 640
      : Math.max(280, Math.min(640, Math.floor(window.innerHeight * 0.72))),
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ukur = () => {
      const h = Math.floor(el.clientHeight);
      setGridH((prev) => (Math.abs(h - prev) < 1 || h <= 0 ? prev : h));
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tableKey]);

  const rowsSig = useMemo(() => rows.map((r) => String(r.id)).join('|'), [rows]);
  useEffect(() => {
    setCheckedIds(new Set());
    setRange(null);
  }, [rowsSig]);

  useEffect(() => {
    onCheckedChangeRef.current?.(rowsRef.current.filter((r) => checkedIds.has(r.id)));
  }, [checkedIds]);

  useEffect(() => {
    setRange(null);
  }, [visibleFields]);

  useEffect(() => {
    if (!((canEdit && modeUbah) || showInput)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      if (t?.closest?.('[data-part="header_tabel"]')) return;
      if (canEdit && modeUbah) setModeUbah(false);
      if (showInput) setInputMode(false);
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [canEdit, modeUbah, showInput, setModeUbah, setInputMode]);

  useEffect(() => {
    if (showInput) return;
    setDrafts((prev) => {
      if (!(INPUT_ROW_ID in prev)) return prev;
      const next = { ...prev };
      delete next[INPUT_ROW_ID];
      return next;
    });
  }, [showInput]);

  useEffect(() => {
    if (!showInput) return;
    const raf = requestAnimationFrame(() => {
      const scroller = wrapRef.current?.querySelector<HTMLElement>('.dsg-container');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [showInput]);

  /** Salin (Ctrl/Cmd+C) — listener capture, lihat useSalinClipboard. */
  useSalinClipboard({ wrapRef, rangeRef, teksSalinan, salinFisik });

  const effectiveH = tinggiBarisDasar ?? rowH ?? TINGGI_BARIS_BAWAAN;

  /** Tinggi satu baris grid: manual → ikut isi → dasar kerapatan. */
  const tinggiBarisSatuan = useTinggiBarisSatuan({
    wrapRef,
    effectiveH,
    effectiveFont,
    visibleFields,
    widths,
    autoWidths,
    syncAutoWidths,
    tinggiBarisManual,
    barisIkutIsi,
    maxRows,
  });

  const headerEfektifH = headerKolomTampil ? (headerH ?? headerAutoH ?? DEFAULT_HEADER_H) : 0;

  const barisIsi = Math.min(Math.max(rows.length, 1), maxRows ?? 0);

  const memuatKompak = loading && maxRows !== undefined;
  /** Tampilkan kerangka tabel (bukan grid) selama data belum siap. */
  const pakaiMemuat = memuatKompak || (loading && rows.length === 0);

  const gridHeight = maxRows === undefined
    ? gridH
    : memuatKompak
      ? tinggiCache.get(tableKey) ?? headerEfektifH + 1 + maxRows * effectiveH
      : rows.length === 0 && !showInput
        ? 280
        : headerEfektifH + 1 + (barisIsi + (showInput ? 1 : 0)) * effectiveH;

  useEffect(() => {
    if (maxRows !== undefined && !loading && gridHeight > 0) {
      tinggiCache.set(tableKey, gridHeight);
    }
  }, [tableKey, maxRows, loading, gridHeight]);

  /** Sel boleh diedit: mode Ubah menyala DAN tabelnya writable. Tabel
   *  read-saja bisa menyalakan mode Ubah untuk fitur manipulasi saja —
   *  `editing` tetap false, jadi tak ada sel yang bisa dibuka editornya. */
  const editing = canEdit && modeUbah;

  const editableKeys = useMemo(
    () => visibleFields.filter((f) => f.kind !== 'static').map((f) => f.key),
    [visibleFields],
  );

  /** Mode Ubah boleh dihidupkan? Tabel read-saja pun boleh, asal punya
   *  fitur manipulasi (mis. seret isi sel pada matriks jadwal). */
  const bolehModeUbah = canEdit || onSeretIsi !== undefined
    || onSalinBlok !== undefined || onTempelBlok !== undefined;

  /** Buka editor untuk sel aktif (sinyal Enter ke DSG). Aman dipanggil ulang:
   *  bila editor sudah terbuka/fokus, tidak melakukan apa-apa. */
  function openEditorForActiveCell() {
    if (hasOpenEditor()) return;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  /** Klik 1× sel saat mode Ubah: buka editor sel (sel sudah aktif dari
   *  mousedown). */
  function openEditorByClick() {
    if (!canEdit || !modeUbah) return;
    openEditorForActiveCell();
  }

  /** Klik 2× sel: nyalakan Mode Ubah + (bila tabelnya writable) buka editor
   *  sel itu.
   *
   *  Dijalankan lewat event dblclick (bukan mousedown detail) agar andal di
   *  semua WebView; dispatch Enter ditunda hingga kolom DSG ikut ter-update.
   *
   *  Gerbangnya `bolehModeUbah`, BUKAN `canEdit`: tabel read-saja yang punya
   *  fitur manipulasi (mis. matriks jadwal dengan `onSeretIsi`) juga punya
   *  tombol Mode Ubah di kaki tabel, jadi klik ganda harus menyalakannya
   *  dengan cara yang sama — kalau tidak, satu-satunya jalan masuk ke mode
   *  itu jadi klik tombol, tidak konsisten dengan tabel lain. Tabel read-saja
   *  tak punya editor sel, jadi setelah mode menyala functinya berhenti di
   *  situ. */
  function enableEditByDoubleClick() {
    if (!bolehModeUbah) return;
    if (!modeUbah) setModeUbah(true);
    if (!canEdit) return;
    setTimeout(openEditorForActiveCell, 0);
    setTimeout(openEditorForActiveCell, 80);
  }

  /** Nilai grid = baris server ditimpa draft lokal + checklist. Baris input
   *  (mode Input) ditambahkan sebagai baris terakhir dengan id sintetis. */
  const gridValue: GridRow[] = useMemo(() => {
    const out = rows.map((r) => {
      const base = getValues(r);
      const d = drafts[String(r.id)] ?? {};
      const g: GridRow = { id: r.id, checked: checkedIds.has(r.id) };
      for (const f of fields) {
        g[f.key] = d[f.key] !== undefined ? d[f.key] : (base[f.key] ?? null);
      }
      return g;
    });
    if (showInput) {
      const d = drafts[INPUT_ROW_ID] ?? {};
      const g: GridRow = { id: INPUT_ROW_ID, checked: false };
      for (const f of fields) {
        g[f.key] = d[f.key] !== undefined ? d[f.key] : (inputRowValues?.[f.key] ?? null);
      }
      out.push(g);
    }
    return out;

  }, [rows, drafts, checkedIds, fields, getValues, showInput, inputRowValues]);

  /** Urutan id kolom grid (termasuk centang & Aksi) — indeks seleksi DSG. */
  function kunciKolomGrid(): string[] {
    return [
      ...(sembunyiCentang ? [] : ['check']),
      ...visibleFields.map((f) => f.key),
      ...(sembunyiAksi ? [] : ['__aksi']),
    ];
  }

  /** Susun blok dari rentang indeks baris/kolom grid. Baris input & kolom
   *  non-data dilewati; null bila tak ada sel data yang tersisa. */
  function susunBlok(r0Awal: number, r1Awal: number, c0Awal: number, c1Awal: number) {
    const r0 = Math.max(0, Math.min(r0Awal, r1Awal));
    const r1 = Math.min(gridValue.length - 1, Math.max(r0Awal, r1Awal));
    if (r1 < r0) return null;
    const keys = kunciKolomGrid();
    const c0 = Math.max(0, Math.min(c0Awal, c1Awal));
    const c1 = Math.min(keys.length - 1, Math.max(c0Awal, c1Awal));
    const fieldsBlok: ExcelField[] = [];
    for (let c = c0; c <= c1; c++) {
      const key = keys[c];
      if (key === 'check' || key === '__aksi') continue;
      const f = visibleFields.find((v) => v.key === key);
      if (f) fieldsBlok.push(f);
    }
    if (fieldsBlok.length === 0) return null;
    const rowsBlok: T[] = [];
    for (let r = r0; r <= r1; r++) {
      const g = gridValue[r];
      if (!g || String(g.id) === INPUT_ROW_ID) continue;
      const domain = rowsRef.current.find((x) => String(x.id) === String(g.id));
      if (domain) rowsBlok.push(domain);
    }
    if (rowsBlok.length === 0) return null;
    return { rows: rowsBlok, fields: fieldsBlok, jumlah: rowsBlok.length * fieldsBlok.length };
  }

  /** Blok seleksi untuk aksi massal halaman (mis. isi mapel & guru banyak
   *  sel sekaligus). */
  const blokSeleksi = (() => {
    if ((!onIsiBlok && !onKosongkanBlok) || range === null) return null;
    return susunBlok(range.min.row, range.max.row, range.min.col, range.max.col);
  })();

  /** Tinggi tiap baris grid (satu kali hitung per render, dipakai ulang di
   *  bawah agar tidak mengukur dua kali). */
  const tinggiPerBaris = useMemo(() => {
    const out: number[] = [];
    for (const g of gridValue) out.push(tinggiBarisSatuan(g));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridValue, tinggiBarisSatuan, sigTinggiBarisManual]);

  /** Kasus umum (hampir semua refresh/pagination): SEMUA baris sama tinggi.
   *  Offset DSG (= indeks × tinggi) tak bergantung urutan/isinya, jadi remount
   * penuh (sumber flash 100px: ke kanan lalu ke kiri) TIDAK diperlukan —
   *  cukup angka tinggi tunggal. Hanya saat ada baris beda tinggi DSG butuh
   *  fungsi per baris + remount. */
  const tinggiSeragam = tinggiPerBaris.length > 0 && tinggiPerBaris.every((h) => h === tinggiPerBaris[0]);

  /**
   * `rowHeight` DSG: angka bila seragam/kosong (jalur cepat, tanpa remount),
   * fungsi bila tinggi variabel — jalur variabel DSG melempar `undefined.top`
   * bila `value` kosong, jadi tabel kosong tetap memakai angka.
   */
  const gridRowHeight = useMemo(
    () => (tinggiSeragam ? tinggiPerBaris[0] : (gridValue.length === 0
      ? effectiveH
      : ({ rowData }: { rowData: GridRow }) => tinggiBarisSatuan(rowData))),
    [tinggiSeragam, tinggiPerBaris, gridValue.length, effectiveH, tinggiBarisSatuan],
  );

  /** Tanda tinggi baris saat ini. Jalur seragam memakai satu angka sehingga
   *  pengurutan ulang/pagination dengan tinggi sama TIDAK mengubah tanda
   *  (sebelumnya: urutan beda → string beda → remount sia-sia + flash). */
  const sigTinggiBaris = useMemo(() => {
    if (tinggiPerBaris.length === 0) return 'kosong';
    if (tinggiSeragam) return `seragam:${tinggiPerBaris[0]}`;
    return tinggiPerBaris.join(',');
  }, [tinggiPerBaris, tinggiSeragam]);

  /**
   * Tanda remount yang DIPAKAI `key` grid.
   *
   * DSG meng-cache offset baris dan tidak pernah membersihkannya sendiri,
   * jadi tinggi baru hanya terlihat setelah grid di-remount. Namun remount
   * tiap frame membuat kedipan: lebar kolom diukur ulang dan
   * posisi scroll hilang (gejala "lebar kolom melompat" saat lebar kolom
   * digeser). Karena itu:
   * - tinggi **manual** per baris (setelan tersimpan) langsung dipakai;
   * - tinggi **otomatis** (perubahan lebar kolom/data) ditunda ~180 ms sampai
   *   semua gerakan selesai, sehingga hanya terjadi satu remount di akhir.
   */
  const sigRemount = `${sigTinggiBaris}|${sigTinggiBarisManual}`;
  const [sigAktif, setSigAktif] = useState(sigRemount);

  remountTertundaRef.current = sigAktif !== sigRemount;
  const sigManualTerakhir = useRef(sigTinggiBarisManual);
  useEffect(() => {
    if (sigManualTerakhir.current !== sigTinggiBarisManual) {
      sigManualTerakhir.current = sigTinggiBarisManual;
      setSigAktif(sigRemount);
      return;
    }

    if (sedangLebar) return;
    const t = setTimeout(() => setSigAktif(sigRemount), 120);
    return () => clearTimeout(t);
  }, [sigRemount, sigTinggiBarisManual, sedangLebar]);

  /** Posisi gulir disimpan agar pulih setelah remount. */
  const scrollPos = useRef({ top: 0, left: 0 });
  const simpanScroll = useCallback(() => {
    const el = wrapRef.current?.querySelector('.dsg-container') as HTMLElement | null;
    if (el) scrollPos.current = { top: el.scrollTop, left: el.scrollLeft };
  }, []);
  useLayoutEffect(() => {
    const el = wrapRef.current?.querySelector('.dsg-container') as HTMLElement | null;
    if (!el) return;
    el.scrollTop = scrollPos.current.top;
    el.scrollLeft = scrollPos.current.left;
  }, [sigAktif]);

  function handleChange(newValue: GridRow[]) {    const base = new Map<string, T>(rowsRef.current.map((r) => [String(r.id), r]));
    const nd: Drafts = {};
    const nc = new Set<T['id']>();
    for (const g of newValue) {
      const id = g.id as T['id'];

      if (String(g.id) === INPUT_ROW_ID) {
        const d: Record<string, string | null> = {};
        for (const f of fieldsRef.current) {
          if (f.kind === 'static' && !f.inputKind) continue;
          const cur = (g[f.key] as string | null) ?? null;
          if (cur !== null && cur !== '') d[f.key] = cur;
        }
        inputDraftRef.current = d;
        if (Object.keys(d).length > 0) nd[INPUT_ROW_ID] = d;
        continue;
      }
      if (g.checked) nc.add(id);
      const b = base.get(String(g.id));
      if (!b) continue;
      const d: Record<string, string | null> = {};
      for (const k of editableKeys) {
        const cur = (g[k] as string | null) ?? null;
        const orig = getValues(b)[k] ?? null;
        if ((cur ?? '') !== (orig ?? '')) d[k] = cur;
      }
      if (Object.keys(d).length > 0) nd[String(g.id)] = d;
    }
    setCheckedIds(nc);
    setDrafts(nd);

    for (const [idKey, flds] of Object.entries(nd)) {
      if (idKey === INPUT_ROW_ID) continue;
      enqueueSave(idKey, flds);
    }
  }

  /** Pembungkus STABIL untuk DSG (yang di-memo): identitasnya tidak pernah
   *  berubah antar render, isinya selalu handler terbaru via ref. Tanpa ini
   *  setiap render ExcelTable (mis. ketikan pencarian di halaman) mengganti
   *  identitas `onChange`/`onScroll` sehingga memo DSG jebol dan seluruh grid
   *  di-render ulang — padahal data tidak berubah. */
  const handleChangeRef = useRef<(v: GridRow[]) => void>(() => {});
  handleChangeRef.current = handleChange;
  const handleChangeStable = useCallback((v: GridRow[]) => handleChangeRef.current(v), []);

  /** Seleksi blok aktif; tanpa seleksi, sel aktif tunggal yang jadi sumber. */
  const seleksiSeret = useMemo<GridSelection | null>(() => {
    if (range !== null) return range;
    const aktif = gridRef.current?.activeCell;
    if (!aktif) return null;
    return { min: { row: aktif.row, col: aktif.col }, max: { row: aktif.row, col: aktif.col } };
  }, [range]);

  const terapkanSeretIsi = useCallback(
    (sumber: BlokIsi, target: BlokIsi, mode: ModeSeret) => {

      const kunciKolom = kunciKolomGrid();
      if (onSeretIsi) {
        onSeretIsi({ mode, sumber, target, kunciKolom, rows: rowsRef.current });
        return;
      }
      const baru = terapkanSeret(gridValueRef.current, sumber, target, kunciKolom, mode);
      handleChangeStable(baru);
      toast.success(mode === 'pindah' ? 'Isi sel dipindahkan.' : 'Isi sel disalin.');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSeretIsi, handleChangeStable],
  );
  useSeretIsiSel(wrapRef, {

    aktif: seretIsiHidup,
    mode: modeSeret,
    bisaTulis: onSeretIsi !== undefined || (canEdit && editableKeys.length > 0),
    onTerapkan: terapkanSeretIsi,
  }, {
    kunciKolom: kunciKolomGrid(),
    jumlahBaris: gridValue.length,
    seleksi: seleksiSeret,
  });

  const salinTempelBlokHidup = modeUbah && (onSalinBlok !== undefined || onTempelBlok !== undefined);
  useSalinTempelBlok(wrapRef, {
    aktif: salinTempelBlokHidup,
    blokAktif: () => {
      const kunci = kunciKolomGrid();
      return blokDariSeleksi(seleksiSeret, kunci, gridValue.length);
    },
    kunciKolom: kunciKolomGrid,
    onSalin: (p) => {
      onSalinBlok?.({ blok: p.blok, kunciKolom: p.kunciKolom, rows: rowsRef.current });
    },
    onTempel: (p) => {
      onTempelBlok?.({ blok: p.blok, kunciKolom: p.kunciKolom, rows: rowsRef.current });
    },
  });
  /** Kolom beku menutupi konten yang digulir ke arahnya. Bila gulir horizontal
   *  berhenti di tengah kolom, kolom pertama di kanan area beku tampil
   *  terpotong. Setelah gulir berhenti, ratakan tepi kolom terdekat dengan
   *  tepi area beku supaya kolom selalu tampil utuh. */
  const snapBekuTimerRef = useRef<number | null>(null);
  function snapBekuSetelahGulir() {
    if (snapBekuTimerRef.current !== null) window.clearTimeout(snapBekuTimerRef.current);
    snapBekuTimerRef.current = null;
    if (freezeAktif <= 0 || sedangLebar) return;
    snapBekuTimerRef.current = window.setTimeout(() => {
      snapBekuTimerRef.current = null;
      const el = wrapRef.current;
      const cont = el?.querySelector<HTMLElement>('.dsg-container');
      if (!el || !cont) return;
      const beku = [...el.querySelectorAll<HTMLElement>(
        '.dsg-row-header .dsg-cell.dsg-cell-sticky-left, .dsg-row-header .dsg-cell.dsg-cell-gutter',
      )];
      if (beku.length === 0) return;
      const batas = Math.max(...beku.map((c) => c.getBoundingClientRect().right));

      if (batas >= cont.getBoundingClientRect().right - 1) return;
      const kolomKiri: number[] = [];
      el.querySelectorAll<HTMLElement>('.dsg-row-header .dsg-cell').forEach((c) => {
        if (c.classList.contains('dsg-cell-sticky-left')
          || c.classList.contains('dsg-cell-gutter')
          || c.classList.contains('dsg-cell-sticky-right')) return;
        const ht = c.querySelector<HTMLElement>('.simpes-dsg-headtitle[data-col-key]');
        if (!ht || ht.dataset.colKey === '__aksi') return;
        const r = c.getBoundingClientRect();
        if (r.width > 0) kolomKiri.push(r.left);
      });
      const target = targetGulirBeku(
        kolomKiri,
        batas,
        cont.scrollLeft,
        Math.max(0, cont.scrollWidth - cont.clientWidth),
      );
      if (target !== null && Math.abs(target - cont.scrollLeft) > 0.5) cont.scrollLeft = target;
    }, 140);
  }
  useEffect(() => () => {
    if (snapBekuTimerRef.current !== null) window.clearTimeout(snapBekuTimerRef.current);
  }, []);
  /** Freeze dinyalakan atau lebar kolom berubah: tepi area beku ikut bergeser,
   *  jadi ratakan lagi tanpa menunggu pengguna menggulir. */
  const snapBekuRef = useRef<() => void>(() => {});
  snapBekuRef.current = snapBekuSetelahGulir;
  useEffect(() => {
    if (freezeAktif > 0 && !sedangLebar) snapBekuRef.current();
  }, [freezeAktif, sedangLebar, widths, autoWidths, syncAutoWidths]);
  const handleScrollRef = useRef(() => {});
  handleScrollRef.current = () => { fitActionsIfNeeded(); simpanScroll(); snapBekuSetelahGulir(); };
  const handleScrollStable = useCallback(() => handleScrollRef.current(), []);
  const handleSelectionStable = useCallback(({ selection }: { selection: GridSelection | null }) => {
    setRange(selection);
  }, []);
  /** Baris dipilih lewat sel aktif (opt-in `onBarisKlik`): DSG melaporkan sel
   *  aktif, barisnya dipetakan lewat indeks ke `rows` — baris input selalu di
   *  paling bawah, jadi indeks baris data tetap sejajar. Pembungkus dibuat
   *  stabil (baca handler terbaru dari ref) supaya memo DSG tidak jebol. */
  const onBarisKlikRef = useRef(onBarisKlik);
  onBarisKlikRef.current = onBarisKlik;
  const handleActiveCellStable = useCallback(({ cell }: { cell: { row: number } | null }) => {
    if (cell === null) return;
    const r = rowsRef.current[cell.row];
    if (r) onBarisKlikRef.current?.(r);
  }, []);
  const rowClassNameStable = useCallback(({ rowIndex }: { rowIndex: number }) => {
    const r = gridValue[rowIndex];
    return cn(
      rowIndex === gridValue.length - 1 && 'simpes-dsg-row-last',
      r && String(r.id) === INPUT_ROW_ID && 'simpes-dsg-row-input',
      r && checkedIds.has(r.id) && 'simpes-dsg-row-checked',
      r && barisAktifId !== null && String(r.id) === String(barisAktifId) && 'simpes-dsg-row-aktif',
    );
  }, [gridValue, checkedIds, barisAktifId]);

  /** Draft baris input saja (dropdown bertingkat): identitasnya stabil selama
   *  yang berubah hanya draft baris data — lihat deps `dsgColumns`. */
  const inputDraft = drafts[INPUT_ROW_ID];

  const dsgColumns: Column<GridRow>[] = useMemo(() => {
    /** Kelas perataan kolom dari standar global tabel (bawaan tengah). */
    const alignClass = (key: string) =>
      alignEfektif(key) === 'right'
        ? 'simpes-dsg-align-right'
        : alignEfektif(key) === 'left'
          ? ''
          : 'simpes-dsg-align-center';
    const cols: Column<GridRow>[] = sembunyiCentang
      ? []
      : [
          {
            ...keyColumn<GridRow, 'checked'>('checked', checkboxColumn),
            component: CheckCell,
            id: 'check',
            title: <CheckAllCell />,
            basis: CHECK_W,
            grow: 0,
            shrink: 0,
            minWidth: CHECK_W,

            disabled: ({ rowData }: { rowData?: GridRow }) => String(rowData?.id) === INPUT_ROW_ID,
          },
        ];
    let idxData = 0;
    for (const f of visibleFields) {
      const iData = idxData++;

      const colDsg = cols.length;
      const bekuCls = iData < freezeAktif ? ' simpes-dsg-beku' : '';
      const tepiCls = iData === freezeAktif - 1 ? ' simpes-dsg-beku-tepi' : '';

      const lastCls = sembunyiAksi && iData === visibleFields.length - 1 ? ' simpes-dsg-col-last' : '';
      const isInputRow = (rowData?: GridRow) => showInput && String(rowData?.id) === INPUT_ROW_ID;
      const common = {
        id: f.key,
        title: (
          <HeaderTitle
            label={labelKolom(f.key, f.label)}
            colKey={f.key}
            required={f.required && showInput}
            noInput={showInput && f.kind === 'static' && !f.inputKind}
            onResizeStart={startResize}
            onResizePrev={
              iData > 0 && iData < freezeAktif
                ? (e) => startResize(visibleFields[iData - 1].key, e)
                : undefined
            }
            onAutoFit={onAutoFit}

            seretAktif={geserHeaderHidup}
            sedangDiseret={statusSeret?.dari === f.key}
          />
        ),
        headerClassName: cn(
          alignClass(f.key),
          bekuCls,
          tepiCls,
          lastCls,

          statusSeret?.tanda?.indeks === iData
            ? statusSeret.tanda.sisi === 'kiri'
              ? ' simpes-dsg-sisip-kiri'
              : ' simpes-dsg-sisip-kanan'
            : '',
        ),
        basis: skalaIsi?.lebar[f.key]
          ?? widths[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150,

        grow: 0,
        shrink: 0,
        minWidth: MIN_COL_W,
        cellClassName: ({ rowData }: { rowData?: GridRow }) =>
          cn(
            alignClass(f.key),
            bekuCls,
            tepiCls,
            lastCls,
            isInputRow(rowData) && 'simpes-dsg-baris-input',
            isInputRow(rowData) && f.required && !rowData?.[f.key] && 'simpes-dsg-wajib',
            draftsRef.current[String(rowData?.id)]?.[f.key] !== undefined && 'simpes-dsg-dirty',
            editing && (f.kind === 'static' ? 'simpes-dsg-readonly' : 'simpes-dsg-editable'),
            rowData ? f.cellClass?.(rowData) : undefined,
          ),
      };
      if (f.kind === 'static') {

        const isInputOnly = (rowData?: GridRow) => String(rowData?.id) === INPUT_ROW_ID;
        if (f.inputKind === 'select') {
          cols.push({
            ...common,
            component: InputStaticSelectCell,
            columnData: {
              fieldKey: f.key,
              choices: typeof f.inputChoices === 'function'
                ? f.inputChoices(inputDraft ?? {})
                : (f.inputChoices ?? f.choices ?? []),
              onEnter: (col: number) => inputEnterRef.current(col),
            },
            disableKeys: true,
            keepFocus: false,
            disabled: ({ rowData }: { rowData: GridRow }) => !isInputOnly(rowData),
            deleteValue: ({ rowData }) => rowData,
            copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
            pasteValue: ({ rowData }) => rowData,
            isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
          });
        } else if (f.inputKind === 'text') {
          cols.push({
            ...common,
            component: InputStaticTextCell,
            columnData: {
              fieldKey: f.key,
              maxLength: f.maxLength,
              onEnter: (col: number) => inputEnterRef.current(col),
            },
            disableKeys: false,
            keepFocus: false,
            disabled: ({ rowData }: { rowData: GridRow }) => !isInputOnly(rowData),
            deleteValue: ({ rowData }) => rowData,
            copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
            pasteValue: ({ rowData }) => rowData,
            isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
          });
        } else {
          cols.push({
            ...common,
            component: StaticCell,
            columnData: {
              fieldKey: f.key,
              render: f.renderCell,
              onClick: f.onCellClick,

              kartuHover: f.kartuHover === undefined
                ? undefined
                : (grid: GridRow) => {
                  const sumber = rowsRef.current.find((r) => String(r.id) === String(grid.id));
                  return f.kartuHover!({ ...(sumber as unknown as GridRow), ...grid });
                },

              onDblClick: () => {
                if (!showInput) enableEditByDoubleClick();
              },
            },
            disableKeys: false,
            keepFocus: false,
            disabled: true,
            deleteValue: ({ rowData }) => rowData,
            copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
            pasteValue: ({ rowData }) => rowData,
            isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
          });
        }
      } else if (f.kind === 'select') {
        const langsung = !!f.selectTanpaEdit;
        cols.push({
          ...common,

          component: SelectRadixCell,
          columnData: {
            fieldKey: f.key,
            choices: f.choices ?? [],
            choicesForRow: f.choicesForRow,
            bolehSelect: f.bolehSelect,
            choicesInput: typeof f.inputChoices === 'function'
              ? f.inputChoices(inputDraft ?? {})
              : (f.inputChoices ?? undefined),

            fokuskanSel: (id: string | number) => {
              const r = rowsRef.current.findIndex((x) => String(x.id) === String(id));
              if (r < 0) return;
              gridRef.current?.setActiveCell({ col: colDsg, row: r });
            },
            onEnter: (col: number) => inputEnterRef.current(col),

            onDblClick: (id: string | number) => {
              if (langsung || showInput || String(id) === INPUT_ROW_ID) return;
              enableEditByDoubleClick();
            },
            onClickCell: (id: string | number) => {
              if (String(id) === INPUT_ROW_ID) openEditorForActiveCell();
              else if (!langsung) openEditorByClick();
            },
          },
          disableKeys: true,
          keepFocus: false,
          disabled: ({ rowData }: { rowData: GridRow }) =>
            !(editing || isInputRow(rowData) || (langsung && canEdit)),
          deleteValue: ({ rowData }) => (editing ? ({ ...rowData, [f.key]: null }) as GridRow : rowData),
          copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
          pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) => {
            if ((editing || isInputRow(rowData)) && (f.choices ?? []).some((c) => c.value === value)) {
              return { ...rowData, [f.key]: value } as GridRow;
            }
            return rowData;
          },
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      } else if (f.kind === 'toggle') {
        cols.push({
          ...common,
          component: ToggleCell,
          columnData: { fieldKey: f.key, label: f.label, bisaEdit: canEdit || !!f.toggleTanpaEdit },
          disableKeys: true,
          keepFocus: false,
          disabled: ({ rowData }: { rowData: GridRow }) =>
            (!canEdit && !f.toggleTanpaEdit)
            || String(rowData.id) === INPUT_ROW_ID
            || (f.bolehToggle != null && !f.bolehToggle(rowData.id)),
          deleteValue: ({ rowData }) => ({ ...rowData, [f.key]: 'tidak' }) as GridRow,
          copyValue: ({ rowData }) => (rowData[f.key] === 'ya' ? 'ya' : 'tidak'),
          pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) =>
            ({
              ...rowData,
              [f.key]: ['', 'tidak', 'no', 'false', '0'].includes(value.trim().toLowerCase()) ? 'tidak' : 'ya',
            }) as GridRow,
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      } else {
        cols.push({
          ...common,
          component: TextCell,
          columnData: {
            fieldKey: f.key,
            maxLength: f.maxLength,
            renderView: f.renderCell,
            onEnter: (col: number) => inputEnterRef.current(col),

            onDblClick: (id: string | number) => {
              if (!showInput && String(id) !== INPUT_ROW_ID) enableEditByDoubleClick();
            },
            onClickCell: (id: string | number) => {
              if (f.onCellClick) { f.onCellClick(id); return; }
              if (String(id) === INPUT_ROW_ID) openEditorForActiveCell();
              else openEditorByClick();
            },
          },
          disableKeys: false,
          keepFocus: false,
          disabled: ({ rowData }: { rowData: GridRow }) =>
            !(editing || isInputRow(rowData)),
          deleteValue: ({ rowData }) => (editing ? ({ ...rowData, [f.key]: null }) as GridRow : rowData),
          copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
          pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) =>
            (editing || isInputRow(rowData) ? { ...rowData, [f.key]: value } : rowData) as GridRow,
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      }
    }
    return cols;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, visibleFields, editing, widths, autoWidths, syncAutoWidths, skalaIsi, showInput, freezeAktif, sembunyiCentang, labelKolom, alignEfektif, inputDraft]);

  /** Logika baris input (mode Input): draft, validasi, simpan, kursor. */
  const {
    inputDraftRef,
    inputEnterRef,
    inputAksiRef,
  } = useBarisInput({
    onCreateRow,
    visibleFieldsRef,
    inputRowValues,
    setDrafts,
    loading,
    gridValueRef,
    gridRef,
  });

  /** Kolom Aksi = kolom "sticky kanan" DSG: selalu ter-render & menempel di
   *  kanan saat grid di-scroll horizontal (freeze pane sisi kanan). */
  const aksiColumn: Column<GridRow> = useMemo(() => ({
    id: '__aksi',
    title: <HeaderTitle label="" colKey="__aksi" onResizeStart={startResize} onAutoFit={onAutoFit} />,
    basis: widths.__aksi ?? autoWidths.__aksi ?? ACTIONS_DEFAULT_W,
    grow: 0,
    shrink: 0,
    minWidth: ACTIONS_MIN_W,

    headerClassName: 'simpes-dsg-col-last',
    cellClassName: 'simpes-dsg-col-last simpes-dsg-col-aksi',
    component: ActionsCell,
    columnData: {
      ringkas: aksiRingkas && !aksiLangsung,
      render: (id: string | number) => {
        if (String(id) === INPUT_ROW_ID) {
          return (
            <ActionIcon
              id={`btn_simpan_input_${tableKey}`}
              title="Simpan baris baru"
              className="text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => inputAksiRef.current()}
            >
              <Save size={16} />
            </ActionIcon>
          );
        }
        const d = rowsRef.current.find((r) => String(r.id) === String(id));
        return d ? renderRef.current(d) : null;
      },
    },
    disableKeys: true,
    keepFocus: false,
    disabled: true,
    deleteValue: ({ rowData }: { rowData: GridRow }) => rowData,
    copyValue: () => null,
    pasteValue: ({ rowData }: { rowData: GridRow }) => rowData,
    isCellEmpty: () => true,

  }), [widths, autoWidths, tableKey, aksiRingkas, aksiLangsung, visibleFields]);

  /** Interaksi sel: drag centang, toggle centang, tutup editor saat pindah sel. */
  const { downPosRef, cegahSeleksiSelCentang, toggleCheckByCell, closeEditorOnOtherCell } = useInteraksiSel<T>({
    hideCheckbox: sembunyiCentang,
    wrapRef,
    rowsRef,
    editing,
    showInput,
    setCheckedIds,
  });

  /** Teks tampil (draft-merged) untuk TSV — lookup O(1) via Map. */
  const gridById = useMemo(() => {
    const m = new Map<string, GridRow>();
    for (const g of gridValue) m.set(String(g.id), g);
    return m;
  }, [gridValue]);

  gridByIdRef.current = gridById;
  gridValueRef.current = gridValue;

  /** Cari baris + kolom di bawah pointer. Target klik kanan bisa jatuh di
   *  padding sel atau lapisan seleksi DSG yang tidak membawa `data-col-key`,
   *  jadi turunkan dari sel terdekat / elemen lain di titik pointer. */
  function cariSelPointer(e: React.MouseEvent): { rowEl: HTMLElement | null; colKey: string | null } {

    const diTitik = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(e.clientX, e.clientY)
      : [];
    const kandidat: Element[] = [e.target as Element, ...diTitik];
    let rowCadangan: HTMLElement | null = null;
    for (const el of kandidat) {
      const sel = el.closest?.('.dsg-cell') as HTMLElement | null;
      const rowEl = (sel?.closest('.dsg-row:not(.dsg-row-header)')
        ?? el.closest?.('.dsg-row:not(.dsg-row-header)')) as HTMLElement | null;
      if (rowEl === null) continue;
      rowCadangan ??= rowEl;
      const colKey = el.closest?.('[data-col-key]')?.getAttribute('data-col-key')
        ?? sel?.querySelector('[data-col-key]')?.getAttribute('data-col-key')
        ?? null;
      if (colKey !== null) return { rowEl, colKey };
    }
    return { rowEl: rowCadangan, colKey: null };
  }

  /** Klik kanan di tabel: tentukan area (header kolom / baris / kosong).
   *  Area kosong tidak punya menu — preventDefault membatalkan penggeseran
   *  menu (Radix maupun menu bawaan WebView). */
  function onGridContextMenu(e: React.MouseEvent) {
    const t = e.target as HTMLElement;

    if (diCornerButton(t)) {
      setCtx({ area: 'sudut' });
      return;
    }
    const colKey = t.closest('[data-col-key]')?.getAttribute('data-col-key') ?? null;
    if (t.closest('.dsg-cell-header')) {
      const f = colKey ? fieldsRef.current.find((x) => x.key === colKey) : null;
      if (f) {
        setCtx({ area: 'header', colKey: f.key });
        return;
      }
      e.preventDefault();
      return;
    }
    const { rowEl, colKey: colKeyBaris } = cariSelPointer(e);
    if (rowEl) {

      const nomor = Number.parseInt(rowEl.querySelector('.dsg-cell-gutter')?.textContent ?? '', 10);
      const top = Number.parseFloat(rowEl.style.top || '0') || 0;
      const idx = Number.isFinite(nomor)
        ? nomor - 1
        : Math.round((top - headerEfektifH) / effectiveH);
      const g = gridValue[idx];
      if (g && String(g.id) !== INPUT_ROW_ID) {
        const domain = rowsRef.current.find((r) => String(r.id) === String(g.id));
        const rowLabel = domain ? displayOf(domain.id, visibleFieldsRef.current[0]?.key ?? '') || String(domain.id) : String(g.id);
        setCtx({ area: 'row', rowId: g.id as T['id'], rowLabel, colKey: colKeyBaris });
        return;
      }
    }
    e.preventDefault();
  }

  /** Status pilih-semua (context) — terpisah dari definisi kolom. */
  const checkAllState = useMemo<CheckAllState>(
    () => ({
      ids: rows.map((r) => r.id),
      checked: checkedIds as unknown as ReadonlySet<string | number>,
      setChecked: (s) => setCheckedIds(s as unknown as Set<T['id']>),
    }),
    [rows, checkedIds],
  );

  /** Buang kunci draft yang selesai/gagal — nilai sel kembali ke data server. */
  function dropDraft(idKey: string, keys: string[]) {
    setDrafts((prev) => {
      const left = { ...(prev[idKey] ?? {}) };
      for (const k of keys) delete left[k];
      const next = { ...prev };
      if (Object.keys(left).length === 0) delete next[idKey];
      else next[idKey] = left;
      return next;
    });
  }
  dropDraftRef.current = dropDraft;

  const hasFilter = filter !== undefined;
  const hasUrut = !!onUrut;
  /** Filter toolbar yang benar-benar tersedia di tabel ini — dipakai dialog
   *  Kelola Tabel untuk menyajikan sakelar per filter (hanya yang ada). */
  const filterTersedia = useMemo(
    () => filterToolbarTersedia({
      adaUrut: hasUrut,
      adaKolom: !hidePreset,

    }),
    [hasUrut, hidePreset],
  );

  const aksiMassal = renderBulkActions && checkedRows.length > 0
    ? renderBulkActions(checkedRows, clearSelection)
    : null;
  const infoHeader = tengah ?? null;
  /** Kontrol milik HALAMAN (bukan komponen tabel): tak punya sakelar, jadi tak
   *  ikut hilang saat "Visibilitas komponen tabel" dimatikan. Info tengah TIDAK
   *  termasuk — itu komponen tabel dengan sakelarnya sendiri. */
  const adaKontrolJudul = aksiMassal != null
    || awalanToolbar !== undefined
    || akhirToolbar !== undefined;
  const adaTombolAksi = addButton !== undefined && addButton !== null;

  const judulTampil = komponenAktif(visibilitas, 'judul_tabel');
  const infoTengahTampil = infoHeader != null && komponenAktif(visibilitas, 'info_tengah');
  const filterTampil = hasFilter && komponenAktif(visibilitas, 'filter');
  const urutTampil = hasUrut && komponenAktif(visibilitas, 'urutan');
  const kolomTampil = !hidePreset && komponenAktif(visibilitas, 'kolom');
  const tombolAksiTampil = adaTombolAksi && komponenAktif(visibilitas, 'tombol_aksi');
  const relFilterTampil = rail && komponenAktif(visibilitas, 'rel_filter');
  const pagerTampil = pager != null && komponenAktif(visibilitas, 'pager');
  const tombolPengaturanTampil = komponenAktif(visibilitas, 'tombol_pengaturan');
  const tombolTambahTampil = inputEnabled && komponenAktif(visibilitas, 'tombol_tambah');

  const sakelarMode: SakelarMode[] = [
    {
      id: `sakelar_seret_salin_${tableKey}`,
      label: 'Seret isi sel untuk copy',
      grup: GRUP_SERET_ISI,
      hint: 'Tekan-tahan blok terpilih lalu geser ke sel lain — isinya disalin ke sel tujuan.',
      checked: seretSalin,
      onCheckedChange: (nyala) => ubahSeretIsi('salin', nyala),
    },
    {
      id: `sakelar_seret_pindah_${tableKey}`,
      label: 'Seret isi sel untuk move',
      grup: GRUP_SERET_ISI,
      hint: 'Tekan-tahan blok terpilih lalu geser ke sel lain — isinya dipindah dan sel asal dikosongkan.',
      checked: seretPindah,
      onCheckedChange: (nyala) => ubahSeretIsi('pindah', nyala),
    },

    ...(isiLebarAktif ? [] : [{
      id: `sakelar_geser_judul_${tableKey}`,
      label: 'Geser judul kolom',
      grup: GRUP_SUSUNAN_KOLOM,
      hint: 'Tekan-tahan judul kolom lalu geser untuk menyusun ulang posisinya. Saat aktif, klik judul tidak lagi memblok satu kolom penuh.',
      checked: geserHeader,
      onCheckedChange: ubahGeserHeader,
    }]),
  ];

  const tombolEditTampil = bolehModeUbah && komponenAktif(visibilitas, 'tombol_edit');

  /** Bilah judul ADA di tabel ini? Ini fakta KEMAMPUAN (setelan visibilitas
   *  belum ikut dihitung) — dialog Kelola Tabel butuh tahu ini untuk menaruh
   *  sakelar yang benar-benar berarti, dan sakelar komponen yang sudah
   *  dimatikan pun harus tetap bisa dimunculkan lagi. */
  const adaBilahJudul = header !== undefined
    || adaKontrolJudul
    || adaTombolAksi

    || hasFilter
    || filterTersedia.length > 0

    || htmlAdaIsi(infoHtmlDb);
  /** Bilah judul dirender selama masih ada SATU pun isinya. Mematikan seluruh
   *  komponennya membuat bilah judul hilang, bukan sisanya menggantung;
   *  kontrol milik halaman (awalan/akhir toolbar, aksi massal) tetap
   *  mempertahankan bilah karena tak punya sakelar untuk dimatikan.
   *  `tombolPengaturanTampil` ikut dihitung supaya gerigi "Pengaturan tabel
   *  ini" — satu-satunya pintu Kelola Tabel dari tabel — tak ikut hilang
   *  bersama bilahnya saat semua komponen lain dimatikan. */
  const isiBilahTampil = adaKontrolJudul
    || judulTampil
    || htmlAdaIsi(infoHtmlDb)
    || infoTengahTampil
    || filterTampil
    || urutTampil
    || kolomTampil
    || tombolAksiTampil
    || tombolPengaturanTampil;
  const headerTampil = adaBilahJudul && isiBilahTampil;

  const judulHeader = judulDb?.trim() || header || judulTabel(tableKey);
  /** Kaki tabel dirender selama masih ada SATU pun komponennya. */
  const kakiTabelTampil = pagerTampil
    || tombolTambahTampil
    || tombolEditTampil;

  /** Komponen mana yang benar-benar ada — dikirim ke dialog Kelola Tabel supaya
   *  sakelar visibilitas yang tak berarti tak pernah tampil. Memoized supaya
   *  identitasnya stabil (tak memicu render ulang dialog tiap render grid).
   *
   *  PENTING: yang dikirim adalah fakta "tabel ini PUNYA komponen itu", bukan
   *  "komponen itu sedang tampil" — jadi sakelar untuk komponen yang sudah
   *  dimatikan pun tetap muncul (memcheckbox-nya harus bisa balikkan). */
  const infoKomponen = useMemo<InfoKomponenTabel>(() => ({
    adaBilahJudul: header !== undefined
    || adaKontrolJudul
    || adaTombolAksi
    || hasFilter
    || filterTersedia.length > 0,
    infoTengah: infoHeader != null,
    filter: hasFilter,
    cari: filterTersedia.includes('cari'),
    keaktifan: filterTersedia.includes('keaktifan'),
    urut: hasUrut,
    kolom: !hidePreset,
    tombolAksi: adaTombolAksi,
    relFilter: rail,
    pager: pager != null,
    tombolTambah: inputEnabled,
    tombolEdit: bolehModeUbah,
    kolomCentang: !hideCheckbox,
    kolomAksi: !hideActions,
  }), [
    adaKontrolJudul, adaTombolAksi, bolehModeUbah, filterTersedia,
    hasFilter, hasUrut, header, hideActions, hideCheckbox, hidePreset,
    infoHeader, inputEnabled, pager, rail,
  ]);

  const ctxHeader = ctx.area === 'header' ? ctx : null;
  const ctxRow = ctx.area === 'row' ? ctx : null;
  const ctxRowDomain = ctxRow
    ? rowsRef.current.find((r) => String(r.id) === String(ctxRow.rowId)) ?? null
    : null;
  const ctxRowAksi = ctxRowDomain
    ? flattenAksi(renderRef.current(ctxRowDomain)).concat(
      renderActionsKonteks === undefined ? [] : flattenAksi(renderActionsKonteks(ctxRowDomain)),
    )
    : [];
  const ctxHeaderLabel = ctxHeader
    ? labelKolom(ctxHeader.colKey, fieldsRef.current.find((f) => f.key === ctxHeader.colKey)?.label ?? ctxHeader.colKey)
    : '';

  const ctxHeaderIdx = ctxHeader
    ? visibleFields.findIndex((f) => f.key === ctxHeader.colKey)
    : -1;

  /** Blok yang ditawarkan saat klik kanan: seleksi aktif bila klik di dalamnya;
   *  sel yang diklik saja bila tanpa seleksi / klik di luar seleksi. */
  const blokCtx = (() => {
    if ((!onIsiBlok && !onKosongkanBlok) || ctxRow === null) return null;
    const keys = kunciKolomGrid();
    const rowIdx = gridValue.findIndex((g) => String(g.id) === String(ctxRow.rowId));
    const colIdx = keys.indexOf(ctxRow.colKey ?? '');
    if (rowIdx < 0 || colIdx < 0) return null;
    if (blokSeleksi !== null && range !== null) {
      const r0 = Math.min(range.min.row, range.max.row);
      const r1 = Math.max(range.min.row, range.max.row);
      const c0 = Math.min(range.min.col, range.max.col);
      const c1 = Math.max(range.min.col, range.max.col);
      if (rowIdx >= r0 && rowIdx <= r1 && colIdx >= c0 && colIdx <= c1) {
        return blokSeleksi;
      }
    }

    return susunBlok(rowIdx, rowIdx, colIdx, colIdx);
  })();

  return (
    <div className={cn(
      'flex flex-col',
      !headerTampil && 'mt-2',
      maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0',
    )}>
      <KonteksLebarFilter.Provider value={konteksLebarFilter}>
        {headerTampil ? (
          <JudulTabel
            tableKey={tableKey}
            judul={judulHeader}
            judulTampil={judulTampil}
            infoTabel={infoHtmlDb}
            infoTampil={infoTengahTampil}
            info={tengah}
            filterTampil={filterTampil}
            filter={filter}
            aksiMassal={aksiMassal}
            awalanToolbar={awalanToolbar}
            akhirToolbar={akhirToolbar}
            urutTampil={urutTampil}
            urutAktif={urutAktif}
            arahUrut={arahUrut}
            onUrut={onUrut}
            kolomTampil={kolomTampil}
            fields={fields}
            onApplyPreset={terapkanPreset}
            presetKolomClassName={presetKolomClassName}
            addButton={addButton}
            tombolAksiTampil={tombolAksiTampil}
            addButtonLangsung={addButtonLangsung}
            tombolPengaturanTampil={tombolPengaturanTampil}
            tabelTerdaftar={visHalaman?.registrasi != null}
            bolehKelola={bolehKelolaHalaman}
            onKelolaTabel={() => setKelolaTabelOpen(true)}
          />
        ) : null}       </KonteksLebarFilter.Provider>

      <div className={cn(relFilterTampil ? 'flex min-h-0 flex-1' : 'contents')}>
        {relFilterTampil ? <FilterRail tinggiLabel={headerEfektifH} /> : null}
      <div
        ref={wrapRef}
        style={
          {
            '--simpes-font-size': `${effectiveFont}px`,
            ...(fontStack
              ? { '--simpes-font-family': fontStack, '--simpes-font-weight': fontStackWeight }
              : {}),
          } as React.CSSProperties
        }
        onMouseDownCapture={(e) => {
          downPosRef.current = { x: e.clientX, y: e.clientY };
          closeEditorOnOtherCell(e);
          cegahSeleksiSelCentang(e);
        }}
        onClickCapture={toggleCheckByCell}
        className={cn(

          'simpes-dsg relative flex min-w-0 flex-col',

          headerTampil && 'simpes-dsg-bilah-judul',
          !headerTampil && '-mx-1 simpes-dsg-bleed',

          maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0',
          !editing && 'simpes-dsg-readonly',

          barisIkutIsi ? 'simpes-dsg-baris-ikut-isi' : 'simpes-dsg-baris-tetap',
        )}
      >

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'simpes-dsg-kartu relative flex flex-col overflow-hidden bg-card',

                maxRows !== undefined && 'transition-[height] duration-200 ease-out',
              )}
              style={{ height: gridHeight, visibility: tampilGrid ? undefined : 'hidden' }}
              onContextMenu={onGridContextMenu}
            >

              {loading && rows.length > 0 && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden="true">
                  <div className="simpes-muat-bar h-full bg-primary/70" />
                </div>
              )}
              {pakaiMemuat ? (
                <TabelMemuat rowH={effectiveH} baris={maxRows ?? 14} />
              ) : (
                <CheckAllContext.Provider value={checkAllState}>
                  <DataSheetGrid
                    key={`baris-${sigAktif}-kolom-${generasiKolom}`}
                    ref={gridRef}
                    value={gridValue}
                    onChange={handleChangeStable}
                    columns={dsgColumns}
                    gutterColumn={GUTTER_COLUMN}
                    stickyLeftColumnCount={freezeAktif > 0 ? freezeAktif + (sembunyiCentang ? 0 : 1) : 0}
                    stickyRightColumn={sembunyiAksi ? undefined : aksiColumn}
                    rowKey="id"
                    height={gridHeight}
                    rowHeight={gridRowHeight}

                    headerRowHeight={headerKolomTampil
                      ? (headerH ?? headerAutoH ?? DEFAULT_HEADER_H)
                      : 0}
                    lockRows
                    addRowsComponent={false}
                    disableContextMenu
                    rowClassName={rowClassNameStable}
                    onSelectionChange={handleSelectionStable}
                    onActiveCellChange={handleActiveCellStable}
                    onScroll={handleScrollStable}
                  />
                </CheckAllContext.Provider>
              )}
              {gridValue.length === 0 && !loading && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <p className="text-xs text-muted-foreground">{emptyText}</p>
                </div>
              )}

              <ScrollbarMelayang orientasi="vertikal" wadahRef={wrapRef} />
              <ScrollbarMelayang orientasi="horizontal" wadahRef={wrapRef} />
            </div>
          </ContextMenuTrigger>

          <MenuKonteksGrid
            tableKey={tableKey}
            header={ctxHeader}
            headerLabel={ctxHeaderLabel}
            headerIdx={ctxHeaderIdx}
            row={ctxRow}
            rowAksi={ctxRowAksi}
            blokJumlah={blokCtx?.jumlah}
            blokLabel={blokAksiLabel}
            onIsiBlok={blokCtx ? () => onIsiBlok!(blokCtx.rows, blokCtx.fields) : undefined}
            onKosongkanBlok={blokCtx && modeUbah && onKosongkanBlok
              ? () => onKosongkanBlok!(blokCtx.rows, blokCtx.fields)
              : undefined}
            kosongkanLabel={kosongkanBlokLabel}
            freezeAktif={freezeAktif}
            ubahFreeze={ubahFreeze}
            geserHeader={geserHeader}
            onUbahGeserHeader={ubahGeserHeader}
            geserHeaderTersedia={!isiLebarAktif}
            onAutoFit={onAutoFit}
            onAutoFitAll={onAutoFitAll}
            align={alignDb}
            onUbahAlign={simpanAlign}
            bolehKelola={bolehGeser}
            onKelolaTabel={bolehKelolaHalaman ? () => setKelolaTabelOpen(true) : undefined}
            salinBaris={(id) => void salinBarisCtx(id as T['id'])}
            salinSel={(id, key) => void salinSelCtx(id as T['id'], key)}
            salinKolom={(key) => void salinKolomCtx(key)}
            sudut={ctx.area === 'sudut'}
            onSalinSemua={() => void salinSemuaCtx()}
            onKonfirmasi={setCtxKonfirmasi}
            barisIkutIsi={barisIkutIsi}
            onUbahBarisIkutIsi={setBarisIkutIsi}
            onResetTinggiBaris={(rowId) => {
              if (rowId === null) {

                resetSemuaTinggiBaris();
                setTinggiBarisDasar(null);
              } else {
                resetTinggiBaris(String(rowId));
              }
            }}
            barisManualAda={
              Object.keys(tinggiBarisManual).length > 0 || tinggiBarisDasar !== null
            }
            barisManualBarisIni={ctxRow ? tinggiBarisManual[String(ctxRow.rowId)] !== undefined : false}
          />
        </ContextMenu>

        {(modeUbah || showInput) && (
          <div className="absolute right-3 bottom-3 z-20 flex flex-wrap items-end justify-end gap-1.5">
            {modeUbah && (
              <PillMode
                id={`banner_mode_edit_${tableKey}`}
                btnId={`btn_keluar_mode_edit_${tableKey}`}
                aksen="warning"
                ikon={<Pencil size={14} />}
                judul="Mode Ubah aktif"
                petunjuk={(canEdit
                  ? 'Sel tanpa garis bawah = bisa diedit. Centang gestur di atas untuk menyalakan seret isi sel atau geser judul kolom.'
                  : 'Sel tetap dibaca. Centang gestur di atas untuk menyalakan seret isi sel atau geser judul kolom.')

                  + (salinTempelBlokHidup
                    ? ' Pilih blok sel lalu Ctrl/Cmd+C untuk menyalin dan Ctrl/Cmd+V untuk menempel.'
                    : '')
                  + ' Tekan Esc untuk keluar.'}
                sakelar={sakelarMode}
                onKeluar={() => setModeUbah(false)}
              />
            )}
            {showInput && (
              <PillMode
                id={`banner_mode_input_${tableKey}`}
                btnId={`btn_keluar_mode_input_${tableKey}`}
                aksen="primary"
                ikon={<PlusCircle size={14} />}
                judul="Mode Input aktif"
                petunjuk="Isi baris paling bawah, lalu klik ikon simpan. Tekan Esc untuk keluar."
                onKeluar={() => setInputMode(false)}
              />
            )}
          </div>
        )}

        {!tampilGrid && (rows.length === 0 || gateLama) && (
          <div className="absolute inset-0 z-10" aria-hidden="true">
            <TabelMemuat rowH={effectiveH} />
          </div>
        )}

        <AlertDialog open={ctxKonfirmasi !== null} onOpenChange={(o) => { if (!o) setCtxKonfirmasi(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{ctxKonfirmasi?.title}</AlertDialogTitle>
              <AlertDialogDescription>{ctxKonfirmasi?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: 'destructive' }))}
                onClick={() => {
                  ctxKonfirmasi?.onConfirm();
                  setCtxKonfirmasi(null);
                }}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>

      {kakiTabelTampil ? (
      <div data-part="kaki_tabel" className="mt-0 flex shrink-0 items-center gap-0">
        {pagerTampil && pager ? <div className="min-w-0 flex-1">{pager}</div> : <div className="flex-1" />}

        <div data-part="grup_aksi" className="flex items-center">
          {tombolTambahTampil && !showInput && (
            <Button
              id={`btn_tambah_baris_${tableKey}`}
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Tambah baris baru"
              title="Tambah baris baru"
              onClick={() => setInputMode(true)}
            >
              <Plus size={14} />
            </Button>
          )}
          {tombolEditTampil && !modeUbah && (
            <Button
              id={`btn_mode_edit_${tableKey}`}
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Aktifkan mode Ubah"
              title="Aktifkan mode Ubah — mengedit sel & memanipulasi isi tabel (atau klik ganda sel)"
              onClick={() => setModeUbah(true)}
            >
              <Pencil size={14} />
            </Button>
          )}
        </div>
      </div>
      ) : null}

      {visHalaman?.registrasi ? (
        <DialogKelolaTabel
          open={kelolaTabelOpen}
          onOpenChange={setKelolaTabelOpen}
          tableKey={tableKey}
          judul={judulHeader}
          fields={fields}
          infoKomponen={infoKomponen}

          nonModal
        />
      ) : null}
    </div>
  );
}
