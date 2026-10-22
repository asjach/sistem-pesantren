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
import { useGridPrefs, DEFAULT_FONT_PX, DEFAULT_HEADER_H } from '@/components/GridPrefs';
import { TINGGI_BARIS_BAWAAN } from '@/components/excel/tinggiBaris';
import { TabelMemuat } from '@/components/excel/primitives';
import { cn } from '@/lib/utils';
import { labelKolom } from '@/lib/labelKolom';
import ScrollbarMelayang from '@/components/excel/ScrollbarMelayang';
import { flattenAksi } from '@/components/excel/actions';
import { CHECK_W, GUTTER_W, teksTampilSel } from '@/components/excel/helpers';
import type { ExcelField, GridRow } from '@/components/excel/types';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import { lebarKolomAksi } from './lebarAksi';
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

/** Sel data V2: baca-saja, teks diformat sesuai format field. */
function SelTeksV2({ rowData, columnData }: CellProps<GridRow, { field: ExcelField; rata: RataKolom }>) {
  const { field: f, rata } = columnData;

  /** Kolom toggle digambar sebagai sakelar mati (baca-saja), bukan teks kosong.
   *  Ukuran xs (24x14px) sama dengan sel switch V1; ukuran bawaan terlalu
   *  besar untuk baris tabel. */
  if (f.kind === 'toggle') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Switch size="xs" checked={rowData[f.key] === 'ya'} disabled aria-label={labelKolom(f.label || f.key)} />
      </div>
    );
  }

  const teks = teksTampilSel(f, rowData[f.key]);
  const isi = (
    <span className="min-w-0 truncate" title={teks || undefined}>
      {f.renderCell ? f.renderCell(rowData) : teks}
    </span>
  );
  const sel = (
    <div
      className={cn(
        'flex h-full w-full min-w-0 items-center px-2',
        f.format === 'angka' && 'tabular-nums',
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

/** Judul kolom V2: satu baris, terpotong, sejajar dengan isinya. */
function JudulKolomV2({ teks, rata }: { teks: string; rata: RataKolom }) {
  return (
    <div
      className={cn(
        'w-full truncate px-2',
        rata === 'kanan' ? 'text-right' : rata === 'tengah' ? 'text-center' : 'text-left',
      )}
      title={teks}
    >
      {teks}
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
  labelDb = LABEL_KOSONG,
  alignDb = ALIGN_KOSONG,
  dipilih,
  onTogglePilih,
  onTogglePilihSemua,
  barisAktifId = null,
  onBarisAktif,
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
        title: <JudulKolomV2 teks={labelTampil(f.key, f.label, labelDb)} rata={rata} />,
        component: SelTeksV2,
        columnData: { field: f, rata },
        basis: f.width ?? 160,
        grow: 1,
        shrink: 0,
        minWidth: 80,
        disabled: true,
        cellClassName: ({ rowData }: { rowData?: GridRow }) =>
          rowData ? f.cellClass?.(rowData) : undefined,
      });
    }

    return cols;
  }, [fields, hideCheckbox, labelDb, alignDb, onTogglePilih, onTogglePilihSemua]);

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

  /** Baris grid: checked mengikuti pilihan agar sel centang terkendali. */
  const nilai = useMemo(
    () => rows.map((r) => ({ ...r, checked: dipilih.has(r.id) })),
    [rows, dipilih],
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const onBarisAktifRef = useRef(onBarisAktif);
  onBarisAktifRef.current = onBarisAktif;

  /** DSG memberi indeks baris; halaman butuh id baris domain. */
  const tanganiSelAktif = useCallback(({ cell }: { cell: { row: number } | null }) => {
    if (!cell) return;
    const r = rowsRef.current[cell.row];
    if (r) onBarisAktifRef.current?.(r.id);
  }, []);

  const rowClassName = useCallback(({ rowData }: { rowData: GridRow }) => {
    const kelas: string[] = [];
    if (dipilih.has(rowData.id)) kelas.push('simpes-dsg-v2-row-checked');
    if (barisAktifId != null && String(rowData.id) === String(barisAktifId)) {
      kelas.push('simpes-dsg-v2-row-aktif');
    }
    return kelas.length > 0 ? kelas.join(' ') : undefined;
  }, [dipilih, barisAktifId]);

  /** Preferensi grid perangkat dipasang sebagai variabel CSS supaya rantai
   *  fallback di index.css bekerja: setelan bagian (--part-tabel_sel-*)
   *  menang atas preferensi perangkat, dan preferensi menang atas bawaan. */
  const gayaWadah: CSSProperties & Record<string, string> = {
    '--simpes-font-size': `${fontPx ?? DEFAULT_FONT_PX}px`,
  };
  if (fontFamily) gayaWadah['--simpes-font-family'] = fontFamily;

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
      className="simpes-dsg-v2 relative min-h-0 flex-1 overflow-hidden"
      style={gayaWadah}
    >
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
            onChange={() => {}}
            columns={kolom}
            gutterColumn={GUTTER_COLUMN}
            stickyLeftColumnCount={hideCheckbox ? 0 : 1}
            stickyRightColumn={kolomAksi}
            rowKey="id"
            height={tinggi}
            rowHeight={rowH ?? TINGGI_BARIS_BAWAAN}
            headerRowHeight={headerH ?? DEFAULT_HEADER_H}
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
