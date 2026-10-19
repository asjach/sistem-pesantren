import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import SpinBox from '@/components/SpinBox';
import LabeledStepper from '@/components/LabeledStepper';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_FONT_PX,
  DEFAULT_HEADER_FONT_PX,
  DEFAULT_HEADER_H,
  FONT_FAMILY_DEFAULT,
  FONT_OPTIONS,
  FONT_TABEL_DEFAULT,
  MAX_FONT_PX,
  MAX_HEADER_H,
  MAX_ROW_H,
  MIN_FONT_PX,
  MIN_HEADER_H,
  MIN_ROW_H,
  useGridPrefs,
} from '@/components/GridPrefs';
import { TINGGI_BARIS_BAWAAN } from '@/components/excel/tinggiBaris';
import { useTheme } from '@/theme';
import { RotateCcw } from '@/icons';

/** Pemilih jenis huruf (dipakai isi tabel & header tabel). */
function PilihFont({ id, value, onChange, title, ariaLabel }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  title: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} size="sm" title={title} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder="Bawaan" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Font sistem</SelectLabel>
          {FONT_OPTIONS.filter((f) => f.group === 'sistem').map((f) => (
            <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Font Aptos (bundel)</SelectLabel>
          {FONT_OPTIONS.filter((f) => f.group === 'aptos').map((f) => (
            <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Font Google (offline)</SelectLabel>
          {FONT_OPTIONS.filter((f) => f.group === 'google').map((f) => (
            <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Input warna kecil. */
function WarnaInput({ id, value, title, ariaLabel, onChange }: {
  id: string;
  value: string;
  title: string;
  ariaLabel: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      id={id}
      type="color"
      value={value}
      title={title}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 w-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
    />
  );
}

/** Baris alat: label tetap di kiri, kontrol mengisi sisanya. */
function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[64px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Tombol reset kecil (selalu tampil, nonaktif bila nilainya bukan manual). */
function TombolReset({ id, label, disabled, onClick }: {
  id: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      id={id}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="-ml-1 shrink-0 text-muted-foreground"
    >
      <RotateCcw size={13} />
    </Button>
  );
}

function Judul({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 border-t pt-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </div>
  );
}

/** Isi kontrol tampilan tabel GLOBAL — tinggi baris sel & header, jenis/ukuran
 *  huruf, serta warna huruf/latar untuk header maupun sel.
 *
 *  Yang di sini berlaku untuk SELURUH TABEL:
 *  - Tinggi HEADER baris & jenis/ukuran huruf & warna: pref perangkat
 *    (GridPrefs) dan bagian tema tabel_header / tabel_sel (theme.tsx).
 *  - Tinggi SEL baris: BAWAAN. Tiap tabel boleh punya tinggi sendiri lewat
 *    tombol tinggi baris di kakinya (pref `simpes_grid_<tableKey>_rowh_dasar`),
 *    dan nilai itu menang atas bawaan di sini.
 *
 *  Karena itu isi ini TIDAK diletakkan di dalam tabel. Dipakai bersama oleh
 *  panel Pengaturan Tampilan (Sheet di TopBar). `idPrefix` hanya untuk
 *  membedakan id bila ada lebih dari satu instans di halaman yang sama. */
export default function IsiPengaturanTampilan({ idPrefix = '' }: {
  idPrefix?: string;
}) {
  const { dark, parts, setGayaBagian, setWarnaBagian } = useTheme();
  const {
    rowH, headerH, fontPx, fontFamily, sumberRowH, sumberHeaderH,
    setRowH, setHeaderH, setFontPx, setFontFamily,
  } = useGridPrefs();

  const headerHManual = sumberHeaderH === 'perangkat';
  const rowHManual = sumberRowH === 'perangkat';
  /** Keterangan asal nilai: penting supaya pengguna tahu kenapa angkanya
   *  berubah sendiri saat super_admin menetapkan standar. */
  const asal = (sumber: string, manual: string, standar: string, otomatis: string) =>
    sumber === 'perangkat' ? manual : sumber === 'server' ? standar : otomatis;

  const mode = dark ? 'gelap' : 'terang';
  const gayaHeader = parts.gaya.tabel_header;
  const headerFont = gayaHeader?.font ?? FONT_TABEL_DEFAULT;
  const headerSize = gayaHeader?.size ?? DEFAULT_HEADER_FONT_PX;
  const headerSizeManual = gayaHeader?.size != null;
  const warnaCell = parts[mode]?.tabel_sel;
  const warnaHeader = parts[mode]?.tabel_header;
  const cellColor = warnaCell?.fg ?? '#9ca3af';
  const headerColor = warnaHeader?.fg ?? '#9ca3af';
  const cellBg = warnaCell?.bg ?? '#1e1e1e';
  const headerBg = warnaHeader?.bg ?? '#1e1e1e';
  const headerWarnaDiatur = !!(warnaHeader?.fg || warnaHeader?.bg);
  const cellWarnaDiatur = !!(warnaCell?.fg || warnaCell?.bg);
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  const p = idPrefix;

  /** Penanda asal nilai: hanya tampil saat standar server benar-benar dipakai,
   *  supaya pengguna paham angkanya bukan berasal dari setelannya sendiri. */
  const penandaStandar = (sumber: string) =>
    sumber === 'server' ? (
      <span
        className="rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted-foreground"
        id={p + 'penanda_standar'}
      >
        standar pesantren
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-2" data-part="isi_pengaturan_tampilan">
      <Judul>Baris tabel</Judul>

      <div className="flex items-center gap-1.5">
        <LabeledStepper
          id={p + 'set_tinggi_sel'}
          htmlFor={p + 'set_tinggi_sel'}

          kelolaLebar={false}
          label="Tinggi sel bawaan"
          min={MIN_ROW_H}
          max={MAX_ROW_H}
          value={rowH ?? TINGGI_BARIS_BAWAAN}
          title={asal(
            sumberRowH,
            'Bawaan tinggi baris sel (tabel yang punya tinggi sendiri tidak ikut)',
            'Bawaan tinggi baris sel (mengikuti standar pesantren)',
            'Bawaan tinggi baris sel (24px)',
          )}
          aria-label="Tinggi baris sel (px)"
          onChange={setRowH}
        />
        {penandaStandar(sumberRowH)}
        <TombolReset
          id={p + 'set_reset_tinggi_sel'}
          label="Kembalikan bawaan tinggi baris sel ke 24px"
          disabled={!rowHManual && sumberRowH !== 'server'}
          onClick={() => setRowH(null)}
        />
      </div>
      <Baris label="Tinggi header">
        <SpinBox
          id={p + 'set_tinggi_header'}
          value={headerH ?? DEFAULT_HEADER_H}
          min={MIN_HEADER_H}
          max={MAX_HEADER_H}
          title={asal(
            sumberHeaderH,
            'Tinggi baris header (diatur sendiri, berlaku semua tabel)',
            'Tinggi baris header (mengikuti standar pesantren)',
            'Tinggi baris header (otomatis mengikuti judul)',
          )}
          ariaLabel="Tinggi baris header (px)"
          onChange={setHeaderH}
        />
        {penandaStandar(sumberHeaderH)}
        <TombolReset
          id={p + 'set_reset_tinggi_header'}
          label="Kembalikan tinggi header ke bawaan"
          disabled={!headerHManual && sumberHeaderH !== 'server'}
          onClick={() => setHeaderH(null)}
        />
      </Baris>

      <Judul>Header tabel</Judul>
      <Baris label="Font">
        <PilihFont
          id={p + 'set_font_header'}
          value={headerFont}
          onChange={(v) => setGayaBagian('tabel_header', { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
          title="Jenis huruf header tabel (berlaku semua tabel)"
          ariaLabel="Jenis huruf header tabel"
        />
      </Baris>
      <Baris label="Ukuran">
        <SpinBox
          id={p + 'set_ukuran_header'}
          value={headerSize}
          min={MIN_FONT_PX}
          max={MAX_FONT_PX}
          title="Ukuran huruf header tabel (berlaku semua tabel)"
          ariaLabel="Ukuran huruf header tabel (px)"
          onChange={(n) => setGayaBagian('tabel_header', { size: n })}
        />
        <TombolReset
          id={p + 'set_reset_ukuran_header'}
          label="Kembalikan ukuran huruf header ke bawaan"
          disabled={!headerSizeManual}
          onClick={() => setGayaBagian('tabel_header', { size: undefined })}
        />
      </Baris>
      <Baris label="Warna">
        <WarnaInput
          id={p + 'set_warna_header'}
          value={headerColor}
          title="Warna huruf header tabel (mode aktif)"
          ariaLabel="Warna huruf header tabel"
          onChange={(v) => setWarnaBagian(mode, 'tabel_header', { fg: v })}
        />
        <WarnaInput
          id={p + 'set_warna_bg_header'}
          value={headerBg}
          title="Warna latar header tabel (mode aktif)"
          ariaLabel="Warna latar header tabel"
          onChange={(v) => setWarnaBagian(mode, 'tabel_header', { bg: v })}
        />
        <TombolReset
          id={p + 'set_reset_warna_header'}
          label="Kembalikan warna header ke bawaan"
          disabled={!headerWarnaDiatur}
          onClick={() => setWarnaBagian(mode, 'tabel_header', { fg: undefined, bg: undefined })}
        />
      </Baris>

      <Judul>Sel tabel</Judul>
      <Baris label="Font">
        <PilihFont
          id={p + 'set_font_sel'}
          value={fontFamily}
          onChange={setFontFamily}
          title="Jenis huruf sel tabel (berlaku semua tabel)"
          ariaLabel="Jenis huruf sel tabel"
        />
      </Baris>
      <Baris label="Ukuran">
        <SpinBox
          id={p + 'set_ukuran_sel'}
          value={effectiveFont}
          min={MIN_FONT_PX}
          max={MAX_FONT_PX}
          title="Ukuran huruf sel tabel (berlaku semua tabel)"
          ariaLabel="Ukuran huruf sel tabel (px)"
          onChange={setFontPx}
        />
        <TombolReset
          id={p + 'set_reset_ukuran_sel'}
          label="Kembalikan ukuran huruf sel ke bawaan"
          disabled={fontPx == null}
          onClick={() => setFontPx(null)}
        />
      </Baris>
      <Baris label="Warna">
        <WarnaInput
          id={p + 'set_warna_sel'}
          value={cellColor}
          title="Warna huruf sel tabel (mode aktif)"
          ariaLabel="Warna huruf sel tabel"
          onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { fg: v })}
        />
        <WarnaInput
          id={p + 'set_warna_bg_sel'}
          value={cellBg}
          title="Warna latar sel tabel (mode aktif)"
          ariaLabel="Warna latar sel tabel"
          onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { bg: v })}
        />
        <TombolReset
          id={p + 'set_reset_warna_sel'}
          label="Kembalikan warna sel ke bawaan"
          disabled={!cellWarnaDiatur}
          onClick={() => setWarnaBagian(mode, 'tabel_sel', { fg: undefined, bg: undefined })}
        />
      </Baris>
    </div>
  );
}
