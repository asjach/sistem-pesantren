import { DENSITY_PX, type DensityName } from '@/prefs';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_PX,
  DEFAULT_HEADER_H,
  FONT_FAMILY_DEFAULT,
  FONT_OPTIONS,
  MAX_FONT_PX,
  MAX_HEADER_H,
  MAX_ROW_H,
  MIN_FONT_PX,
  MIN_HEADER_H,
  MIN_ROW_H,
  useGridPrefs,
} from '@/components/GridPrefs';
import type { RibbonTableApi } from '@/components/RibbonTable';
import { Copy, MoveHorizontal, Pencil, PlusCircle, RotateCcw } from '@/icons';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RibbonCmd, RibbonGroup, RibbonPemisah, SpinBox } from './primitives';

/** Pemilih jenis huruf bergaya ribbon (dipakai isi tabel & header tabel). */
function PilihFont({
  id,
  value,
  onChange,
  title,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  title: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        title={title}
        aria-label={ariaLabel}
        className="h-6 w-44 border-white/20 bg-white/5 text-white [&_svg]:text-white/70"
      >
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

/** Input warna kecil bergaya ribbon. */
function WarnaInput({
  id,
  value,
  title,
  ariaLabel,
  onChange,
}: {
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
      className="h-6 w-8 shrink-0 cursor-pointer rounded-md border border-white/20 bg-white/5 p-0.5"
    />
  );
}

const KERAPATAN: { id: DensityName; nama: string }[] = [
  { id: 'ramping', nama: 'Ramping' },
  { id: 'sedang', nama: 'Sedang' },
  { id: 'nyaman', nama: 'Nyaman' },
];

export function RibbonTabel({ apiTabel }: { apiTabel: RibbonTableApi | null }) {
  const { density, dark, parts, setGayaBagian, setWarnaBagian, setDensity } = useTheme();
  const { rowH, headerH, fontPx, fontFamily, setRowH, setHeaderH, setFontPx, setFontFamily } = useGridPrefs();
  const effectiveH = rowH ?? DENSITY_PX[density];
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;
  /** Tinggi header efektif: nilai riil tabel aktif (auto/manual) agar spinner
   *  tidak menampilkan angka yang berbeda dari yang dirender. */
  const effectiveHeaderH = apiTabel?.headerHeight ?? headerH ?? DEFAULT_HEADER_H;
  const headerHManual = headerH != null;

  // Pengaturan header & sel tabel — tersimpan sebagai bagian UI `tabel_header`
  // dan `tabel_sel` sehingga tersinkron dua arah dengan halaman Tampilan.
  const mode = dark ? 'gelap' : 'terang';
  const gayaHeader = parts.gaya.tabel_header;
  const warnaCell = parts[mode]?.tabel_sel;
  const warnaHeader = parts[mode]?.tabel_header;
  const headerFont = gayaHeader?.font ?? FONT_FAMILY_DEFAULT;
  const headerSize = gayaHeader?.size ?? effectiveFont;
  const cellColor = warnaCell?.fg ?? '#9ca3af';
  const headerColor = warnaHeader?.fg ?? '#9ca3af';
  const cellBg = warnaCell?.bg ?? '#1e1e1e';
  const headerBg = warnaHeader?.bg ?? '#1e1e1e';
  const headerWarnaDiatur = !!(warnaHeader?.fg || warnaHeader?.bg);
  const cellWarnaDiatur = !!(warnaCell?.fg || warnaCell?.bg);

  return (
    <>
      <RibbonGroup label="Tabel">
        <RibbonCmd
          id="ribbon_btn_input"
          icon={PlusCircle}
          label="Input Baris"
          aktif={!!apiTabel?.showInput}
          disabled={!apiTabel?.inputEnabled}
          onClick={() => apiTabel?.setInputMode(!apiTabel.inputMode)}
        />
        <RibbonCmd
          id="ribbon_btn_edit"
          icon={Pencil}
          label="Edit Sel"
          aktif={!!apiTabel?.editing}
          disabled={!apiTabel?.canEdit}
          onClick={() => apiTabel?.setEditMode(!apiTabel.editMode)}
        />
        <RibbonCmd
          id="ribbon_btn_salin"
          icon={Copy}
          label="Salin TSV"
          iconOnly
          disabled={!apiTabel}
          onClick={() => apiTabel?.salin()}
        />
        <RibbonCmd
          id="ribbon_btn_reset"
          icon={RotateCcw}
          label="Reset Tampilan"
          iconOnly
          disabled={!apiTabel}
          onClick={() => apiTabel?.reset()}
        />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Kolom">
        <RibbonCmd
          id="ribbon_btn_autofit"
          icon={MoveHorizontal}
          label="Sesuaikan Lebar"
          iconOnly
          disabled={!apiTabel}
          onClick={() => apiTabel?.autofit()}
        />
        <SpinBox
          id="input_bekukan_kolom_top"
          value={apiTabel?.freeze ?? 0}
          min={0}
          max={apiTabel?.freezeMax ?? 0}
          title="Bekukan N kolom pertama di kiri (termasuk kolom centang)"
          ariaLabel="Jumlah kolom beku"
          onChange={(v) => apiTabel?.setFreeze(v)}
        />
        {(apiTabel?.freeze ?? 0) > 0 ? (
          <RibbonCmd
            id="btn_lepas_bekukan_kolom_top"
            icon={RotateCcw}
            label="Lepas semua kolom beku"
            iconOnly
            onClick={() => apiTabel?.setFreeze(0)}
          />
        ) : null}
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Baris">
        <div className="flex flex-col items-center gap-1">
          <ToggleGroup
            type="single"
            spacing={0}
            value={density}
            onValueChange={(v) => {
              if (!v) return;
              setDensity(v as DensityName);
              // Kosongkan tinggi baris manual agar preset kerapatan berlaku.
              setRowH(null);
            }}
          >
            {KERAPATAN.map((k) => (
              <ToggleGroupItem
                key={k.id}
                id={`btn_kerapatan_${k.id}`}
                value={k.id}
                title={`Kerapatan ${k.nama}`}
                aria-label={`Kerapatan ${k.nama}`}
                className="h-6 rounded-md border-0 px-2 text-[11px] text-white/75 hover:bg-white/10 hover:text-white data-[state=on]:bg-white/20 data-[state=on]:font-semibold data-[state=on]:text-white"
              >
                {k.nama}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-1.5">
            <SpinBox
              id="input_tinggi_top"
              value={effectiveH}
              min={MIN_ROW_H}
              max={MAX_ROW_H}
              title="Tinggi baris (berlaku semua tabel)"
              ariaLabel="Tinggi baris (px)"
              onChange={setRowH}
            />
          </div>
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Header">
        <div className="flex flex-col items-center gap-1">
          <PilihFont
            id="select_huruf_header_top"
            value={headerFont}
            onChange={(v) => setGayaBagian('tabel_header', { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
            title="Jenis huruf header tabel"
            ariaLabel="Jenis huruf header tabel"
          />
          <div className="flex items-center gap-1.5">
            <SpinBox
              id="input_ukuran_header_top"
              value={headerSize}
              min={MIN_FONT_PX}
              max={MAX_FONT_PX}
              title="Ukuran huruf header tabel"
              ariaLabel="Ukuran huruf header tabel (px)"
              onChange={(n) => setGayaBagian('tabel_header', { size: n })}
            />
            <WarnaInput
              id="input_warna_header_top"
              value={headerColor}
              title="Warna huruf header tabel (mode aktif)"
              ariaLabel="Warna huruf header tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_header', { fg: v })}
            />
            <SpinBox
              id="input_tinggi_header_top"
              value={effectiveHeaderH}
              min={MIN_HEADER_H}
              max={MAX_HEADER_H}
              title={headerHManual
                ? 'Tinggi baris header (manual, berlaku semua tabel)'
                : 'Tinggi baris header (otomatis mengikuti judul)'}
              ariaLabel="Tinggi baris header (px)"
              onChange={setHeaderH}
            />
            {headerHManual ? (
              <RibbonCmd
                id="btn_reset_tinggi_header_top"
                icon={RotateCcw}
                label="Kembalikan tinggi header ke otomatis"
                iconOnly
                onClick={() => setHeaderH(null)}
              />
            ) : null}
            <WarnaInput
              id="input_warna_bg_header_top"
              value={headerBg}
              title="Warna latar header tabel (mode aktif)"
              ariaLabel="Warna latar header tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_header', { bg: v })}
            />
            {headerWarnaDiatur ? (
              <RibbonCmd
                id="btn_reset_warna_header_top"
                icon={RotateCcw}
                label="Kembalikan warna header ke bawaan"
                iconOnly
                onClick={() => setWarnaBagian(mode, 'tabel_header', { fg: undefined, bg: undefined })}
              />
            ) : null}
          </div>
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Cell">
        <div className="flex flex-col items-center gap-1">
          <PilihFont
            id="select_huruf_top"
            value={fontFamily}
            onChange={setFontFamily}
            title="Jenis huruf sel tabel (berlaku semua tabel)"
            ariaLabel="Jenis huruf sel tabel"
          />
          <div className="flex items-center gap-1.5">
            <SpinBox
              id="input_huruf_top"
              value={effectiveFont}
              min={MIN_FONT_PX}
              max={MAX_FONT_PX}
              title="Ukuran huruf sel tabel (berlaku semua tabel)"
              ariaLabel="Ukuran huruf sel tabel (px)"
              onChange={setFontPx}
            />
            <WarnaInput
              id="input_warna_cell_top"
              value={cellColor}
              title="Warna huruf sel tabel (mode aktif)"
              ariaLabel="Warna huruf sel tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { fg: v })}
            />
            <WarnaInput
              id="input_warna_bg_cell_top"
              value={cellBg}
              title="Warna latar sel tabel (mode aktif)"
              ariaLabel="Warna latar sel tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { bg: v })}
            />
            {cellWarnaDiatur ? (
              <RibbonCmd
                id="btn_reset_warna_cell_top"
                icon={RotateCcw}
                label="Kembalikan warna sel ke bawaan"
                iconOnly
                onClick={() => setWarnaBagian(mode, 'tabel_sel', { fg: undefined, bg: undefined })}
              />
            ) : null}
          </div>
        </div>
      </RibbonGroup>
    </>
  );
}
