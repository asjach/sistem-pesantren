import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  type CellProps,
  type Column,
  type DataSheetGridRef,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { prefSet } from '@/api/client';
import { useGridPrefs, DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_OPTIONS, FONT_FAMILY_DEFAULT } from '@/components/GridPrefs';
import { TINGGI_BARIS_BAWAAN } from '@/components/excel/tinggiBaris';
import { useTinggiBaris } from '@/components/excel/useTinggiBaris';
import { useTinggiBarisSatuan } from '@/components/excel/useTinggiBarisSatuan';
import { targetGulirBeku } from '@/components/excel/beku';
import { PillMode, TabelMemuat } from '@/components/excel/primitives';
import { cn } from '@/lib/utils';
import { labelKolom } from '@/lib/labelKolom';
import ScrollbarMelayang from '@/components/excel/ScrollbarMelayang';
import { flattenAksiMenu } from '@/components/excel/actions';
import {
  CHECK_W,
  INPUT_ROW_ID,
  GUTTER_W,
  MIN_COL_W,
  freezeKey,
  geserHeaderKey,
  loadFreeze,
  loadGeserHeader,
  loadSakelarGestur,
  seretPindahKey,
  seretSalinKey,
  teksTampilSel,
} from '@/components/excel/helpers';
import type { ExcelField, GridRow, GridSelection } from '@/components/excel/types';
import { EVENT_TAMPILAN_PERANGKAT_BERUBAH, kabariTampilanPerangkat, type AlignKolom } from '@/components/kelolaTabel/jenis';
import { blokDariSeleksi, type BlokIsi, type ModeSeret } from '@/components/excel/seretIsiSel';
import { useSalinTabel } from '@/components/excel/useSalinTabel';
import { useSalinClipboard } from '@/components/excel/useSalinClipboard';
import { useSalinTempelBlok } from '@/components/excel/useSalinTempelBlok';
import { useSeretIsiSel } from '@/components/excel/useSeretIsiSel';
import { useSeretKolomHeader } from '@/components/excel/useSeretKolomHeader';
import { Pencil } from '@/icons';
import { lebarKolomAksi } from './lebarAksi';
import { susunPerubahanSeret } from './seretV2';
import MenuKonteksV2 from './MenuKonteksV2';
import { useLebarKolom } from '@/components/excel/useLebarKolom';
import { useAntreanSimpan, type AksiDraftTabel } from '@/components/excel/useAntreanSimpan';
import { useIsiLebar } from '@/components/excel/useIsiLebar';
import { useLebarWadah } from '@/components/excel/useLebarWadah';
import { skalaLebarIsi, RESIZER_OVERHANG } from '@/components/excel/lebarIsi';
import { labelTampil, rataKolom, statusPilihSemua, type RataKolom } from './kolom';
import SelInputV2 from './SelInputV2';
import SelSelectV2 from './SelSelectV2';
import { bisaInput, type BarisInputV2State } from './useBarisInputV2';

const InputContextV2 = createContext<{ state: BarisInputV2State; tableKey: string } | null>(null);

/** Border checkbox tabel memakai warna garis grid (--part-tabel_grid-border,
 *  sama seperti header row, gutter, dan sel), bukan border-foreground/40
 *  bawaan komponen Checkbox. State checked ikut ditimpa supaya warnanya
 *  konsisten. */
const CHECKBOX_TABEL = 'border-[var(--part-tabel_grid-border,var(--border))] data-[state=checked]:border-[var(--part-tabel_grid-border,var(--border))]';

/** Kolom gutter DSG (nomor urut): identitas stabil agar memo kolom DSG tak
 *  dihitung ulang tiap render. */
const GUTTER_COLUMN = { basis: GUTTER_W };

/** Callback stabil saat halaman tidak menyediakan penyimpanan urutan kolom. */
const TANPA_PINDAH_KOLOM = () => {};

/** Nilai bawaan stabil agar memo kolom tidak dihitung ulang tiap render. */
const LABEL_KOSONG: Record<string, string> = {};
const ALIGN_KOSONG: Partial<Record<string, AlignKolom>> = {};
/** Pertahankan tinggi tabel kompak selama refetch supaya skeleton tidak
 *  melonjak ke tinggi `maxRows` setelah tabel sempat menampilkan lebih sedikit row. */
const tinggiKompakCache = new Map<string, number>();

/** Status "pilih semua" dibaca header lewat context agar klik centang tidak
 *  membangun ulang definisi kolom DSG (sama seperti CheckAllContext V1). */
const PilihSemuaContext = createContext<{
  status: 'semua' | 'sebagian' | 'tidak';
  onToggle: (centang: boolean) => void;
} | null>(null);

function KepalaPilihSemuaV2() {
  const ctx = useContext(PilihSemuaContext);
  if (!ctx) return null;
  return (
    <div className="flex w-full items-center justify-center">
      <Checkbox
        checked={ctx.status === 'sebagian' ? 'indeterminate' : ctx.status === 'semua'}
        onCheckedChange={(v) => ctx.onToggle(v === true)}
        aria-label="Pilih semua baris"
        className={CHECKBOX_TABEL}
      />
    </div>
  );
}

/** Sel data V2: baca-saja, kecuali saat Mode Ubah dan kolomnya bisa disunting. */
function SelTeksV2(props: CellProps<GridRow, { field: ExcelField; rata: RataKolom; modeUbah: boolean; barisIkutIsi: boolean; bisaSelect?: boolean; onSimpan?: (id: string | number, key: string, nilai: string | null) => void }>) {
  const { rowData, columnData } = props;
  const input = useContext(InputContextV2);
  const { field: f, rata, modeUbah, barisIkutIsi, onSimpan } = columnData;
  const bisaEdit = modeUbah && f.kind !== 'static' && onSimpan != null;
  const [buka, setBuka] = useState(false);
  /** Nilai mentah baris (tanpa format tampilan) yang sedang disunting. */
  const [nilaiDraft, setNilaiDraft] = useState('');
  /** Sel dibuka lewat listener native: DSG menangani pointer-nya sendiri
   *  sehingga `onDoubleClick` React sintetis tidak selalu sampai ke sel. */
  const selRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = selRef.current;
    if (!el || !bisaEdit) return;
    const bukaEditor = () => { setNilaiDraft(String(rowData[f.key] ?? '')); setBuka(true); };
    el.addEventListener('dblclick', bukaEditor);
    return () => el.removeEventListener('dblclick', bukaEditor);
  });

  if (rowData.id === INPUT_ROW_ID && input) {
    return <SelInputV2 field={f} state={input.state} tableKey={input.tableKey} />;
  }

  /** Record lama berjenis select memakai dropdown, bukan input teks. */
  if (f.kind === 'select') {
    return <SelSelectV2 {...props} />;
  }

  /** Toggle mengikuti Mode Ubah, kecuali field meminta toggleTanpaEdit. */
  if (f.kind === 'toggle') {
    const nyala = rowData[f.key] === 'ya';
    // onSimpan sudah digerbang canEdit oleh grid; flag ini hanya melewati
    // Mode Ubah, bukan melewati izin halaman.
    const bisaToggle = onSimpan != null && (modeUbah || !!f.toggleTanpaEdit);
    return (
      <div data-col-key={f.key} className="flex h-full w-full items-center justify-center">
        <Switch
          size="xs"
          checked={nyala}
          disabled={!bisaToggle}
          onCheckedChange={bisaToggle ? (v) => onSimpan?.(rowData.id, f.key, v ? 'ya' : 'tidak') : undefined}
          aria-label={labelKolom(f.label || f.key)}
        />
      </div>
    );
  }

  const teks = teksTampilSel(f, rowData[f.key]);

  /** Editor inline: dibuka klik 2x, ditutup Enter/blur/Escape. Nilai dikirim
   *  ke antrean simpan otomatis lewat `onSimpan` (validasi ada di antrean). */
  if (bisaEdit && buka) {
    return (
      <div data-col-key={f.key} className="flex h-full w-full min-w-0 items-center px-2">
        <input
          autoFocus
          className="h-full w-full min-w-0 bg-transparent text-inherit outline-none"
          defaultValue={nilaiDraft}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSimpan?.(rowData.id, f.key, nilaiDraft); setBuka(false); }
            if (e.key === 'Escape') setBuka(false);
          }}
          onChange={(e) => setNilaiDraft(e.target.value)}
          onBlur={() => { onSimpan?.(rowData.id, f.key, nilaiDraft); setBuka(false); }}
        />
      </div>
    );
  }

  const isi = (
    <span
      className={cn(
        'min-w-0 overflow-hidden',
        barisIkutIsi ? 'whitespace-normal break-words' : 'truncate',
      )}
      title={teks || undefined}
    >
      {f.renderCell ? f.renderCell(rowData) : teks}
    </span>
  );
  const sel = (
    <div
      ref={selRef}
      data-col-key={f.key}
      className={cn(
        'flex h-full w-full min-w-0 items-center',
        barisIkutIsi ? 'py-1' : 'px-2',
        f.format === 'angka' && 'tabular-nums',
        bisaEdit && 'bg-primary/5',
        rata === 'kanan' ? 'justify-end' : rata === 'tengah' ? 'justify-center' : 'justify-start',
      )}
    >
      {isi}
    </div>
  );

  if (!f.kartuHover) return sel;
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>{sel}</HoverCardTrigger>
      <HoverCardContent align="start" side="bottom" className="w-auto max-w-[26rem] p-3 text-xs">
        {f.kartuHover(rowData)}
      </HoverCardContent>
    </HoverCard>
  );
}

/** Sel centang V2: pilihan baris untuk aksi massal. */
function SelCentangV2({ rowData, columnData }: CellProps<GridRow, { onToggle: (id: string | number) => void }>) {
  if (rowData.id === INPUT_ROW_ID) return <></>;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Checkbox
        checked={!!rowData.checked}
        onCheckedChange={() => columnData.onToggle(rowData.id)}
        aria-label={`Pilih baris ${rowData.id}`}
        className={CHECKBOX_TABEL}
      />
    </div>
  );
}

/** Sel aksi V2: isi kolom dari halaman, menempel di kanan. Padding dan gap
 *  di sini adalah cermin AKSI_PAD_X dan AKSI_GAP di lebarAksi.ts.
 *
 *  `simpes-dsg-actions` adalah penanda yang dibaca `measureActionsWidth` V1:
 *  lebar kolom Aksi diukur dari tombol yang benar-benar dirender, jadi tombol
 *  teks (mis. MI/MD di halaman MiMd) tidak terpotong seperti asumsi ikon 24px.
 *  Klik aksi juga dihentikan agar tidak menyeleksi sel grid di belakangnya. */
function SelAksiV2({ rowData, columnData }: CellProps<GridRow, { render: (id: string | number) => ReactNode }>) {
  if (rowData.id === INPUT_ROW_ID) return <></>;
  return (
    <div
      className="simpes-dsg-actions flex h-full w-full items-center justify-end gap-0.5 px-1 [&>*]:shrink-0"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {columnData.render(rowData.id)}
    </div>
  );
}

/** Judul kolom V2 membungkus mengikuti lebar kolom dan tetap sejajar isinya.
 *
 *  Gagang pengubah lebar digambar sendiri dengan Tailwind — BUKAN memakai
 *  HeaderTitle V1, sebab V2 tidak mewarisi index.css (.simpes-dsg-*).
 *  Geometri meniru V1 agar rasa seretnya sama: pita 12px yang menonjol 6px
 *  ke luar sel, kursor ew-resize, garis 2px primary saat hover/aktif, dan
 *  klik 2x untuk AutoFit. */
function JudulKolomV2({
  teks,
  rata,
  colKey,
  onResizeStart,
  onAutoFit,
  seretAktif = false,
}: {
  teks: string;
  rata: RataKolom;
  /** Absen = kolom tidak bisa diubah lebarnya (mis. kolom Aksi). */
  colKey?: string;
  /** Mode geser judul aktif: tampilkan kursor grab. */
  seretAktif?: boolean;
  onResizeStart?: (key: string, e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  onAutoFit?: (key: string) => void;
}) {
  const bisaSeret = colKey != null && onResizeStart != null;
  return (
    // PENTING: lebar dikunci ke `.dsg-cell` (induk), bukan `w-full`.
    // `.dsg-cell-header-container` DSG diberi lebar mengikuti judul yang TIDAK
    // dipotong (pernah terukur 110px untuk kolom 66px), sehingga `w-full`
    // membuat pembungkus ini meluber keluar kolom dan gagang lebar — yang
    // ditambatkan ke pembungkus — ikut meleset dari garis kolom.
    <div
      data-col-key={colKey}
      className={cn(
        'simpes-dsg-v2-headtitle absolute inset-0 flex items-center py-1',
        seretAktif && 'cursor-grab select-none active:cursor-grabbing',
      )}
    >
      <div
        className={cn(
          'simpes-dsg-v2-teks-judul w-full min-w-0 whitespace-normal break-words px-2 leading-[1.2]',
          rata === 'kanan' ? 'text-right' : rata === 'tengah' ? 'text-center' : 'text-left',
        )}
        title={teks}
      >
        {teks}
      </div>

      {bisaSeret && (
        // Gagang ditambatkan ke BORDER SEL, bukan ke kotak judul:
        // `.dsg-cell-header-container` DSG bisa lebih lebar dari kolomnya,
        // sehingga `right-0` pada pembungkus judul meleset dari garis kolom.
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Ubah lebar kolom ${teks || colKey}`}
          data-gagang-lebar={colKey}
          className={cn(
            'absolute top-1/2 z-[5] h-[calc(100%+12px)] w-3 -translate-y-1/2 cursor-ew-resize touch-none',
            // Menempel di garis kanan kolom: digeser setengah lebar gagang.
            'right-[-6px]',
            // Garis umpan balik 2px tepat di border sel.
            'after:absolute after:top-0 after:bottom-0 after:right-[5px] after:w-0.5 after:bg-primary',
            'after:opacity-0 hover:after:opacity-100',
          )}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            onResizeStart(colKey, e);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAutoFit?.(colKey);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

export interface GridV2Props {
  inputRow?: BarisInputV2State;
  tableKey: string;
  fields: ExcelField[];
  rows: GridRow[];
  loading?: boolean;
  emptyText?: string;
  renderActions?: (id: string | number) => ReactNode;
  /** Aksi tambahan yang hanya muncul di menu klik kanan, bukan kolom Aksi. */
  renderActionsKonteks?: (id: string | number) => ReactNode;
  /** Tabel ringkas baca-saja: sembunyikan kolom centang. */
  hideCheckbox?: boolean;
  /** Sembunyikan baris header kolom (sakelar visibilitas header_kolom). */
  hideHeader?: boolean;
  /** Label header kustom per tabel (key kolom -> teks); absen = label field. */
  labelDb?: Record<string, string>;
  /** Perataan per tabel (key kolom -> left/center/right); absen = tengah. */
  alignDb?: Partial<Record<string, AlignKolom>>;
  dipilih: ReadonlySet<string | number>;
  onTogglePilih: (id: string | number) => void;
  onTogglePilihSemua: (centang: boolean) => void;
  /** Id baris yang disorot (dipetakan halaman dari klik sel aktif). */
  barisAktifId?: string | number | null;
  onBarisAktif?: (id: string | number) => void;
  /** Keadaan awal sakelar "tabel mengisi lebar wadah" (pref perangkat menang). */
  isiLebarPenuh?: boolean;
  /** Batasi tinggi badan grid maksimal N row. */
  maxRows?: number;
  /** Izin menyunting sel. false = tabel murni baca-saja (Mode Ubah tak ada). */
  canEdit?: boolean;
  /** Simpan satu baris ke server; dipanggil antrean simpan otomatis. */
  onCommit?: (id: string | number, fields: Record<string, string | null>) => Promise<void>;
  /** Muat ulang data setelah antrean simpan habis (satu kali, bukan per sel). */
  onSaved?: () => Promise<void> | void;
  /** Tahan antrean sampai Mode Ubah ditutup (mis. Leger Nilai). */
  simpanSaatKeluarMode?: boolean;
  /** Sel yang gagal validasi dilewati; sel lain tetap disimpan. */
  onValidasiGagal?: (info: { id: string | number; key: string; pesan: string }) => void;
  /** Aksi untuk menyimpan/membuang draft, dipakai penjaga konteks halaman. */
  onAksiDraftSiap?: (aksi: AksiDraftTabel | null) => void;
  /** Isi blok sel terpilih dari menu klik kanan (mis. matriks jadwal). */
  onIsiBlok?: (rows: GridRow[], fields: ExcelField[]) => void;
  blokAksiLabel?: string;
  /** Kosongkan blok sel terpilih; hanya tersedia saat Mode Ubah. */
  onKosongkanBlok?: (rows: GridRow[], fields: ExcelField[]) => void;
  kosongkanBlokLabel?: string;
  /** Seret isi sel ditangani halaman (kolom statis dengan semantik sendiri). */
  onSeretIsi?: (p: {
    mode: ModeSeret; sumber: BlokIsi; target: BlokIsi;
    kunciKolom: string[]; rows: GridRow[];
  }) => void;
  /** Ctrl/Cmd+C blok ditangani halaman saat Mode Ubah. */
  onSalinBlok?: (p: { blok: BlokIsi; kunciKolom: string[]; rows: GridRow[] }) => void;
  /** Ctrl/Cmd+V blok ditangani halaman saat Mode Ubah. */
  onTempelBlok?: (p: { blok: BlokIsi; kunciKolom: string[]; rows: GridRow[] }) => void;
  /** Buka dialog Kelola Tabel dari menu klik kanan header. Absen = item
   *  disembunyikan (mis. halaman belum mendaftarkan tabelnya). */
  onKelolaTabel?: () => void;
  /** Tulis perataan kolom ke setelan tabel. Absen = tombol perataan
   *  disembunyikan (bukan super admin efektif). */
  onUbahAlign?: (key: string, nilai: AlignKolom) => void;
  /** Izinkan geser judul kolom (super admin efektif). */
  bolehGeser?: boolean;
  /** Simpan urutan baru hasil geser judul. Absen = gestur tidak aktif. */
  onPindahKolom?: (urutan: string[]) => void;
  /** Introspeksi lebar kolom ke halaman (AutoFit semua, reset lebar).
   *  Dipanggil tiap hook siap; dipakai menu klik kanan & kontrol halaman
   *  pada poin berikutnya agar tak ada pekerjaan ulang. */
  onSiapLebar?: (aksi: { autoFitSemua: () => void; resetLebar: () => void }) => void;
  /** Kabarkan tinggi header efektif agar FilterRail di luar grid tetap sejajar. */
  onTinggiHeaderChange?: (tinggi: number) => void;
}

/**
 * GridV2 — badan tabel ExcelTabelV2.
 *
 *  Mesin grid memakai react-datasheet-grid (sama seperti V1), tetapi seluruh
 *  gaya sel, header, dan bingkai ditentukan di sini lewat kelas Tailwind
 *  sehingga tampilannya tidak mewarisi index.css milik V1 (.simpes-dsg).
 *  Tahap ini baca-saja: seleksi baris berjalan, penyuntingan sel belum.
 */
export default function GridV2({
  tableKey,
  fields,
  rows,
  loading = false,
  emptyText = 'Belum ada data.',
  renderActions,
  renderActionsKonteks,
  hideCheckbox = false,
  hideHeader = false,
  labelDb = LABEL_KOSONG,
  alignDb = ALIGN_KOSONG,
  dipilih,
  onTogglePilih,
  onTogglePilihSemua,
  barisAktifId = null,
  onBarisAktif,
  onSiapLebar,
  isiLebarPenuh = false,
  maxRows,
  canEdit = false,
  onCommit,
  onSaved,
  simpanSaatKeluarMode = false,
  onValidasiGagal,
  onAksiDraftSiap,
  onIsiBlok,
  blokAksiLabel = 'Isi blok…',
  onKosongkanBlok,
  kosongkanBlokLabel = 'Kosongkan blok…',
  onSeretIsi,
  onSalinBlok,
  onTempelBlok,
  onKelolaTabel,
  onUbahAlign,
  bolehGeser = false,
  onPindahKolom,
  onTinggiHeaderChange,
  inputRow,
}: GridV2Props) {
  const { rowH, headerH, fontPx, fontFamily } = useGridPrefs();
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<DataSheetGridRef>(null);
  const [tinggi, setTinggi] = useState(0);
  const {
    manual: tinggiBarisManual,
    sigManual: sigTinggiBarisManual,
    autoIkut: barisIkutIsi,
    dasar: tinggiBarisDasar,
  } = useTinggiBaris(tableKey);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTinggi(el.clientHeight));
    ro.observe(el);
    setTinggi(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const statusPilih = useMemo(
    () => statusPilihSemua(rows.map((r) => r.id), dipilih),
    [rows, dipilih],
  );

  /** Baris grid per id: dipakai AutoFit & salin untuk membaca teks sel
   *  seperti yang benar-benar dirender SelTeksV2 (termasuk draft). */
  const gridByIdRef = useRef(new Map<string, GridRow>());

  const labelKolomEfektif = useCallback(
    (key: string, bawaan: string) => labelTampil(key, bawaan, labelDb),
    [labelDb],
  );

  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  const fontChoice = FONT_OPTIONS.find((f) => f.value === fontFamily);
  const [fontStack, fontStackWeight] =
    fontChoice && fontChoice.value !== FONT_FAMILY_DEFAULT ? fontChoice.value.split('|') : ['', ''];

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const getValuesRef = useRef<(row: GridRow) => Record<string, string | null>>(() => ({}));
  getValuesRef.current = (row) => row as unknown as Record<string, string | null>;

  /** ===== Penyuntingan sel (Mode Ubah) ===== */
  /** Kolom yang boleh disunting: sama seperti V1, `kind` selain `static`. */
  const editableKeys = useMemo(() => fields.filter((f) => f.kind !== 'static').map((f) => f.key), [fields]);
  const bisaEdit = canEdit && editableKeys.length > 0 && onCommit != null;
  /** Fitur blok khusus halaman (mis. matriks jadwal) juga membuka Mode Ubah. */
  const blokKustom = onSeretIsi != null || onSalinBlok != null || onTempelBlok != null;
  const bolehModeUbah = bisaEdit || blokKustom;
  /** Mode Ubah: pagar agar tabel tidak tersunting tak sengaja (pola V1). */
  const [modeUbah, setModeUbah] = useState(false);
  useEffect(() => { if (!bolehModeUbah) setModeUbah(false); }, [bolehModeUbah]);

  /** Gestur seret isi sel: MATI bawaan, per perangkat, satu aktif pada satu
   *  waktu (copy ATAU move). Kuncinya sama dengan V1 supaya tabel yang sama
   *  berperilaku konsisten di kedua varian. */
  const [seretSalin, setSeretSalin] = useState(false);
  const [seretPindah, setSeretPindah] = useState(false);
  /** Geser judul kolom: MATI bawaan, per perangkat, dan hanya ditawarkan
   *  kepada super admin efektif (sama seperti V1). */
  const [geserHeader, setGeserHeader] = useState(false);
  useEffect(() => {
    let batal = false;
    const muat = () => {
      Promise.all([
        loadSakelarGestur(seretSalinKey(tableKey)),
        loadSakelarGestur(seretPindahKey(tableKey)),
        loadGeserHeader(geserHeaderKey(tableKey)),
      ]).then(([salin, pindah, geser]) => {
        if (batal) return;
        setSeretSalin(salin);
        setSeretPindah(pindah);
        setGeserHeader(geser);
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

  const ubahSeretIsi = useCallback((mode: ModeSeret, nyala: boolean) => {
    const salin = mode === 'salin' ? nyala : false;
    const pindah = mode === 'pindah' ? nyala : false;
    setSeretSalin(salin);
    setSeretPindah(pindah);
    prefSet(seretSalinKey(tableKey), salin ? '1' : '').catch(() => {});
    prefSet(seretPindahKey(tableKey), pindah ? '1' : '').catch(() => {});
    kabariTampilanPerangkat(tableKey);
  }, [tableKey]);

  const ubahGeserHeader = useCallback((nyala: boolean) => {
    setGeserHeader(nyala);
    prefSet(geserHeaderKey(tableKey), nyala ? '1' : '').catch(() => {});
    kabariTampilanPerangkat(tableKey);
  }, [tableKey]);

  const modeSeret: ModeSeret | null = seretSalin ? 'salin' : (seretPindah ? 'pindah' : null);

  /** ===== Kolom beku (freeze pane kiri) ===== */
  /** Jumlah kolom DATA pertama yang menempel saat grid digulir horizontal.
   *  Pref PER PERANGKAT, satu kunci per tabel — kuncinya sama dengan V1, jadi
   *  angka yang disetel di Kelola Tabel -> Umum berlaku untuk kedua varian. */
  const [freeze, setFreeze] = useState(0);
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

  /** Dibatasi jumlah kolom yang benar-benar tampil: preset kolom bisa
   *  mengurangi kolom sehingga angka tersimpan jadi terlalu besar. */
  const freezeAktif = Math.min(freeze, fields.length);
  const ubahFreeze = useCallback((n: number) => {
    const v = Math.max(0, Math.min(fieldsRef.current.length, Math.round(n)));
    setFreeze(v);
    prefSet(freezeKey(tableKey), String(v)).catch(() => {});
    kabariTampilanPerangkat(tableKey);
  }, [tableKey]);

  /** Seleksi blok aktif (dipakai salin blok & seret isi sel). Tanpa seleksi,
   *  sel aktif tunggal menjadi sumber — sama seperti V1. */
  const [range, setRange] = useState<GridSelection | null>(null);
  const rangeRef = useRef<GridSelection | null>(null);
  rangeRef.current = range;
  const [selAktif, setSelAktif] = useState<{ row: number; col: number } | null>(null);
  /** Cermin sel aktif untuk dedupe callback DSG (lihat tanganiSelAktif). */
  const selAktifRef = useRef<{ row: number; col: number } | null>(null);

  /** Area yang diklik kanan: header kolom, baris, sudut, atau kosong. */
  const [ctx, setCtx] = useState<
    | { area: 'header'; colKey: string }
    | { area: 'row'; rowId: string | number; rowLabel: string; colKey: string | null }
    | { area: 'sudut' }
    | { area: 'grid' }
  >({ area: 'grid' });
  /** Draft lokal per baris; nilai grid = data server ditimpa draft ini. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | null>>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const rowsRefEdit = useRef(rows);
  rowsRefEdit.current = rows;

  /** Baris grid: nilai server ditimpa draft lokal, plus status centang.
   *  Dipakai render DSG, salin TSV, dan seret isi sel — semuanya harus
   *  melihat nilai yang sedang tampil, bukan data server yang belum tersimpan. */
  const nilai = useMemo(
    () => rows.map((r) => ({ ...r, ...(drafts[String(r.id)] ?? {}), checked: dipilih.has(r.id) })),
    [rows, dipilih, drafts],
  );
  const nilaiRef = useRef<GridRow[]>(nilai);
  const nilaiDenganInput = useMemo<GridRow[]>(() => inputRow
    ? [...nilai, { ...inputRow.nilai, id: INPUT_ROW_ID, checked: false }]
    : nilai, [nilai, inputRow?.nilai]);
  useEffect(() => {
    if (!inputRow || loading) return;
    const col = fields.findIndex((f) => f.key === inputRow.focusKey);
    if (col >= 0) gridRef.current?.setActiveCell({ row: nilai.length, col: col + (hideCheckbox ? 0 : 1) });
  }, [!!inputRow, inputRow?.generasi, loading, nilai.length, fields, hideCheckbox]);
  nilaiRef.current = nilai;
  const gridRowsRef = useRef<GridRow[]>(nilai);
  gridRowsRef.current = nilai;
  gridByIdRef.current = useMemo(
    () => new Map(nilai.map((r) => [String(r.id), r])),
    [nilai],
  );

  /** Pilihan baris dalam bentuk ref: hook salin membacanya saat Ctrl+C,
   *  sedangkan pilihan datang dari props (dikelola ExcelTabelV2). */
  const dipilihRef = useRef<Set<string | number>>(new Set());
  dipilihRef.current = dipilih as Set<string | number>;

  /** Kembalikan sel ke nilai data server (dipakai saat simpan sukses/gagal). */
  const dropDraft = useCallback((idKey: string, keys: string[]) => {
    setDrafts((prev) => {
      const baris = { ...(prev[idKey] ?? {}) };
      for (const k of keys) delete baris[k];
      const next = { ...prev };
      if (Object.keys(baris).length === 0) delete next[idKey];
      else next[idKey] = baris;
      return next;
    });
  }, []);
  const dropDraftRef = useRef(dropDraft);
  dropDraftRef.current = dropDraft;

  const onCommitRef = useRef<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
  onCommitRef.current = onCommit ?? (async () => {});
  const onSavedRef = useRef<() => Promise<void> | void>(() => {});
  onSavedRef.current = onSaved ?? (() => {});
  const onInvalidRef = useRef(onValidasiGagal);
  onInvalidRef.current = onValidasiGagal;

  /** Antrean simpan V1 dipakai apa adanya: gabung ketikan beruntun, urut,
   *  validasi per field, satu muat ulang + satu toast setelah antrean habis. */
  const { enqueueSave, flush, batalkanAntrean } = useAntreanSimpan<GridRow>({
    rowsRef: rowsRefEdit,
    fieldsRef,
    onCommitRef,
    onSavedRef,
    dropDraftRef,
    autoDrain: !simpanSaatKeluarMode,
    pertahankanGagal: simpanSaatKeluarMode,
    onInvalidRef,
  });

  const buangDraft = useCallback(() => {
    setDrafts({});
    batalkanAntrean();
  }, [batalkanAntrean]);
  const adaDraft = useCallback(() => Object.keys(draftsRef.current).length > 0, []);
  const aksiDraft = useMemo<AksiDraftTabel>(
    () => ({ adaDraft, flush, buang: buangDraft }),
    [adaDraft, flush, buangDraft],
  );

  useEffect(() => {
    onAksiDraftSiap?.(aksiDraft);
    return () => onAksiDraftSiap?.(null);
  }, [aksiDraft, onAksiDraftSiap]);

  /** Simpan nilai satu sel: tulis draft lalu antrekan ke server. */
  const simpanSel = useCallback((id: string | number, key: string, nilai: string | null) => {
    // Sel menyerahkan id apa adanya dari baris (number), sedangkan kunci draft
    // dan antrean simpan selalu string. Normalkan SEKALI di sini: tanpa ini
    // `String(r.id) === idKey` di useAntreanSimpan tak pernah bertemu
    // ("485" !== 485) sehingga baris dianggap tak ada dan simpanan dibatalkan
    // diam-diam tanpa galat.
    const idKey = String(id);
    setDrafts((prev) => ({ ...prev, [idKey]: { ...(prev[idKey] ?? {}), [key]: nilai } }));
    enqueueSave(idKey, { [key]: nilai });
  }, [enqueueSave]);

  /** DSG tetap menangani tempel TSV/blok dan hapus nilai sel saat kolomnya
   *  terbuka (Mode Ubah). Perubahan dibandingkan dengan nilai
   *  tampil (server + draft) lalu masuk antrean simpan yang sama dengan
   *  penyuntingan sel, sehingga validasi, toast, dan muat ulang tetap satu
   *  jalur. Tanpa handler ini DSG mengubah nilai internalnya sendiri lalu
   *  ditimpa render berikutnya — perubahan hilang tanpa pesan. */
  const tanganiPerubahanDsg = useCallback((baru: GridRow[]) => {
    if (!bisaEdit) return;
    const lamaById = new Map(nilaiRef.current.map((r) => [String(r.id), r]));
    const perBaris = new Map<string, Record<string, string | null>>();

    for (const g of baru) {
      if (String(g.id) === INPUT_ROW_ID) continue;
      const lama = lamaById.get(String(g.id));
      if (!lama) continue;
      for (const key of editableKeys) {
        const f = fieldsRef.current.find((x) => x.key === key);
        if (!f) continue;
        let val = (g[key] as string | null) ?? null;
        // Samakan normalisasi tempel V1: toggle jadi 'ya'/'tidak', select
        // hanya menerima nilai yang ada di daftar pilihan (selain kosong).
        if (f.kind === 'toggle') {
          val = ['', 'tidak', 'no', 'false', '0'].includes(String(val ?? '').trim().toLowerCase())
            ? 'tidak'
            : 'ya';
        }
        if (f.kind === 'select' && val !== null) {
          const opsi = f.choicesForRow?.(g.id) ?? f.choices ?? [];
          if (!opsi.some((o) => o.value === val)) continue;
        }
        const old = (lama[key] as string | null) ?? null;
        if ((val ?? '') === (old ?? '')) continue;
        const flds = perBaris.get(String(g.id)) ?? {};
        flds[key] = val;
        perBaris.set(String(g.id), flds);
      }
    }

    if (perBaris.size === 0) return;

    setDrafts((prev) => {
      const next = { ...prev };
      for (const [id, flds] of perBaris) {
        next[id] = { ...(next[id] ?? {}), ...flds };
      }
      return next;
    });
    for (const [id, flds] of perBaris.entries()) enqueueSave(id, flds);
  }, [bisaEdit, editableKeys, enqueueSave]);

  /** Urutan kunci kolom grid (indeks seleksi DSG): centang, data, Aksi. */
  const kunciKolomGrid = useMemo(() => [
    ...(hideCheckbox ? [] : ['check']),
    ...fields.map((f) => f.key),
    ...(renderActions ? ['__aksi'] : []),
  ], [hideCheckbox, fields, renderActions]);

  /** Kolom yang boleh berubah karena seret: sama dengan yang bisa disunting. */
  const editableSet = useMemo(() => new Set(editableKeys), [editableKeys]);

  /** Seleksi untuk seret: blok aktif, atau sel aktif tunggal bila belum ada. */
  const seleksiSeret = useMemo<GridSelection | null>(() => {
    if (range) return range;
    return selAktif ? { min: selAktif, max: selAktif } : null;
  }, [range, selAktif]);

  /** Terapkan seret isi sel: halaman boleh menangani sendiri, atau tulis
   *  draft per baris lalu antrekan simpan seperti biasa. */
  const terapkanSeretIsi = useCallback((sumber: BlokIsi, target: BlokIsi, mode: ModeSeret) => {
    if (onSeretIsi) {
      onSeretIsi({ mode, sumber, target, kunciKolom: kunciKolomGrid, rows: nilaiRef.current });
      return;
    }
    const perubahan = susunPerubahanSeret(
      nilaiRef.current, sumber, target, kunciKolomGrid, editableSet, mode,
    );
    if (perubahan.length === 0) return;

    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of perubahan) {
        next[p.id] = { ...(next[p.id] ?? {}), ...p.fields };
      }
      return next;
    });
    for (const p of perubahan) enqueueSave(p.id, p.fields);
    toast.success(mode === 'pindah' ? 'Isi sel dipindahkan.' : 'Isi sel disalin.');
  }, [onSeretIsi, kunciKolomGrid, editableSet, enqueueSave]);

  useSeretIsiSel(wrapRef, {
    aktif: modeSeret !== null && modeUbah && (bisaEdit || onSeretIsi != null),
    mode: modeSeret,
    bisaTulis: onSeretIsi != null || bisaEdit,
    onTerapkan: terapkanSeretIsi,
  }, {
    kunciKolom: kunciKolomGrid,
    jumlahBaris: nilai.length,
    seleksi: seleksiSeret,
  });

  /** Salin TSV dari menu konteks & Ctrl/Cmd+C (mesin V1 dipakai apa adanya). */
  const {
    displayOf,
    salinBarisCtx,
    salinSelCtx,
    salinKolomCtx,
    salinSemuaCtx,
    teksSalinan,
    salinFisik,
  } = useSalinTabel<GridRow>({
    hideCheckbox,
    hideActions: !renderActions,
    visibleFieldsRef: fieldsRef,
    fieldsRef,
    rowsRef: gridRowsRef,
    gridValueRef: gridRowsRef,
    gridByIdRef,
    checkedIdsRef: dipilihRef,
    rangeRef,
    labelKolom: labelKolomEfektif,
  });
  useSalinClipboard({ wrapRef, rangeRef, teksSalinan, salinFisik });

  /** Salin/tempel blok khusus halaman (mis. jadwal) menang atas penyalin TSV
   *  saat Mode Ubah menyala. */
  useSalinTempelBlok(wrapRef, {
    aktif: modeUbah && (onSalinBlok != null || onTempelBlok != null),
    blokAktif: () => blokDariSeleksi(seleksiSeret, kunciKolomGrid, nilai.length),
    kunciKolom: () => kunciKolomGrid,
    onSalin: (p) => onSalinBlok?.({ blok: p.blok, kunciKolom: p.kunciKolom, rows: nilaiRef.current }),
    onTempel: (p) => onTempelBlok?.({ blok: p.blok, kunciKolom: p.kunciKolom, rows: nilaiRef.current }),
  });

  /** data-server + draft; dipakai grid & pengukuran teks. */
  const nilaiTampil = useCallback((row: GridRow): GridRow => {
    const d = draftsRef.current[String(row.id)];
    return d ? ({ ...row, ...d } as GridRow) : row;
  }, []);
  const nilaiTampilRef = useRef(nilaiTampil);
  nilaiTampilRef.current = nilaiTampil;
  /** Mesin lebar kolom V1 dipakai ulang apa adanya: lebar tersimpan pengguna,
   *  AutoFit, persistensi per perangkat, dan gerbang anti-lompat. */
  /** Sakelar "tabel mengisi lebar wadah" (pref perangkat menang atas bawaan). */
  const isiLebarAktif = useIsiLebar(tableKey, isiLebarPenuh);

  /** Geser judul hanya hidup di Mode Ubah, untuk super admin efektif, saat
   *  isi-lebar mati, dan bila halaman menyediakan penyimpanan urutan. */
  const geserHidup = bolehGeser && geserHeader && modeUbah && !isiLebarAktif && !!onPindahKolom;
  useSeretKolomHeader({
    terlihat: fields.map((f) => f.key),
    wrapRef,
    aktif: geserHidup,
    kelasJudul: 'simpes-dsg-v2-headtitle',
    onPindah: onPindahKolom ?? TANPA_PINDAH_KOLOM,
  });

  /** Rasio skala dipakai seret gagang agar gerakan kursor 1 px tetap 1 px. */
  const skalaIsiRef = useRef(1);
  /** Lebar efekti+ area gulir, dasar penskalaan (0 = belum terukur). */
  const lebarWadah = useLebarWadah(wrapRef, isiLebarAktif);

  /** renderActions dari halaman biasanya fungsi inline yang berganti
   *  identitas tiap render; dibaca lewat ref agar hitung ulang seluruh baris
   *  hanya terjadi saat data berubah. */
  const renderAksiRef = useRef(renderActions);
  renderAksiRef.current = renderActions;

  /** Jumlah ikon/aksi terbanyak di antara baris yang tampil: izin bisa
   *  berbeda per baris, sedangkan satu kolom dipakai bersama. Nilainya juga
   *  menjadi sinyal agar lebar kolom Aksi diukur ulang setelah aksi terender. */
  const jumlahAksi = useMemo(() => {
    let maks = 0;
    for (const r of rows) {
      const n = flattenAksiMenu(renderAksiRef.current?.(r.id)).length;
      if (n > maks) maks = n;
    }
    return maks;
  }, [rows]);

  const lebar = useLebarKolom<GridRow>({
    tableKey,
    fields,
    fieldsRef,
    rows,
    rowsRef,
    getValuesRef,
    gridByIdRef,
    visibleFields: fields,
    wrapRef,
    getSelectedColumnKeys: () => [],
    labelKolom: labelKolomEfektif,
    hideActions: !renderActions,
    sinyalAksi: jumlahAksi,
    hideCheckbox,
    loading,
    headerH,
    fontPx,
    fontFamily,
    effectiveFont,
    fontStack,
    fontStackWeight,
    skalaRef: skalaIsiRef,
  });

  /** Kolom beku menutupi konten yang digulir ke arahnya: bila gulir berhenti
   *  di tengah kolom, kolom pertama setelah area beku tampil terpotong.
   *  Setelah gulir berhenti, ratakan tepi kolom terdekat dengan tepi area
   *  beku — memakai mesin V1 (`targetGulirBeku`) supaya rasa gulirnya sama. */
  const snapBekuTimerRef = useRef<number | null>(null);
  /** Thumb scrollbar sedang diseret: snap ditahan sampai pointer dilepas,
   *  supaya posisi tidak melompat di bawah jari pengguna. */
  const seretScrollbarRef = useRef(false);
  const snapBeku = useCallback(() => {
    if (snapBekuTimerRef.current !== null) window.clearTimeout(snapBekuTimerRef.current);
    snapBekuTimerRef.current = null;
    // Sedang menyeret lebar kolom atau thumb scrollbar: jangan lawan gerakan
    // pengguna. Setelah pointer dilepas, snap dijadwalkan ulang dari efek.
    if (freezeAktif <= 0 || lebar.sedangLebar || seretScrollbarRef.current) return;
    snapBekuTimerRef.current = window.setTimeout(() => {
      snapBekuTimerRef.current = null;
      if (seretScrollbarRef.current) return;
      const el = wrapRef.current;
      const cont = el?.querySelector<HTMLElement>('.dsg-container');
      if (!el || !cont) return;

      // Tepi kanan area beku = kanan sel header terakhir yang menempel.
      const beku = [...el.querySelectorAll<HTMLElement>(
        '.dsg-row-header .dsg-cell.dsg-cell-sticky-left, .dsg-row-header .dsg-cell-gutter',
      )];
      if (beku.length === 0) return;
      const batas = Math.max(...beku.map((c) => c.getBoundingClientRect().right));
      // Area beku sudah menutupi seluruh lebar yang terlihat: tak ada kolom
      // bergulir yang bisa diratakan.
      if (batas >= cont.getBoundingClientRect().right - 1) return;

      // Kiri tiap kolom yang masih bergulir (beku, gutter, aksi dilewati).
      const kolomKiri: number[] = [];
      el.querySelectorAll<HTMLElement>('.dsg-row-header .dsg-cell').forEach((c) => {
        if (c.classList.contains('dsg-cell-sticky-left')
          || c.classList.contains('dsg-cell-gutter')
          || c.classList.contains('dsg-cell-sticky-right')) return;
        if (c.querySelector('[data-col-key]') === null) return;
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
  }, [freezeAktif, lebar.sedangLebar]);

  /** Scrollbar melayang memakai pointer event. Selama thumb masih ditahan,
   *  snap ditahan; begitu pointer dilepas, snap dijalankan sekali supaya
   *  kolom tetap rata tanpa posisi melompat di bawah jari.
   *
   *  Sekaligus menangani bug DSG: klik sel di kolom beku membuat DSG
   *  menggulir ke posisi STATIS kolom itu (`scrollTo(activeCell)`), sehingga
   *  grid melompat ke kiri walau selnya sedang menempel. Posisi gulir
   *  dikembalikan bila pointer tidak bergerak (klik, bukan seret seleksi). */
  const klikBekuRef = useRef<{ left: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const kontainer = () => el.querySelector<HTMLElement>('.dsg-container');
    /** Selama pointer masih di bawah (klik/seret dari kolom beku), posisi
     *  gulir dikunci ke nilai sebelum klik. DSG menggulir ke posisi statis
     *  sel lewat effect setelah state seleksi berubah; guard ini menahannya
     *  sampai pointer dilepas. */
    let jaga = false;
    const jagaScroll = () => {
      if (!jaga) return;
      const k = klikBekuRef.current;
      const cont = kontainer();
      if (k && cont && Math.abs(cont.scrollLeft - k.left) > 0.5) cont.scrollLeft = k.left;
    };
    const mulai = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[role="scrollbar"]')) {
        seretScrollbarRef.current = true;
        return;
      }
      const cont = kontainer();
      if (cont && target?.closest?.('.dsg-cell-sticky-left')) {
        klikBekuRef.current = { left: cont.scrollLeft, x: e.clientX, y: e.clientY };
        jaga = true;
        cont.addEventListener('scroll', jagaScroll);
      }
    };
    const selesai = (e: PointerEvent) => {
      const k = klikBekuRef.current;
      klikBekuRef.current = null;
      const cont = kontainer();
      if (jaga) {
        jaga = false;
        cont?.removeEventListener('scroll', jagaScroll);
      }
      // Sisa geseran kecil setelah guard dilepas (mis. DSG menggulir lagi
      // pada frame berikutnya) dikembalikan bila pointer tidak bergerak.
      if (k && cont && Math.hypot(e.clientX - k.x, e.clientY - k.y) <= 4
        && Math.abs(cont.scrollLeft - k.left) > 0.5) {
        cont.scrollLeft = k.left;
      }
      if (!seretScrollbarRef.current) return;
      seretScrollbarRef.current = false;
      snapBeku();
    };
    /** Pointer dilepas di luar jendela: guard tidak boleh tertinggal aktif. */
    const batal = () => {
      klikBekuRef.current = null;
      if (!jaga) return;
      jaga = false;
      kontainer()?.removeEventListener('scroll', jagaScroll);
    };
    el.addEventListener('pointerdown', mulai, true);
    window.addEventListener('pointerup', selesai);
    window.addEventListener('pointercancel', selesai);
    window.addEventListener('blur', batal);
    return () => {
      el.removeEventListener('pointerdown', mulai, true);
      window.removeEventListener('pointerup', selesai);
      window.removeEventListener('pointercancel', selesai);
      window.removeEventListener('blur', batal);
      kontainer()?.removeEventListener('scroll', jagaScroll);
    };
  }, [snapBeku]);

  useEffect(() => () => {
    if (snapBekuTimerRef.current !== null) window.clearTimeout(snapBekuTimerRef.current);
  }, []);

  /** Freeze dinyalakan atau lebar kolom berubah: tepi area beku ikut bergeser,
   *  jadi ratakan lagi tanpa menunggu pengguna menggulir. */
  useEffect(() => {
    if (freezeAktif > 0 && !lebar.sedangLebar) snapBeku();
  }, [freezeAktif, lebar.sedangLebar, lebar.widths, lebar.autoWidths, lebar.syncAutoWidths, snapBeku]);

  /** Lebar kolom data hasil skala agar tabel mengisi wadah; `null` = pakai
   *  lebar basis apa adanya (fitur mati / wadah belum terukur). Kolom tetap
   *  (gutter, centang, Aksi) tidak ikut diskalakan — itu chrome tabel.
   *
   *  PENTING: hanya MEMBESARKAN. Halaman V2 boleh memuat banyak kolom (halaman
   *  ini memuat seluruh kolom 3 tabel, ~92), sehingga total lebar basis hampir
   *  selalu melebihi wadah. Bila rasio dipakai apa adanya, semua kolom menyusut
   *  ke lebar minimum dan tabel jadi tak terbaca. Saat tabel memang lebih lebar
   *  dari wadah, membiarkannya menggulir horizontal adalah perilaku yang benar. */
  const skalaIsi = useMemo(() => {
    if (!isiLebarAktif || lebarWadah <= 0) return null;
    const lebarTetap = GUTTER_W
      + (hideCheckbox ? 0 : CHECK_W)
      + (renderActions ? (lebar.widths.__aksi ?? lebar.autoWidths.__aksi ?? lebar.syncAutoWidths.__aksi ?? lebarKolomAksi(3)) : 0)
      + RESIZER_OVERHANG;
    const kolom = fields.map((f) => ({
      key: f.key,
      lebar: lebar.widths[f.key] ?? lebar.autoWidths[f.key] ?? lebar.syncAutoWidths[f.key] ?? f.width ?? 160,
    }));
    const hasil = skalaLebarIsi(kolom, lebarWadah, lebarTetap);
    // Opsi A: hanya membesarkan. Tabel yang total kolomnya melebihi wadah
    // dibiarkan menggulir horizontal — menyusutkan semua kolom sampai batas
    // minimum akan membuat tabel tak terbaca.
    return hasil && hasil.rasio > 1 ? hasil : null;
  }, [isiLebarAktif, lebarWadah, fields, lebar.widths, lebar.autoWidths, lebar.syncAutoWidths, hideCheckbox, renderActions]);
  skalaIsiRef.current = skalaIsi?.rasio ?? 1;

  /** Tinggi row memakai preference per tabel lebih dulu, kemudian preference
   *  global, lalu bawaan 24px. */
  const effectiveH = tinggiBarisDasar ?? rowH ?? TINGGI_BARIS_BAWAAN;
  const lebarUntukTinggi = useMemo(
    () => ({ ...lebar.widths, ...(skalaIsi?.lebar ?? {}) }),
    [lebar.widths, skalaIsi],
  );
  const tinggiBarisSatuan = useTinggiBarisSatuan({
    wrapRef,
    effectiveH,
    effectiveFont,
    visibleFields: fields,
    widths: lebarUntukTinggi,
    autoWidths: lebar.autoWidths,
    syncAutoWidths: lebar.syncAutoWidths,
    tinggiBarisManual,
    barisIkutIsi,
    maxRows,
  });
  const tinggiPerBaris = useMemo(() => nilai.map(tinggiBarisSatuan), [nilai, tinggiBarisSatuan]);
  const tinggiSeragam = tinggiPerBaris.length > 0
    && tinggiPerBaris.every((h) => h === tinggiPerBaris[0]);
  const gridRowHeight = useMemo(
    () => (tinggiSeragam
      ? tinggiPerBaris[0]
      : (nilai.length === 0
          ? effectiveH
          : ({ rowData }: { rowData: GridRow }) => tinggiBarisSatuan(rowData))),
    [tinggiSeragam, tinggiPerBaris, nilai.length, effectiveH, tinggiBarisSatuan],
  );
  /** DSG menyimpan offset row; remount hanya diperlukan saat tinggi berbeda
   *  antar-row. Jalur seragam tetap stabil saat pagination atau sort. */
  const sigTinggiBaris = useMemo(() => {
    if (tinggiPerBaris.length === 0) return `kosong:${effectiveH}`;
    if (tinggiSeragam) return `seragam:${tinggiPerBaris[0]}`;
    return `${sigTinggiBarisManual}|${tinggiPerBaris.join(',')}`;
  }, [tinggiPerBaris, tinggiSeragam, effectiveH, sigTinggiBarisManual]);

  const kolom = useMemo<Column<GridRow>[]>(() => {
    const cols: Column<GridRow>[] = [];

    if (!hideCheckbox) {
      cols.push({
        id: '__pilih',
        title: <KepalaPilihSemuaV2 />,
        component: SelCentangV2,
        columnData: { onToggle: onTogglePilih },
        basis: CHECK_W,
        grow: 0,
        shrink: 0,
        minWidth: CHECK_W,
        disabled: true,
      });
    }

    for (const [iData, f] of fields.entries()) {
      const rata = rataKolom(f, alignDb);
      /** Select record lama: teks saat view, dropdown hanya saat Mode Ubah. */
      const selectBisa = f.kind === 'select' && bisaEdit && modeUbah;
      /** Satu gerbang untuk semua jalur DSG (disabled, tempel, hapus). */
      const bisaUbahSel = f.kind === 'select' ? selectBisa : (bisaEdit && f.kind !== 'static');
      const onSimpanKolom = f.kind === 'select'
        ? (selectBisa ? simpanSel : undefined)
        : (bisaEdit ? simpanSel : undefined);
      /** Tepi kanan area beku: DSG sendiri sudah menempelkan kolomnya lewat
       *  `stickyLeftColumnCount`, kelas ini hanya menambah garis pemisah. */
      const tepiBeku = freezeAktif > 0 && iData === freezeAktif - 1;
      cols.push({
        id: f.key,
        title: (
          <JudulKolomV2
            teks={`${labelTampil(f.key, f.label, labelDb)}${inputRow && f.required && bisaInput(f) ? ' *' : ''}`}
            rata={rata}
            colKey={f.key}
            onResizeStart={lebar.startResize}
            onAutoFit={lebar.onAutoFit}
            seretAktif={geserHidup}
          />
        ),
        component: SelTeksV2,
        columnData: {
          field: f,
          rata,
          modeUbah,
          ...(f.kind === 'select' ? { bisaSelect: selectBisa } : {}),
          barisIkutIsi: barisIkutIsi && maxRows === undefined,
          onSimpan: onSimpanKolom,
        },
        basis: skalaIsi?.lebar[f.key] ?? lebar.widths[f.key] ?? lebar.autoWidths[f.key] ?? lebar.syncAutoWidths[f.key] ?? f.width ?? 160,
        // Sama seperti V1: lebar ditentukan `basis`, bukan diregangkan DSG.
        // `grow: 1` membuat DSG mengabaikan `basis` saat tabel lebih sempit
        // dari wadah, sehingga hasil penskalaan isi-lebar tak terpakai.
        grow: 0,
        shrink: 0,
        minWidth: MIN_COL_W,
        // Hanya kolom yang benar-benar bisa disunting yang dibuka; kolom
        // `static` tetap terkunci meski Mode Ubah menyala, dan select V2
        // tetap teks sampai Mode Ubah aktif.
        disabled: !bisaUbahSel,
        // DSG hanya mengubah nilai lewat `pasteValue`/`deleteValue`: tanpa
        // keduanya, tempel TSV dan tombol Delete tidak menghasilkan perubahan
        // sehingga onChange tak pernah melihat baris yang berbeda. Nilai
        // mentah sengaja diteruskan apa adanya; normalisasi toggle/select dan
        // validasi tetap ditangani `tanganiPerubahanDsg` + antrean simpan.
        copyValue: ({ rowData }: { rowData: GridRow }) => String(rowData[f.key] ?? ''),
        deleteValue: ({ rowData }: { rowData: GridRow }) => (
          bisaUbahSel
            ? ({ ...rowData, [f.key]: f.kind === 'toggle' ? 'tidak' : null } as GridRow)
            : rowData
        ),
        pasteValue: ({ rowData, value }: { rowData: GridRow; value: string }) => (
          bisaUbahSel ? ({ ...rowData, [f.key]: value } as GridRow) : rowData
        ),
        isCellEmpty: ({ rowData }: { rowData: GridRow }) =>
          rowData[f.key] == null || rowData[f.key] === '',
        headerClassName: tepiBeku ? 'simpes-dsg-v2-beku-tepi' : undefined,
        cellClassName: ({ rowData }: { rowData?: GridRow }) => cn(
          barisIkutIsi && maxRows === undefined && 'px-2',
          tepiBeku && 'simpes-dsg-v2-beku-tepi',
          rowData ? f.cellClass?.(rowData) : undefined,
        ) || undefined,
      });
    }

    return cols;
  }, [fields, hideCheckbox, labelDb, alignDb, onTogglePilih, onTogglePilihSemua, lebar.widths, lebar.autoWidths, lebar.syncAutoWidths, lebar.startResize, lebar.onAutoFit, skalaIsi, modeUbah, bisaEdit, simpanSel, barisIkutIsi, maxRows, !!inputRow, freezeAktif, geserHidup]);

  /** Kolom Aksi = kolom sticky kanan DSG. Sengaja TIDAK ikut columns:
   *  DSG menggambarnya terpisah agar menempel saat digulir horizontal.
   *  Lebarnya memakai hasil ukur DOM (termasuk tombol teks); asumsi jumlah
   *  ikon di lebarAksi.ts hanya cadangan saat pengukuran belum tersedia. */
  const kolomAksi = useMemo<Column<GridRow> | undefined>(() => {
    if (!renderActions) return undefined;
    // V1 mengukur tombol yang benar-benar dirender lewat `measureActionsWidth`
    // (hasilnya di autoWidths.__aksi). Pakai hasil ukur itu lebih dulu supaya
    // tombol teks (mis. MI/MD) tidak terpotong; asumsi ikon hanya cadangan.
    const lebarTerukur = lebar.widths.__aksi
      ?? lebar.autoWidths.__aksi
      ?? lebar.syncAutoWidths.__aksi
      ?? 0;
    // Hasil ukur bisa parsial saat mount (aksi kedua belum terender); jangan
    // sampai lebih sempit dari kebutuhan minimum jumlah aksi.
    const lebarAksi = Math.max(lebarTerukur, lebarKolomAksi(jumlahAksi));
    return {
      id: '__aksi',
      title: <JudulKolomV2 teks="" rata="kanan" />,
      component: SelAksiV2,
      columnData: { render: renderActions },
      basis: lebarAksi,
      grow: 0,
      shrink: 0,
      minWidth: lebarAksi,
      disabled: true,
    };
  }, [renderActions, jumlahAksi, lebar.widths.__aksi, lebar.autoWidths.__aksi, lebar.syncAutoWidths.__aksi]);

  const onBarisAktifRef = useRef(onBarisAktif);
  onBarisAktifRef.current = onBarisAktif;

  /** DSG memberi indeks baris; halaman butuh id baris domain. Posisi sel
   *  aktif juga disimpan sebagai fallback sumber seret isi sel.
   *
   *  PENTING: DSG memanggil callback ini ulang setiap `columns` berganti
   *  identitas, termasuk untuk sel yang SAMA. Tanpa dedupe, `setSelAktif`
   *  membuat objek baru → render → kolom dibangun ulang → callback lagi
   *  (loop render tanpa henti; gejalanya kolom Aksi berkedip). */
  const tanganiSelAktif = useCallback(({ cell }: { cell: { row: number; col: number } | null }) => {
    const prev = selAktifRef.current;
    if (cell === null) {
      if (prev === null) return;
      selAktifRef.current = null;
      setSelAktif(null);
      return;
    }
    if (prev && prev.row === cell.row && prev.col === cell.col) return;

    const posisi = { row: cell.row, col: cell.col };
    selAktifRef.current = posisi;
    setSelAktif(posisi);

    const r = rowsRef.current[cell.row];
    if (r) onBarisAktifRef.current?.(r.id);
  }, []);

  const tanganiSeleksi = useCallback(({ selection }: { selection: GridSelection | null }) => {
    setRange((prev) => {
      if (prev === selection) return prev;
      if (prev && selection
        && prev.min.row === selection.min.row && prev.min.col === selection.min.col
        && prev.max.row === selection.max.row && prev.max.col === selection.max.col) {
        return prev;
      }
      return selection;
    });
  }, []);

  const rowClassName = useCallback((args: { rowData?: GridRow }) => {
    const rowData = args?.rowData;
    if (!rowData) return undefined;
    const kelas: string[] = [];
    if (dipilih.has(rowData.id)) kelas.push('simpes-dsg-v2-row-checked');
    if (barisAktifId != null && String(rowData.id) === String(barisAktifId)) {
      kelas.push('simpes-dsg-v2-row-aktif');
    }
    return kelas.length > 0 ? kelas.join(' ') : undefined;
  }, [dipilih, barisAktifId]);

  /** Gerbang anti-lompat (sama seperti V1): DSG merender kolom dengan lebar
   *  bawaan (100px) di frame pertama sebelum basis kita dipakai. Teks grid
   *  disembunyikan — ruangnya tetap dialokasikan — sampai lebar basis benar-
   *  benar terpasang, supaya judul kolom tidak terlihat melompat. */
  const siapTampil = lebar.lebarStabil && lebar.tampilGrid;

  const tinggiHeaderEfektif = hideHeader ? 0 : (headerH ?? lebar.headerAutoH ?? DEFAULT_HEADER_H);
  useEffect(() => {
    onTinggiHeaderChange?.(tinggiHeaderEfektif);
  }, [onTinggiHeaderChange, tinggiHeaderEfektif]);

  const batasBaris = maxRows === undefined ? undefined : Math.max(1, Math.round(maxRows));
  const jumlahRowKompak = batasBaris === undefined ? 0
    : inputRow ? Math.min(nilai.length, batasBaris) + 1
      : Math.min(Math.max(nilai.length, 1), batasBaris);
  const tinggiKompak = batasBaris === undefined
    ? undefined
    : loading
      ? tinggiKompakCache.get(tableKey)
        ?? tinggiHeaderEfektif + 1 + batasBaris * effectiveH
      : nilai.length === 0 && !inputRow
        ? 280
        : tinggiHeaderEfektif + 1 + jumlahRowKompak * effectiveH;
  const tinggiGrid = tinggiKompak ?? tinggi;

  useEffect(() => {
    if (batasBaris !== undefined && !loading && tinggiKompak !== undefined) {
      tinggiKompakCache.set(tableKey, tinggiKompak);
    }
  }, [tableKey, batasBaris, loading, tinggiKompak]);

  /** Preferensi grid perangkat dipasang sebagai variabel CSS supaya rantai
   *  fallback di index.css bekerja: setelan bagian (--part-tabel_sel-*)
   *  menang atas preferensi perangkat, dan preferensi menang atas bawaan. */
  const gayaWadah: CSSProperties & Record<string, string> = {
    '--simpes-font-size': `${fontPx ?? DEFAULT_FONT_PX}px`,
  };
  if (fontFamily) gayaWadah['--simpes-font-family'] = fontFamily;

  useEffect(() => {
    onSiapLebar?.({ autoFitSemua: lebar.onAutoFitAll, resetLebar: lebar.resetLebar });
  }, [onSiapLebar, lebar.onAutoFitAll, lebar.resetLebar]);

  const memuatAwal = loading && rows.length === 0;
  const pakaiMemuat = !inputRow && (memuatAwal || (loading && batasBaris !== undefined));
  const nilaiPilihSemua = useMemo(
    () => ({ status: statusPilih, onToggle: onTogglePilihSemua }),
    [statusPilih, onTogglePilihSemua],
  );
  const kunciKolom = `${tableKey}-${fields.map((f) => f.key).join('|')}-baris-${sigTinggiBaris}`;

  /** Cari baris + kolom di bawah pointer klik kanan. Target bisa jatuh di
   *  padding sel atau lapisan seleksi DSG yang tidak membawa `data-col-key`. */
  function cariSelPointer(e: ReactMouseEvent): { rowEl: HTMLElement | null; colKey: string | null } {
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

  /** Klik kanan: tentukan area. Area kosong tidak punya menu; preventDefault
   *  menahan menu bawaan Radix maupun WebView. */
  function onGridContextMenu(e: ReactMouseEvent) {
    const t = e.target as HTMLElement;

    if (t.closest('.dsg-cell-gutter.dsg-cell-header')) {
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
      const g = Number.isFinite(nomor) ? nilaiRef.current[nomor - 1] : undefined;
      if (g) {
        const rowLabel = displayOf(g.id, fieldsRef.current[0]?.key ?? '') || String(g.id);
        setCtx({ area: 'row', rowId: g.id, rowLabel, colKey: colKeyBaris });
        return;
      }
    }
    e.preventDefault();
  }

  const ctxHeaderLabel = ctx.area === 'header'
    ? labelKolomEfektif(ctx.colKey, fieldsRef.current.find((f) => f.key === ctx.colKey)?.label ?? ctx.colKey)
    : '';
  /** Aksi record halaman untuk baris yang diklik kanan. Halaman sudah
   *  menggerbang izin di `renderActions`, jadi menu tinggal menampilkannya. */
  const ctxAksi = ctx.area === 'row'
    ? [
        ...(renderActions ? flattenAksiMenu(renderActions(ctx.rowId)) : []),
        ...(renderActionsKonteks ? flattenAksiMenu(renderActionsKonteks(ctx.rowId)) : []),
      ]
    : [];

  /** Blok sel untuk menu klik kanan: seleksi aktif bila klik di dalamnya,
   *  sel yang diklik saja bila di luar seleksi — sama seperti V1. */
  const blokCtx = useMemo(() => {
    if ((!onIsiBlok && !onKosongkanBlok) || ctx.area !== 'row' || seleksiSeret === null) return null;
    const rowIdx = nilai.findIndex((g) => String(g.id) === String(ctx.rowId));
    const colIdx = ctx.colKey ? kunciKolomGrid.indexOf(ctx.colKey) : -1;
    if (rowIdx < 0 || colIdx < 0) return null;
    const r0 = Math.min(seleksiSeret.min.row, seleksiSeret.max.row);
    const r1 = Math.max(seleksiSeret.min.row, seleksiSeret.max.row);
    const c0 = Math.min(seleksiSeret.min.col, seleksiSeret.max.col);
    const c1 = Math.max(seleksiSeret.min.col, seleksiSeret.max.col);
    const diDalam = rowIdx >= r0 && rowIdx <= r1 && colIdx >= c0 && colIdx <= c1;
    const rowsBlok = nilai.slice(diDalam ? r0 : rowIdx, (diDalam ? r1 : rowIdx) + 1);
    const fieldsBlok = kunciKolomGrid
      .slice(diDalam ? c0 : colIdx, (diDalam ? c1 : colIdx) + 1)
      .filter((k) => k !== 'check' && k !== '__aksi')
      .map((k) => fields.find((f) => f.key === k))
      .filter((f): f is ExcelField => f != null);
    if (rowsBlok.length === 0 || fieldsBlok.length === 0) return null;
    return { rows: rowsBlok, fields: fieldsBlok, jumlah: rowsBlok.length * fieldsBlok.length };
  }, [onIsiBlok, onKosongkanBlok, ctx, seleksiSeret, nilai, kunciKolomGrid, fields]);

  return (
    // PENTING: `min-w-0` + `overflow-hidden` mengunci lebar pembungkus ini ke
    // sisa ruang flex. Tanpa keduanya, pembungkus ikut melebar mengikuti lebar
    // konten DSG (yang bisa puluhan kolom) sehingga muncul scrollbar horizontal
    // KEDUA di pembungkus tabel — selain scrollbar milik grid sendiri — dan
    // lebar kolom Aksi ikut terukur ulang/berkedip.
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col overflow-hidden',
        batasBaris === undefined ? 'flex-1' : 'shrink-0 transition-[height] duration-200 ease-out',
      )}
      data-max-rows={batasBaris}
      style={tinggiKompak === undefined ? undefined : { height: tinggiKompak }}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={wrapRef}
            data-slot="excel-table-grid"
            data-siap={siapTampil ? 'ya' : 'belum'}
            className={cn(
              'simpes-dsg-v2 relative min-h-0 flex-1 overflow-hidden',
              // visibility (bukan hidden/opacity): ruang tetap dialokasikan
              // sehingga pengukuran tinggi & lebar tetap sah, teksnya saja
              // yang belum tampak.
              !siapTampil && 'invisible',
            )}
            style={gayaWadah}
            onDoubleClick={() => { if (bolehModeUbah && !modeUbah) setModeUbah(true); }}
            onContextMenu={onGridContextMenu}
          >

            {loading && rows.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden="true">
                <div className="simpes-muat-bar h-full bg-primary/70" />
              </div>
            )}

            {pakaiMemuat ? (
              <TabelMemuat rowH={effectiveH} baris={batasBaris ?? 14} />
            ) : tinggiGrid > 0 && (
              <InputContextV2.Provider value={inputRow ? { state: inputRow, tableKey } : null}>
              <PilihSemuaContext.Provider value={nilaiPilihSemua}>
                <DataSheetGrid
                  key={`${kunciKolom}-input-${!!inputRow}`}
                  ref={gridRef}
                  value={nilaiDenganInput}
                  // Penyuntingan per sel ditangani SelTeksV2/SelSelectV2; DSG
                  // hanya dipakai untuk tempel TSV/blok dan hapus nilai sel.
                  onChange={tanganiPerubahanDsg}
                  columns={kolom}
                  gutterColumn={GUTTER_COLUMN}
                  // DSG menghitung kolom dari indeks 0 = gutter, jadi jumlah
                  // sticky = kolom centang (bila ada) + kolom data yang dibekukan.
                  stickyLeftColumnCount={(hideCheckbox ? 0 : 1) + freezeAktif}
                  stickyRightColumn={kolomAksi}
                  rowKey="id"
                  height={tinggiGrid}
                  rowHeight={inputRow ? ({ rowData }) => tinggiBarisSatuan(rowData) : gridRowHeight}
                  headerRowHeight={tinggiHeaderEfektif}
                  lockRows
                  addRowsComponent={false}
                  disableContextMenu
                  rowClassName={rowClassName}
                  onActiveCellChange={tanganiSelAktif}
                  onSelectionChange={tanganiSeleksi}
                  onScroll={snapBeku}
                />
              </PilihSemuaContext.Provider>
              </InputContextV2.Provider>
            )}

            {nilai.length === 0 && !loading && !inputRow && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <p className="text-xs text-muted-foreground">{emptyText}</p>
              </div>
            )}

            <ScrollbarMelayang orientasi="vertikal" wadahRef={wrapRef} />
            <ScrollbarMelayang orientasi="horizontal" wadahRef={wrapRef} />
          </div>
        </ContextMenuTrigger>

        <MenuKonteksV2
          tableKey={tableKey}
          header={ctx.area === 'header' ? ctx : null}
          headerLabel={ctxHeaderLabel}
          row={ctx.area === 'row' ? ctx : null}
          aksi={ctxAksi}
          blokJumlah={blokCtx?.jumlah}
          onIsiBlok={blokCtx && onIsiBlok ? () => onIsiBlok(blokCtx.rows, blokCtx.fields) : undefined}
          blokLabel={blokAksiLabel}
          onKosongkanBlok={blokCtx && modeUbah && onKosongkanBlok
            ? () => onKosongkanBlok(blokCtx.rows, blokCtx.fields)
            : undefined}
          kosongkanLabel={kosongkanBlokLabel}
          sudut={ctx.area === 'sudut'}
          onAutoFit={lebar.onAutoFit}
          onAutoFitAll={lebar.onAutoFitAll}
          freezeAktif={freezeAktif}
          headerIdx={ctx.area === 'header' ? fields.findIndex((f) => f.key === ctx.colKey) : -1}
          onFreeze={ubahFreeze}
          align={alignDb}
          onUbahAlign={onUbahAlign}
          onKelolaTabel={onKelolaTabel}
          salinBaris={(id) => void salinBarisCtx(id)}
          salinSel={(id, key) => void salinSelCtx(id, key)}
          salinKolom={(key) => void salinKolomCtx(key)}
          onSalinSemua={() => void salinSemuaCtx()}
        />
      </ContextMenu>

      {bolehModeUbah && modeUbah && (
        <div className="absolute bottom-2 right-3 z-20">
          <PillMode
            id={`banner_mode_edit_${tableKey}`}
            btnId={`btn_keluar_mode_edit_${tableKey}`}
            aksen="warning"
            ikon={<Pencil size={14} />}
            judul="Mode Ubah aktif"
            petunjuk="Sel yang ditandai bisa disunting. Nyalakan salah satu gestur seret untuk menyalin atau memindahkan blok sel."
            sakelar={[
              {
                id: `sakelar_seret_salin_${tableKey}`,
                label: 'Seret isi sel untuk copy',
                grup: 'seret_isi',
                hint: 'Tekan-tahan blok terpilih lalu geser ke sel lain — isinya disalin ke sel tujuan.',
                checked: seretSalin,
                onCheckedChange: (nyala) => ubahSeretIsi('salin', nyala),
              },
              {
                id: `sakelar_seret_pindah_${tableKey}`,
                label: 'Seret isi sel untuk move',
                grup: 'seret_isi',
                hint: 'Tekan-tahan blok terpilih lalu geser ke sel lain — isinya dipindah dan sel asal dikosongkan.',
                checked: seretPindah,
                onCheckedChange: (nyala) => ubahSeretIsi('pindah', nyala),
              },
              ...(bolehGeser && !isiLebarAktif ? [{
                id: `sakelar_geser_judul_${tableKey}`,
                label: 'Geser judul kolom',
                grup: 'geser_judul',
                hint: 'Tarik judul kolom untuk menyusun ulang urutan; urutan disimpan ke preset aktif atau urutan tabel.',
                checked: geserHeader,
                onCheckedChange: ubahGeserHeader,
              }] : []),
            ]}
            onKeluar={() => { setModeUbah(false); if (simpanSaatKeluarMode) void flush(); }}
          />
        </div>
      )}
    </div>
  );
}
