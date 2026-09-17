import { Children, createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
import { errorMessage, prefGet, prefSet } from '@/api/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_FAMILY_DEFAULT, FONT_OPTIONS, MAX_HEADER_H, useGridPrefs } from '@/components/GridPrefs';
import { useStandarTampilan } from '@/standarTampilan';
import PresetKolom, { type PresetKolomApi } from '@/components/PresetKolom';
import FilterField from '@/components/FilterField';
import { useRibbonTable } from '@/components/RibbonTable';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ActionIcon, DeleteAction, EditAction, SetAktifAction, ViewAction } from '@/components/RowActions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlignCenter, AlignLeft, AlignRight, Ban, Copy, Check, Eye, MoreVertical, MoveHorizontal, Pencil, PlusCircle, RotateCcw, Save, Search, Trash2 } from '@/icons';
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

/** Kerangka tabel saat memuat: menyerupai grid (baris header + baris data)
 *  agar area tabel tidak tampak seperti blok abu-abu kosong. */
function TabelMemuat({ rowH, baris = 14 }: { rowH: number; baris?: number }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card" aria-hidden="true">
      <div className="h-[26px] shrink-0 border-b bg-muted/60" />
      <div className="flex min-h-0 flex-1 flex-col">
        {Array.from({ length: baris }).map((_, i) => (
          <div key={i} className="shrink-0 border-b border-border/50" style={{ height: rowH }} />
        ))}
      </div>
    </div>
  );
}

/** Status "pilih semua" lewat context agar klik checkbox tidak membangun ulang
 *  definisi kolom DSG (kolom tetap stabil, hanya header ini yang re-render). */
interface CheckAllState {
  ids: readonly (string | number)[];
  checked: ReadonlySet<string | number>;
  setChecked: (s: Set<string | number>) => void;
}

const CheckAllContext = createContext<CheckAllState | null>(null);

function CheckAllCell() {
  const ctx = useContext(CheckAllContext);
  if (!ctx) return null;
  const all = ctx.ids.length > 0 && ctx.ids.every((id) => ctx.checked.has(id));
  const some = ctx.ids.some((id) => ctx.checked.has(id));
  return (
    <span className="flex w-full items-center justify-center">
      <input
        type="checkbox"
        aria-label="Pilih semua baris"
        className="simpes-dsg-checkall"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some && !all;
        }}
        onChange={(e) => {
          const next = new Set<string | number>();
          if (e.target.checked) for (const id of ctx.ids) next.add(id);
          ctx.setChecked(next);
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </span>
  );
}

export interface ExcelChoice {
  value: string;
  label: string;
}

/** Teks yang BENAR-BENAR dirender sel untuk sebuah nilai grid. Kolom `select`
 *  menampilkan label pilihannya (`Ikut lembaga`), bukan nilai mentahnya
 *  (`default`) — pengukuran lebar kolom (AutoFit & lebar awal) wajib memakai
 *  teks ini, kalau tidak kolom jadi sempit dan label terpotong/terbungkus. */
function teksTampilSel(f: ExcelField, raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw);
  if (f.kind === 'select') {
    return (f.choices ?? []).find((c) => c.value === s)?.label ?? s;
  }
  return s;
}

export interface ExcelField {
  key: string;
  label: string;
  /** Lebar cadangan bila pengukuran konten gagal; lebar normal mengikuti AutoFit. */
  width?: number;
  /** text/select bisa diedit saat mode Edit aktif; static selalu baca-saja. */
  kind: 'text' | 'select' | 'static';
  choices?: ExcelChoice[];
  maxLength?: number;
  /** Kembalikan pesan galat bila nilai tidak valid, atau null bila OK. */
  validate?: (value: string | null) => string | null;
  /** Wajib diisi pada mode Input (ditandai warna di header + sel baris input). */
  required?: boolean;
  /** Kolom static yang tetap bisa DIISI saat mode Input (mis. kode/nik yang
   *  belum ada saat membuat record). Baris biasa tetap baca-saja. */
  inputKind?: 'text' | 'select';
  /** Pilihan dropdown untuk inputKind 'select' (bila beda dari `choices`). */
  inputChoices?: ExcelChoice[];
}

/** Satu entri urut dropdown: nilai = kode backend (string) atau gabungan
 *  beberapa kode (mis. JK-Nama = ['jk','nama'], satu arah toggle).
 *  `kunci` (opsional) = key kolom grid untuk indikator header pasif;
 *  `label` (opsional) = teks dropdown (bawaan: label kolom `kunci`). */
export interface OpsiUrutKolom {
  kunci?: string;
  nilai: string | string[];
  label?: string;
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
  /** Pendaftaran kolom yang bisa diurutkan (kunci = key kolom grid).
   *  Kolom tanpa entri = header biasa. Urut dieksekusi halaman (server-side). */
  opsiUrut?: OpsiUrutKolom[];
  /** Daftar nilai urut aktif berurutan (maks 3) + arah global. */
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  /** Niat urut dari klik header: halaman me-refetch lalu mengisi urutAktif. */
  onUrut?: (nilai: string[], arah: 'naik' | 'turun') => void;
}

const MIN_COL_W = 50;
/** Batas lebar hasil AutoFit (Excel juga membatasi, ~255 karakter). */
const AUTOFIT_MAX_W = 480;
/** Ruang napas agar teks tidak menempel garis kolom saat AutoFit. */
const AUTOFIT_BUFFER = 8;
/** Lebar kolom Aksi saat belum terukur (3 tombol ikon + padding + napas). */
const ACTIONS_DEFAULT_W = 124;
/** Lebar kolom checklist (kolom data pertama). */
const CHECK_W = 44;
/** Lantai lebar kolom Aksi (1 tombol ikon + padding). */
const ACTIONS_MIN_W = 56;
/** Penanda "kapasitas aksi > 3" per tableKey; hanya tumbuh selama sesi (tidak
 *  pernah turun) agar layout ikon vs hamburger tidak berubah-ubah mengikuti
 *  data yang sedang tampil. Nilai = jumlah aksi maksimum yang pernah terlihat
 *  pada tabel tersebut. */
const AKSI_RINGKAS = new Map<string, number>();
/** Id sintetis baris input paling bawah (mode Input). */
const INPUT_ROW_ID = '__input__';

function widthsKey(tableKey: string) {
  // v2: hasil AutoFit tidak lagi disimpan (lihat onAutoFit). Kunci lama berisi
  // lebar basi yang membekukan kolom dinamis (status/aksi) — diabaikan sekali.
  return `simpes_grid_${tableKey}_w_v2`;
}

/** Pref jumlah kolom beku (freeze pane kiri) per tabel; 0 = tanpa beku. */
function freezeKey(tableKey: string) {
  return `simpes_grid_${tableKey}_freeze`;
}

async function loadFreeze(key: string): Promise<number> {
  try {
    const v = await prefGet(key);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
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

/** Cache lebar kolom per tabel untuk SESI berjalan (di memori, tidak disimpan).
 *  Kunjungan ulang ke halaman yang sama memakai lebar yang sudah final sehingga
 *  grid dapat dirender sekali jadi — tata letak tidak bergeser lagi. */
interface WidthCacheEntry {
  widths: Record<string, number>;
  autoWidths: Record<string, number>;
}

const widthCache = new Map<string, WidthCacheEntry>();

function readWidthCache(tableKey: string): WidthCacheEntry | null {
  return widthCache.get(tableKey) ?? null;
}

function writeWidthCache(tableKey: string, patch: Partial<WidthCacheEntry>) {
  const prev = widthCache.get(tableKey) ?? { widths: {}, autoWidths: {} };
  widthCache.set(tableKey, { ...prev, ...patch });
}

/** Cache tinggi final tabel kompak per tabel (sesi). Dipakai sebagai tinggi
 *  placeholder saat memuat ulang halaman agar tabel tidak berubah tinggi. */
const tinggiCache = new Map<string, number>();

/** Host pengukuran offscreen: meniru struktur & kelas grid nyata sehingga
 *  getComputedStyle memberi font/padding PERSIS seperti sel asli (termasuk
 *  override gaya bagian). Dipakai menghitung lebar kolom secara sinkron pada
 *  render pertama — tanpa menunggu DOM grid atau pemuatan font. */
let ukurHostEl: HTMLDivElement | null = null;

function hostUkur(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (!ukurHostEl) {
    const h = document.createElement('div');
    h.className = 'simpes-dsg';
    h.setAttribute('aria-hidden', 'true');
    h.style.cssText =
      'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap';
    h.innerHTML =
      '<div class="dsg-row dsg-row-header"><div class="dsg-cell dsg-cell-header">' +
      '<div class="dsg-cell-header-container"><span data-ukur="head"></span></div></div></div>' +
      '<div class="dsg-row"><div class="dsg-cell"><span data-ukur="cell"></span></div></div>';
    document.body.appendChild(h);
    ukurHostEl = h;
  }
  return ukurHostEl;
}

interface TextColData {
  fieldKey: string;
  maxLength?: number;
  /** Enter saat mengedit baris input = simpan baris (mode Input).
   *  Kembalikan true bila baris boleh pindah ke bawah (kolom wajib lengkap). */
  onEnter?: (columnIndex: number) => boolean;
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
function TextCell({ rowData, setRowData, columnData, focus, stopEditing, columnIndex }: CellProps<GridRow, TextColData>) {
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
        data-col-key={key}
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
      data-col-key={key}
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
          // Baris input (mode Input): Enter = simpan baris. Kursor pindah ke
          // baris bawah (baris input berikutnya) hanya bila kolom wajib lengkap.
          if (String(rowData.id) === INPUT_ROW_ID && columnData.onEnter) {
            const bolehPindah = columnData.onEnter(columnIndex);
            stopEditing({ nextRow: bolehPindah });
            return;
          }
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
  /** Enter saat mengedit baris input = simpan baris (mode Input).
   *  Kembalikan true bila baris boleh pindah ke bawah (kolom wajib lengkap). */
  onEnter?: (columnIndex: number) => boolean;
  /** Klik 2× sel (mode view): nyalakan checkbox Edit. */
  onDblClick?: (id: string | number) => void;
  /** Klik 1× sel (mode Edit): buka editor sel ini. */
  onClickCell?: (id: string | number) => void;
}

/** Sel dropdown native (tanpa dependensi baru). */
function SelectCell({ rowData, setRowData, columnData, focus, stopEditing, disabled, columnIndex }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  const label = columnData.choices.find((c) => c.value === cur)?.label ?? cur;
  if (disabled || !focus) {
    return (
      <span
        className="simpes-dsg-fill"
        data-col-key={key}
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <select
      className="simpes-dsg-select"
      data-col-key={key}
      aria-label={key}
      value={cur}
      autoFocus
      onChange={(e) => {
        setRowData({ ...rowData, [key]: e.target.value });
        setTimeout(() => stopEditing(), 0);
      }}
      onBlur={() => stopEditing()}
      onKeyDown={(e) => {
        if (e.key === 'Tab') return;
        e.stopPropagation();
        if (e.key === 'Escape') stopEditing();
        if (e.key === 'Enter' && String(rowData.id) === INPUT_ROW_ID && columnData.onEnter) {
          e.preventDefault();
          const bolehPindah = columnData.onEnter(columnIndex);
          stopEditing({ nextRow: bolehPindah });
        }
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
    <span
      className="simpes-dsg-fill"
      data-col-key={columnData.fieldKey}
      onDoubleClick={() => columnData.onDblClick?.()}
    >
      {String(rowData[columnData.fieldKey] ?? '')}
    </span>
  );
}

/** Kolom static + inputKind 'text': baca-saja untuk baris data, input teks
 *  untuk baris input (mode Input). */
function InputStaticTextCell(props: CellProps<GridRow, TextColData>) {
  if (String(props.rowData.id) !== INPUT_ROW_ID) {
    return <StaticCell {...(props as unknown as CellProps<GridRow, StaticColData>)} />;
  }
  return <TextCell {...props} />;
}

/** Kolom static + inputKind 'select': baca-saja untuk baris data, dropdown
 *  untuk baris input (mode Input). */
function InputStaticSelectCell(props: CellProps<GridRow, SelectColData>) {
  if (String(props.rowData.id) !== INPUT_ROW_ID) {
    return <StaticCell {...(props as unknown as CellProps<GridRow, StaticColData>)} />;
  }
  return <SelectCell {...props} />;
}

/** Judul kolom dengan gagang seret pengubah lebar (drag di tepi kanan).
 *  Klik 2× pada gagang = AutoFit lebar mengikuti isi (seperti Excel).
 *  Field wajib (mode Input) ditandai bintang merah; kolom otomatis (tidak
 *  bisa diisi manual saat mode Input) ditandai ikon merah. */
function HeaderTitle({
  label,
  colKey,
  required,
  noInput,
  onResizeStart,
  onResizePrev,
  onAutoFit,
  tandaUrut = null,
}: {
  label: string;
  colKey: string;
  required?: boolean;
  noInput?: boolean;
  onResizeStart: (key: string, e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  /** Kolom beku: gagang tepi KIRI untuk mengubah lebar kolom sebelumnya
   *  (gagang kanan tertutup oleh sel beku di sebelahnya). */
  onResizePrev?: (e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  onAutoFit: (key: string) => void;
  /** Indikator urut pasif (mis. "▲", "▼2") — dikontrol dari dropdown toolbar. */
  tandaUrut?: string | null;
}) {
  return (
    <span className="simpes-dsg-headtitle" data-col-key={colKey}>
      {label}
      {tandaUrut ? (
        <span className="simpes-dsg-tanda-urut" aria-label={`Urutan ${tandaUrut}`}>
          {tandaUrut}
        </span>
      ) : null}
      {required ? (
        <span className="simpes-dsg-wajib-tanda" title="Wajib diisi pada mode Input">
          *
        </span>
      ) : null}
      {noInput ? (
        <span
          className="simpes-dsg-tak-input"
          title="Kolom otomatis — tidak bisa diisi manual pada mode Input"
          aria-label="Tidak bisa diisi manual"
        >
          <Ban size={11} />
        </span>
      ) : null}
      {onResizePrev ? (
        <span
          className="simpes-dsg-resizer simpes-dsg-resizer-kiri"
          title="Seret untuk ubah lebar kolom di kiri"
          onMouseDown={(e) => onResizePrev(e)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
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
  /** True bila kapasitas aksi tabel pernah melebihi 3 (high-water mark) —
   *  seluruh baris memakai dropdown hamburger walau aksi baris ini ≤ 3. */
  ringkas: boolean;
}

/** Ratakan aksi (bisa berupa fragment/conditional) menjadi daftar elemen. */
function flattenAksi(node: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(...flattenAksi((child.props as { children?: ReactNode }).children));
      return;
    }
    out.push(child);
  });
  return out;
}

/** Data menu yang diekstrak dari elemen aksi (tanpa menyarangkan tombol asli). */
interface AksiMenu {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  konfirmasi?: { title: string; description: string; confirmLabel?: string; onConfirm: () => void };
}

/** Ambil isi ikon dari elemen tombol aksi agar menu tidak menyarangkan button. */
function ikonAksi(node: ReactNode): ReactNode {
  if (isValidElement(node) && node.type === ActionIcon) {
    return (node.props as { children?: ReactNode }).children;
  }
  return node;
}

function metaAksi(el: ReactElement): AksiMenu {
  const p = el.props as {
    title?: string;
    onClick?: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    description?: string;
    children?: ReactNode;
  };
  if (el.type === DeleteAction) {
    return {
      label: 'Hapus',
      icon: <Trash2 size={16} />,
      konfirmasi: { title: p.title ?? 'Hapus?', description: p.description ?? '', onConfirm: p.onConfirm ?? (() => {}) },
    };
  }
  if (el.type === EditAction) return { label: 'Ubah', icon: <Pencil size={16} />, onClick: p.onClick };
  if (el.type === ViewAction) return { label: 'Lihat', icon: <Eye size={16} />, onClick: p.onClick };
  if (el.type === SetAktifAction) return { label: 'Set aktif', icon: <Check size={16} />, onClick: p.onClick };
  const title = typeof p.title === 'string' ? p.title.replace(/\?$/, '') : 'Aksi';
  // Pembungkus konfirmasi umum (mis. ConfirmDelete): teruskan ke dialog konfirmasi menu.
  if (typeof p.onConfirm === 'function') {
    return {
      label: title,
      icon: ikonAksi(p.children),
      konfirmasi: {
        title: p.title ?? 'Konfirmasi?',
        description: p.description ?? '',
        confirmLabel: p.confirmLabel,
        onConfirm: p.onConfirm,
      },
    };
  }

  return { label: title, icon: ikonAksi(p.children), onClick: p.onClick };
}

/** Tinggi minimum baris header agar judul (termasuk yang membungkus beberapa
 *  baris) tidak meluber: hitung jumlah baris teks × line-height + padding judul.
 *  Tidak bergantung tinggi baris saat ini sehingga stabil (tidak loop). */
function ukurPerluTinggiHeader(akar: HTMLElement): number {
  let maks = 0;
  akar.querySelectorAll<HTMLElement>('.dsg-row-header .simpes-dsg-headtitle').forEach((ht) => {
    const cs = getComputedStyle(ht);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 15;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    let baris = 1;
    const node = ht.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') {
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, (node.textContent ?? '').length);
      baris = Math.max(1, r.getClientRects().length);
    }
    maks = Math.max(maks, Math.ceil(baris * lh + pad));
  });
  return maks;
}

/** Sel Aksi: tombol ikon dialog (klik tidak mengubah seleksi grid).
 *  Bila aksi lebih dari 3, diringkas jadi dropdown titik-tiga vertikal. */
function ActionsCell({ rowData, columnData }: CellProps<GridRow, ActionsColData>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<AksiMenu['konfirmasi'] | null>(null);
  const aksi = flattenAksi(columnData.render(rowData.id));
  const stop = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  if (columnData.ringkas) {
    // Tabel berkapasitas > 3 aksi: selalu hamburger agar konsisten, walau baris
    // ini sendiri beraksi ≤ 3. Baris tanpa aksi tidak menampilkan apa pun
    // (fragment kosong: tipe component kolom DSG menolak null).
    if (aksi.length === 0) return <></>;
  } else if (aksi.length <= 3) {
    return (
      <div className="simpes-dsg-actions flex h-full flex-1 items-center justify-center gap-1" {...stop}>
        {aksi.map((el, i) => (
          <Fragment key={el.key ?? i}>{el}</Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="simpes-dsg-actions flex h-full flex-1 items-center justify-end gap-1" {...stop}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <ActionIcon id={`btn_aksi_lain_${rowData.id}`} title="Aksi lainnya">
            <MoreVertical size={16} />
          </ActionIcon>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {aksi.map((el, i) => {
            const m = metaAksi(el);
            return (
              <DropdownMenuItem
                key={el.key ?? i}
                onSelect={() => {
                  setMenuOpen(false);
                  if (m.konfirmasi) setKonfirmasi(m.konfirmasi);
                  else m.onClick?.();
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={konfirmasi !== null} onOpenChange={(o) => { if (!o) setKonfirmasi(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{konfirmasi?.title}</AlertDialogTitle>
            <AlertDialogDescription>{konfirmasi?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={() => {
                konfirmasi?.onConfirm();
                setKonfirmasi(null);
              }}
            >
              {konfirmasi?.confirmLabel ?? 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  renderBulkActions,
  maxRows,
  onCreateRow,
  inputRowValues,
  hideCheckbox = false,
  hideActions = false,
  hidePreset = false,
  onCheckedChange,
  opsiUrut,
  urutAktif,
  arahUrut = 'naik',
  onUrut,
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

  /** Peta kunci kolom grid → nilai urut backend (untuk indikator header pasif). */
  const petaUrut = useMemo(
    () =>
      new Map(
        (opsiUrut ?? [])
          .filter((o) => o.kunci != null && typeof o.nilai === 'string')
          .map((o) => [o.kunci as string, o.nilai as string]),
      ),
    [opsiUrut],
  );
  const urutAktifRef = useRef<string[] | undefined>(urutAktif);
  urutAktifRef.current = urutAktif;
  const arahUrutRef = useRef(arahUrut);
  arahUrutRef.current = arahUrut;
  const onUrutRef = useRef(onUrut);
  onUrutRef.current = onUrut;
  /** Item dropdown: label + daftar nilai (tunggal/gabungan). */
  const itemUrut = useMemo(
    () =>
      (opsiUrut ?? [])
        .map((o) => ({
          label:
            o.label ??
            (o.kunci != null ? fields.find((f) => f.key === o.kunci)?.label : undefined) ??
            (Array.isArray(o.nilai) ? o.nilai.join('+') : o.nilai),
          kunci: Array.isArray(o.nilai) ? o.nilai : [o.nilai],
        }))
        .filter((it) => it.kunci.length > 0),
    [opsiUrut, fields],
  );
  const idxUrutAktif = useMemo(() => {
    const aktif = (urutAktif ?? []).join(',');
    return itemUrut.findIndex((it) => it.kunci.join(',') === aktif);
  }, [itemUrut, urutAktif]);
  /** Pilih dari dropdown: kirim daftar nilai + arah saat ini. */
  const pilihUrut = useCallback(
    (idx: number) => {
      const it = itemUrut[idx];
      if (!it || !onUrutRef.current) return;
      onUrutRef.current(it.kunci, arahUrutRef.current);
    },
    [itemUrut],
  );
  /** Tombol arah: putar arah urutan aktif (nonaktif bila belum ada urutan). */
  const balikArahUrut = useCallback(() => {
    const aktif = urutAktifRef.current ?? [];
    if (aktif.length === 0 || !onUrutRef.current) return;
    onUrutRef.current(aktif, arahUrutRef.current === 'naik' ? 'turun' : 'naik');
  }, []);

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
  const queueRef = useRef<Map<string, Record<string, string | null>>>(new Map());
  const drainingRef = useRef(false);
  /** Baris yang sukses tersimpan pada siklus drain berjalan. */
  const savedRef = useRef<{ id: string; keys: string[] }[]>([]);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

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
  fieldsRef.current = fields;
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;
  const [presetKeys, setPresetKeys] = useState<string[] | null>(null);
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
    const w = measureActionsWidth();
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
      probeRef.current?.remove();
      probeRef.current = null;
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

  // Esc saat TIDAK sedang mengedit sel = keluar dari mode Edit / mode Input.
  // Esc di dalam editor sel ditangani TextCell/SelectCell (tidak sampai ke sini).
  useEffect(() => {
    if (!((canEdit && editMode) || showInput)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      // Jangan ikut menutup saat Esc dipakai dialog/dropdown yang sedang terbuka.
      if (t?.closest?.('[role="dialog"], [role="listbox"], [role="menu"]')) return;
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
      const v = teksTampilSel(f, gridById.get(String(r.id))?.[key]);
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
    return Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
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
      const w = measureActionsWidth();
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
      let w = lebar(headProbe, csHeadCont, f.label) + padHead + AUTOFIT_BUFFER;
      for (const v of values) {
        const s = teksTampilSel(f, v[f.key]);
        if (!s) continue;
        w = Math.max(w, lebar(cellProbe, csCell, s) + padCell + AUTOFIT_BUFFER);
      }
      out[f.key] = Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, visibleFields, effectiveFont, fontStack, fontStackWeight]);

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
    /** Kelas perataan kolom: mengikuti peta global per field (bawaan kiri). */
    const alignClass = (key: string) =>
      align[key] === 'right'
        ? 'simpes-dsg-align-right'
        : align[key] === 'left'
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
      const nilaiUrut = petaUrut.get(f.key);
      const posUrut = nilaiUrut != null ? (urutAktif ?? []).indexOf(nilaiUrut) : -1;
      const tandaUrut =
        posUrut < 0
          ? null
          : `${arahUrut === 'naik' ? '▲' : '▼'}${(urutAktif ?? []).length > 1 ? posUrut + 1 : ''}`;
      const isInputRow = (rowData: GridRow) => showInput && String(rowData.id) === INPUT_ROW_ID;
      const common = {
        id: f.key,
        title: (
          <HeaderTitle
            label={f.label}
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
            tandaUrut={tandaUrut}
          />
        ),
        headerClassName: cn(alignClass(f.key), bekuCls, tepiCls),
        basis: widths[f.key] ?? stdLebar?.[f.key] ?? autoWidths[f.key] ?? syncAutoWidths[f.key] ?? f.width ?? 150,
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
              choices: f.inputChoices ?? f.choices ?? [],
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
  }, [fields, visibleFields, editing, widths, stdLebar, autoWidths, syncAutoWidths, align, showInput, freezeAktif, hideCheckbox, petaUrut, urutAktif, arahUrut]);

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
    return v == null ? '' : String(v);
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
    const header = visibleFieldsRef.current.map((f) => f.label);
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
      header = visibleFields.map((f) => f.label);
      body = checkedRows.map((r) => visibleFields.map((f) => displayOf(r.id, f.key)));
    } else if (range) {
      const r0 = Math.max(0, Math.min(range.min.row, range.max.row));
      const r1 = Math.min(gridValue.length - 1, Math.max(range.min.row, range.max.row));
      const idx: number[] = [];
      for (let c = Math.min(range.min.col, range.max.col); c <= Math.max(range.min.col, range.max.col); c++) {
        // 0 = checklist, kolom terlihat 1..n, terakhir = Aksi
        if (c >= 1 && c <= visibleFields.length) idx.push(c - 1);
      }
      if (r1 < r0 || idx.length === 0) return;
      header = idx.map((i) => visibleFields[i].label);
      body = [];
      for (let r = r0; r <= r1; r++) {
        const g = gridValue[r];
        if (!g) continue;
        body.push(idx.map((i) => displayOf(g.id, visibleFields[i].key)));
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

  const hasSearchInput = searchValue !== undefined && onSearchChange;
  const hasFilter = filter !== undefined;
  const hasUrut = itemUrut.length > 0 && !!onUrut;
  const showToolbar = hasSearchInput || hasFilter || hasUrut;
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
    ? fieldsRef.current.find((f) => f.key === ctxHeader.colKey)?.label ?? ctxHeader.colKey
    : '';
  // Indeks kolom yang di-klik kanan pada daftar kolom tampil (untuk bekukan
  // "sampai kolom ini"); -1 = kolom non-data (centang/Aksi).
  const ctxHeaderIdx = ctxHeader
    ? visibleFields.findIndex((f) => f.key === ctxHeader.colKey)
    : -1;

  return (
    <div className={cn('mt-2 flex flex-col', maxRows === undefined ? 'min-h-0 flex-1' : 'shrink-0')}>
      {editing && (
        <div
          id={`banner_mode_edit_${tableKey}`}
          role="status"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning-foreground"
        >
          <Pencil size={14} />
          <span className="font-semibold">Mode Edit aktif</span>
          <span>
            — tekan{' '}
            <kbd className="rounded border border-warning/40 bg-background/60 px-1 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            untuk keluar.
          </span>
          <span
            className="flex items-center gap-2 text-[11px]"
            title="Sel bertanda bawah = bisa diedit; sel berarsir = baca-saja."
          >
            <span className="flex items-center gap-1">
              <span className="simpes-dsg-swatch-editable size-2.5 rounded-[3px]" />
              bisa diedit
            </span>
            <span className="flex items-center gap-1">
              <span className="simpes-dsg-swatch-readonly size-2.5 rounded-[3px]" />
              baca-saja
            </span>
          </span>
          <Button
            id={`btn_keluar_mode_edit_${tableKey}`}
            variant="outline"
            size="sm"
            className="ml-auto border-warning/40 bg-transparent text-warning-foreground hover:bg-warning/10 hover:text-warning-foreground"
            onClick={() => setEditMode(false)}
          >
            Keluar mode Edit
          </Button>
        </div>
      )}
      {showInput && (
        <div
          id={`banner_mode_input_${tableKey}`}
          role="status"
          className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
        >
          <PlusCircle size={14} />
          <span className="font-semibold">Mode Input aktif</span>
          <span>
            — isi baris paling bawah, lalu klik ikon simpan. Tekan{' '}
            <kbd className="rounded border border-primary/40 bg-background/60 px-1 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            untuk keluar.
          </span>
          <Button
            id={`btn_keluar_mode_input_${tableKey}`}
            variant="outline"
            size="sm"
            className="ml-auto border-primary/40 bg-transparent hover:bg-primary/10"
            onClick={() => setInputMode(false)}
          >
            Keluar mode Input
          </Button>
        </div>
      )}
      {/* Satu baris: input cari → tombol cari → pemisah → filter (kiri), lalu
          kontrol tabel dan tombol tambah halaman (kanan), dikelompokkan
          menurut fungsi. */}
      <div
        data-part="toolbar_tabel"
        className={cn('flex flex-wrap items-end gap-2', showToolbar || addButton || !hidePreset ? 'mb-3' : 'mb-0')}
      >
        {showToolbar && (
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.();
            }}
            className="flex flex-wrap items-end gap-1.5"
          >
            {hasSearchInput && (
              <FilterField label="Cari" htmlFor={inputId}>
                <Input
                  id={inputId}
                  aria-label="Cari"
                  placeholder={searchPlaceholder ?? 'Cari'}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-44 sm:w-48"
                />
              </FilterField>
            )}
            {showSearchButton && (
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
            )}
            {hasFilter && (hasSearchInput || showSearchButton) && (
              <Separator orientation="vertical" className="h-4 self-center" />
            )}
            {filter}
          </form>
        )}
        <span
          id={`grid_info_${tableKey}`}
          className={`text-xs text-muted-foreground${checkedIds.size > 0 ? '' : ' hidden'}`}
        >
          {checkedIds.size} baris dipilih
        </span>
        {checkedRows.length > 0 && renderBulkActions ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {renderBulkActions(checkedRows, clearSelection)}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Urutan tabel: dropdown kunci + tombol arah (server-side). */}
          {hasUrut && (
            <span className="flex items-end gap-1.5">
              <FilterField label="Urutkan" htmlFor={`select_urut_${tableKey}`}>
                <Select
                  value={idxUrutAktif >= 0 ? String(idxUrutAktif) : ''}
                  onValueChange={(v) => pilihUrut(Number(v))}
                >
                  <SelectTrigger id={`select_urut_${tableKey}`} className="w-40">
                    <SelectValue placeholder="Urutkan…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {itemUrut.map((it, i) => (
                        <SelectItem key={it.kunci.join(',')} value={String(i)}>
                          {it.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FilterField>
              <Button
                id={`btn_arah_urut_${tableKey}`}
                variant="outline"
                size="sm"
                title="Balik arah urutan"
                aria-label={`Arah urutan: ${arahUrut === 'naik' ? 'naik' : 'turun'}`}
                disabled={(urutAktif ?? []).length === 0}
                onClick={balikArahUrut}
              >
                {arahUrut === 'naik' ? '▲ Naik' : '▼ Turun'}
              </Button>
            </span>
          )}
          {/* Preset kolom tampilan (tersimpan di DB per lembaga) — tanpa
              pembungkus kotak agar tampil polos seperti kontrol lain. Kontrol
              tabel umum (mode edit/input, salin, autofit, reset) pindah ke
              ribbon tab "Tabel" agar tak memakan ruang toolbar. */}
          {!hidePreset && (
            <PresetKolom tableKey={tableKey} fields={fields} onApply={setPresetKeys} apiRef={presetApiRef} />
          )}

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

          <ContextMenuContent>
            {/* Area header kolom: perataan + show/hide di preset. */}
            {ctxHeader && (
              <>
                <ContextMenuLabel>Kolom: {ctxHeaderLabel}</ContextMenuLabel>
                <ContextMenuItem
                  id={`btn_ctx_autofit_kolom_${tableKey}`}
                  onSelect={() => onAutoFit(ctxHeader.colKey)}
                >
                  <MoveHorizontal size={14} />
                  <span>Sesuaikan lebar kolom ini</span>
                </ContextMenuItem>
                <ContextMenuItem
                  id={`btn_ctx_autofit_semua_${tableKey}`}
                  onSelect={() => onAutoFitAll()}
                >
                  <MoveHorizontal size={14} />
                  <span>Sesuaikan lebar semua kolom</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  id={`btn_ctx_bekukan_${tableKey}`}
                  disabled={ctxHeaderIdx < 0 || freezeAktif >= ctxHeaderIdx + 1}
                  onSelect={() => ctxHeaderIdx >= 0 && ubahFreeze(ctxHeaderIdx + 1)}
                >
                  <MoveHorizontal size={14} />
                  <span>Bekukan sampai kolom ini</span>
                </ContextMenuItem>
                {freezeAktif > 0 && (
                  <ContextMenuItem
                    id={`btn_ctx_lepas_bekukan_${tableKey}`}
                    onSelect={() => ubahFreeze(0)}
                  >
                    <RotateCcw size={14} />
                    <span>Lepas semua kolom beku</span>
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <div className="flex items-center gap-1 px-2 py-1">
                  <span className="mr-auto text-xs text-muted-foreground">Perataan</span>
                  {([
                    { nilai: 'left' as const, label: 'Kiri', Icon: AlignLeft },
                    { nilai: 'center' as const, label: 'Tengah', Icon: AlignCenter },
                    { nilai: 'right' as const, label: 'Kanan', Icon: AlignRight },
                  ]).map(({ nilai, label, Icon }) => {
                    const aktif = (align[ctxHeader.colKey] ?? 'center') === nilai;
                    return (
                      <button
                        key={nilai}
                        type="button"
                        id={`btn_ctx_align_${nilai}_${tableKey}`}
                        title={`Rata ${label.toLowerCase()} (berlaku semua tabel)`}
                        aria-label={`Rata ${label.toLowerCase()}`}
                        aria-pressed={aktif}
                        onClick={() => setAlign(ctxHeader.colKey, nilai)}
                        className={cn(
                          'grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                          aktif && 'bg-accent text-foreground',
                        )}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>
                <ContextMenuSeparator />
                <ContextMenuLabel>Tampilkan di preset</ContextMenuLabel>
                {(presetApiRef.current?.presets.length ?? 0) === 0 ? (
                  <ContextMenuItem disabled>Belum ada preset</ContextMenuItem>
                ) : presetApiRef.current?.presets.map((p) => (
                  <ContextMenuCheckboxItem
                    key={p.id}
                    checked={p.kolom.includes(ctxHeader.colKey)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) =>
                      void presetApiRef.current?.toggleKolom(p.id, ctxHeader.colKey, !!c)
                    }
                  >
                    {p.lembaga_id === null
                      ? p.nama
                      : `${p.nama} (${p.lembaga?.kode ?? p.lembaga?.nama ?? p.lembaga_id})`}
                  </ContextMenuCheckboxItem>
                ))}
              </>
            )}

            {/* Area baris data: aksi halaman + salin. */}
            {ctxRow && (
              <>
                <ContextMenuLabel>{ctxRow.rowLabel}</ContextMenuLabel>
                {ctxRowAksi.map((el, i) => {
                  const m = metaAksi(el);
                  return (
                    <ContextMenuItem
                      key={el.key ?? i}
                      onSelect={() => {
                        if (m.konfirmasi) setCtxKonfirmasi(m.konfirmasi);
                        else m.onClick?.();
                      }}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </ContextMenuItem>
                  );
                })}
                {ctxRowAksi.length > 0 && <ContextMenuSeparator />}
                <ContextMenuItem onSelect={() => void salinBarisCtx(ctxRow.rowId)}>
                  <Copy size={16} />
                  <span>Salin baris (TSV)</span>
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!ctxRow.colKey}
                  onSelect={() => {
                    if (ctxRow.colKey) void salinSelCtx(ctxRow.rowId, ctxRow.colKey);
                  }}
                >
                  <Copy size={16} />
                  <span>Salin nilai sel</span>
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
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
  );
}
