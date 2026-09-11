import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  checkboxColumn,
  keyColumn,
  type CellProps,
  type Column,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { DENSITY_PX } from '@/prefs';
import { useTheme } from '@/theme';
import { errorMessage, prefGet, prefSet } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_FONT_PX, FONT_FAMILY_DEFAULT, FONT_OPTIONS, useGridPrefs } from '@/components/GridPrefs';
import { Copy, MoveHorizontal, Pencil, RotateCcw, Search } from 'lucide-react';
import { copyText, toTSV } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Wadah kecil untuk mengelompokkan kontrol toolbar yang sejenis. */
function ToolbarGroup({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      title={title}
      className={cn('flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2', className)}
    >
      {children}
    </div>
  );
}

export interface ExcelChoice {
  value: string;
  label: string;
}

export interface ExcelField {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  /** text/select bisa diedit saat mode Edit aktif; static selalu baca-saja. */
  kind: 'text' | 'select' | 'static';
  choices?: ExcelChoice[];
  maxLength?: number;
  /** Kembalikan pesan galat bila nilai tidak valid, atau null bila OK. */
  validate?: (value: string | null) => string | null;
}

/** Baris grid: id + checklist + nilai string per field. */
export interface GridRow {
  id: string | number;
  checked: boolean;
  [key: string]: string | boolean | number | null;
}

/** Seleksi blok gaya spreadsheet (indeks baris/kolom numerik). */
export interface GridSelection {
  min: { row: number; col: number };
  max: { row: number; col: number };
}

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
  /** Tombol aksi utama halaman (mis. "+ Tambah X"): diletakkan sebaris
   *  dengan pencarian/filter, di sisi kanan. */
  addButton?: ReactNode;
}

const MIN_COL_W = 50;
/** Batas lebar hasil AutoFit (Excel juga membatasi, ~255 karakter). */
const AUTOFIT_MAX_W = 480;
/** Ruang napas agar teks tidak menempel garis kolom saat AutoFit. */
const AUTOFIT_BUFFER = 8;
/** Lebar kolom Aksi saat belum terukur (3 tombol ikon + padding). */
const ACTIONS_DEFAULT_W = 112;
/** Lantai lebar kolom Aksi (1 tombol ikon + padding). */
const ACTIONS_MIN_W = 56;

function widthsKey(tableKey: string) {
  return `simpes_grid_${tableKey}_w`;
}

async function loadWidths(key: string): Promise<Record<string, number>> {
  try {
    const v = await prefGet(key);
    const o = JSON.parse(v ?? '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(o)) {
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

interface TextColData {
  fieldKey: string;
  maxLength?: number;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
}

/** Editor sel DSG (input teks / select) sedang terbuka dan fokus? */
function hasOpenEditor(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el?.classList?.contains('dsg-input') || !!el?.classList?.contains('simpes-dsg-select');
}

/** Sel teks: span saat baca-saja, input saat fokus edit. */
function TextCell({ rowData, setRowData, columnData, focus, stopEditing }: CellProps<GridRow, TextColData>) {
  const key = columnData.fieldKey;
  const committed = (rowData[key] as string) ?? '';
  const [val, setVal] = useState<string | null>(null);

  useEffect(() => {
    setVal(null);
  }, [committed]);

  if (!focus && val === null) {
    return (
      <span
        className="simpes-dsg-fill"
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          // Sel yang tadinya aktif sudah otomatis membuka editor lewat
          // mousedown DSG (input fokus) — jangan buka dua kali.
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {committed}
      </span>
    );
  }
  const cur = val ?? committed;
  const commit = (v: string) => {
    if (v !== committed) setRowData({ ...rowData, [key]: v });
  };
  return (
    <input
      className="dsg-input"
      value={cur}
      maxLength={columnData.maxLength}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        commit(cur);
        setVal(null);
      }}
      onKeyDown={(e) => {
        // Tab & panah atas/bawah: commit dulu, lalu biarkan DSG yang
        // memindahkan sel + menutup mode edit (DSG tak memicu blur saat
        // input di-unmount, jadi commit wajib di sini).
        if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          commit(cur);
          setVal(null);
          return;
        }
        // Panah kiri/kanan tetap milik input (pindah kursor di dalam teks).
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          commit(cur);
          setVal(null);
          // stopEditing bawaan DSG = tutup edit + aktif turun 1 baris (kolom sama).
          stopEditing();
        } else if (e.key === 'Escape') {
          setVal(null);
          // Batal: tutup edit tanpa pindah baris.
          stopEditing({ nextRow: false });
        }
      }}
    />
  );
}

interface SelectColData {
  fieldKey: string;
  choices: ExcelChoice[];
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
}

/** Sel dropdown native (tanpa dependensi baru). */
function SelectCell({ rowData, setRowData, columnData, stopEditing, disabled }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  if (disabled) {
    return (
      <span
        className="simpes-dsg-fill"
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {cur}
      </span>
    );
  }
  return (
    <select
      className="simpes-dsg-select"
      aria-label={key}
      value={cur}
      onChange={(e) => {
        setRowData({ ...rowData, [key]: e.target.value });
        setTimeout(() => stopEditing(), 0);
      }}
      onBlur={() => stopEditing()}
      onKeyDown={(e) => {
        if (e.key === 'Tab') return;
        e.stopPropagation();
        if (e.key === 'Escape') stopEditing();
      }}
    >
      {columnData.choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

interface StaticColData {
  fieldKey: string;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: () => void;
}

/** Sel baca-saja (teks polos). */
function StaticCell({ rowData, columnData }: CellProps<GridRow, StaticColData>) {
  return (
    <span className="simpes-dsg-fill" onDoubleClick={() => columnData.onDblClick?.()}>
      {String(rowData[columnData.fieldKey] ?? '')}
    </span>
  );
}

/** Judul kolom dengan gagang seret pengubah lebar (drag di tepi kanan).
 *  Klik 2× pada gagang = AutoFit lebar mengikuti isi (seperti Excel). */
function HeaderTitle({
  label,
  colKey,
  onResizeStart,
  onAutoFit,
}: {
  label: string;
  colKey: string;
  onResizeStart: (key: string, e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  onAutoFit: (key: string) => void;
}) {
  return (
    <span className="simpes-dsg-headtitle">
      {label}
      <span
        className="simpes-dsg-resizer"
        title="Seret untuk ubah lebar • klik 2× untuk sesuaikan isi"
        onMouseDown={(e) => onResizeStart(colKey, e)}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAutoFit(colKey);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </span>
  );
}

interface ActionsColData {
  render: (id: string | number) => ReactNode;
}

/** Sel Aksi: tombol ikon dialog (klik tidak mengubah seleksi grid). */
function ActionsCell({ rowData, columnData }: CellProps<GridRow, ActionsColData>) {
  return (
    <div
      className="simpes-dsg-actions flex h-full items-center gap-1"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {columnData.render(rowData.id)}
    </div>
  );
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
  addButton,
}: ExcelTableProps<T>) {
  const { density } = useTheme();
  const densityPx = DENSITY_PX[density];
  // Preferensi tampilan tabel global (dikontrol dari top bar).
  const { rowH, fontPx, fontFamily } = useGridPrefs();

  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [checkedIds, setCheckedIds] = useState<Set<T['id']>>(new Set());
  const [range, setRange] = useState<GridSelection | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const renderRef = useRef(renderActions);
  renderRef.current = renderActions;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const resizeRef = useRef<{ key: string; startX: number; startW: number; targets: string[] } | null>(
    null,
  );
  /** Antrean simpan otomatis per baris (id → field yang belum dikirim). */
  const queueRef = useRef<Map<string, Record<string, string | null>>>(new Map());
  const drainingRef = useRef(false);
  /** Baris yang sukses tersimpan pada siklus drain berjalan. */
  const savedRef = useRef<{ id: string; keys: string[] }[]>([]);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  const [widths, setWidths] = useState<Record<string, number>>({});
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  /** Lebar AutoFit bawaan — TIDAK disimpan, dipakai hanya untuk kolom yang
   *  belum pernah diatur lebarnya oleh pengguna. Dihitung ulang tiap muat
   *  awal supaya selalu pas dengan data aktual. */
  const [autoWidths, setAutoWidths] = useState<Record<string, number>>({});
  const autoWidthsRef = useRef(autoWidths);
  autoWidthsRef.current = autoWidths;
  const [widthsReady, setWidthsReady] = useState(false);
  const fittedRef = useRef<string | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(() =>
    typeof window === 'undefined'
      ? 640
      : Math.max(280, Math.min(640, Math.floor(window.innerHeight * 0.72))),
  );

  // Tinggi grid mengikuti sisa ruang vertikal wrapper (flex-1 dari halaman).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const h = Math.floor(el.clientHeight);
      setGridH((prev) => (Math.abs(h - prev) < 1 || h <= 0 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setWidthsReady(false);
    loadWidths(widthsKey(tableKey)).then((w) => {
      setWidths(w);
      setWidthsReady(true);
    });
  }, [tableKey]);

  // Muat awal: kolom yang belum punya lebar tersimpan disesuaikan dengan isi
  // (judul dipakai bila lebih panjang dari data). Menunggu widthsReady supaya
  // tidak menimpa sesaat lebar simpanan pengguna yang sedang dibaca.
  useEffect(() => {
    if (fittedRef.current === tableKey) return;
    if (!widthsReady || loading || rows.length === 0) return;
    // Virtualizer DSG baru merender baris setelah mengukur wadah, jadi tunggu
    // sampai sel data benar-benar ada di DOM sebelum mengukur teks.
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      if (fittedRef.current === tableKey) return;
      const ready = !!wrapRef.current?.querySelector(
        '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)',
      );
      if (!ready) {
        if (++tries < 30) raf = requestAnimationFrame(attempt);
        return;
      }
      fittedRef.current = tableKey;
      const auto = computeAutoWidths();
      if (Object.keys(auto).length > 0) setAutoWidths(auto);
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, widthsReady, loading, rows, fields]);

  // Bersihkan span pengukur teks saat tabel dilepas.
  useEffect(
    () => () => {
      probeRef.current?.remove();
      probeRef.current = null;
    },
    [],
  );

  // Seleksi + range mengikuti data aktif.
  useEffect(() => {
    setCheckedIds(new Set());
    setRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Esc saat TIDAK sedang mengedit sel = keluar dari mode Edit.
  // Esc di dalam editor sel ditangani TextCell/SelectCell (tidak sampai ke sini).
  useEffect(() => {
    if (!(canEdit && editMode)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      // Jangan ikut menutup saat Esc dipakai dialog/dropdown yang sedang terbuka.
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      setEditMode(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canEdit, editMode]);

  // Ukuran/jenis huruf berubah → teks butuh lebar baru: hitung ulang AutoFit
  // (lebar yang sudah diatur pengguna tetap dipertahankan).
  useEffect(() => {
    if (fittedRef.current !== tableKey) return;
    const raf = requestAnimationFrame(() => setAutoWidths(computeAutoWidths()));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontPx, fontFamily]);

  function persistWidths(next: Record<string, number>) {
    prefSet(widthsKey(tableKey), JSON.stringify(next)).catch(() => {});
  }

  /** Urutan id kolom grid (tanpa gutter) — untuk memetakan indeks seleksi. */
  function gridColumnKeys(): string[] {
    return ['check', ...fieldsRef.current.map((f) => f.key), '__aksi'];
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
      resizeRef.current = null;
      setWidths((prev) => {
        persistWidths(prev);
        return prev;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Ukur lebar teks memakai span tersembunyi dengan SELURUH properti font
   *  nyata dari sel. Canvas tidak cukup: `font-variant-numeric: tabular-nums`
   *  (dipakai sel) tidak bisa direpresentasikan canvas sehingga hasilnya
   *  ~8px lebih sempit dan teks panjang (mis. email) jadi terpotong. */
  function measureTextWidth(text: string, cs: CSSStyleDeclaration): number {
    let probe = probeRef.current;
    if (!probe) {
      probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.left = '-10000px';
      probe.style.top = '0';
      probe.style.whiteSpace = 'pre';
      probe.style.pointerEvents = 'none';
      document.body.appendChild(probe);
      probeRef.current = probe;
    }
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStyle = cs.fontStyle;
    probe.style.fontVariantNumeric = cs.fontVariantNumeric;
    probe.style.fontFeatureSettings = cs.fontFeatureSettings;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  }

  /** Lebar kolom Aksi diukur dari tombol yang benar-benar dirender — jumlah
   *  tombol bergantung role/baris sehingga tidak bisa dihitung dari data.
   *  Mengembalikan null bila kolom Aksi sedang tidak dirender (virtualisasi). */
  function measureActionsWidth(): number | null {
    const root = wrapRef.current;
    if (!root) return null;
    let content = 0;
    let pad = 24;
    for (const box of Array.from(root.querySelectorAll<HTMLElement>('.simpes-dsg-actions'))) {
      const kids = Array.from(box.children) as HTMLElement[];
      if (kids.length === 0) continue;
      const first = kids[0].getBoundingClientRect();
      const last = kids[kids.length - 1].getBoundingClientRect();
      content = Math.max(content, last.right - first.left);
      const cell = box.closest<HTMLElement>('.dsg-cell');
      if (cell) {
        const cs = getComputedStyle(cell);
        pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      }
    }
    if (content <= 0) return null;
    return Math.min(
      AUTOFIT_MAX_W,
      Math.max(ACTIONS_MIN_W, Math.ceil(content) + pad + AUTOFIT_BUFFER),
    );
  }

  /** Ukur lebar teks dengan font & padding nyata dari DOM (akurat ikut tema). */
  function autoFitWidth(key: string): number | null {
    const root = wrapRef.current;
    if (!root) return null;
    if (key === '__aksi') return measureActionsWidth();
    const f = fieldsRef.current.find((x) => x.key === key);
    if (!f) return null;
    // Ambil sel data TEKS: bukan gutter (padding 5px) dan bukan sel checkbox
    // (padding 0) — keduanya punya padding berbeda dari sel isi sehingga
    // lebar hasil AutoFit jadi kurang.
    const cellEl =
      root.querySelector<HTMLElement>(
        '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter):not(:has(> input.dsg-checkbox))',
      ) ??
      root.querySelector<HTMLElement>('.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)');
    const headEl = root.querySelector<HTMLElement>('.dsg-row-header .dsg-cell');
    if (!cellEl || !headEl) return null;
    const ctx = (measureCtxRef.current ??= document.createElement('canvas').getContext('2d'));
    if (!ctx) return null;

    const fontOf = (cs: CSSStyleDeclaration) =>
      `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const padOf = (cs: CSSStyleDeclaration) =>
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);

    const csHead = getComputedStyle(headEl);
    const headCont = headEl.querySelector<HTMLElement>('.dsg-cell-header-container');
    const padHead = padOf(csHead) + (headCont ? padOf(getComputedStyle(headCont)) : 0);
    const csCell = getComputedStyle(cellEl);
    const padCell = padOf(csCell);

    // Canvas dipakai hanya untuk MENYARING kandidat terlebar (cepat), lalu
    // kandidat itu diukur presisi dengan span DOM. Selisih canvas vs DOM
    // berasal dari tabular-nums/kerning, jadi ambil margin lebar.
    const CANDIDATE_MARGIN = 40;
    ctx.font = fontOf(csCell);
    const values: { v: string; cw: number }[] = [];
    let maxCw = 0;
    for (const r of rowsRef.current) {
      const v = displayOf(r.id, key);
      if (!v) continue;
      const cw = ctx.measureText(v).width;
      if (cw > maxCw) maxCw = cw;
      values.push({ v, cw });
    }

    let w = measureTextWidth(f.label, csHead) + padHead + AUTOFIT_BUFFER;
    for (const { v, cw } of values) {
      if (cw < maxCw - CANDIDATE_MARGIN) continue;
      w = Math.max(w, measureTextWidth(v, csCell) + padCell + AUTOFIT_BUFFER);
    }
    return Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, f.minWidth ?? MIN_COL_W, Math.ceil(w)));
  }

  /** AutoFit semua kolom yang belum punya lebar tersimpan (muat awal).
   *  `ignoreSaved = true` untukReset: lebar simpanan baru dibuang, jadi
   *  semua kolom dihitung ulang. */
  function computeAutoWidths(ignoreSaved = false): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of [...fieldsRef.current.map((f) => f.key), '__aksi']) {
      if (!ignoreSaved && widthsRef.current[key] !== undefined) continue;
      const w = autoFitWidth(key);
      if (w != null) out[key] = w;
    }
    return out;
  }

  /** AutoFit satu kolom: klik 2× pada gagang tepi kanan judul (seperti Excel). */
  function onAutoFit(key: string) {
    const w = autoFitWidth(key);
    if (w == null) return;
    setWidths((prev) => {
      const next = { ...prev, [key]: w };
      persistWidths(next);
      return next;
    });
    toast.success('Lebar kolom disesuaikan dengan isi.');
  }

  /** AutoFit seluruh kolom (tombol toolbar). */
  function onAutoFitAll() {
    const next = { ...widthsRef.current };
    let n = 0;
    for (const key of [...fieldsRef.current.map((f) => f.key), '__aksi']) {
      const w = autoFitWidth(key);
      if (w != null) {
        next[key] = w;
        n++;
      }
    }
    setWidths(next);
    persistWidths(next);
    toast.success(n > 0 ? `${n} kolom disesuaikan lebarnya.` : 'Tidak ada kolom yang bisa disesuaikan.');
  }

  /** Kolom Aksi hanya terender saat berada di viewport (virtualisasi), jadi
   *  lebarnya dipaskan begitu grid digeser horizontal — selama pengguna
   *  belum pernah mengatur lebarnya sendiri. */
  function fitActionsIfNeeded() {
    if (widthsRef.current.__aksi !== undefined) return;
    const w = measureActionsWidth();
    if (w == null) return;
    setAutoWidths((prev) => (prev.__aksi === w ? prev : { ...prev, __aksi: w }));
  }

  const effectiveH = rowH ?? densityPx;
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  // "keluarga|ketebalan"; bawaan = pakai font & ketebalan aplikasi.
  const fontChoice = FONT_OPTIONS.find((f) => f.value === fontFamily);
  const [fontStack, fontStackWeight] =
    fontChoice && fontChoice.value !== FONT_FAMILY_DEFAULT
      ? fontChoice.value.split('|')
      : ['', ''];
  const editing = canEdit && editMode;
  const editableKeys = useMemo(() => fields.filter((f) => f.kind !== 'static').map((f) => f.key), [fields]);

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

  /** Nilai grid = baris server ditimpa draft lokal + checklist. */
  const gridValue: GridRow[] = useMemo(
    () =>
      rows.map((r) => {
        const base = getValues(r);
        const d = drafts[String(r.id)] ?? {};
        const g: GridRow = { id: r.id, checked: checkedIds.has(r.id) };
        for (const f of fields) {
          g[f.key] = d[f.key] !== undefined ? d[f.key] : (base[f.key] ?? null);
        }
        return g;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, drafts, checkedIds, fields, getValues],
  );

  function handleChange(newValue: GridRow[]) {
    const base = new Map<string, T>(rowsRef.current.map((r) => [String(r.id), r]));
    const nd: Drafts = {};
    const nc = new Set<T['id']>();
    for (const g of newValue) {
      const id = g.id as T['id'];
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
    for (const [idKey, flds] of Object.entries(nd)) enqueueSave(idKey, flds);
  }

  const dsgColumns: Column<GridRow>[] = useMemo(() => {
    const cols: Column<GridRow>[] = [
      {
        ...keyColumn<GridRow, 'checked'>('checked', checkboxColumn),
        id: 'check',
        title: (
          <span className="flex w-full items-center justify-center">
            <input
              type="checkbox"
              aria-label="Pilih semua baris"
              className="simpes-dsg-checkall"
              checked={rows.length > 0 && rows.every((r) => checkedIds.has(r.id))}
              ref={(el) => {
                if (el) {
                  el.indeterminate =
                    rows.some((r) => checkedIds.has(r.id)) && !rows.every((r) => checkedIds.has(r.id));
                }
              }}
              onChange={(e) => {
                const next = new Set<T['id']>();
                if (e.target.checked) rows.forEach((r) => next.add(r.id));
                setCheckedIds(next);
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </span>
        ),
        basis: 44,
        grow: 0,
        shrink: 0,
        minWidth: 44,
      },
    ];
    for (const f of fields) {
      const common = {
        id: f.key,
        title: <HeaderTitle label={f.label} colKey={f.key} onResizeStart={startResize} onAutoFit={onAutoFit} />,
        basis: widths[f.key] ?? autoWidths[f.key] ?? f.width ?? 150,
        // Semua kolom fixed (grow 0): lebar hanya berubah saat digagang
        // seret atau di-AutoFit, persis seperti Excel. Sisa ruang di kanan
        // dibiarkan kosong, bukan dibagi ke kolom elastis.
        grow: 0,
        shrink: 0,
        minWidth: f.minWidth ?? 80,
        cellClassName: ({ rowData }: { rowData: GridRow }) =>
          draftsRef.current[String(rowData.id)]?.[f.key] !== undefined ? 'simpes-dsg-dirty' : undefined,
      };
      if (f.kind === 'static') {
        cols.push({
          ...common,
          component: StaticCell,
          columnData: { fieldKey: f.key, onDblClick: enableEditByDoubleClick },
          disableKeys: false,
          keepFocus: false,
          disabled: true,
          deleteValue: ({ rowData }) => rowData,
          copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
          pasteValue: ({ rowData }) => rowData,
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      } else if (f.kind === 'select') {
        cols.push({
          ...common,
          component: SelectCell,
          columnData: {
            fieldKey: f.key,
            choices: f.choices ?? [],
            onDblClick: enableEditByDoubleClick,
            onClickCell: openEditorByClick,
          },
          disableKeys: true,
          keepFocus: false,
          disabled: !editing,
          deleteValue: ({ rowData }) => (editing ? ({ ...rowData, [f.key]: null }) as GridRow : rowData),
          copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
          pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) => {
            if (editing && (f.choices ?? []).some((c) => c.value === value)) {
              return { ...rowData, [f.key]: value } as GridRow;
            }
            return rowData;
          },
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      } else {
        cols.push({
          ...common,
          component: TextCell,
          columnData: {
            fieldKey: f.key,
            maxLength: f.maxLength,
            onDblClick: enableEditByDoubleClick,
            onClickCell: openEditorByClick,
          },
          disableKeys: false,
          keepFocus: false,
          disabled: !editing,
          deleteValue: ({ rowData }) => (editing ? ({ ...rowData, [f.key]: null }) as GridRow : rowData),
          copyValue: ({ rowData }) => String(rowData[f.key] ?? ''),
          pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) =>
            (editing ? { ...rowData, [f.key]: value } : rowData) as GridRow,
          isCellEmpty: ({ rowData }) => rowData[f.key] == null || rowData[f.key] === '',
        });
      }
    }
    cols.push({
      id: '__aksi',
      title: <HeaderTitle label="Aksi" colKey="__aksi" onResizeStart={startResize} onAutoFit={onAutoFit} />,
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
        render: (id: string | number) => {
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
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, editing, rows, checkedIds, renderActions, widths, autoWidths]);

  /** Teks tampil (draft-merged) untuk TSV. */
  function displayOf(id: string | number, key: string): string {
    const g = gridValue.find((r) => String(r.id) === String(id));
    const v = g?.[key];
    return v == null ? '' : String(v);
  }

  async function onCopy() {
    const checkedRows = rows.filter((r) => checkedIds.has(r.id));
    let header: string[];
    let body: string[][];
    if (checkedRows.length > 0) {
      header = fields.map((f) => f.label);
      body = checkedRows.map((r) => fields.map((f) => displayOf(r.id, f.key)));
    } else if (range) {
      const r0 = Math.max(0, Math.min(range.min.row, range.max.row));
      const r1 = Math.min(gridValue.length - 1, Math.max(range.min.row, range.max.row));
      const idx: number[] = [];
      for (let c = Math.min(range.min.col, range.max.col); c <= Math.max(range.min.col, range.max.col); c++) {
        // 0 = checklist, fields 1..n, terakhir = Aksi
        if (c >= 1 && c <= fields.length) idx.push(c - 1);
      }
      if (r1 < r0 || idx.length === 0) return;
      header = idx.map((i) => fields[i].label);
      body = [];
      for (let r = r0; r <= r1; r++) {
        const g = gridValue[r];
        if (!g) continue;
        body.push(idx.map((i) => displayOf(g.id, fields[i].key)));
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

  /** Simpan satu baris; ditolak validasi / gagal API → nilai kembali + toast. */
  async function saveRow(idKey: string, flds: Record<string, string | null>) {
    const domain = rowsRef.current.find((r) => String(r.id) === idKey);
    if (!domain) {
      dropDraft(idKey, Object.keys(flds));
      return;
    }
    for (const f of fields) {
      if (flds[f.key] !== undefined && f.validate) {
        const blocked = f.validate(flds[f.key]);
        if (blocked) {
          dropDraft(idKey, Object.keys(flds));
          toast.error(blocked);
          return;
        }
      }
    }
    try {
      await onCommit(domain.id, flds);
      savedRef.current.push({ id: idKey, keys: Object.keys(flds) });
      toast.success('Perubahan tersimpan.');
    } catch (e) {
      dropDraft(idKey, Object.keys(flds));
      toast.error(`Gagal menyimpan. ${errorMessage(e)}`);
    }
  }

  /** Antrean simpan per baris: perubahan beruntun di baris yang sama digabung. */
  function enqueueSave(idKey: string, flds: Record<string, string | null>) {
    const prev = queueRef.current.get(idKey) ?? {};
    queueRef.current.set(idKey, { ...prev, ...flds });
    void drain();
  }

  /** Proses antrean berurutan; satu reload server setelah antrean habis. */
  async function drain() {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.size > 0) {
        const [idKey, flds] = [...queueRef.current.entries()][0];
        queueRef.current.delete(idKey);
        await saveRow(idKey, flds);
      }
      try {
        await onSaved();
      } catch {
        // Reload gagal: draft sukses tetap dibuang (data sudah tersimpan di server).
      }
      for (const s of savedRef.current) dropDraft(s.id, s.keys);
      savedRef.current = [];
    } finally {
      drainingRef.current = false;
    }
    // Ada perubahan baru saat reload berjalan → proses lagi.
    if (queueRef.current.size > 0) void drain();
  }

  function onResetView() {
    setWidths({});
    prefSet(widthsKey(tableKey), '{}').catch(() => {});
    // Kembali ke bawaan = lebar menyesuaikan isi (dihitung ulang).
    fittedRef.current = null;
    setAutoWidths(computeAutoWidths(true));
    setCheckedIds(new Set());
    setRange(null);
    toast.success('Tampilan tabel dikembalikan bawaan.');
  }

  if (loading && rows.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }

  const hasSearchInput = searchValue !== undefined && onSearchChange;
  const hasFilter = filter !== undefined;
  const showToolbar = hasSearchInput || hasFilter;
  const showSearchButton = !!onSearchSubmit;
  const formId = searchIds?.form ?? `form_cari_${tableKey}`;
  const inputId = searchIds?.input ?? `input_cari_${tableKey}`;
  const buttonId = searchIds?.button ?? `btn_cari_${tableKey}`;

  return (
    <div className="flex flex-1 flex-col">
      {editing && (
        <div
          id={`banner_mode_edit_${tableKey}`}
          role="status"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <Pencil size={14} />
          <span className="font-semibold">Mode Edit aktif</span>
          <span>
            — tekan{' '}
            <kbd className="rounded border border-amber-500/40 bg-background/60 px-1 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            untuk keluar.
          </span>
          <Button
            id={`btn_keluar_mode_edit_${tableKey}`}
            variant="outline"
            size="sm"
            className="ml-auto border-amber-500/40 bg-transparent text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            onClick={() => setEditMode(false)}
          >
            Keluar mode Edit
          </Button>
        </div>
      )}
      {/* Satu baris: pencarian + filter (kiri), lalu kontrol tabel dan tombol
          tambah halaman (kanan), dikelompokkan menurut fungsi. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {showToolbar && (
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.();
            }}
            className="flex flex-wrap items-center gap-1.5"
          >
            {hasSearchInput && (
              <Input
                id={inputId}
                aria-label="Cari"
                placeholder={searchPlaceholder ?? 'Cari'}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="h-8 w-44 sm:w-48"
              />
            )}
            {filter}
            {showSearchButton && (
              <Button
                id={buttonId}
                type="submit"
                size="icon-sm"
                variant="outline"
                title="Cari"
                aria-label="Cari"
                className="h-8 w-8"
              >
                <Search size={16} />
              </Button>
            )}
          </form>
        )}
        <span
          id={`grid_info_${tableKey}`}
          className={`text-xs text-muted-foreground${checkedIds.size > 0 ? '' : ' hidden'}`}
        >
          {checkedIds.size} baris dipilih
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Grup 1 — gerbang mode edit (satu-satunya cara mengaktifkan ubah sel) */}
          {canEdit && (
            <ToolbarGroup title="Mode edit sel">
              <label
                htmlFor={`chk_edit_${tableKey}`}
                className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              >
                <input
                  id={`chk_edit_${tableKey}`}
                  type="checkbox"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                  className="size-3.5 accent-[var(--accent)]"
                />
                Edit
              </label>
            </ToolbarGroup>
          )}

          {/* Grup 2 — alat tabel: salin, sesuaikan lebar, reset */}
          <ToolbarGroup>
          <Button
            id={`btn_salin_${tableKey}`}
            size="icon-sm"
            variant="outline"
            title="Salin TSV"
            aria-label="Salin TSV"
            disabled={checkedIds.size === 0 && !range}
            onClick={onCopy}
          >
            <Copy size={16} />
          </Button>
          <Button
            id={`btn_autofit_${tableKey}`}
            size="icon-sm"
            variant="outline"
            title="Sesuaikan lebar semua kolom dengan isi"
            aria-label="Sesuaikan lebar semua kolom dengan isi"
            onClick={onAutoFitAll}
          >
            <MoveHorizontal size={16} />
          </Button>
          <Button
            id={`btn_reset_${tableKey}`}
            size="icon-sm"
            variant="ghost"
            title="Reset tampilan"
            aria-label="Reset tampilan"
            onClick={onResetView}
          >
            <RotateCcw size={16} />
          </Button>
          </ToolbarGroup>

          {/* Tombol aksi utama halaman, sejajar dengan kontrol tabel. */}
          {addButton && <div className="flex items-center gap-2">{addButton}</div>}
        </div>
      </div>

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
        className={cn(
          'simpes-dsg relative flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl bg-card',
          !editing && 'simpes-dsg-readonly',
        )}
      >
        <DataSheetGrid
          value={gridValue}
          onChange={handleChange}
          columns={dsgColumns}
          rowKey="id"
          height={gridH}
          rowHeight={effectiveH}
          headerRowHeight={36}
          lockRows
          addRowsComponent={false}
          rowClassName={({ rowIndex }) =>
            rowIndex === gridValue.length - 1 ? 'simpes-dsg-row-last' : ''
          }
          onSelectionChange={({ selection }) => setRange(selection)}
          onScroll={fitActionsIfNeeded}
        />
        {gridValue.length === 0 && !loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
