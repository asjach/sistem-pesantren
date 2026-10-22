import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DynamicDataSheetGrid as DataSheetGrid,
  type CellProps,
  type Column,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useGridPrefs, DEFAULT_FONT_PX, DEFAULT_HEADER_H, FONT_OPTIONS, FONT_FAMILY_DEFAULT } from '@/components/GridPrefs';
import { TINGGI_BARIS_BAWAAN } from '@/components/excel/tinggiBaris';
import { TabelMemuat } from '@/components/excel/primitives';
import { cn } from '@/lib/utils';
import { labelKolom } from '@/lib/labelKolom';
import ScrollbarMelayang from '@/components/excel/ScrollbarMelayang';
import { flattenAksi } from '@/components/excel/actions';
import { CHECK_W, GUTTER_W, MIN_COL_W, teksTampilSel } from '@/components/excel/helpers';
import type { ExcelField, GridRow } from '@/components/excel/types';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import { lebarKolomAksi } from './lebarAksi';
import { useLebarKolom } from '@/components/excel/useLebarKolom';
import { useAntreanSimpan } from '@/components/excel/useAntreanSimpan';
import { useIsiLebar } from '@/components/excel/useIsiLebar';
import { useLebarWadah } from '@/components/excel/useLebarWadah';
import { skalaLebarIsi, RESIZER_OVERHANG } from '@/components/excel/lebarIsi';
import { labelTampil, rataKolom, statusPilihSemua, type RataKolom } from './kolom';

/** Border checkbox tabel memakai warna garis grid (--part-tabel_grid-border,
 *  sama seperti header row, gutter, dan sel), bukan border-foreground/40
 *  bawaan komponen Checkbox. State checked ikut ditimpa supaya warnanya
 *  konsisten. */
const CHECKBOX_TABEL = 'border-[var(--part-tabel_grid-border,var(--border))] data-[state=checked]:border-[var(--part-tabel_grid-border,var(--border))]';

/** Kolom gutter DSG (nomor urut): identitas stabil agar memo kolom DSG tak
 *  dihitung ulang tiap render. */
const GUTTER_COLUMN = { basis: GUTTER_W };

/** Nilai bawaan stabil agar memo kolom tidak dihitung ulang tiap render. */
const LABEL_KOSONG: Record<string, string> = {};
const ALIGN_KOSONG: Partial<Record<string, AlignKolom>> = {};

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
function SelTeksV2({ rowData, columnData }: CellProps<GridRow, { field: ExcelField; rata: RataKolom; modeUbah: boolean; onSimpan?: (id: string | number, key: string, nilai: string | null) => void }>) {
  const { field: f, rata, modeUbah, onSimpan } = columnData;
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

  /** Kolom toggle digambar sebagai sakelar; saat Mode Ubah bisa diklik. */
  if (f.kind === 'toggle') {
    const nyala = rowData[f.key] === 'ya';
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Switch
          size="xs"
          checked={nyala}
          disabled={!bisaEdit}
          onCheckedChange={bisaEdit ? (v) => onSimpan?.(rowData.id, f.key, v ? 'ya' : 'tidak') : undefined}
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
      <div className="flex h-full w-full min-w-0 items-center px-2">
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
    <span className="min-w-0 truncate" title={teks || undefined}>
      {f.renderCell ? f.renderCell(rowData) : teks}
    </span>
  );
  const sel = (
    <div
      ref={selRef}
      className={cn(
        'flex h-full w-full min-w-0 items-center px-2',
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
 *  di sini adalah cermin AKSI_PAD_X dan AKSI_GAP di lebarAksi.ts. */
function SelAksiV2({ rowData, columnData }: CellProps<GridRow, { render: (id: string | number) => ReactNode }>) {
  return (
    <div className="flex h-full w-full items-center justify-end gap-0.5 px-1">
      {columnData.render(rowData.id)}
    </div>
  );
}

/** Judul kolom V2: satu baris, terpotong, sejajar dengan isinya.
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
}: {
  teks: string;
  rata: RataKolom;
  /** Absen = kolom tidak bisa diubah lebarnya (mis. kolom Aksi). */
  colKey?: string;
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
    <div className="absolute inset-0 flex items-center">
      <div
        className={cn(
          'w-full truncate px-2',
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
          onMouseDown={(e) => onResizeStart(colKey, e)}
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
  tableKey: string;
  fields: ExcelField[];
  rows: GridRow[];
  loading?: boolean;
  emptyText?: string;
  renderActions?: (id: string | number) => ReactNode;
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
  /** Izin menyunting sel. false = tabel murni baca-saja (Mode Ubah tak ada). */
  canEdit?: boolean;
  /** Simpan satu baris ke server; dipanggil antrean simpan otomatis. */
  onCommit?: (id: string | number, fields: Record<string, string | null>) => Promise<void>;
  /** Muat ulang data setelah antrean simpan habis (satu kali, bukan per sel). */
  onSaved?: () => Promise<void> | void;
  /** Introspeksi lebar kolom ke halaman (AutoFit semua, reset lebar).
   *  Dipanggil tiap hook siap; dipakai menu klik kanan & kontrol halaman
   *  pada poin berikutnya agar tak ada pekerjaan ulang. */
  onSiapLebar?: (aksi: { autoFitSemua: () => void; resetLebar: () => void }) => void;
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
  canEdit = false,
  onCommit,
  onSaved,
}: GridV2Props) {
  const { rowH, headerH, fontPx, fontFamily } = useGridPrefs();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tinggi, setTinggi] = useState(0);

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

  /** Baris grid per id: dipakai AutoFit untuk membaca teks sel seperti yang
   *  benar-benar dirender SelTeksV2. */
  const gridByIdRef = useRef(new Map<string, GridRow>());
  gridByIdRef.current = useMemo(
    () => new Map(rows.map((r) => [String(r.id), r])),
    [rows],
  );

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
  /** Mode Ubah: pagar agar tabel tidak tersunting tak sengaja (pola V1). */
  const [modeUbah, setModeUbah] = useState(false);
  useEffect(() => { if (!bisaEdit) setModeUbah(false); }, [bisaEdit]);
  /** Draft lokal per baris; nilai grid = data server ditimpa draft ini. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | null>>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const rowsRefEdit = useRef(rows);
  rowsRefEdit.current = rows;

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

  /** Antrean simpan V1 dipakai apa adanya: gabung ketikan beruntun, urut,
   *  validasi per field, satu muat ulang + satu toast setelah antrean habis. */
  const { enqueueSave, flush } = useAntreanSimpan<GridRow>({
    rowsRef: rowsRefEdit,
    fieldsRef,
    onCommitRef,
    onSavedRef,
    dropDraftRef,
  });

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
  /** Rasio skala dipakai seret gagang agar gerakan kursor 1 px tetap 1 px. */
  const skalaIsiRef = useRef(1);
  /** Lebar efekti+ area gulir, dasar penskalaan (0 = belum terukur). */
  const lebarWadah = useLebarWadah(wrapRef, isiLebarAktif);
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

    for (const f of fields) {
      const rata = rataKolom(f, alignDb);
      cols.push({
        id: f.key,
        title: (
          <JudulKolomV2
            teks={labelTampil(f.key, f.label, labelDb)}
            rata={rata}
            colKey={f.key}
            onResizeStart={lebar.startResize}
            onAutoFit={lebar.onAutoFit}
          />
        ),
        component: SelTeksV2,
        columnData: {
          field: f,
          rata,
          modeUbah,
          onSimpan: bisaEdit ? simpanSel : undefined,
        },
        basis: skalaIsi?.lebar[f.key] ?? lebar.widths[f.key] ?? lebar.autoWidths[f.key] ?? lebar.syncAutoWidths[f.key] ?? f.width ?? 160,
        // Sama seperti V1: lebar ditentukan `basis`, bukan diregangkan DSG.
        // `grow: 1` membuat DSG mengabaikan `basis` saat tabel lebih sempit
        // dari wadah, sehingga hasil penskalaan isi-lebar tak terpakai.
        grow: 0,
        shrink: 0,
        minWidth: MIN_COL_W,
        // Hanya kolom yang benar-benar bisa disunting yang dibuka; kolom
        // `static` tetap terkunci meski Mode Ubah menyala.
        disabled: !(bisaEdit && f.kind !== 'static'),
        cellClassName: ({ rowData }: { rowData?: GridRow }) =>
          rowData ? f.cellClass?.(rowData) : undefined,
      });
    }

    return cols;
  }, [fields, hideCheckbox, labelDb, alignDb, onTogglePilih, onTogglePilihSemua, lebar.widths, lebar.autoWidths, lebar.syncAutoWidths, lebar.startResize, lebar.onAutoFit, skalaIsi]);

  /** renderActions dari halaman biasanya fungsi inline yang berganti
   *  identitas tiap render; dibaca lewat ref agar hitung ulang seluruh baris
   *  hanya terjadi saat data berubah. */
  const renderAksiRef = useRef(renderActions);
  renderAksiRef.current = renderActions;

  /** Jumlah ikon terbanyak di antara baris yang tampil: izin bisa berbeda per
   *  baris, sedangkan satu kolom dipakai bersama. */
  const jumlahAksi = useMemo(() => {
    let maks = 0;
    for (const r of rows) {
      const n = flattenAksi(renderAksiRef.current?.(r.id)).length;
      if (n > maks) maks = n;
    }
    return maks;
  }, [rows]);

  /** Kolom Aksi = kolom sticky kanan DSG. Sengaja TIDAK ikut columns:
   *  DSG menggambarnya terpisah agar menempel saat digulir horizontal.
   *  Lebarnya mengikuti jumlah ikon (lihat lebarAksi.ts), jadi tidak perlu
   *  ditebak per halaman. */
  const kolomAksi = useMemo<Column<GridRow> | undefined>(() => {
    if (!renderActions) return undefined;
    const lebar = lebarKolomAksi(jumlahAksi);
    return {
      id: '__aksi',
      title: <JudulKolomV2 teks="" rata="kanan" />,
      component: SelAksiV2,
      columnData: { render: renderActions },
      basis: lebar,
      grow: 0,
      shrink: 0,
      minWidth: lebar,
      disabled: true,
    };
  }, [renderActions, jumlahAksi]);

  /** Baris grid: checked mengikuti pilihan agar sel centang terkendali, dan
   *  nilai sel ditimpa draft lokal supaya ketikan langsung terlihat tanpa
   *  menunggu muat ulang server. */
  const nilai = useMemo(
    () => rows.map((r) => ({ ...r, ...(drafts[String(r.id)] ?? {}), checked: dipilih.has(r.id) })),
    [rows, dipilih, drafts],
  );

  const onBarisAktifRef = useRef(onBarisAktif);
  onBarisAktifRef.current = onBarisAktif;

  /** DSG memberi indeks baris; halaman butuh id baris domain. */
  const tanganiSelAktif = useCallback(({ cell }: { cell: { row: number } | null }) => {
    if (!cell) return;
    const r = rowsRef.current[cell.row];
    if (r) onBarisAktifRef.current?.(r.id);
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
  const nilaiPilihSemua = useMemo(
    () => ({ status: statusPilih, onToggle: onTogglePilihSemua }),
    [statusPilih, onTogglePilihSemua],
  );
  const kunciKolom = `${tableKey}-${fields.map((f) => f.key).join('|')}`;

  return (
    <div
      ref={wrapRef}
      data-slot="excel-table-grid"
      data-siap={siapTampil ? 'ya' : 'belum'}
      className={cn(
        'simpes-dsg-v2 relative min-h-0 flex-1 overflow-hidden',
        // visibility (bukan hidden/opacity): ruang tetap dialokasikan sehingga
        // pengukuran tinggi & lebar tetap sah, teksnya saja yang belum tampak.
        !siapTampil && 'invisible',
      )}
      style={gayaWadah}
      onDoubleClick={() => { if (bisaEdit && !modeUbah) setModeUbah(true); }}
    >
      {bisaEdit && modeUbah && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-2 right-3 z-20 rounded-sm border border-[var(--part-tabel_grid-border,var(--border))] bg-background px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm"
        >
          Mode Ubah aktif
        </div>
      )}

      {loading && rows.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden="true">
          <div className="simpes-muat-bar h-full bg-primary/70" />
        </div>
      )}

      {memuatAwal ? (
        <TabelMemuat rowH={rowH ?? TINGGI_BARIS_BAWAAN} />
      ) : tinggi > 0 && (
        <PilihSemuaContext.Provider value={nilaiPilihSemua}>
          <DataSheetGrid
            key={kunciKolom}
            value={nilai}
            // Penyuntingan ditangani per sel (lihat SelTeksV2) supaya sel lain
            // di baris yang sama tidak ikut jadi draft; `onChange` DSG tak dipakai.
            onChange={() => {}}
            columns={kolom}
            gutterColumn={GUTTER_COLUMN}
            stickyLeftColumnCount={hideCheckbox ? 0 : 1}
            stickyRightColumn={kolomAksi}
            rowKey="id"
            height={tinggi}
            rowHeight={rowH ?? TINGGI_BARIS_BAWAAN}
            headerRowHeight={hideHeader ? 0 : (headerH ?? DEFAULT_HEADER_H)}
            lockRows
            addRowsComponent={false}
            disableContextMenu
            rowClassName={rowClassName}
            onActiveCellChange={onBarisAktif ? tanganiSelAktif : undefined}
          />
        </PilihSemuaContext.Provider>
      )}

      {nilai.length === 0 && !loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        </div>
      )}

      <ScrollbarMelayang orientasi="vertikal" wadahRef={wrapRef} />
      <ScrollbarMelayang orientasi="horizontal" wadahRef={wrapRef} />
    </div>
  );
}
