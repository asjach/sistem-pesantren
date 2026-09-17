import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  checkboxColumn,
  keyColumn,
  type CellProps,
  type Column,
  type DataSheetGridRef,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { DENSITY_PX } from '@/prefs';
import { useTheme } from '@/theme';
import { errorMessage, prefSet } from '@/api/client';
import { formatNilai } from '@/lib/nilaiTampil';
import { buttonVariants } from '@/components/ui/button';
import { DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_FAMILY_DEFAULT, FONT_OPTIONS, MAX_HEADER_H, useGridPrefs, type AlignName } from '@/components/GridPrefs';
import { useStandarTampilan } from '@/standarTampilan';
import { type PresetKolomApi } from '@/components/PresetKolom';
import { useKamusPeta } from '@/components/useKamusPeta';
import { type KamusKolomAttr } from '@/api/kamusLabel';
import { useRibbonTable } from '@/components/RibbonTable';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ActionIcon } from '@/components/RowActions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pencil, PlusCircle, Save } from '@/icons';
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
import { copyText, toTSV } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { CheckAllCell, CheckAllContext, PillMode, TabelMemuat } from './excel/primitives';
import {
  ACTIONS_DEFAULT_W,
  ACTIONS_MIN_W,
  AKSI_RINGKAS,
  AUTOFIT_BUFFER,
  AUTOFIT_MAX_W,
  CHECK_W,
  INPUT_ROW_ID,
  MIN_COL_W,
  freezeKey,
  hasOpenEditor,
  hostUkur,
  loadFreeze,
  loadWidths,
  readWidthCache,
  teksTampilSel,
  tinggiCache,
  widthsKey,
  writeWidthCache,
} from './excel/helpers';
import {
  InputStaticSelectCell,
  InputStaticTextCell,
  SelectCell,
  StaticCell,
  TextCell,
  ToggleCell,
} from './excel/cells';
import { HeaderTitle, ukurPerluTinggiHeader } from './excel/header';
import { bersihkanProbe, measureActionsWidth } from './excel/measure';
import { ukurAutoFit } from './excel/autofit';
import { useAntreanSimpan } from './excel/useAntreanSimpan';
import ToolbarTabel from './excel/toolbar';
import { ActionsCell, flattenAksi } from './excel/actions';
import MenuKonteksGrid from './excel/konteksMenu';
import type { AksiMenu, CheckAllState, ExcelField, GridRow, GridSelection } from './excel/types';

export type { ExcelChoice, ExcelField, GridRow, GridSelection } from './excel/types';











interface ExcelTableProps<T extends { id: string | number }> {
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
  /** Pencarian sebaris di toolbar. */
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  searchIds?: { form?: string; input?: string; button?: string };
  filter?: ReactNode;
  /** Kontrol di awal toolbar, diletakkan SEBELUM kotak Cari (mis. pemilih
   *  tabel pada halaman Kamus Label). */
  awalanToolbar?: ReactNode;
  /** Kontrol di ujung KANAN toolbar (setelah tombol aksi utama halaman). */
  akhirToolbar?: ReactNode;
  /** Tombol aksi utama halaman (mis. "+ Tambah X"): diletakkan sebaris
   *  dengan pencarian/filter, di sisi kanan. */
  addButton?: ReactNode;
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
  /** Tabel ringkas baca-saja: sembunyikan pemilih preset kolom di toolbar. */
  hidePreset?: boolean;
  /** Kabarkan baris tercentang setiap seleksi berubah (opsional). */
  onCheckedChange?: (rows: T[]) => void;
  /** Daftar nilai urut aktif berurutan (maks 3) + arah global. */
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** Niat urut dari klik header: halaman me-refetch lalu mengisi urutAktif. */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
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
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder,
  searchIds,
  filter,
  awalanToolbar,
  akhirToolbar,
  addButton,
  renderBulkActions,
  maxRows,
  onCreateRow,
  inputRowValues,
  hideCheckbox = false,
  hideActions = false,
  hidePreset = false,
  onCheckedChange,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
  sumberTabel,
}: ExcelTableProps<T>) {
  const { density } = useTheme();
  const densityPx = DENSITY_PX[density];
  // Preferensi tampilan tabel global (dikontrol dari top bar).
  const { rowH, headerH, fontPx, fontFamily, align, setAlign } = useGridPrefs();
  // Standar tampilan lembaga: lebar & kolom beku bawaan (bisa ditimpa user).
  const { tampilan: standar, isPribadi, tandai, hapus, merekam, simpanKeStandar } = useStandarTampilan();

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
  /** Baris input hanya tersedia bila halaman menyediakan onCreateRow.
   *  Tidak bergantung mode Edit: halaman boleh mendukung create saja. */
  const inputEnabled = !!onCreateRow;
  const showInput = inputEnabled && inputMode;

  const checkedRows = useMemo(() => rows.filter((r) => checkedIds.has(r.id)), [rows, checkedIds]);
  const clearSelection = useMemo(() => () => setCheckedIds(new Set<T['id']>()), []);

  const [presetKeys, setPresetKeys] = useState<string[] | null>(null);
  /** Nama header kustom dari preset aktif (key kolom → nama tampil). */
  const [presetLabel, setPresetLabel] = useState<Record<string, string> | null>(null);
  const terapkanPreset = useCallback((keys: string[] | null, label?: Record<string, string> | null) => {
    setPresetKeys(keys);
    setPresetLabel(label ?? null);
  }, []);

  /** Sumber efektif sebuah kolom: `sumber` eksplisit, atau tabel utama grid
   *  dengan nama kolom = key (kecuali `sumber: null`). */
  const sumberField = useCallback((f: ExcelField): { tabel: string; kolom: string } | null => {
    if (f.sumber === null) return null;
    if (f.sumber) return f.sumber;
    return sumberTabel ? { tabel: sumberTabel, kolom: f.key } : null;
  }, [sumberTabel]);
  /** Kamus kolom level tabel database (global): label, perataan, lebar,
   *  tooltip, format, kontrol urut. Dibaca sekali per kombinasi tabel. */
  const tabelKamus = useMemo(
    () => [...new Set(fields.map((f) => sumberField(f)?.tabel).filter((t): t is string => !!t))],
    [fields, sumberField],
  );
  const kamus = useKamusPeta(tabelKamus);
  /** Atribut kamus per key kolom grid. */
  const attrByKey = useMemo(() => {
    const m = new Map<string, KamusKolomAttr>();
    for (const f of fields) {
      const s = sumberField(f);
      if (!s) continue;
      const a = kamus[`${s.tabel}.${s.kolom}`];
      if (a) m.set(f.key, a);
    }
    return m;
  }, [fields, kamus, sumberField]);

  /** Nama tampil kolom: kamus DB > label preset > label bawaan field.
   *  Semua header ditampilkan KAPITAL dan underscore jadi spasi (aturan v2.74);
   *  label placeholder bertipe `tabel.kolom` dipangkas jadi nama kolomnya saja.
   *  Nilai tersimpan kamus/preset tidak diubah, hanya tampilan. */
  const labelKolom = useCallback((key: string, bawaan: string) => {
    const dariKamus = attrByKey.get(key)?.label?.trim();
    const kustom = presetLabel?.[key]?.trim();
    const teks = dariKamus || kustom || bawaan;
    const dasar = /^[a-z0-9_]+\.[a-z0-9_]+$/.test(teks) ? teks.slice(teks.indexOf('.') + 1) : teks;
    return dasar.replace(/_+/g, ' ').toUpperCase();
  }, [presetLabel, attrByKey]);
  /** Perataan efektif: kamus DB > preferensi pribadi > tengah. */
  const alignEfektif = useCallback((key: string): AlignName => (
    attrByKey.get(key)?.align ?? align[key] ?? 'center'
  ), [attrByKey, align]);
  /** Lebar terkunci kamus (kolom tidak bisa diseret/di-AutoFit). */
  const lebarKunci = useCallback((key: string): number | null => {
    const a = attrByKey.get(key);
    return a?.kunci_lebar && a.lebar ? a.lebar : null;
  }, [attrByKey]);
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
  const resizeRef = useRef<{ key: string; startX: number; startW: number; targets: string[] } | null>(
    null,
  );
  /** Listener resize aktif (dibersihkan saat unmount bila masih menyeret). */
  const resizeListenersRef = useRef<{ move: (ev: MouseEvent) => void; up: () => void } | null>(null);
  /** Antrean simpan otomatis per baris (id → field yang belum dikirim). */
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  /** Cache sesi untuk tabel ini (bila ada): lebar langsung final di render
   *  pertama sehingga tidak ada geseran saat kembali ke halaman. */
  const cacheHit = readWidthCache(tableKey);
  /** Ada cache SAAT render pertama (sebelum efek menulis apa pun) — dipakai
   *  agar muat-lebar-dari-disk tidak dilewati keliru (mis. StrictMode). */
  const cacheHadRef = useRef(!!cacheHit);
  const [widths, setWidths] = useState<Record<string, number>>(() => cacheHit?.widths ?? {});
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  /** Lebar AutoFit bawaan — TIDAK disimpan, dipakai hanya untuk kolom yang
   *  belum pernah diatur lebarnya oleh pengguna. Dihitung ulang tiap muat
   *  awal supaya selalu pas dengan data aktual. */
  const [autoWidths, setAutoWidths] = useState<Record<string, number>>(() => cacheHit?.autoWidths ?? {});
  const autoWidthsRef = useRef(autoWidths);
  autoWidthsRef.current = autoWidths;
  const [widthsReady, setWidthsReady] = useState(!!cacheHit);
  /** Grid disembunyikan (space tetap dialokasikan) sampai lebar kolom BENAR
   *  diterapkan DSG. DSG merender semua kolom dengan lebar bawaan (100px) pada
   *  frame pertama sebelum basis kita dipakai — tanpa penahan ini terlihat
   *  header "melompat". Selalu mulai tersembunyi, termasuk saat cache ada. */
  const [lebarStabil, setLebarStabil] = useState(false);
  /** Tinggi header otomatis (konten-driven) — dari judul terpanjang yang
   *  membungkus; dipakai bila pengguna tidak mengunci tinggi manual. */
  const [headerAutoH, setHeaderAutoH] = useState<number | null>(null);
  /** Jumlah kolom DATA pertama yang dibekukan (freeze pane kiri), per tabel. */
  const [freeze, setFreeze] = useState(0);
  /** Lewati AutoFit pada commit pertama: cache sudah memuat lebar final. */
  const skipFitPertamaRef = useRef(!!cacheHit);
  const fittedRef = useRef<string | null>(cacheHit ? tableKey : null);
  /** Sedang mencoba mengukur kolom Aksi yang baru ter-render (hindari loop ganda). */
  const aksiFitRef = useRef(false);
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
    if (presetKeys === null) return fields;
    const terlihat = fields.filter((f) => presetKeys.includes(f.key));
    return terlihat.length > 0 ? terlihat : fields;
  }, [fields, presetKeys]);
  const visibleFieldsRef = useRef(visibleFields);
  /** Nilai TERBARU baris input (ditulis handleChange) — dipakai saat Enter
   *  agar simpan tidak membaca state yang belum ter-flush. */
  const inputDraftRef = useRef<Record<string, string | null>>({});
  /** Indeks kolom yang ditinggalkan & penanda kursor harus turun ke baris input. */
  const inputKolomRef = useRef(0);
  const pindahKeInputRef = useRef(false);
  const gridRef = useRef<DataSheetGridRef>(null);

  // Standar lembaga untuk tabel ini (diabaikan bila user menyesuaikan sendiri).
  const stdLebar = merekam
    ? (standar?.lebar?.[tableKey] ?? undefined)
    : (isPribadi(`lebar.${tableKey}`) ? undefined : standar?.lebar?.[tableKey] ?? undefined);
  const stdBeku = merekam
    ? (standar?.beku?.[tableKey] ?? undefined)
    : (isPribadi(`beku.${tableKey}`) ? undefined : standar?.beku?.[tableKey] ?? undefined);

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

  const freezeEfektif = stdBeku != null && !isPribadi(`beku.${tableKey}`) ? stdBeku : freeze;
  const freezeAktif = Math.min(freezeEfektif, visibleFields.length);
  const ubahFreeze = useCallback(
    (n: number) => {
      const v = Math.max(0, Math.min(visibleFields.length, Math.round(n)));
      if (merekam) {
        hapus(`beku.${tableKey}`);
        simpanKeStandar({ beku: { [tableKey]: v } });
        return;
      }
      setFreeze(v);
      prefSet(freezeKey(tableKey), String(v)).catch(() => {});
      tandai(`beku.${tableKey}`);
    },
    [tableKey, visibleFields.length, tandai, hapus, merekam, simpanKeStandar],
  );
  visibleFieldsRef.current = visibleFields;
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // Tinggi header otomatis: judul yang membungkus beberapa baris butuh baris
  // header lebih tinggi agar tidak meluber. Manual (pref headerH) menang;
  // observer memantau perubahan lebar kolom/font yang mengubah jumlah baris.
  useLayoutEffect(() => {
    if (headerH != null || !lebarStabil) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ukur = () => {
      const perlu = Math.min(MAX_HEADER_H, Math.max(DEFAULT_HEADER_H, ukurPerluTinggiHeader(el)));
      setHeaderAutoH((prev) => (prev === perlu ? prev : perlu));
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    const barisHeader = el.querySelector<HTMLElement>('.dsg-row.dsg-row-header');
    ro.observe(barisHeader ?? el);
    return () => ro.disconnect();
  }, [headerH, lebarStabil, tableKey, visibleFields, fontPx, fontFamily]);

  useEffect(() => {
    // Cache sesi: lebar sudah final, tidak perlu muat dari disk (menghindari
    // render perantara yang menggeser kolom).
    if (cacheHadRef.current) {
      setWidthsReady(true);
      return;
    }
    setWidthsReady(false);
    loadWidths(widthsKey(tableKey)).then((w) => {
      setWidths(w);
      setWidthsReady(true);
    });
  }, [tableKey]);

  // Simpan lebar terbaru ke cache sesi (dipakai kunjungan ulang).
  useEffect(() => {
    writeWidthCache(tableKey, { widths });
  }, [tableKey, widths]);
  useEffect(() => {
    writeWidthCache(tableKey, { autoWidths });
  }, [tableKey, autoWidths]);

  // Tampilkan grid setelah DSG benar-benar memakai lebar basis kita. Pada frame
  // pertama DSG merender semua kolom 100px (bawaan) sebelum basis diterapkan —
  // tanpa penahan ini header tampak "melompat". Kolom pertama (checkbox) selalu
  // CHECK_W, jadi kita tunggu sampai lebarnya bukan lagi 100 (bawaan DSG).
  useEffect(() => {
    if (lebarStabil) return;
    // Tanpa kolom centang tak ada penanda lebar basis pertama → tunggu lebar
    // basis kolom data siap, lalu tampilkan.
    if (hideCheckbox) {
      if (widthsReady && !loading) setLebarStabil(true);
      return;
    }
    if (!widthsReady || loading) return;
    if (rows.length === 0) {
      setLebarStabil(true);
      return;
    }
    let tries = 0;
    let raf = 0;
    let batal = false;
    const cek = () => {
      if (batal) return;
      const head = wrapRef.current?.querySelector<HTMLElement>(
        '.dsg-row-header .dsg-cell:not(.dsg-cell-gutter)',
      );
      const w = head ? Math.round(head.getBoundingClientRect().width) : 0;
      if (Math.abs(w - CHECK_W) <= 1 || ++tries > 20) {
        setLebarStabil(true);
        return;
      }
      raf = requestAnimationFrame(cek);
    };
    raf = requestAnimationFrame(cek);
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
    };
  }, [lebarStabil, widthsReady, loading, rows.length, tableKey, hideCheckbox]);

  useEffect(() => {
    const t = setTimeout(() => setLebarStabil(true), 1500);
    return () => clearTimeout(t);
  }, [tableKey]);

  // Ukur lebar kolom Aksi dari tombol yang benar-benar dirender SEBELUM cat
  // (useLayoutEffect). Kolom teks sudah final dari syncAutoWidths; hanya Aksi
  // yang tak bisa dihitung sinkron karena jumlah/isi tombol bergantung data.
  useLayoutEffect(() => {
    if (hideActions) return;
    if (widthsRef.current.__aksi !== undefined) return;
    const w = measureActionsWidth(wrapRef.current);
    if (w == null) return;
    setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lebarStabil, rows, fields, visibleFields]);

  // Muat awal: kolom yang belum punya lebar tersimpan disesuaikan dengan isi
  // (judul dipakai bila lebih panjang dari data). Menunggu widthsReady supaya
  // tidak menimpa sesaat lebar simpanan pengguna yang sedang dibaca, dan
  // menunggu font selesai dimuat agar pengukuran teks akurat.
  useEffect(() => {
    if (fittedRef.current === tableKey) return;
    if (!widthsReady || loading || rows.length === 0) return;
    // Virtualizer DSG baru merender baris setelah mengukur wadah, jadi tunggu
    // sampai sel data benar-benar ada di DOM sebelum mengukur teks.
    let tries = 0;
    let raf = 0;
    let batal = false;
    let batalFit: (() => void) | null = null;
    const attempt = () => {
      if (batal || fittedRef.current === tableKey) return;
      const ready = !!wrapRef.current?.querySelector(
        '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)',
      );
      if (!ready) {
        if (++tries < 120) raf = requestAnimationFrame(attempt);
        return;
      }
      fittedRef.current = tableKey;
      // Lebar sudah tampil dari syncAutoWidths; AutoFit DOM di sini hanya
      // menyempurnakan kolom (mis. Aksi) tanpa menahan tampilnya grid.
      batalFit = scheduleAutoFit();
    };
    const mulai = () => {
      if (!batal) raf = requestAnimationFrame(attempt);
    };
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(mulai).catch(mulai);
    } else {
      mulai();
    }
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      batalFit?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, widthsReady, loading, rows, fields, visibleFields]);

  // Bersihkan span pengukur teks saat tabel dilepas.
  useEffect(
    () => () => {
      bersihkanProbe();
    },
    [],
  );

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
  // kotak cari/filter di toolbar juga dikecualikan agar Esc saat mengetik tidak
  // keluar dari mode Edit/Input.
  useEffect(() => {
    if (!((canEdit && editMode) || showInput)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      if (t?.closest?.('[data-part="toolbar_tabel"]')) return;
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

  // Shortcut Ctrl/Cmd+C di grid ditangani DSG tanpa notifikasi — beri toast singkat.
  // Kondisi: ada sel aktif grid & tidak sedang mengedit. Editor sel / input lain
  // (termasuk fallback textarea toolbar) dilewati agar tidak dobel notifikasi.
  useEffect(() => {
    function saatSalin(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const root = wrapRef.current;
      if (!root?.querySelector('.dsg-active-cell')) return;
      if (root.querySelector('.dsg-active-cell-focus')) return; // sedang mengedit sel
      toast.success('Telah disalin ke clipboard.');
    }
    document.addEventListener('copy', saatSalin);
    return () => document.removeEventListener('copy', saatSalin);
  }, []);

  // Ukuran/jenis huruf berubah → teks butuh lebar baru: hitung ulang AutoFit
  // (lebar yang sudah diatur pengguna tetap dipertahankan).
  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontPx, fontFamily]);

  // Data berubah (ganti kegiatan/filter/muat ulang) → sesuaikan ulang lebar
  // kolom yang belum diatur pengguna.
  useEffect(() => {
    if (skipFitPertamaRef.current) return;
    if (fittedRef.current !== tableKey) return;
    return scheduleAutoFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fields, visibleFields]);

  // Setelah commit pertama, AutoFit kembali normal (perubahan berikutnya —
  // huruf/data/filter — boleh menyesuaikan lebar). Efek ini SENGAJA ditaruh
  // setelah efek AutoFit agar urutan mount tidak melewati penjagaan cache.
  useEffect(() => {
    skipFitPertamaRef.current = false;
  }, []);

  function persistWidths(next: Record<string, number>) {
    prefSet(widthsKey(tableKey), JSON.stringify(next)).catch(() => {});
  }

  /** Urutan id kolom grid (tanpa gutter) — untuk memetakan indeks seleksi. */
  function gridColumnKeys(): string[] {
    return [
      ...(hideCheckbox ? [] : ['check']),
      ...visibleFieldsRef.current.map((f) => f.key),
      ...(hideActions ? [] : ['__aksi']),
    ];
  }

  /** Kolom-kolom yang sedang terseleksi, kolom checkbox dikecualikan karena
   *  lebarnya tetap. Dipakai untuk resize serentak seperti Excel: pilih
   *  beberapa kolom → ubah lebar salah satunya → semuanya jadi sama lebar. */
  function selectedColumnKeys(): string[] {
    const r = rangeRef.current;
    if (!r || r.max.col <= r.min.col) return [];
    const keys = gridColumnKeys();
    const out: string[] = [];
    for (let c = r.min.col; c <= r.max.col; c++) {
      const k = keys[c];
      if (k && k !== 'check') out.push(k);
    }
    return out;
  }

  /** Seret gagang tepi kanan judul untuk ubah lebar kolom.
   *  Bila beberapa kolom penuh terseleksi, semuanya diubah ke lebar sama. */
  function startResize(
    key: string,
    e: { preventDefault(): void; stopPropagation(): void; clientX: number },
  ) {
    e.preventDefault();
    e.stopPropagation();
    const f = fieldsRef.current.find((x) => x.key === key);
    const startW = widthsRef.current[key] ?? autoWidthsRef.current[key] ?? f?.width ?? 150;
    const group = selectedColumnKeys();
    const targets = group.length > 1 && group.includes(key) ? group : [key];
    resizeRef.current = { key, startX: e.clientX, startW, targets };
    const onMove = (ev: MouseEvent) => {
      const d = resizeRef.current;
      if (!d) return;
      const w = Math.max(MIN_COL_W, Math.round(d.startW + (ev.clientX - d.startX)));
      setWidths((prev) => {
        const next = { ...prev };
        for (const t of d.targets) next[t] = w;
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizeListenersRef.current = null;
      resizeRef.current = null;
      if (merekam) {
        // Bertindak sebagai lembaga → lebar kolom disimpan ke standar lembaga.
        const map = { ...(stdLebar ?? {}), ...widthsRef.current };
        hapus(`lebar.${tableKey}`);
        simpanKeStandar({ lebar: { [tableKey]: map } });
        setWidths({});
        prefSet(widthsKey(tableKey), '{}').catch(() => {});
        return;
      }
      setWidths((prev) => {
        persistWidths(prev);
        return prev;
      });
      tandai(`lebar.${tableKey}`);
    };
    resizeListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Unmount saat masih menyeret gagang → lepas listener agar tidak bocor.
  useEffect(
    () => () => {
      const l = resizeListenersRef.current;
      if (!l) return;
      window.removeEventListener('mousemove', l.move);
      window.removeEventListener('mouseup', l.up);
      resizeListenersRef.current = null;
    },
    [],
  );

  /** Ukur lebar teks dengan font & padding nyata dari DOM (akurat ikut tema). */
  function autoFitWidth(key: string): number | null {
    return ukurAutoFit(wrapRef.current, key, {
      fields: fieldsRef.current,
      rows: rowsRef.current,
      labelKolom,
      teksSel: (f, rowId, k) =>
        teksTampilSel(f, gridById.get(rowId)?.[k], attrByKey.get(k)?.format),
      dapatkanCtx: () => (measureCtxRef.current ??= document.createElement('canvas').getContext('2d')),
    });
  }

  /** AutoFit semua kolom yang belum punya lebar tersimpan (muat awal).
   *  `ignoreSaved = true` untukReset: lebar simpanan baru dibuang, jadi
   *  semua kolom dihitung ulang. */
  function computeAutoWidths(ignoreSaved = false): Record<string, number> {
    const out: Record<string, number> = {};
    const keys = [
      ...visibleFieldsRef.current.map((f) => f.key),
      ...(hideActions ? [] : ['__aksi']),
    ];
    for (const key of keys) {
      if (!ignoreSaved && widthsRef.current[key] !== undefined) continue;
      // Bila pengukuran gagal sesaat (sel aksi/teks belum dirender virtualisasi),
      // pertahankan hasil ukur terakhir — lebih baik daripada jatuh ke lebar bawaan.
      const w = autoFitWidth(key) ?? autoWidthsRef.current[key] ?? null;
      if (w != null) out[key] = w;
    }
    return out;
  }

  /** Terapkan AutoFit kolom non-manual, diulang satu frame lagi supaya sel
   *  yang telat dirender DSG ikut terukur (kolom Aksi paling sering telat). */
  function scheduleAutoFit() {
    let raf2 = 0;
    const terapkan = () =>
      setAutoWidths((prev) => {
        const auto = computeAutoWidths();
        const keys = Object.keys(auto);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === auto[k])) return prev;
        return auto;
      });
    const raf1 = requestAnimationFrame(() => {
      terapkan();
      raf2 = requestAnimationFrame(terapkan);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }

  /** AutoFit satu kolom: klik 2× pada gagang tepi kanan judul (seperti Excel).
   *  Hasilnya TIDAK disimpan sebagai lebar pengguna: kolom dinamis (mis. Status,
   *  Aksi) berubah isi kapan saja dan harus selalu dihitung ulang. Menekan
   *  AutoFit pada kolom yang pernah diseret manual = melepas lebar manualnya. */
  function onAutoFit(key: string) {
    const w = autoFitWidth(key);
    if (w == null) return;
    setAutoWidths((prev) => ({ ...prev, [key]: w }));
    if (merekam) {
      // Bertindak sebagai lembaga → lepas lebar kolom itu dari standar lembaga.
      const map = { ...(stdLebar ?? {}) };
      delete map[key];
      hapus(`lebar.${tableKey}`);
      simpanKeStandar({
        lebar: { [tableKey]: Object.keys(map).length > 0 ? map : null },
      });
      setWidths({});
      prefSet(widthsKey(tableKey), '{}').catch(() => {});
      toast.success('Lebar kolom disesuaikan dengan isi.');
      return;
    }
    setWidths((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      persistWidths(next);
      return next;
    });
    // AutoFit = user menentukan lebar sendiri → lepas dari standar lembaga.
    tandai(`lebar.${tableKey}`);
    toast.success('Lebar kolom disesuaikan dengan isi.');
  }

  /** AutoFit seluruh kolom (tombol toolbar). Sama: tidak disimpan permanen. */
  function onAutoFitAll() {
    const nextAuto: Record<string, number> = {};
    let n = 0;
    for (const key of [...visibleFieldsRef.current.map((f) => f.key), '__aksi']) {
      const w = autoFitWidth(key);
      if (w != null) {
        nextAuto[key] = w;
        n++;
      }
    }
    setAutoWidths(nextAuto);
    if (merekam) {
      hapus(`lebar.${tableKey}`);
      simpanKeStandar({ lebar: { [tableKey]: null } });
      setWidths({});
      prefSet(widthsKey(tableKey), '{}').catch(() => {});
      toast.success(n > 0 ? `${n} kolom disesuaikan lebarnya.` : 'Tidak ada kolom yang bisa disesuaikan.');
      return;
    }
    setWidths((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      persistWidths({});
      return {};
    });
    tandai(`lebar.${tableKey}`);
    toast.success(n > 0 ? `${n} kolom disesuaikan lebarnya.` : 'Tidak ada kolom yang bisa disesuaikan.');
  }

  /** Kolom Aksi hanya terender saat berada di viewport (virtualisasi kolom
   *  DSG), jadi lebarnya dipaskan begitu grid digeser horizontal — selama
   *  pengguna belum pernah mengatur lebarnya sendiri. Sel yang baru muncul
   *  kadang belum ada saat event scroll tiba, jadi coba ulang beberapa frame. */
  function fitActionsIfNeeded() {
    if (hideActions) return;
    if (aksiFitRef.current || widthsRef.current.__aksi !== undefined) return;
    aksiFitRef.current = true;
    let tries = 0;
    const coba = () => {
      const w = measureActionsWidth(wrapRef.current);
      if (w != null) {
        aksiFitRef.current = false;
        setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
        return;
      }
      if (++tries < 12) requestAnimationFrame(coba);
      else aksiFitRef.current = false;
    };
    requestAnimationFrame(coba);
  }

  const effectiveH = rowH ?? densityPx;
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
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

  // "keluarga|ketebalan"; bawaan = pakai font & ketebalan aplikasi.
  const fontChoice = FONT_OPTIONS.find((f) => f.value === fontFamily);
  const [fontStack, fontStackWeight] =
    fontChoice && fontChoice.value !== FONT_FAMILY_DEFAULT
      ? fontChoice.value.split('|')
      : ['', ''];
  const editing = canEdit && editMode;

  /** Lebar kolom awal yang dihitung SINKRON saat render (tanpa DOM grid/font
   *  ready) memakai host pengukuran offscreen. Grid jadi bisa tampil langsung
   *  dengan lebar final — tidak ada geseran, tidak ada jeda muat tambahan.
   *  Hasil ini hanya dipakai untuk kolom yang belum punya lebar tersimpan;
   *  AutoFit DOM (saat font/data berubah) tetap boleh menyempurnakan. */
  const syncAutoWidths = useMemo<Record<string, number>>(() => {
    const host = hostUkur();
    if (!host) return {};
    host.style.setProperty('--simpes-font-size', `${effectiveFont}px`);
    if (fontStack) {
      host.style.setProperty('--simpes-font-family', fontStack);
      host.style.setProperty('--simpes-font-weight', fontStackWeight || '400');
    } else {
      host.style.removeProperty('--simpes-font-family');
      host.style.removeProperty('--simpes-font-weight');
    }
    const cellEl = host.querySelector<HTMLElement>('.dsg-row:not(.dsg-row-header) .dsg-cell');
    const headCellEl = host.querySelector<HTMLElement>('.dsg-row.dsg-row-header .dsg-cell');
    const headContEl = host.querySelector<HTMLElement>('.dsg-cell-header-container');
    const cellProbe = host.querySelector<HTMLElement>('[data-ukur="cell"]');
    const headProbe = host.querySelector<HTMLElement>('[data-ukur="head"]');
    if (!cellEl || !headCellEl || !headContEl || !cellProbe || !headProbe) return {};
    const csCell = getComputedStyle(cellEl);
    const csHeadCell = getComputedStyle(headCellEl);
    const csHeadCont = getComputedStyle(headContEl);
    const pasangFont = (probe: HTMLElement, cs: CSSStyleDeclaration) => {
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.fontVariantNumeric = cs.fontVariantNumeric;
      probe.style.fontFeatureSettings = cs.fontFeatureSettings;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.style.whiteSpace = 'pre';
    };
    const lebar = (probe: HTMLElement, cs: CSSStyleDeclaration, text: string) => {
      pasangFont(probe, cs);
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    const padOf = (cs: CSSStyleDeclaration) =>
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padCell = padOf(csCell);
    const padHead = padOf(csHeadCell) + padOf(csHeadCont);
    const out: Record<string, number> = {};
    const values = rows.map((r) => getValuesRef.current(r) as Record<string, unknown>);
    for (const f of visibleFields) {
      let w = lebar(headProbe, csHeadCont, labelKolom(f.key, f.label)) + padHead + AUTOFIT_BUFFER;
      for (const v of values) {
        const s = teksTampilSel(f, v[f.key], attrByKey.get(f.key)?.format);
        if (!s) continue;
        w = Math.max(w, lebar(cellProbe, csCell, s) + padCell + AUTOFIT_BUFFER);
      }
      out[f.key] = Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, visibleFields, effectiveFont, fontStack, fontStackWeight, labelKolom, attrByKey]);

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

  function handleChange(newValue: GridRow[]) {
    const base = new Map<string, T>(rowsRef.current.map((r) => [String(r.id), r]));
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
    /** Kelas perataan kolom: kamus DB > preferensi pribadi (bawaan tengah). */
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
      const lebarTerkunci = lebarKunci(f.key);
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
            tooltip={attrByKey.get(f.key)?.tooltip ?? null}
            terkunci={lebarTerkunci != null}
          />
        ),
        headerClassName: cn(alignClass(f.key), bekuCls, tepiCls, lastCls),
        basis: lebarTerkunci ?? widths[f.key] ?? stdLebar?.[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150,
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
              if (!showInput && String(id) !== INPUT_ROW_ID) enableEditByDoubleClick();
            },
            onClickCell: (id: string | number) => {
              if (String(id) === INPUT_ROW_ID) openEditorForActiveCell();
              else openEditorByClick();
            },
          },
          disableKeys: true,
          keepFocus: false,
          disabled: ({ rowData }: { rowData: GridRow }) =>
            !(editing || isInputRow(rowData)),
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
          columnData: { fieldKey: f.key, label: f.label, bisaEdit: canEdit },
          disableKeys: true,
          keepFocus: false,
          disabled: ({ rowData }: { rowData: GridRow }) =>
            !canEdit || String(rowData.id) === INPUT_ROW_ID,
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
  }, [fields, visibleFields, editing, widths, stdLebar, autoWidths, syncAutoWidths, align, showInput, freezeAktif, hideCheckbox, labelKolom, attrByKey, alignEfektif, lebarKunci, drafts]);

  /** Simpan baris input → buat record baru via onCreateRow halaman. Validasi
   *  field wajib + validator kolom dulu; draft dibersihkan hanya bila sukses
   *  (toast sukses menjadi tanggung jawab halaman). */
  /** Periksa baris input tanpa efek samping: nilai, kolom kurang, pesan. */
  function periksaInput() {
    const d = inputDraftRef.current;
    const flds: Record<string, string | null> = {};
    const kurang: string[] = [];
    let pesan: string | null = null;
    for (const f of visibleFieldsRef.current) {
      if (f.kind === 'static' && !f.inputKind) continue;
      const raw = d[f.key] ?? inputRowValues?.[f.key] ?? null;
      const v = raw == null || String(raw).trim() === '' ? null : String(raw);
      flds[f.key] = v;
      if (f.required && v === null) {
        kurang.push(f.label);
        continue;
      }
      if (v !== null && f.validate) {
        const blocked = f.validate(v);
        if (blocked && pesan === null) pesan = blocked;
      }
    }
    return { flds, kurang, pesan, valid: kurang.length === 0 && pesan === null };
  }

  async function simpanInput() {
    if (!onCreateRow) return;
    const { flds, kurang, pesan, valid } = periksaInput();
    if (!valid) {
      // Kolom wajib belum lengkap → tidak ada yang disimpan.
      if (pesan) toast.error(pesan);
      else toast.error('Kolom wajib harus diisi terlebih dahulu.', { description: kurang.join(', ') });
      return;
    }
    try {
      await onCreateRow(flds);
      inputDraftRef.current = {};
      // Kursor pindah ke baris bawah (baris input) setelah data dimuat.
      pindahKeInputRef.current = true;
      setDrafts((prev) => {
        if (!(INPUT_ROW_ID in prev)) return prev;
        const next = { ...prev };
        delete next[INPUT_ROW_ID];
        return next;
      });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Enter pada baris input: simpan bila kolom wajib lengkap. Kembalikan true
   *  bila kursor boleh turun ke baris bawah (baris input berikutnya). */
  function enterInputRow(columnIndex: number): boolean {
    if (!onCreateRow) return false;
    inputKolomRef.current = columnIndex;
    const { valid } = periksaInput();
    void simpanInput();
    return valid;
  }
  const inputEnterRef = useRef(enterInputRow);
  inputEnterRef.current = enterInputRow;

  /** Setelah simpan sukses: pindahkan kursor ke baris input (baris di bawah
   *  data yang baru dibuat) begitu daftar selesai dimuat. */
  useEffect(() => {
    if (!pindahKeInputRef.current || loading) return;
    const idx = gridValue.findIndex((r) => String(r.id) === INPUT_ROW_ID);
    if (idx < 0) return;
    pindahKeInputRef.current = false;
    gridRef.current?.setActiveCell({ col: inputKolomRef.current, row: idx });
  }, [gridValue, loading]);

  /** Handler simpan baris input (dipakai tombol di kolom Aksi & Enter). */
  const inputAksiRef = useRef<() => void>(() => {});
  inputAksiRef.current = () => void simpanInput();


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
      ringkas: aksiRingkas,
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
  }), [widths, autoWidths, tableKey, aksiRingkas]);

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

  function displayOf(id: string | number, key: string): string {
    const v = gridById.get(String(id))?.[key];
    if (v == null) return '';
    const format = attrByKey.get(key)?.format;
    return format ? formatNilai(String(v), format) : String(v);
  }

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
      const idx = Math.round((parseFloat(rowEl.style.top || '0') || 0) / effectiveH);
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

  /** Salin satu baris (kolom terlihat) sebagai TSV. */
  async function salinBarisCtx(id: T['id']) {
    const header = visibleFieldsRef.current.map((f) => labelKolom(f.key, f.label));
    const body = [visibleFieldsRef.current.map((f) => displayOf(id, f.key))];
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success('Baris disalin (TSV).');
    else toast.error('Gagal menyalin.');
  }

  /** Salin nilai satu sel. */
  async function salinSelCtx(id: T['id'], key: string) {
    const ok = await copyText(displayOf(id, key));
    if (ok) toast.success('Nilai sel disalin.');
    else toast.error('Gagal menyalin.');
  }

  /** Salin seluruh kolom (label header + nilai semua baris) sebagai TSV. */
  async function salinKolomCtx(key: string) {
    const f = fieldsRef.current.find((x) => x.key === key);
    if (!f) return;
    const header = [labelKolom(key, f.label)];
    const body = rowsRef.current.map((r) => [displayOf(r.id, key)]);
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success(`${body.length} baris kolom disalin (TSV).`);
    else toast.error('Gagal menyalin.');
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

  async function onCopy() {
    const checkedRows = rows.filter((r) => checkedIds.has(r.id));
    let header: string[];
    let body: string[][];
    if (checkedRows.length > 0) {
      header = visibleFields.map((f) => labelKolom(f.key, f.label));
      body = checkedRows.map((r) => visibleFields.map((f) => displayOf(r.id, f.key)));
    } else if (range) {
      const r0 = Math.max(0, Math.min(range.min.row, range.max.row));
      const r1 = Math.min(gridValue.length - 1, Math.max(range.min.row, range.max.row));
      const keys = gridColumnKeys();
      const picked: { key: string; label: string }[] = [];
      for (let c = Math.min(range.min.col, range.max.col); c <= Math.max(range.min.col, range.max.col); c++) {
        const k = keys[c];
        if (!k || k === 'check' || k === '__aksi') continue;
        const f = visibleFields.find((v) => v.key === k);
        if (f) picked.push({ key: f.key, label: labelKolom(f.key, f.label) });
      }
      if (r1 < r0 || picked.length === 0) return;
      header = picked.map((p) => p.label);
      body = [];
      for (let r = r0; r <= r1; r++) {
        const g = gridValue[r];
        if (!g) continue;
        body.push(picked.map((p) => displayOf(g.id, p.key)));
      }
    } else {
      return;
    }
    if (body.length === 0) return;
    const n = checkedRows.length > 0 ? checkedRows.length : body.length;
    const ok = await copyText(toTSV(header, body));
    if (ok) toast.success(`${n} baris disalin (TSV, siap tempel ke Excel).`);
    else toast.error('Gagal menyalin. Coba blok manual + Ctrl+C.');
  }

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
    setWidths({});
    prefSet(widthsKey(tableKey), '{}').catch(() => {});
    // Kembali ke standar/bawaan = lebar menyesuaikan isi (dihitung ulang).
    hapus(`lebar.${tableKey}`);
    if (merekam) simpanKeStandar({ lebar: { [tableKey]: null } });
    fittedRef.current = null;
    setAutoWidths(computeAutoWidths(true));
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

  const hasSearchInput = searchValue !== undefined && !!onSearchChange;
  const hasFilter = filter !== undefined;
  const hasUrut = !!onUrut;
  const showToolbar = hasSearchInput || hasFilter || hasUrut || awalanToolbar !== undefined || akhirToolbar !== undefined;
  const showSearchButton = !!onSearchSubmit;
  const formId = searchIds?.form ?? `form_cari_${tableKey}`;
  const inputId = searchIds?.input ?? `input_cari_${tableKey}`;
  const buttonId = searchIds?.button ?? `btn_cari_${tableKey}`;

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
    <div className={cn('mt-2 flex flex-col', maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0')}>
      <ToolbarTabel
        tableKey={tableKey}
        showToolbar={showToolbar}
        hidePreset={hidePreset}
        awalanToolbar={awalanToolbar}
        akhirToolbar={akhirToolbar}
        addButton={addButton}
        filter={filter}
        formId={formId}
        inputId={inputId}
        buttonId={buttonId}
        hasSearchInput={!!hasSearchInput}
        hasFilter={hasFilter}
        showSearchButton={showSearchButton}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        searchPlaceholder={searchPlaceholder}
        checkedCount={checkedIds.size}
        checkedRows={checkedRows}
        renderBulkActions={renderBulkActions}
        clearSelection={clearSelection}
        onUrut={onUrut}
        urutAktif={urutAktif}
        arahUrut={arahUrut}
        fields={fields}
        terapkanPreset={terapkanPreset}
        presetApiRef={presetApiRef}
      />

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
          closeEditorOnOtherCell(e);
          // Halaman multi-tabel: tabel yang disentuh jadi sumber perintah ribbon.
          ribbonAktif?.(tableKey);
        }}
        className={cn(
          // Grid full-bleed: menempel tepi kiri-kanan area konten (imbangi padding
          // layout p-1) tanpa sudut membulat; toolbar tetap berpadding.
          'simpes-dsg relative -mx-1 flex flex-col',
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
                    ref={gridRef}
                    value={gridValue}
                    onChange={handleChange}
                    columns={dsgColumns}
                    stickyLeftColumnCount={freezeAktif > 0 ? freezeAktif + (hideCheckbox ? 0 : 1) : 0}
                    stickyRightColumn={hideActions ? undefined : aksiColumn}
                    rowKey="id"
                    height={gridHeight}
                    rowHeight={effectiveH}
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
                    onScroll={fitActionsIfNeeded}
                  />
                </CheckAllContext.Provider>
              )}
              {gridValue.length === 0 && !loading && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <p className="text-sm text-muted-foreground">{emptyText}</p>
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
            align={align}
            setAlign={setAlign}
            presetApiRef={presetApiRef}
            salinBaris={(id) => void salinBarisCtx(id as T['id'])}
            salinSel={(id, key) => void salinSelCtx(id as T['id'], key)}
            salinKolom={(key) => void salinKolomCtx(key)}
            onKonfirmasi={setCtxKonfirmasi}
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
    </div>
  );
}
