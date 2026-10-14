import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  checkboxColumn,
  keyColumn,
  type Column,
  type DataSheetGridRef,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { DENSITY_PX } from '@/prefs';
import { useTheme } from '@/theme';
import { isTauri, prefSet } from '@/api/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_FAMILY_DEFAULT, FONT_OPTIONS, useGridPrefs } from '@/components/GridPrefs';
import { useLembagaAktif } from '@/lembagaAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import FilterRail from '@/components/FilterRail';
import PopoverSettingTabel from './excel/PopoverSettingTabel';
import TombolTinggiBaris from './excel/TombolTinggiBaris';
import ScrollbarMelayang from './excel/ScrollbarMelayang';
import { gabungUrutan } from './excel/urutanKolom';
import { judulTabel } from './excel/judul';
import { useToolbarPresetState } from './excel/useToolbarPreset';
import { useUrutanKolom } from './excel/useUrutanKolom';
import { useLebarKolom } from './excel/useLebarKolom';
import { useTinggiBaris } from './excel/useTinggiBaris';
import { useTinggiBarisSatuan } from './excel/useTinggiBarisSatuan';
import { useSalinTabel } from './excel/useSalinTabel';
import { useSalinClipboard } from './excel/useSalinClipboard';
import { useInteraksiSel } from './excel/useInteraksiSel';
import { copyText, tulisPolosSinkron } from '@/lib/clipboard';
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

import { CheckAllCell, CheckAllContext, PillMode, TabelMemuat } from './excel/primitives';
import {
  ACTIONS_DEFAULT_W,
  ACTIONS_MIN_W,
  AKSI_RINGKAS,
  CHECK_W,
  GUTTER_W,
  INPUT_ROW_ID,
  MIN_COL_W,
  freezeKey,
  hasOpenEditor,
  loadFreeze,
  tinggiCache,
} from './excel/helpers';
import {
  InputStaticSelectCell,
  InputStaticTextCell,
  CheckCell,
  SelectCell,
  StaticCell,
  TextCell,
  ToggleCell,
} from './excel/cells';
import { HeaderTitle } from './excel/header';
import { useAntreanSimpan } from './excel/useAntreanSimpan';
import type { PresetKolomApi } from '@/components/PresetKolom';
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
  presetLuar?: { keys: string[] | null; label?: Record<string, string> | null; presetId?: number | null };
  /** Pemanggil menggambar bar judul sendiri (mis. `TabelRingkas`): grid
   *  tidak perlu jarak `mt-2` dari pemanggil maupun margin horizontal
   *  negatif `-mx-1` yang biasanya mengimbangi padding halaman. */
  judulPemilik?: boolean;
  /** Timpa lebar trigger dropdown Kolom (bawaan `w-44`), mis. tabel sempit. */
  presetKolomClassName?: string;
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
  /** Kontrol paginasi halaman (mis. `<Pager/>`). Dirender di kaki tabel
   *  SEBARIS dengan tombol tinggi baris; tanpa prop ini kaki tabel hanya
   *  berisi tombol tinggi baris. */
  pager?: ReactNode;
}

































type Drafts = Record<string, Record<string, string | null>>;

export default function ExcelTable<T extends { id: string | number }>({
  tableKey,
  fields,
  rows,
  getValues,
  loading = false,
  emptyText = 'Belum ada data.',
  canEdit,
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
  presetLuar,
  judulPemilik = false,
  presetKolomClassName,
  rail = false,
  onCheckedChange,
  onBarisKlik,
  barisAktifId = null,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  pager,
}: ExcelTableProps<T>) {
  const { density } = useTheme();
  const densityPx = DENSITY_PX[density];
  // Preferensi tampilan tabel global (dikontrol dari top bar).
  const { rowH, headerH, fontPx, fontFamily } = useGridPrefs();
  // Standar tampilan lembaga: lebar & kolom beku bawaan (bisa ditimpa user).

  const [editMode, setEditModeRaw] = useState(false);
  const [inputMode, setInputModeRaw] = useState(false);
  /** Mode tabel saling eksklusif: hanya satu boleh aktif. Mengaktifkan mode
   *  Edit mematikan mode Input, dan sebaliknya. */
  const setEditMode = useCallback((v: boolean) => {
    setEditModeRaw(v);
    if (v) setInputModeRaw(false);
  }, []);
  const setInputMode = useCallback((v: boolean) => {
    setInputModeRaw(v);
    if (v) setEditModeRaw(false);
  }, []);
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
  /** API preset kolom (dipakai menu klik kanan header: show/hide kolom). */
  const presetApiRef = useRef<PresetKolomApi | null>(null);
  /** Geser urutan kolom = super_admin EFEKTIF (global; mati saat bertindak). */
  const { efektifSuper: bolehGeser } = useLembagaAktif();
  const visHalaman = useVisibilitasFilter();
  const bolehKelolaHalaman = !!visHalaman?.registrasi && bolehGeser;
  const [kelolaTabelOpen, setKelolaTabelOpen] = useState(false);
  const { alignDb, urutanDb, setUrutanDb, simpanAlign, konteksLebarFilter } = useToolbarPresetState(tableKey);
  /** Baris input hanya tersedia bila halaman menyediakan onCreateRow.
   *  Tidak bergantung mode Edit: halaman boleh mendukung create saja. */
  const inputEnabled = !!onCreateRow;
  const showInput = inputEnabled && inputMode;

  const checkedRows = useMemo(() => rows.filter((r) => checkedIds.has(r.id)), [rows, checkedIds]);
  const clearSelection = useMemo(() => () => setCheckedIds(new Set<T['id']>()), []);

  const [presetKeysDalam, setPresetKeysDalam] = useState<string[] | null>(null);
  /** Id preset aktif (null = Lengkap/tanpa preset): urutan kolom mengikuti
   *  susunan preset; geser dari menu konteks menyimpan balik ke preset ini. */
  const [presetAktifIdDalam, setPresetAktifIdDalam] = useState<number | null>(null);
  /** Nama header kustom dari preset aktif (key kolom → nama tampil). */
  const [presetLabelDalam, setPresetLabelDalam] = useState<Record<string, string> | null>(null);
  // Bila dikendalikan luar, ketiga nilai di atas diabaikan sepenuhnya.
  const luar = presetLuar !== undefined;
  const presetKeys = luar ? presetLuar.keys : presetKeysDalam;
  const presetAktifId = luar ? (presetLuar.presetId ?? null) : presetAktifIdDalam;
  const presetLabel = luar ? (presetLuar.label ?? null) : presetLabelDalam;
  const terapkanPreset = useCallback((keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => {
    if (luar) return;
    setPresetKeysDalam(keys);
    setPresetLabelDalam(label ?? null);
    setPresetAktifIdDalam(presetId ?? null);
  }, [luar]);


  /** Nama tampilan kolom: label preset per tabel (kalau ada) > label field.
   *  Label berupa nama kolom mentah di-humanize supaya header tidak pernah
   *  tampil apa adanya; lihat `lib/labelKolom`. */
  const labelKolom = useCallback((key: string, bawaan: string) => (
    labelKolomTeks(presetLabel?.[key]?.trim() || bawaan || key)
  ), [presetLabel]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const dropDraftRef = useRef<(idKey: string, keys: string[]) => void>(() => {});
  const { enqueueSave } = useAntreanSimpan<T>({ rowsRef, fieldsRef, onCommitRef, onSavedRef, dropDraftRef });
  fieldsRef.current = fields;
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;
  const visibleFields = useMemo(() => {
    // Preset aktif: urutan kolom mengikuti susunan key di dalam preset.
    if (presetKeys !== null) {
      const byKey = new Map(fields.map((f) => [f.key, f]));
      const terpilih = presetKeys
        .map((k) => byKey.get(k))
        .filter((f): f is (typeof fields)[number] => !!f);
      if (terpilih.length > 0) return terpilih;
    }
    const dasar = fields;
    // Tanpa preset (Lengkap): urutan global tersimpan (super_admin) menata
    // ulang kolom; kolom yang tak ada di simpanan menempel di akhir.
    if (urutanDb !== null && urutanDb.length > 0) {
      const byKey = new Map(dasar.map((f) => [f.key, f]));
      const urut = gabungUrutan(urutanDb, dasar.map((f) => f.key));
      const hasil = urut.map((k) => byKey.get(k)).filter((f): f is (typeof dasar)[number] => !!f);
      return hasil.length > 0 ? hasil : dasar;
    }
    return dasar;
  }, [fields, presetKeys, urutanDb]);
  const visibleFieldsRef = useRef(visibleFields);
  /** Semua kolom beserta label efektif & status tampil — dipakai menu klik
   *  kanan header agar kolom bisa ditampilkan/disembunyikan dari sana. */
  const daftarKolom = useMemo(() => {
    const tampil = new Set(visibleFields.map((f) => f.key));
    return fields.map((f) => ({ key: f.key, label: labelKolom(f.key, f.label), tampil: tampil.has(f.key) }));
  }, [fields, visibleFields, labelKolom]);
  const gridRef = useRef<DataSheetGridRef>(null);

  // Muat jumlah kolom beku tabel ini; clamp bila preset menyembunyikan kolom.
  useEffect(() => {
    let batal = false;
    loadFreeze(freezeKey(tableKey)).then((n) => {
      if (!batal) setFreeze(n);
    });
    return () => {
      batal = true;
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
  visibleFieldsRef.current = visibleFields;
  const wrapRef = useRef<HTMLDivElement>(null);

  /** Geser & simpan urutan kolom dari menu konteks header. */
  const { geserKolom, kembalikanUrutan } = useUrutanKolom({
    tableKey,
    presetAktifId,
    // Saat preset dikendalikan luar, tulis ini tak berpengaruh visual (event
    // preset-berubah memuat ulang susunan dari server); persist API di dalam
    // hook tetap jalan sehingga tak ada yang hilang.
    setPresetKeys: setPresetKeysDalam,
    setUrutanDb,
    getVisibleKeys: () => visibleFieldsRef.current.map((f) => f.key),
    getFieldKeys: () => fieldsRef.current.map((f) => f.key),
  });

  // Ukuran huruf efektif + font stack (dibaca hook lebar & render).
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  // "keluarga|ketebalan"; bawaan = pakai font & ketebalan aplikasi.
  const fontChoice = FONT_OPTIONS.find((f) => f.value === fontFamily);
  const [fontStack, fontStackWeight] =
    fontChoice && fontChoice.value !== FONT_FAMILY_DEFAULT
      ? fontChoice.value.split('|')
      : ['', ''];

  /** Diisi di bawah setelah tanda tinggi baris dihitung; dibaca gerbang lebar
   *  kolom agar tampilan pertama menunggu remount grid selesai (anti kedip). */
  const remountTertundaRef = useRef(true);

  /** Manajemen lebar kolom: state widths/autoWidths, persistensi, penahan
   *  lebarStabil, seret gagang, AutoFit, lebar Aksi, tinggi header otomatis. */
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
    resetLebar,
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
    hideActions,
    hideCheckbox,
    loading,
    headerH,
    fontPx,
    fontFamily,
    effectiveFont,
    fontStack,
    fontStackWeight,
  });

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

  /** Tinggi baris per tabel: ikut isi + seret batas bawah baris (manual). */
  const {
    manual: tinggiBarisManual,
    sigManual: sigTinggiBarisManual,
    autoIkut: barisIkutIsi,
    setAutoIkut: setBarisIkutIsi,
    resetBaris: resetTinggiBaris,
    resetSemua: resetSemuaTinggiBaris,
    mulaiSeret: mulaiSeretBaris,
  } = useTinggiBaris(tableKey);

  /** Perintah salin (menu konteks, ribbon, Ctrl+C) + pemetaan kolom grid. */
  const {
    selectedColumnKeys,
    displayOf,
    salinBarisCtx,
    salinSelCtx,
    salinKolomCtx,
    salinSemuaCtx,
    onCopy,
    salinFisik,
    teksSalinan,
  } = useSalinTabel<T>({
    hideCheckbox,
    hideActions,
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

  // Tinggi grid mengikuti sisa ruang vertikal wrapper (flex-1 dari halaman).
  // useLayoutEffect: diukur SEBELUM cat sehingga kartu tidak sempat tampil
  // dengan tinggi tebakan awal lalu melompat ke tinggi asli. Observer tetap
  // terpasang pada elemen wrapper yang sama (tidak perlu dipasang ulang saat
  // loading/rows berubah) agar tinggi stabil saat pagination/refetch.
  //
  // Yang diukur wrapper-nya sendiri: wrapper mode isi-penuh memakai
  // `min-h-0 flex-1` (tanpa lantai tinggi tetap) sehingga `clientHeight`-nya
  // persis ruang tersedia. Dua jebakan yang membuat kartu melewati dasar panel
  // (bagian bawah tabel terpotong/meluber ke bawah area aplikasi):
  // (1) lantai `min-h-[280px]` menahan wrapper di 280 px saat panel resizable
  // lebih pendek dari itu; (2) mengukur PARENT-nya (root ExcelTable) malah ikut
  // menghitung bilah judul tabel (±28 px) yang bersaudara dengan wrapper —
  // kartu jadi lebih tinggi dari ruangnya sebesar tinggi judul itu.
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


  // Seleksi + range mengikuti data aktif. Hanya reset bila KUMPULAN ID berubah
  // (bukan tiap identitas array rows baru, mis. hasil pencarian yang sama).
  const rowsSig = useMemo(() => rows.map((r) => String(r.id)).join('|'), [rows]);
  useEffect(() => {
    setCheckedIds(new Set());
    setRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSig]);

  // Kabarkan baris tercentang ke halaman (mis. daftar pilihan klasifikasi
  // santri pada halaman siklus) tanpa harus mengelola centang sendiri.
  useEffect(() => {
    onCheckedChangeRef.current?.(rowsRef.current.filter((r) => checkedIds.has(r.id)));
  }, [checkedIds]);

  // Preset kolom berganti → seleksi kolom lama tidak relevan lagi.
  useEffect(() => {
    setRange(null);
  }, [visibleFields]);

  // Esc = langsung keluar dari mode Edit / mode Input (satu kali tekan), baik
  // saat fokus di grid maupun di editor sel (input/select) — listener capture
  // berjalan sebelum handler editor, lalu editor ikut ditutup komponennya.
  // Dialog/dropdown yang sedang terbuka tetap dikecualikan agar Esc menutupnya;
  // kotak filter di judul juga dikecualikan agar Esc saat mengetik tidak
  // keluar dari mode Edit/Input.
  useEffect(() => {
    if (!((canEdit && editMode) || showInput)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      if (t?.closest?.('[data-part="header_tabel"]')) return;
      if (canEdit && editMode) setEditMode(false);
      if (showInput) setInputMode(false);
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [canEdit, editMode, showInput]);

  // Keluar dari mode Input → draft baris input dibuang (tidak tersimpan).
  useEffect(() => {
    if (showInput) return;
    setDrafts((prev) => {
      if (!(INPUT_ROW_ID in prev)) return prev;
      const next = { ...prev };
      delete next[INPUT_ROW_ID];
      return next;
    });
  }, [showInput]);

  // Mode Input menyala → gulir grid ke baris input (paling bawah).
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






  const effectiveH = rowH ?? densityPx;

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

  // Tinggi header efektif (manual → terukur → bawaan). Dipakai untuk tinggi
  // tabel kompak agar header yang membungkus 2 baris (judul panjang) ikut
  // terhitung — dulu dipatok 1 baris sehingga tabel kompak kena scrollbar.
  const headerEfektifH = headerH ?? headerAutoH ?? DEFAULT_HEADER_H;
  // Tabel halaman (tanpa maxRows) mengisi penuh sisa tinggi wrapper sehingga
  // kartu menutupi seluruh area vertikal. Tabel kompak ber-maxRows berhenti
  // tepat di baris terakhir (+ baris input bila mode Input aktif); versi
  // kompak yang kosong tetap tinggi layak agar pesan "Tidak ada …" terbaca.
  const barisIsi = Math.min(Math.max(rows.length, 1), maxRows ?? 0);
  // Tabel kompak saat halaman masih memuat: tinggi placeholder DIPATOK pada
  // batas maksimum (maxRows) dan tidak ikut berubah saat data tiap seksi tiba,
  // supaya tabel di bawahnya tidak bergeser berkali-kali. Tinggi final
  // diterapkan sekali saat muat selesai.
  const memuatKompak = loading && maxRows !== undefined;
  /** Tampilkan kerangka tabel (bukan grid) selama data belum siap. */
  const pakaiMemuat = memuatKompak || (loading && rows.length === 0);
  // Tabel kompak TIDAK dibatasi `gridH`: tinggi wrapper kompak mengikuti isi
  // kartu, sehingga memakai `gridH` sebagai batas menciptakan umpan balik yang
  // membuat tinggi terpaku saat header membungkus (needed naik, gridH tertinggal
  // → scrollbar). Kebutuhan sudah dibatasi `maxRows`.
  const gridHeight = maxRows === undefined
    ? gridH
    : memuatKompak
      ? tinggiCache.get(tableKey) ?? headerEfektifH + 1 + maxRows * effectiveH
      : rows.length === 0 && !showInput
        ? 280
        : headerEfektifH + 1 + (barisIsi + (showInput ? 1 : 0)) * effectiveH;

  // Simpan tinggi final tabel kompak untuk dipakai sebagai placeholder pada
  // kunjungan berikutnya (tinggi placeholder = tinggi final → tanpa geseran).
  useEffect(() => {
    if (maxRows !== undefined && !loading && gridHeight > 0) {
      tinggiCache.set(tableKey, gridHeight);
    }
  }, [tableKey, maxRows, loading, gridHeight]);

  const editing = canEdit && editMode;

  const editableKeys = useMemo(
    () => visibleFields.filter((f) => f.kind !== 'static').map((f) => f.key),
    [visibleFields],
  );

  /** Buka editor untuk sel aktif (sinyal Enter ke DSG). Aman dipanggil ulang:
   *  bila editor sudah terbuka/fokus, tidak melakukan apa-apa. */
  function openEditorForActiveCell() {
    if (hasOpenEditor()) return;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  /** Klik 1× sel saat mode Edit: buka editor sel (sel sudah aktif dari mousedown). */
  function openEditorByClick() {
    if (!canEdit || !editMode) return;
    openEditorForActiveCell();
  }

  /** Klik 2× sel: nyalakan checkbox Edit + buka editor sel itu.
   *  Dijalankan lewat event dblclick (bukan mousedown detail) agar andal di
   *  semua WebView; dispatch Enter ditunda hingga kolom DSG ikut ter-update. */
  function enableEditByDoubleClick() {
    if (!canEdit) return;
    if (!editMode) setEditMode(true);
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
    // `editing` disengaja TIDAK masuk deps: isi nilai grid tak bergantung mode
    // Edit (hanya `disabled` sel yang bergantung — itu di `dsgColumns`).
    // Tanpa ini tiap nyala/mati mode Edit membangun ulang seluruh nilai grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, drafts, checkedIds, fields, getValues, showInput, inputRowValues]);

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
   * - tinggi **manual** (seret batas baris) langsung dipakai — aksi memang disengaja;
   * - tinggi **otomatis** (perubahan lebar kolom/data) ditunda ~180 ms sampai
   *   semua gerakan selesai, sehingga hanya terjadi satu remount di akhir.
   */
  const sigRemount = `${sigTinggiBaris}|${sigTinggiBarisManual}`;
  const [sigAktif, setSigAktif] = useState(sigRemount);
  // Remount tertunda = tanda baru belum dipakai DSG (masih menunggu debounce
  // 120 ms) → gerbang lebar kolom menahan tampilan sampai remount selesai.
  remountTertundaRef.current = sigAktif !== sigRemount;
  const sigManualTerakhir = useRef(sigTinggiBarisManual);
  useEffect(() => {
    if (sigManualTerakhir.current !== sigTinggiBarisManual) {
      sigManualTerakhir.current = sigTinggiBarisManual;
      setSigAktif(sigRemount);
      return;
    }
    // Selama gagang lebar diseret, JANGAN remount: remount memunculkan
    // placeholder AutoFit sehingga lebar kolom terlihat melompat. Remount
    // cukup dilakukan setelah gerakan selesai (ditunda 120 ms).
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
      // Baris input: simpan semua nilai terisi sebagai draft; TIDAK ikut
      // auto-save (penyimpanan lewat tombol simpan di kolom Aksi).
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
    // Auto-save: setiap baris yang berubah langsung masuk antrean simpan.
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
  const handleScrollRef = useRef(() => {});
  handleScrollRef.current = () => { fitActionsIfNeeded(); simpanScroll(); };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridValue, checkedIds, barisAktifId]);

  /** Draft baris input saja (dropdown bertingkat): identitasnya stabil selama
   *  yang berubah hanya draft baris data — lihat deps `dsgColumns`. */
  const inputDraft = drafts[INPUT_ROW_ID];

  const dsgColumns: Column<GridRow>[] = useMemo(() => {    /** Kelas perataan kolom dari standar global tabel (bawaan tengah). */
    const alignClass = (key: string) =>
      alignEfektif(key) === 'right'
        ? 'simpes-dsg-align-right'
        : alignEfektif(key) === 'left'
          ? ''
          : 'simpes-dsg-align-center';
    const cols: Column<GridRow>[] = hideCheckbox
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
            // Baris input bukan data pengguna: tidak bisa dicentang.
            // DSG memanggil `disabled` juga dari SelectionRect tanpa rowData
            // (baris tak ditemukan) — jangan meledak, anggap bukan baris input.
            disabled: ({ rowData }: { rowData?: GridRow }) => String(rowData?.id) === INPUT_ROW_ID,
          },
        ];
    let idxData = 0;
    for (const f of visibleFields) {
      const iData = idxData++;
      const bekuCls = iData < freezeAktif ? ' simpes-dsg-beku' : '';
      const tepiCls = iData === freezeAktif - 1 ? ' simpes-dsg-beku-tepi' : '';
      // Tanpa kolom Aksi, kolom data terakhir yang menggambar tepi kanan tabel.
      const lastCls = hideActions && iData === visibleFields.length - 1 ? ' simpes-dsg-col-last' : '';
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
          />
        ),
        headerClassName: cn(alignClass(f.key), bekuCls, tepiCls, lastCls),
        basis: widths[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150,
        // Semua kolom fixed (grow 0): lebar hanya berubah saat digagang
        // seret atau di-AutoFit, persis seperti Excel. Sisa ruang di kanan
        // dibiarkan kosong, bukan dibagi ke kolom elastis.
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
          ),
      };
      if (f.kind === 'static') {
        // Static + inputKind: tetap baca-saja untuk baris data, tapi bisa
        // diisi pada baris input (mode Input).
        // `rowData` bisa undefined saat DSG merender SelectionRect (mis. seleksi
        // melampaui baris terakhir) — dulu ini melempar TypeError dan memblokir
        // seluruh halaman karena `disabled` ikut dipanggil di sana.
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
              /* Kartu hover menerima baris SUMBER yang digabung dengan nilai
                 tampilan: data yang tak ditampilkan grid (mis. rincian periode
                 mentah) tetap bisa dipakai tanpa menaruhnya di `getValues`. */
              kartuHover: f.kartuHover === undefined
                ? undefined
                : (grid: GridRow) => {
                  const sumber = rowsRef.current.find((r) => String(r.id) === String(grid.id));
                  return f.kartuHover!({ ...(sumber as unknown as GridRow), ...grid });
                },
              // Mode Input aktif: klik 2× tidak menyalakan mode Edit.
              onDblClick: () => {
                if (!showInput) enableEditByDoubleClick();
              },
              // Pegangan seret tinggi baris hanya di kolom data pertama.
              ...(iData === 0 ? {
                onResizeBaris: (rowData: GridRow) => (event: React.MouseEvent) => {
                  if (String(rowData.id) === INPUT_ROW_ID) return;
                  mulaiSeretBaris(event, String(rowData.id), tinggiBarisSatuan(rowData));
                },
                labelBaris: (rowData: GridRow) => String(rowData[visibleFields[0]?.key ?? ''] ?? ''),
              } : {}),
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
          component: SelectCell,
          columnData: {
            fieldKey: f.key,
            choices: f.choices ?? [],
            choicesInput: typeof f.inputChoices === 'function'
              ? f.inputChoices(inputDraft ?? {})
              : (f.inputChoices ?? undefined),
            onEnter: (col: number) => inputEnterRef.current(col),
            // Mode Input aktif: klik 2× tidak menyalakan mode Edit (baris
            // input cukup buka editor sel).
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
            onEnter: (col: number) => inputEnterRef.current(col),
            // Mode Input aktif: klik 2× tidak menyalakan mode Edit (baris
            // input cukup buka editor sel).
            onDblClick: (id: string | number) => {
              if (!showInput && String(id) !== INPUT_ROW_ID) enableEditByDoubleClick();
            },
            onClickCell: (id: string | number) => {
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
    // `drafts` disengaja TIDAK masuk deps: satu-satunya yang dibaca dari state
    // adalah draft BARIS INPUT (dropdown bertingkat, via `inputDraft`);
    // ketikan edit baris data tak perlu membangun ulang definisi kolom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, visibleFields, editing, widths, autoWidths, syncAutoWidths, showInput, freezeAktif, hideCheckbox, labelKolom, alignEfektif, inputDraft]);

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
    // Kolom terakhir: garis kanan digambar di dalam sel (lihat index.css)
    // karena box-shadow DSG terpotong oleh tepi area scroll.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [widths, autoWidths, tableKey, aksiRingkas, aksiLangsung]);

  /** Interaksi sel: drag centang, toggle centang, tutup editor saat pindah sel. */
  const { downPosRef, cegahSeleksiSelCentang, toggleCheckByCell, closeEditorOnOtherCell } = useInteraksiSel<T>({
    hideCheckbox,
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
  // Cermin untuk AutoFit DOM di hook lebar & salin blok di hook salin
  // (dibaca saat event/ukur, bukan saat render).
  gridByIdRef.current = gridById;
  gridValueRef.current = gridValue;

  /** Klik kanan di tabel: tentukan area (header kolom / baris / kosong).
   *  Area kosong tidak punya menu — preventDefault membatalkan penggeseran
   *  menu (Radix maupun menu bawaan WebView). */
  function onGridContextMenu(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    // "Corner button" ala Excel/PyQt (sel header gutter) punya menu sendiri:
    // salin seluruh tabel. Diperiksa sebelum cabang header karena sel ini juga
    // berkelas header tetapi tanpa `data-col-key` (jatuh ke "area kosong").
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
    const rowEl = t.closest('.dsg-row:not(.dsg-row-header)') as HTMLElement | null;
    if (rowEl) {
      // Indeks baris dibaca dari NOMOR GUTTER DSG (sel `.dsg-cell-gutter`
      // berisi rowIndex+1) — selalu ada, bahkan saat hideCheckbox. Jangan
      // pakai `style.top`: virtualizer DSG memakai `paddingStart =
      // headerRowHeight`, jadi nilainya sudah termasuk tinggi header dan
      // hasil baginya meleset sebesar tinggi header (baris terakhir bahkan
      // jatuh di luar array). Fallback tetap dikurangi tinggi header.
      const nomor = Number.parseInt(rowEl.querySelector('.dsg-cell-gutter')?.textContent ?? '', 10);
      const top = Number.parseFloat(rowEl.style.top || '0') || 0;
      const idx = Number.isFinite(nomor)
        ? nomor - 1
        : Math.round((top - headerEfektifH) / effectiveH);
      const g = gridValue[idx];
      if (g && String(g.id) !== INPUT_ROW_ID) {
        const domain = rowsRef.current.find((r) => String(r.id) === String(g.id));
        const rowLabel = domain ? displayOf(domain.id, visibleFieldsRef.current[0]?.key ?? '') || String(domain.id) : String(g.id);
        setCtx({ area: 'row', rowId: g.id as T['id'], rowLabel, colKey });
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

  function onResetView() {
    resetLebar();
    setCheckedIds(new Set());
    setRange(null);
    toast.success('Tampilan tabel dikembalikan bawaan.');
  }

  const hasFilter = filter !== undefined;
  const hasUrut = !!onUrut;
  // Kontrol toolbar tak lagi diatur dari Kelola Tabel (tab Toolbar dihapus) —
  // semuanya tampil selama halaman menyediakannya.
  const filterTampil = hasFilter;
  const urutTampil = hasUrut;
  const kolomTampil = !hidePreset;
  const aksiMassal = renderBulkActions && checkedRows.length > 0
    ? renderBulkActions(checkedRows, clearSelection)
    : null;
  const infoHeader = tengah ?? null;
  const adaKontrolJudul = aksiMassal != null
    || awalanToolbar !== undefined
    || akhirToolbar !== undefined
    || infoHeader != null;
  const headerKontrolTampil = filterTampil || urutTampil || kolomTampil || (addButton !== undefined && addButton !== null) || adaKontrolJudul;
  const headerTampil = header !== undefined || headerKontrolTampil;
  const judulHeader = header ?? judulTabel(tableKey);

  // Data context menu per area (header kolom / baris).
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
  // Indeks kolom yang di-klik kanan pada daftar kolom tampil (untuk bekukan
  // "sampai kolom ini"); -1 = kolom non-data (centang/Aksi).
  const ctxHeaderIdx = ctxHeader
    ? visibleFields.findIndex((f) => f.key === ctxHeader.colKey)
    : -1;

  return (
    <div className={cn(
      'flex flex-col',
      !headerTampil && !judulPemilik && 'mt-2',
      maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0',
    )}>
      <KonteksLebarFilter.Provider value={konteksLebarFilter}>
        {headerTampil ? (
          <JudulTabel
            tableKey={tableKey}
            judul={judulHeader}
            infoTampil={infoHeader != null}
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
            presetApiRef={presetApiRef}
            presetKolomClassName={presetKolomClassName}
            addButton={addButton}
            addButtonLangsung={addButtonLangsung}
            bolehKelola={bolehKelolaHalaman}
            onKelolaTabel={() => setKelolaTabelOpen(true)}
          />
        ) : null}       </KonteksLebarFilter.Provider>

      {/* Rel Tingkat/Kelas (bila `rail`): di kiri grid, tepat di bawah bar
          judul tabel sehingga bagian atasnya sejajar judul kolom grid.
          Label rel diberi tinggi header tabel efektif (`headerEfektifH`) agar
          sejajar walau tinggi header diubah (pengaturan tabel) atau otomatis.
          Tanpa `rail`, kontainer `contents` tidak mengubah tata letak. */}
      <div className={cn(rail ? 'flex min-h-0 flex-1' : 'contents')}>
        {rail ? <FilterRail tinggiLabel={headerEfektifH} /> : null}
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
          // Grid full-bleed: menempel tepi kiri-kanan area konten (imbangi padding
          // layout p-1) tanpa sudut membulat; judul tetap berpadding.
          // `simpes-dsg-bleed` menandai keadaan itu untuk CSS: saat bleed, tepi
          // kiri tabel ada di luar bingkai panel sehingga garisnya tetap perlu.
          'simpes-dsg relative flex min-w-0 flex-col',
          // Bilah judul tabel di atas (JudulTabel) sudah menggambar `border-b`
          // sebagai pemisah ke grid; `border-top` sel header tabel jatuh tepat
          // 1px di bawahnya → dua garis berdempetan terbaca 2px. Penanda ini
          // membuat CSS mematikan garis itu (index.css); tanpa bilah
          // judul, `border-top` itu tetap jadi tepi atas tabel.
          headerTampil && 'simpes-dsg-bilah-judul',
          !headerTampil && !judulPemilik && '-mx-1 simpes-dsg-bleed',
          // Tanpa lantai tinggi tetap: tinggi kartu sudah eksplisit
          // (`gridHeight`), dan lantai 280 px lebih tinggi dari panel resizable
          // membuat kartu beserta tabelnya meluber di bawah panel.
          maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0',
          !editing && 'simpes-dsg-readonly',
        )}
      >
        {/* Kartu tabel setinggi gridHeight: tabel halaman mengisi penuh sisa
            area vertikal, tabel kompak (maxRows) berhenti di baris terakhir. */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'simpes-dsg-kartu relative flex flex-col overflow-hidden bg-card',
                // Tabel kompak: haluskan perubahan tinggi placeholder → final.
                maxRows !== undefined && 'transition-[height] duration-200 ease-out',
              )}
              style={{ height: gridHeight, visibility: tampilGrid ? undefined : 'hidden' }}
              onContextMenu={onGridContextMenu}
            >
              {/* Bilah muat halus saat refetch (ganti halaman/filter): grid
                  lama tetap terlihat, hanya bilah tipis di tepi atas yang
                  bergerak — tanpa kerangka, tanpa kedip. */}
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
                    key={`baris-${sigAktif}`}
                    ref={gridRef}
                    value={gridValue}
                    onChange={handleChangeStable}
                    columns={dsgColumns}
                    gutterColumn={GUTTER_COLUMN}
                    stickyLeftColumnCount={freezeAktif > 0 ? freezeAktif + (hideCheckbox ? 0 : 1) : 0}
                    stickyRightColumn={hideActions ? undefined : aksiColumn}
                    rowKey="id"
                    height={gridHeight}
                    rowHeight={gridRowHeight}
                    headerRowHeight={headerH ?? headerAutoH ?? DEFAULT_HEADER_H}
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
              {/* Bilah gulir melayang (pengganti scrollbar bawaan yang
                  disembunyikan): menempel tepi kartu, grid menembus di
                  bawahnya. Sembunyi sendiri bila tak ada luapan. */}
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
            freezeAktif={freezeAktif}
            ubahFreeze={ubahFreeze}
            onAutoFit={onAutoFit}
            onAutoFitAll={onAutoFitAll}
            align={alignDb}
            onUbahAlign={simpanAlign}
            presetApiRef={presetApiRef}
            bolehKelola={bolehGeser}
            onKelolaTabel={bolehKelolaHalaman ? () => setKelolaTabelOpen(true) : undefined}
            daftarKolom={daftarKolom}
            salinBaris={(id) => void salinBarisCtx(id as T['id'])}
            salinSel={(id, key) => void salinSelCtx(id as T['id'], key)}
            salinKolom={(key) => void salinKolomCtx(key)}
            sudut={ctx.area === 'sudut'}
            onSalinSemua={() => void salinSemuaCtx()}
            onKonfirmasi={setCtxKonfirmasi}
            bolehGeser={bolehGeser}
            jumlahKolom={visibleFields.length}
            onGeserKiri={() => ctxHeader && geserKolom(ctxHeader.colKey, -1)}
            onGeserKanan={() => ctxHeader && geserKolom(ctxHeader.colKey, 1)}
            onResetUrutan={() => kembalikanUrutan()}
            barisIkutIsi={barisIkutIsi}
            onUbahBarisIkutIsi={setBarisIkutIsi}
            onResetTinggiBaris={(rowId) => {
              if (rowId === null) resetSemuaTinggiBaris();
              else resetTinggiBaris(String(rowId));
            }}
            barisManualAda={Object.keys(tinggiBarisManual).length > 0}
            barisManualBarisIni={ctxRow ? tinggiBarisManual[String(ctxRow.rowId)] !== undefined : false}
          />
        </ContextMenu>

        {/* Penanda mode (Edit/Input) melayang di kanan bawah area tabel —
            menandai mode aktif + tombol keluar tanpa memakan ruang layout. */}
        {(editing || showInput) && (
          <div className="absolute right-3 bottom-3 z-20 flex flex-wrap items-center justify-end gap-1.5">
            {editing && (
              <PillMode
                id={`banner_mode_edit_${tableKey}`}
                btnId={`btn_keluar_mode_edit_${tableKey}`}
                aksen="warning"
                ikon={<Pencil size={14} />}
                judul="Mode Edit aktif"
                petunjuk="Sel bertanda bawah = bisa diedit; sel berarsir = baca-saja. Tekan Esc untuk keluar."
                onKeluar={() => setEditMode(false)}
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

        {/* Placeholder saat gerbang lebar menahan grid. Hanya bila BELUM ada
            data (muat awal) atau gerbang macet >800ms (kasus langka: semua
            kolom memang ~100px) — jendela flash remount (~2 bingkai) cukup
            ditutup kartu kosong seukuran, tanpa kerangka yang berkedip. */}
        {!tampilGrid && (rows.length === 0 || gateLama) && (
          <div className="absolute inset-0 z-10" aria-hidden="true">
            <TabelMemuat rowH={effectiveH} />
          </div>
        )}

        {/* Konfirmasi hapus dari context menu baris (pola sama ActionsCell). */}
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

      {/* Kaki tabel: kontrol paginasi (bila ada) sebaris dengan tombol tinggi
          baris dan tombol ikon mode (tambah baris / edit). Nilai tinggi baris
          global, tetapi tombolnya tampil di tiap tabel. */}
      <div data-part="kaki_tabel" className="mt-0 flex shrink-0 items-center gap-0">
        {pager ? <div className="min-w-0 flex-1">{pager}</div> : <div className="flex-1" />}
        {/* Grup aksi (pengaturan tabel / tinggi baris / tambah baris / edit):
            bingkai menyatu — garis dalam dibagi seperti kelompok jumlah baris
            di pager. */}
        <div data-part="grup_aksi" className="flex items-center">
          <PopoverSettingTabel tableKey={tableKey} headerHeight={headerEfektifH} />
          <TombolTinggiBaris tableKey={tableKey} />
          {inputEnabled && !showInput && (
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
          {canEdit && !editing && (
            <Button
              id={`btn_mode_edit_${tableKey}`}
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Aktifkan mode Edit"
              title="Aktifkan mode Edit (atau klik ganda sel)"
              onClick={() => setEditMode(true)}
            >
              <Pencil size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Dialog pengaturan tabel ini: kolom, urutan, toolbar, dan filter. */}
      {visHalaman?.registrasi ? (
        <DialogKelolaTabel
          open={kelolaTabelOpen}
          onOpenChange={setKelolaTabelOpen}
          tableKey={tableKey}
          judul={judulHeader}
          fields={fields}
          filterRelevan={visHalaman.registrasi.filterRelevan}
          filterBawaan={visHalaman.registrasi.bawaan}
          filterModeBawaan={visHalaman.registrasi.modeBawaan}
          jumlahTabel={visHalaman.registrasi.tabel.length}
        />
      ) : null}
    </div>
  );
}
