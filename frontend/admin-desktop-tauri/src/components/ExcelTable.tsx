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
import { buttonVariants } from '@/components/ui/button';
import { DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_FAMILY_DEFAULT, FONT_OPTIONS, useGridPrefs } from '@/components/GridPrefs';
import { useLembagaAktif } from '@/lembagaAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';
import DialogKelolaTabel from '@/components/kelolaTabel/DialogKelolaTabel';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import FilterRail from '@/components/FilterRail';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import PresetUrut from '@/components/PresetUrut';
import { gabungUrutan } from './excel/urutanKolom';
import { judulTabel } from './excel/judul';
import { useToolbarPresetState } from './excel/useToolbarPreset';
import { useUrutanKolom } from './excel/useUrutanKolom';
import { useLebarKolom } from './excel/useLebarKolom';
import { useTinggiBaris } from './excel/useTinggiBaris';
import { hitungTinggiBaris, MAX_BARIS_H, MIN_BARIS_H } from './excel/tinggiBaris';
import { measureTextWidth } from './excel/measure';
import { useSalinTabel } from './excel/useSalinTabel';
import { copyText, tulisPolosSinkron } from '@/lib/clipboard';
import { useBarisInput } from './excel/useBarisInput';
import { KonteksLebarFilter } from './excel/lebarFilter';
import { useRibbonTable } from '@/components/RibbonTable';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ActionIcon } from '@/components/RowActions';
import { NotebookTabs, Pencil, PlusCircle, Save } from '@/icons';
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
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
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
  /** Daftar nilai urut aktif berurutan (maks 3) + arah global. */
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** Niat urut dari dropdown Urutkan: halaman me-refetch lalu mengisi urutAktif.
   *  `arahKolom` = arah per kode dari preset (bila preset mengaturnya sendiri). */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: Record<string, 'naik' | 'turun'>) => void;
  /** Tabel database utama grid ini: kolom tanpa `sumber` dianggap berasal dari
   *  tabel ini (nama kolom = key-nya), kecuali `sumber: null`. */
  sumberTabel?: string;
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
  judulPemilik = false,
  presetKolomClassName,
  rail = false,
  onCheckedChange,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
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
  const { visToolbar, lebarToolbar, lebarKolomDb, alignDb, urutanDb, setUrutanDb, simpanAlign, konteksLebarFilter } = useToolbarPresetState(tableKey);
  /** Baris input hanya tersedia bila halaman menyediakan onCreateRow.
   *  Tidak bergantung mode Edit: halaman boleh mendukung create saja. */
  const inputEnabled = !!onCreateRow;
  const showInput = inputEnabled && inputMode;

  const checkedRows = useMemo(() => rows.filter((r) => checkedIds.has(r.id)), [rows, checkedIds]);
  const clearSelection = useMemo(() => () => setCheckedIds(new Set<T['id']>()), []);

  const [presetKeys, setPresetKeys] = useState<string[] | null>(null);
  /** Id preset aktif (null = Lengkap/tanpa preset): urutan kolom mengikuti
   *  susunan preset; geser dari menu konteks menyimpan balik ke preset ini. */
  const [presetAktifId, setPresetAktifId] = useState<number | null>(null);
  /** Nama header kustom dari preset aktif (key kolom → nama tampil). */
  const [presetLabel, setPresetLabel] = useState<Record<string, string> | null>(null);
  const terapkanPreset = useCallback((keys: string[] | null, label?: Record<string, string> | null, presetId?: number | null) => {
    setPresetKeys(keys);
    setPresetLabel(label ?? null);
    setPresetAktifId(presetId ?? null);
  }, []);


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
   *  di bawah — tidak untuk keputusan per baris. */
  const aksiMaksBaris = useMemo(
    () => rows.reduce((m, r) => Math.max(m, flattenAksi(renderActions(r)).length), 0),
    [rows, renderActions],
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
    setPresetKeys,
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

  /** Manajemen lebar kolom: state widths/autoWidths, persistensi, penahan
   *  lebarStabil, seret gagang, AutoFit, lebar Aksi, tinggi header otomatis. */
  const {
    widths,
    autoWidths,
    lebarStabil,
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
  // dengan tinggi tebakan awal lalu melompat ke tinggi asli. Observer dipasang
  // ulang saat loading/rows berubah karena wrapper ikut dirender ulang.
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
  }, [loading, rows.length, tableKey]);


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

  // Shortcut Ctrl/Cmd+C: tulis clipboard ditangani DSG (tanpa notifikasi).
  // Listener ini (capture: jalan SEBELUM handler DSG) menjaga tiga kasus
  // tepi agar toast tak menipu + clipboard tak tertimpa string kosong:
  // 1. Fokus di input/teks (kolom cari, filter, dialog): biarkan salin
  //    native — tahan DSG yang tetap menimpa clipboard dari sel aktif lama.
  // 2. Teks diseleksi manual (seret mouse) pada satu sel: salin teksnya apa
  //    adanya — tahan DSG yang menyalin sel aktif/gutter.
  // 3. Sel aktif di gutter (centang/aksi/nomor baris) tanpa blok: DSG
  //    menyalin kosong — tahan + beri petunjuk. Blok multi-sel tetap milik DSG.
  useEffect(() => {
    function saatSalin(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        e.stopPropagation();
        return;
      }
      const root = wrapRef.current;
      if (!root || !(t && root.contains(t))) return;
      if (root.querySelector('.dsg-active-cell-focus')) return; // sedang mengedit sel
      // Desktop: clipboardData webview tak andal — tulis via plugin sebelum
      // DSG sempat menimpa clipboard (wajib preventDefault sinkron; tulis
      // async di bawah, clipboard lama aman bila tak ada yang tersalin).
      if (isTauri()) {
        const r = rangeRef.current;
        const blokBanyak = !!r && (r.min.col !== r.max.col || r.min.row !== r.max.row);
        const sel = window.getSelection();
        if (!blokBanyak && sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode)) {
          const teks = sel.toString();
          if (teks !== '') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            tulisPolosSinkron(e, teks);
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug(`[simpes-salin] tabel teks: ${teks.length} aksara`);
            }
            void copyText(teks).then((ok) => {
              if (ok) toast.success('Telah disalin ke clipboard.');
              else toast.error('Gagal menyalin.');
            });
            return;
          }
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        // Tulis sinkron agar clipboard langsung terisi teks polos meski
        // tulis async plugin terlambat; TANPA text/html agar tempel
        // ke Excel tetap memakai TSV (grid utuh, bukan satu kolom).
        const praduga = teksSalinan();
        if (praduga != null && praduga !== '') {
          try {
            e.clipboardData?.setData('text/plain', praduga);
          } catch {
            /* abaikan — tulis ulang via plugin di bawah */
          }
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug(`[simpes-salin] tabel TSV: ${praduga.length} aksara`);
          }
        }
        void salinFisik().then((ok) => {
          if (!ok) toast.warning('Pilih sel data untuk menyalin.');
        });
        return;
      }
      const r = rangeRef.current;
      const blokBanyak = !!r && (r.min.col !== r.max.col || r.min.row !== r.max.row);
      const sel = window.getSelection();
      if (!blokBanyak && sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode)) {
        const teks = sel.toString();
        if (teks !== '') {
          e.preventDefault();
          e.stopPropagation();
          try {
            e.clipboardData?.setData('text/plain', teks);
          } catch {
            /* abaikan — copyText menangani fallback */
          }
          void copyText(teks).then((ok) => {
            if (ok) toast.success('Telah disalin ke clipboard.');
            else toast.error('Gagal menyalin.');
          });
          return;
        }
      }
      const selAktif = root.querySelector('.dsg-active-cell');
      if (!selAktif) return;
      if (!blokBanyak) {
        const kunciKolom = selAktif.closest?.('[data-col-key]')?.getAttribute('data-col-key');
        if (kunciKolom === 'check' || kunciKolom === '__aksi' || kunciKolom == null) {
          e.preventDefault();
          e.stopPropagation();
          toast.warning('Pilih sel data untuk menyalin.');
          return;
        }
      }
      toast.success('Telah disalin ke clipboard.');
    }
    document.addEventListener('copy', saatSalin, true);
    return () => document.removeEventListener('copy', saatSalin, true);
  }, []);






  const effectiveH = rowH ?? densityPx;

  /**
   * Tinggi satu baris (dari baris GRID yang sudah berformat teks): manual
   * (seret hanya baris itu) → ikut isi (baris ini membesar bila teksnya
   * membungkus) → tinggi dasar kerapatan. Baris yang isinya muat tetap.
   *
   * Catatan: yang diterima DSG adalah `gridValue` (kunci = kolom, nilai =
   * teks terformat), BUKAN baris domain — jadi `getValues` tidak boleh
   * dipanggil lagi di sini.
   *
   * Mode ikut isi hanya untuk tabel halaman; tabel kompak `maxRows`
   * menghitung tinggi dari jumlah baris tetap sehingga tinggi variabel akan
   * membuat perkiraan itsinya meleset.
   *
   * Pengukuran lebar teks menyentuh DOM, jadi di-cache per teks dan tinggi
   * akhir per baris. Kegagalan pengukuran tidak boleh menjatuhkan grid.
   */
  const cacheLebarTeks = useRef(new Map<string, number>());
  const cacheTinggiBaris = useRef(new Map<string, number>());
  const tinggiBarisSatuan = useCallback((rowData: GridRow): number => {
    const rowKey = String(rowData.id);
    const manual = tinggiBarisManual[rowKey];
    if (manual !== undefined) return manual;
    if (!barisIkutIsi || maxRows !== undefined || rowKey === INPUT_ROW_ID) return effectiveH;

    try {
      const style = wrapRef.current ? getComputedStyle(wrapRef.current) : null;
      if (!style) return effectiveH;

      const teks: string[] = [];
      const lebarKolom: number[] = [];
      for (const f of visibleFields) {
        if (f.kind === 'toggle') continue;
        const isi = rowData[f.key];
        if (isi === null || isi === undefined || isi === '') continue;
        teks.push(String(isi));
        lebarKolom.push(widths[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150);
      }
      if (teks.length === 0) return effectiveH;

      const sig = `${rowKey}|${effectiveFont}|${effectiveH}|${lebarKolom.join(',')}|${teks.join('\u0001')}`;
      const tersimpan = cacheTinggiBaris.current.get(sig);
      if (tersimpan !== undefined) return tersimpan;

      const lebarTeks = teks.map((t) => {
        const kunci = `${effectiveFont}|${t}`;
        const ada = cacheLebarTeks.current.get(kunci);
        if (ada !== undefined) return ada;
        const baru = measureTextWidth(t, style);
        if (cacheLebarTeks.current.size > 2000) cacheLebarTeks.current.clear();
        cacheLebarTeks.current.set(kunci, baru);
        return baru;
      });
      const tinggi = hitungTinggiBaris({ lebarTeks, lebarKolom, fontPx: effectiveFont, minH: effectiveH });
      if (cacheTinggiBaris.current.size > 1000) cacheTinggiBaris.current.clear();
      cacheTinggiBaris.current.set(sig, tinggi);
      return tinggi;
    } catch {
      // Pengukuran gagal (mis. DOM belum siap) → tinggi dasar.
      return effectiveH;
    }
  }, [tinggiBarisManual, barisIkutIsi, maxRows, effectiveH, effectiveFont, visibleFields, widths, autoWidths, syncAutoWidths]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, drafts, checkedIds, fields, getValues, editing, showInput, inputRowValues]);

  /**
   * `rowHeight` DSG: fungsi saat tabel punya baris (tinggi per baris), angka
   * saat kosong — jalur tinggi variabel DSG melempar `undefined.top` bila
   * `value` kosong.
   */
  const gridRowHeight = useMemo(
    () => (gridValue.length === 0
      ? effectiveH
      : ({ rowData }: { rowData: GridRow }) => tinggiBarisSatuan(rowData)),
    [gridValue.length, effectiveH, tinggiBarisSatuan],
  );

  /** Tanda tinggi baris saat ini (setiap baris ikut isinya masing-masing). */
  const sigTinggiBaris = useMemo(() => {
    if (gridValue.length === 0) return 'kosong';
    const parts: string[] = [];
    for (const g of gridValue) parts.push(String(tinggiBarisSatuan(g)));
    return parts.join(',');
  }, [gridValue, tinggiBarisSatuan, sigTinggiBarisManual]);

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
  const sigManualTerakhir = useRef(sigTinggiBarisManual);
  useEffect(() => {
    if (sigManualTerakhir.current !== sigTinggiBarisManual) {
      sigManualTerakhir.current = sigTinggiBarisManual;
      setSigAktif(sigRemount);
      return;
    }
    const t = setTimeout(() => setSigAktif(sigRemount), 180);
    return () => clearTimeout(t);
  }, [sigRemount, sigTinggiBarisManual]);

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

  const dsgColumns: Column<GridRow>[] = useMemo(() => {
    /** Kelas perataan kolom dari standar global tabel (bawaan tengah). */
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
            disabled: ({ rowData }: { rowData: GridRow }) => String(rowData.id) === INPUT_ROW_ID,
          },
        ];
    let idxData = 0;
    for (const f of visibleFields) {
      const iData = idxData++;
      const bekuCls = iData < freezeAktif ? ' simpes-dsg-beku' : '';
      const tepiCls = iData === freezeAktif - 1 ? ' simpes-dsg-beku-tepi' : '';
      // Tanpa kolom Aksi, kolom data terakhir yang menggambar tepi kanan tabel.
      const lastCls = hideActions && iData === visibleFields.length - 1 ? ' simpes-dsg-col-last' : '';
      const isInputRow = (rowData: GridRow) => showInput && String(rowData.id) === INPUT_ROW_ID;
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
        cellClassName: ({ rowData }: { rowData: GridRow }) =>
          cn(
            alignClass(f.key),
            bekuCls,
            tepiCls,
            lastCls,
            isInputRow(rowData) && 'simpes-dsg-baris-input',
            isInputRow(rowData) && f.required && !rowData[f.key] && 'simpes-dsg-wajib',
            draftsRef.current[String(rowData.id)]?.[f.key] !== undefined && 'simpes-dsg-dirty',
            editing && (f.kind === 'static' ? 'simpes-dsg-readonly' : 'simpes-dsg-editable'),
          ),
      };
      if (f.kind === 'static') {
        // Static + inputKind: tetap baca-saja untuk baris data, tapi bisa
        // diisi pada baris input (mode Input).
        const isInputOnly = (rowData: GridRow) => String(rowData.id) === INPUT_ROW_ID;
        if (f.inputKind === 'select') {
          cols.push({
            ...common,
            component: InputStaticSelectCell,
            columnData: {
              fieldKey: f.key,
              choices: typeof f.inputChoices === 'function'
                ? f.inputChoices(drafts[INPUT_ROW_ID] ?? {})
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
              ? f.inputChoices(drafts[INPUT_ROW_ID] ?? {})
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, visibleFields, editing, widths, autoWidths, syncAutoWidths, showInput, freezeAktif, hideCheckbox, labelKolom, alignEfektif, drafts]);

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
    title: <HeaderTitle label="AKSI" colKey="__aksi" onResizeStart={startResize} onAutoFit={onAutoFit} />,
    basis: widths.__aksi ?? autoWidths.__aksi ?? ACTIONS_DEFAULT_W,
    grow: 0,
    shrink: 0,
    minWidth: ACTIONS_MIN_W,
    // Kolom terakhir: garis kanan digambar di dalam sel (lihat index.css)
    // karena box-shadow DSG terpotong oleh tepi area scroll.
    headerClassName: 'simpes-dsg-col-last',
    cellClassName: 'simpes-dsg-col-last',
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

  /** Posisi mousedown terakhir: klik setelah drag-seleksi bukan maksud mencentang. */
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  /** Mousedown di sel centang (termasuk tepat di kotak) = niat mencentang,
   *  bukan menyeleksi: cegah DSG memasang anchor/drag-seleksi dari sel ini.
   *  Toggle tetap jalan sekali via onClick di bawah (mousedown asli yang
   *  diblokir tak sampai ke input, jadi tak ada toggle ganda). Klik kanan &
   *  kontrol lain dikecualikan agar menu konteks tetap bekerja. */
  function cegahSeleksiSelCentang(e: React.MouseEvent): void {
    if (hideCheckbox || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest?.('select, textarea, button, a')) return;
    const sel = t.closest?.('.dsg-cell');
    if (!sel || !wrapRef.current?.contains(sel)) return;
    const box = sel.querySelector('input.dsg-checkbox, input.simpes-dsg-checkall');
    if (!box || (box as HTMLInputElement).disabled) return;
    e.preventDefault();
    e.stopPropagation();
  }

  /** Klik sel centang (area maupun tepat di kotak): toggle 1× via `checkedIds`
   *  sendiri memakai `data-row-id` — deterministik, tanpa lewat DSG (jalur
   *  bawaannya butuh 2× klik dan berbalapan dengan flip browser). Header
   *  pilih-semua memakai jalur `onChange`-nya sendiri. Baris nonaktif dan
   *  hasil drag (>4px) dilewati. */
  function toggleCheckByCell(e: React.MouseEvent) {
    if (hideCheckbox) return;
    const d = downPosRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.closest?.('select, textarea, button, a')) return;
    const sel = t.closest?.('.dsg-cell');
    if (!sel || !wrapRef.current?.contains(sel)) return;
    const box = sel.querySelector<HTMLInputElement>('input.dsg-checkbox, input.simpes-dsg-checkall');
    if (!box || box.disabled) return;
    if (box.classList.contains('simpes-dsg-checkall')) {
      // Header pilih-semua: biarkan onChange alaminya yang bekerja. Klik
      // sintetis di sini justru men-toggle balik (true→false) sebelum change
      // terbaca, sehingga check/uncheck-all tampak tidak berfungsi.
      return;
    }
    const rowId = box.dataset.rowId;
    const row = rowsRef.current.find((r) => String(r.id) === rowId);
    if (!row) return;
    const id = row.id;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Klik/pindah ke sel lain saat ada editor terbuka: tutup dulu editor lama
   *  (memicu commit + auto-save), lalu DSG memindahkan sel aktif. Tanpa ini
   *  input lama tetap fokus sehingga ketikan lanjut masuk ke sel sebelumnya. */
  function closeEditorOnOtherCell(e: React.MouseEvent) {
    if (!editing && !showInput) return;
    const aktif = document.activeElement as HTMLElement | null;
    if (!aktif || !(aktif.classList.contains('dsg-input') || aktif.classList.contains('simpes-dsg-select'))) {
      return;
    }
    const targetCell = (e.target as HTMLElement).closest?.('.dsg-cell') ?? null;
    if (targetCell && targetCell === aktif.closest('.dsg-cell')) return;
    aktif.blur();
  }

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

  // Publikasikan perintah tabel ke tab ribbon "Tabel" (tab memakai tabel
  // pertama yang terdaftar di halaman; handler selalu versi terbaru via ref).
  // Depend hanya pada callback registri yang stabil + status mode — objek context
  // berubah identitas saat registri terisi dan akan memicu loop daftar/lepas.
  const ribbon = useRibbonTable();
  const ribbonDaftar = ribbon?.daftar;
  const ribbonLepas = ribbon?.lepas;
  const ribbonAktif = ribbon?.aktif;
  const ribbonAksiRef = useRef({ salin: () => {}, autofit: () => {}, reset: () => {} });
  ribbonAksiRef.current = { salin: onCopy, autofit: onAutoFitAll, reset: onResetView };
  // Lepas registri hanya saat tabel unmount/ganti key — bukan tiap status mode
  // berubah (kalau tidak, ribbon sempat kosong lalu disabled sekilas).
  useEffect(() => {
    if (!ribbonDaftar || !ribbonLepas) return;
    return () => ribbonLepas(tableKey);
  }, [ribbonDaftar, ribbonLepas, tableKey]);
  useEffect(() => {
    if (!ribbonDaftar) return;
    ribbonDaftar(tableKey, {
      tableKey,
      salin: () => ribbonAksiRef.current.salin(),
      autofit: () => ribbonAksiRef.current.autofit(),
      reset: () => ribbonAksiRef.current.reset(),
      canEdit,
      editMode,
      setEditMode,
      editing,
      inputEnabled,
      inputMode,
      setInputMode,
      showInput,
      headerHeight: headerH ?? headerAutoH ?? DEFAULT_HEADER_H,
      freeze: freezeAktif,
      freezeMax: visibleFields.length,
      setFreeze: ubahFreeze,
    });
  }, [
    ribbonDaftar,
    tableKey,
    canEdit,
    editMode,
    editing,
    inputEnabled,
    inputMode,
    showInput,
    headerH,
    headerAutoH,
    freezeAktif,
    visibleFields.length,
    ubahFreeze,
  ]);

  const hasFilter = filter !== undefined;
  const hasUrut = !!onUrut;
  const filterTampil = visToolbar.filter && hasFilter;
  const urutTampil = visToolbar.urut && hasUrut;
  const kolomTampil = visToolbar.kolom && !hidePreset;
  const aksiMassal = renderBulkActions && checkedRows.length > 0
    ? renderBulkActions(checkedRows, clearSelection)
    : null;
  const infoHeader = visToolbar.info ? tengah ?? null : null;
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
  const ctxRowAksi = ctxRowDomain ? flattenAksi(renderRef.current(ctxRowDomain)) : [];
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
          <ContextMenu>
            <ContextMenuTrigger asChild disabled={!bolehKelolaHalaman}>
              <div data-part="header_tabel" className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--warna-border-ribbon)] bg-muted/40 px-3 py-1 text-xs font-medium">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex-1 truncate">{judulHeader}</div>
              {infoHeader ? (
                <div className="flex max-w-full shrink-0 self-center flex-col items-center gap-0.5 rounded-full border bg-muted/60 px-4 py-1 text-center">
                  <span className="max-w-[32rem] truncate text-[11px] text-muted-foreground">{tengah}</span>
                </div>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
              <div className="flex shrink-0 items-center justify-end gap-2">
                {filterTampil ? <div className="flex items-center gap-1.5 [&>*]:shrink-0">{filter}</div> : null}
                {aksiMassal ? <div className="flex flex-nowrap items-center gap-1.5 [&>*]:shrink-0">{aksiMassal}</div> : null}
                {awalanToolbar}
                {akhirToolbar}
                {urutTampil ? (
                  <PresetUrut
                    tableKey={tableKey}
                    urutAktif={urutAktif}
                    arahUrut={arahUrut}
                    onUrut={onUrut}
                    wrapperClassName="flex-row items-center gap-1.5"
                    lebarTrigger={lebarToolbar.urut}
                  />
                ) : null}
                {kolomTampil ? (
                  <PresetKolom
                    tableKey={tableKey}
                    fields={fields}
                    onApply={terapkanPreset}
                    apiRef={presetApiRef}
                    triggerClassName={presetKolomClassName}
                    wrapperClassName="flex-row items-center gap-1.5"
                    lebarTrigger={lebarKolomDb}
                  />
                ) : null}
              </div>
              {addButton ? (
                addButtonLangsung
                  ? <div className="shrink-0">{addButton}</div>
                  : <div className="shrink-0"><MenuAksiToolbar triggerId={`btn_aksi_${tableKey}`}>{addButton}</MenuAksiToolbar></div>
              ) : null}
              </div>
            </div>
            </ContextMenuTrigger>
            {bolehKelolaHalaman ? (
              <ContextMenuContent>
                <ContextMenuItem
                  id={`menu_kelola_tabel_${tableKey}`}
                  onSelect={() => setKelolaTabelOpen(true)}
                >
                  <NotebookTabs data-icon="inline-start" size={16} /> Kelola Tabel
                </ContextMenuItem>
              </ContextMenuContent>
            ) : null}
          </ContextMenu>
        ) : null}
       </KonteksLebarFilter.Provider>

      {/* Rel Tingkat/Kelas (bila `rail`): di kiri grid, tepat di bawah bar
          judul tabel sehingga bagian atasnya sejajar judul kolom grid.
          Tanpa `rail`, kontainer `contents` tidak mengubah tata letak. */}
      <div className={cn(rail ? 'flex min-h-0 flex-1' : 'contents')}>
        {rail ? <FilterRail /> : null}
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
        title="Seret untuk memblokir sel • Ctrl+C menyalin"
        onMouseDownCapture={(e) => {
          downPosRef.current = { x: e.clientX, y: e.clientY };
          closeEditorOnOtherCell(e);
          // Halaman multi-tabel: tabel yang disentuh jadi sumber perintah ribbon.
          ribbonAktif?.(tableKey);
          cegahSeleksiSelCentang(e);
        }}
        onClickCapture={toggleCheckByCell}
        className={cn(
          // Grid full-bleed: menempel tepi kiri-kanan area konten (imbangi padding
          // layout p-1) tanpa sudut membulat; judul tetap berpadding.
          'simpes-dsg relative flex min-w-0 flex-col',
          !headerTampil && !judulPemilik && '-mx-1',
          maxRows === undefined ? 'min-h-[280px] flex-1' : 'shrink-0',
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
              style={{ height: gridHeight, visibility: lebarStabil || loading ? undefined : 'hidden' }}
              onContextMenu={onGridContextMenu}
            >
              {pakaiMemuat ? (
                <TabelMemuat rowH={effectiveH} baris={maxRows ?? 14} />
              ) : (
                <CheckAllContext.Provider value={checkAllState}>
                  <DataSheetGrid
                    key={`baris-${sigAktif}`}
                    ref={gridRef}
                    value={gridValue}
                    onChange={handleChange}
                    columns={dsgColumns}
                    stickyLeftColumnCount={freezeAktif > 0 ? freezeAktif + (hideCheckbox ? 0 : 1) : 0}
                    stickyRightColumn={hideActions ? undefined : aksiColumn}
                    rowKey="id"
                    height={gridHeight}
                    rowHeight={gridRowHeight}
                    headerRowHeight={headerH ?? headerAutoH ?? DEFAULT_HEADER_H}
                    lockRows
                    addRowsComponent={false}
                    disableContextMenu
                    rowClassName={({ rowIndex }) => {
                      const r = gridValue[rowIndex];
                      return cn(
                        rowIndex === gridValue.length - 1 && 'simpes-dsg-row-last',
                        r && String(r.id) === INPUT_ROW_ID && 'simpes-dsg-row-input',
                        r && checkedIds.has(r.id) && 'simpes-dsg-row-checked',
                      );
                    }}
                    onSelectionChange={({ selection }) => setRange(selection)}
                    onScroll={() => { fitActionsIfNeeded(); simpanScroll(); }}
                  />
                </CheckAllContext.Provider>
              )}
              {gridValue.length === 0 && !loading && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <p className="text-xs text-muted-foreground">{emptyText}</p>
                </div>
              )}
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
            salinBaris={(id) => void salinBarisCtx(id as T['id'])}
            salinSel={(id, key) => void salinSelCtx(id as T['id'], key)}
            salinKolom={(key) => void salinKolomCtx(key)}
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

        {/* Placeholder saat lebar kolom belum stabil (grid disembunyikan agar
            tidak terlihat melompat). Berbentuk tabel agar tidak tampak blok kosong. */}
        {!lebarStabil && !loading && (
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

      {/* Bilah status mode di bawah tabel (bagian badan halaman): menandai Mode
          Edit/Input aktif + tombol keluar; tidak menutupi isi grid. */}
      {(editing || showInput) && (
        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-1.5">
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
