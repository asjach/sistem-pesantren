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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, MoveHorizontal, RotateCcw, Rows3, Save, Search, Type, X } from 'lucide-react';
import { copyText, toTSV } from '@/lib/clipboard';
import { toast } from 'sonner';

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
  /** Simpan satu baris draft (dipanggil per baris saat Simpan). */
  onCommit: (id: T['id'], fields: Record<string, string | null>) => Promise<void>;
  /** Dipanggil setelah Simpan (biasanya reload halaman aktif). */
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

const MIN_ROW_H = 26;
const MAX_ROW_H = 200;
const MIN_COL_W = 50;
const MIN_FONT_PX = 9;
const MAX_FONT_PX = 24;
const DEFAULT_FONT_PX = 13;
/** Batas lebar hasil AutoFit (Excel juga membatasi, ~255 karakter). */
const AUTOFIT_MAX_W = 480;
/** Ruang napas agar teks tidak menempel garis kolom saat AutoFit. */
const AUTOFIT_BUFFER = 8;
/** Lebar kolom Aksi saat belum terukur (3 tombol ikon + padding). */
const ACTIONS_DEFAULT_W = 112;
/** Lantai lebar kolom Aksi (1 tombol ikon + padding). */
const ACTIONS_MIN_W = 56;

/** Tinggi baris tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_ROWH_KEY = 'simpes_grid_rowh';
/** Ukuran huruf tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_FONT_KEY = 'simpes_grid_font';
/** Jenis huruf ISI tabel, tunggal untuk SELURUH tabel. */
const GLOBAL_FONT_FAMILY_KEY = 'simpes_grid_font_family';

/** Nilai SelectItem untuk "ikut bawaan" (Radix tidak mengizinkan string kosong). */
const FONT_FAMILY_DEFAULT = '_bawaan';

/** Pilihan jenis huruf isi tabel — sans-serif (tanpa kaki), relatif ramping.
 *  Nilai berformat "<font-family>|<font-weight>"; `FONT_FAMILY_DEFAULT`
 *  berarti ikut font & ketebalan bawaan aplikasi. */
const FONT_OPTIONS: { value: string; label: string; group: 'sistem' | 'google' }[] = [
  { value: FONT_FAMILY_DEFAULT, label: 'Bawaan', group: 'sistem' },
  // Font sistem (terpasang di OS pengguna).
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|400', label: 'Helvetica Neue', group: 'sistem' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|300', label: 'Helvetica Neue Light', group: 'sistem' },
  { value: '"Segoe UI", "Noto Sans", Roboto, Arial, sans-serif|400', label: 'Segoe UI', group: 'sistem' },
  { value: 'Calibri, Candara, "Segoe UI", Optima, sans-serif|400', label: 'Calibri', group: 'sistem' },
  { value: 'Arial, "Helvetica Neue", Helvetica, sans-serif|400', label: 'Arial', group: 'sistem' },
  { value: 'Tahoma, Geneva, sans-serif|400', label: 'Tahoma', group: 'sistem' },
  { value: '"Trebuchet MS", Tahoma, sans-serif|400', label: 'Trebuchet MS', group: 'sistem' },
  { value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif|400', label: 'Lucida Sans', group: 'sistem' },
  // Google Fonts — sudah diunduh ke src/assets/fonts (berjalan offline).
  { value: '"Inter", sans-serif|300', label: 'Inter Light', group: 'google' },
  { value: '"Inter", sans-serif|400', label: 'Inter', group: 'google' },
  { value: '"Roboto", sans-serif|300', label: 'Roboto Light', group: 'google' },
  { value: '"Roboto", sans-serif|400', label: 'Roboto', group: 'google' },
  { value: '"Open Sans", sans-serif|300', label: 'Open Sans Light', group: 'google' },
  { value: '"Open Sans", sans-serif|400', label: 'Open Sans', group: 'google' },
  { value: '"Lato", sans-serif|300', label: 'Lato Light', group: 'google' },
  { value: '"Lato", sans-serif|400', label: 'Lato', group: 'google' },
  { value: '"Noto Sans", sans-serif|300', label: 'Noto Sans Light', group: 'google' },
  { value: '"Noto Sans", sans-serif|400', label: 'Noto Sans', group: 'google' },
  { value: '"Source Sans 3", sans-serif|300', label: 'Source Sans 3 Light', group: 'google' },
  { value: '"Source Sans 3", sans-serif|400', label: 'Source Sans 3', group: 'google' },
  { value: '"Work Sans", sans-serif|300', label: 'Work Sans Light', group: 'google' },
  { value: '"Work Sans", sans-serif|400', label: 'Work Sans', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|300', label: 'Plus Jakarta Sans Light', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|400', label: 'Plus Jakarta Sans', group: 'google' },
];

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

async function loadRowH(key: string): Promise<number | null> {
  try {
    const v = await prefGet(key);
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, Math.round(n)));
  } catch {
    return null;
  }
}

async function loadFontPx(key: string): Promise<number | null> {
  try {
    const v = await prefGet(key);
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, Math.round(n)));
  } catch {
    return null;
  }
}

async function loadFontFamily(key: string): Promise<string> {
  try {
    const v = await prefGet(key);
    if (v == null || v === '') return FONT_FAMILY_DEFAULT;
    return FONT_OPTIONS.some((f) => f.value === v) ? v : FONT_FAMILY_DEFAULT;
  } catch {
    return FONT_FAMILY_DEFAULT;
  }
}

interface TextColData {
  fieldKey: string;
  maxLength?: number;
  /** Dipanggil saat klik 2× di sel (mulai edit cepat, langsung tersimpan). */
  onQuickEdit?: (id: string | number) => void;
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
        onMouseDown={(e) => {
          // detail >= 2 = mousedown kedua dari klik 2×. Dijalankan SEBELUM
          // handler dokumen DSG agar sel dianggap aktif-editable dan DSG
          // langsung membuka mode edit. Span dibuat mengisi penuh sel
          // (kelas simpes-dsg-fill) supaya klik di mana pun kena.
          if (e.detail >= 2) columnData.onQuickEdit?.(rowData.id);
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
        // Biarkan Tab ke DSG (pindah sel + commit via blur); sisanya milik input.
        if (e.key === 'Tab') return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          commit(cur);
          setVal(null);
          stopEditing();
        } else if (e.key === 'Escape') {
          setVal(null);
          stopEditing();
        }
      }}
    />
  );
}

interface SelectColData {
  fieldKey: string;
  choices: ExcelChoice[];
  /** Dipanggil saat klik 2× di sel (mulai edit cepat, langsung tersimpan). */
  onQuickEdit?: (id: string | number) => void;
}

/** Sel dropdown native (tanpa dependensi baru). */
function SelectCell({ rowData, setRowData, columnData, stopEditing, disabled }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  if (disabled) {
    return (
      <span
        className="simpes-dsg-fill"
        onMouseDown={(e) => {
          if (e.detail >= 2) columnData.onQuickEdit?.(rowData.id);
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
}

/** Sel baca-saja (teks polos). */
function StaticCell({ rowData, columnData }: CellProps<GridRow, StaticColData>) {
  return <span>{String(rowData[columnData.fieldKey] ?? '')}</span>;
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

  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [checkedIds, setCheckedIds] = useState<Set<T['id']>>(new Set());
  const [range, setRange] = useState<GridSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [rowH, setRowH] = useState<number | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [fontPx, setFontPx] = useState<number | null>(null);
  const [fontDraft, setFontDraft] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILY_DEFAULT);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const renderRef = useRef(renderActions);
  renderRef.current = renderActions;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const resizeRef = useRef<{ key: string; startX: number; startW: number; targets: string[] } | null>(
    null,
  );
  /** Sel yang sedang diedit lewat klik 2× (ref dibaca sinkron oleh DSG). */
  const quickEditRef = useRef<{ key: string; id: string } | null>(null);
  const [quickEdit, setQuickEdit] = useState<{ key: string; id: string } | null>(null);
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
    loadRowH(GLOBAL_ROWH_KEY).then(setRowH);
    loadFontPx(GLOBAL_FONT_KEY).then(setFontPx);
    loadFontFamily(GLOBAL_FONT_FAMILY_KEY).then(setFontFamily);
    loadWidths(widthsKey(tableKey)).then((w) => {
      setWidths(w);
      setWidthsReady(true);
    });
    setDraft(null);
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

  // Edit cepat (klik 2×): begitu draft baris itu terbentuk (dari blur/Enter),
  // langsung simpan baris tersebut — tanpa menekan tombol Simpan.
  useEffect(() => {
    const q = quickEdit;
    if (!q || saving) return;
    const d = drafts[q.id];
    if (!d || Object.keys(d).length === 0) return;
    void onSave(q.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, quickEdit, saving]);

  // Seleksi + range mengikuti data aktif.
  useEffect(() => {
    setCheckedIds(new Set());
    setRange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Simpan tinggi baris global (debounce agar tidak menulis tiap ketikan).
  useEffect(() => {
    if (rowH == null) return;
    const t = setTimeout(() => {
      prefSet(GLOBAL_ROWH_KEY, String(rowH)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [rowH]);

  // Simpan ukuran huruf global (debounce, berlaku semua tabel).
  useEffect(() => {
    if (fontPx == null) return;
    const t = setTimeout(() => {
      prefSet(GLOBAL_FONT_KEY, String(fontPx)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [fontPx]);

  // Simpan jenis huruf isi tabel (global, berlaku semua tabel).
  useEffect(() => {
    const t = setTimeout(() => {
      prefSet(GLOBAL_FONT_FAMILY_KEY, fontFamily).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [fontFamily]);

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

  /** Predikat disabled per sel. DSG memanggilnya saat event, jadi cukup
   *  membaca ref: mode Edit aktif → semua bisa diedit; selain itu hanya sel
   *  yang sedang di-edit cepat (klik 2×) yang bisa diedit. */
  function cellDisabledFor(key: string) {
    return ({ rowData }: { rowData: GridRow }) => {
      if (editing) return false;
      const q = quickEditRef.current;
      return !(q && q.key === key && q.id === String(rowData.id));
    };
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
  }

  const dirtyIds = useMemo(() => Object.keys(drafts), [drafts]);

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
          columnData: { fieldKey: f.key },
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
            onQuickEdit: (id: string | number) => startQuickEdit(f.key, id),
          },
          disableKeys: true,
          keepFocus: false,
          disabled: cellDisabledFor(f.key),
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
            onQuickEdit: (id: string | number) => startQuickEdit(f.key, id),
          },
          disableKeys: false,
          keepFocus: false,
          disabled: cellDisabledFor(f.key),
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

  /** `onlyId` dipakai oleh edit cepat (klik 2×) untuk menyimpan satu baris. */
  async function onSave(onlyId?: string) {
    const entries = Object.entries(draftsRef.current).filter(([idKey]) => !onlyId || idKey === onlyId);
    if (entries.length === 0 || saving) return;
    setSaving(true);
    let ok = 0;
    let fail = 0;
    let lastErr = '';
    const remaining: Drafts = { ...draftsRef.current };
    try {
      for (const [idKey, flds] of entries) {
        const domain = rowsRef.current.find((r) => String(r.id) === String(idKey));
        if (!domain) {
          delete remaining[idKey];
          continue;
        }
        let blocked: string | null = null;
        for (const f of fields) {
          if (flds[f.key] !== undefined && f.validate) {
            blocked = f.validate(flds[f.key]);
            if (blocked) break;
          }
        }
        if (blocked) {
          fail++;
          lastErr = blocked;
          continue;
        }
        try {
          await onCommit(domain.id, flds);
          ok++;
          delete remaining[idKey];
        } catch (e) {
          fail++;
          lastErr = errorMessage(e);
        }
      }
    } finally {
      setDrafts(remaining);
      setSaving(false);
    }
    if (ok > 0) toast.success(`${ok} baris disimpan.`);
    if (fail > 0) toast.error(`Gagal menyimpan ${fail} baris. ${lastErr}`);
    if (onlyId) {
      // Edit cepat selesai: lepas penanda agar tidak tersimpan berulang.
      quickEditRef.current = null;
      setQuickEdit(null);
    }
    await onSaved();
  }

  /** Klik 2× pada sel = mulai edit cepat (tanpa checkbox Edit).
   *  Ref diisi sinkron supaya DSG menganggap sel ini tidak disabled. */
  function startQuickEdit(key: string, id: string | number) {
    if (!canEdit) return;
    const next = { key, id: String(id) };
    quickEditRef.current = next;
    setQuickEdit(next);
  }

  function onResetView() {
    setWidths({});
    prefSet(widthsKey(tableKey), '{}').catch(() => {});
    // Kembali ke bawaan = lebar menyesuaikan isi (dihitung ulang).
    fittedRef.current = null;
    setAutoWidths(computeAutoWidths(true));
    quickEditRef.current = null;
    setQuickEdit(null);
    setCheckedIds(new Set());
    setRange(null);
    toast.success('Tampilan tabel dikembalikan bawaan.');
  }

  /** Terapkan langsung saat diketik/dipanah (clamp), tampilkan apa adanya. */
  function applyRowHDraft(raw: string) {
    setDraft(raw);
    if (raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setRowH(Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, Math.round(n))));
  }

  /** Ukuran huruf grid (berlaku semua tabel), clamp saat diketik. */
  function applyFontDraft(raw: string) {
    setFontDraft(raw);
    if (raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setFontPx(Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, Math.round(n))));
  }

  function onToggleEdit(next: boolean) {
    if (!next && dirtyIds.length > 0) {
      setConfirmDiscard(true);
      return;
    }
    setEditMode(next);
  }

  if (loading && rows.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }

  const hasSearchInput = searchValue !== undefined && onSearchChange;
  const hasFilter = filter !== undefined;
  const hasSearch = !!onSearchSubmit && (hasSearchInput || hasFilter);
  const formId = searchIds?.form ?? `form_cari_${tableKey}`;
  const inputId = searchIds?.input ?? `input_cari_${tableKey}`;
  const buttonId = searchIds?.button ?? `btn_cari_${tableKey}`;

  return (
    <div className="mt-4 flex flex-1 flex-col">
      {/* Satu baris: pencarian + filter (kiri), lalu kontrol tabel dan tombol
          tambah halaman (kanan), dikelompokkan menurut fungsi. */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {hasSearch && (
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
                className="h-6 w-40 sm:w-44"
              />
            )}
            {filter}
            <Button
              id={buttonId}
              type="submit"
              size="icon-sm"
              variant="outline"
              title="Cari"
              aria-label="Cari"
            >
              <Search size={16} />
            </Button>
          </form>
        )}
        <span
          id={`grid_info_${tableKey}`}
          className={`text-xs text-muted-foreground${checkedIds.size > 0 ? '' : ' hidden'}`}
        >
          {checkedIds.size} baris dipilih
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Grup 1 — mode edit sel */}
          {canEdit && (
            <label
              htmlFor={`chk_edit_${tableKey}`}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
              title="Mode edit sel"
            >
              <input
                id={`chk_edit_${tableKey}`}
                type="checkbox"
                checked={editMode}
                onChange={(e) => onToggleEdit(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Edit
            </label>
          )}
          {canEdit && <span className="h-5 w-px bg-border" aria-hidden="true" />}

          {/* Grup 2 — tampilan: ukuran huruf + tinggi baris (berlaku semua tabel) */}
          <div
            className="flex items-center gap-1.5 rounded-md border border-border px-1.5 py-0.5"
            title="Tampilan tabel (berlaku semua tabel)"
          >
            <Label
              htmlFor={`input_huruf_${tableKey}`}
              title="Ukuran huruf (berlaku semua tabel)"
              className="cursor-default text-muted-foreground"
            >
              <Type size={16} />
              <span className="sr-only">Ukuran huruf (semua tabel)</span>
            </Label>
            <Input
              id={`input_huruf_${tableKey}`}
              type="number"
              min={MIN_FONT_PX}
              max={MAX_FONT_PX}
              step={1}
              aria-label="Ukuran huruf (px)"
              className="h-6 w-12"
              value={fontDraft ?? String(effectiveFont)}
              onChange={(e) => applyFontDraft(e.target.value)}
              onBlur={() => setFontDraft(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger
                id={`select_huruf_${tableKey}`}
                title="Jenis huruf isi tabel (berlaku semua tabel)"
                aria-label="Jenis huruf isi tabel"
                className="h-6 w-36"
              >
                <SelectValue placeholder="Bawaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Font sistem</SelectLabel>
                  {FONT_OPTIONS.filter((f) => f.group === 'sistem').map((f) => (
                    <SelectItem key={f.label} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Font Google (offline)</SelectLabel>
                  {FONT_OPTIONS.filter((f) => f.group === 'google').map((f) => (
                    <SelectItem key={f.label} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Label
              htmlFor={`input_tinggi_${tableKey}`}
              title="Tinggi baris (berlaku semua tabel)"
              className="cursor-default text-muted-foreground"
            >
              <Rows3 size={16} />
              <span className="sr-only">Tinggi baris (semua tabel)</span>
            </Label>
            <Input
              id={`input_tinggi_${tableKey}`}
              type="number"
              min={MIN_ROW_H}
              max={MAX_ROW_H}
              step={1}
              aria-label="Tinggi baris (px)"
              className="h-6 w-12"
              value={draft ?? String(effectiveH)}
              onChange={(e) => applyRowHDraft(e.target.value)}
              onBlur={() => setDraft(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </div>

          <span className="h-5 w-px bg-border" aria-hidden="true" />

          {/* Grup 3 — alat tabel: salin, sesuaikan lebar, reset */}
          <div className="flex items-center gap-1.5">
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
          </div>

          {/* Grup 4 — draft belum disimpan */}
          {canEdit && dirtyIds.length > 0 && (
            <>
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <Button id={`btn_simpan_${tableKey}`} size="sm" disabled={saving} onClick={() => onSave()}>
                <Save size={15} /> Simpan ({dirtyIds.length})
              </Button>
              <Button
                id={`btn_batal_${tableKey}`}
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => setDrafts({})}
              >
                <X size={15} /> Batal
              </Button>
            </>
          )}

          {/* Tombol aksi utama halaman, sejajar dengan kontrol tabel. */}
          {addButton && (
            <>
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <div className="flex items-center gap-2">{addButton}</div>
            </>
          )}
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
        className="simpes-dsg flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl bg-card"
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
          <p className="p-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buang perubahan?</DialogTitle>
            <DialogDescription>
              Ada {dirtyIds.length} baris yang belum disimpan. Mematikan mode Edit akan membuang semuanya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDrafts({});
                setEditMode(false);
                setConfirmDiscard(false);
              }}
            >
              Buang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
