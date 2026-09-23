import { DENSITY_PX, type DensityName } from '@/prefs';
import { useTheme } from '@/theme';
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
import type { RibbonTableApi } from '@/components/RibbonTable';
import { DensityLarge, DensityMedium, DensitySmall, Pencil, PlusCircle, RotateCcw, type Ikon } from '@/icons';
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

/** Item kerapatan (ikon saja — label jadi tooltip). Tinggi seragam `h-6`,
 *  sejajar dengan tiap baris stepper vertikal. Rapat = banyak baris. */
const KERAPATAN: { id: DensityName; nama: string; icon: Ikon }[] = [
  { id: 'ramping', nama: 'Ramping', icon: DensitySmall },
  { id: 'sedang', nama: 'Sedang', icon: DensityMedium },
  { id: 'nyaman', nama: 'Nyaman', icon: DensityLarge },
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
  const headerFont = gayaHeader?.font ?? FONT_TABEL_DEFAULT;
  // Ukuran huruf header MANDIRI dari ukuran isi sel (stepper grup Header).
  const headerSize = gayaHeader?.size ?? DEFAULT_HEADER_FONT_PX;
  const headerSizeManual = gayaHeader?.size != null;
  const cellColor = warnaCell?.fg ?? '#9ca3af';
  const headerColor = warnaHeader?.fg ?? '#9ca3af';
  const cellBg = warnaCell?.bg ?? '#1e1e1e';
  const headerBg = warnaHeader?.bg ?? '#1e1e1e';
  const headerWarnaDiatur = !!(warnaHeader?.fg || warnaHeader?.bg);
  const cellWarnaDiatur = !!(warnaCell?.fg || warnaCell?.bg);

  return (
    <>
      <RibbonGroup>
        <div className="flex flex-col items-start gap-1">
          <RibbonCmd
            id="ribbon_btn_input"
            icon={PlusCircle}
            label="Mode Input"
            aktif={!!apiTabel?.showInput}
            disabled={!apiTabel?.inputEnabled}
            onClick={() => apiTabel?.setInputMode(!apiTabel.inputMode)}
          />
          <RibbonCmd
            id="ribbon_btn_edit"
            icon={Pencil}
            label="Mode Edit"
            aktif={!!apiTabel?.editing}
            disabled={!apiTabel?.canEdit}
            onClick={() => apiTabel?.setEditMode(!apiTabel.editMode)}
          />
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup>
        <div className="flex flex-col items-start gap-1.5">
          {/* Label di samping stepper; lebar label dikunci agar kedua stepper
              sejajar dalam satu kolom. */}
          <div className="flex items-center gap-1.5">
            <span
              id="label_bekukan_kolom_top"
              className="min-w-[86px] whitespace-nowrap text-xs text-white/80"
            >
              Freeze Kolom
            </span>
            <SpinBox
              id="input_bekukan_kolom_top"
              value={apiTabel?.freeze ?? 0}
              min={0}
              max={apiTabel?.freezeMax ?? 0}
              title="Bekukan N kolom pertama di kiri (termasuk kolom centang)"
              ariaLabel="Jumlah kolom beku"
              onChange={(v) => apiTabel?.setFreeze(v)}
            />
            {/* Selalu tampil; nonaktif bila tidak ada kolom beku (seragam dengan
                tombol reset lain di grup ini). */}
            <RibbonCmd
              id="btn_lepas_bekukan_kolom_top"
              icon={RotateCcw}
              label="Lepas semua kolom beku"
              iconOnly
              disabled={(apiTabel?.freeze ?? 0) === 0}
              onClick={() => apiTabel?.setFreeze(0)}
            />
          </div>
          {/* Tinggi baris header */}
          <div className="flex items-center gap-1.5">
            <span className="min-w-[86px] whitespace-nowrap text-xs text-white/80">Tinggi header</span>
            <SpinBox
              id="input_tinggi_header_top"
              value={effectiveHeaderH}
              min={MIN_HEADER_H}
              max={MAX_HEADER_H}
              title={headerHManual
                ? 'Tinggi baris header (manual, berlaku semua tabel)'
                : 'Tinggi baris header (otomatis mengikuti judul)'}
              ariaLabel="Tinggi baris header (px)"
              disabled={!apiTabel}
              onChange={setHeaderH}
            />
            <RibbonCmd
              id="btn_reset_tinggi_header_top"
              icon={RotateCcw}
              label="Kembalikan tinggi header ke otomatis"
              iconOnly
              disabled={!headerHManual}
              onClick={() => setHeaderH(null)}
            />
          </div>
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup disabled={!apiTabel}>
        <div className="flex items-start gap-1.5">
          <ToggleGroup
            type="single"
            orientation="vertical"
            spacing={0}
            value={density}
            onValueChange={(v) => {
              if (!v) return;
              setDensity(v as DensityName);
              // Kosongkan tinggi baris manual agar preset kerapatan berlaku.
              setRowH(null);
            }}
            className="flex-col items-stretch pt-px"
          >
            {KERAPATAN.map((k) => (
              <ToggleGroupItem
                key={k.id}
                id={`btn_kerapatan_${k.id}`}
                value={k.id}
                title={`Kerapatan ${k.nama}`}
                aria-label={`Kerapatan ${k.nama}`}
                className="h-6 w-8 rounded-md border-0 px-0 text-white/75 hover:bg-white/10 hover:text-white data-[state=on]:bg-white/20 data-[state=on]:text-white data-[spacing=0]:rounded-md data-[spacing=0]:first:rounded-md data-[spacing=0]:last:rounded-md"
              >
                <k.icon size={14} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <SpinBox
            id="input_tinggi_top"
            vertikal
            value={effectiveH}
            min={MIN_ROW_H}
            max={MAX_ROW_H}
            title="Tinggi baris (berlaku semua tabel)"
            ariaLabel="Tinggi baris (px)"
            disabled={!apiTabel}
            onChange={setRowH}
          />
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup disabled={!apiTabel}>
        {/* Kolom stepper & tombol reset dipisah agar judul "Font Size"
            center tepat di atas stepper-nya, bukan gabungan stepper+reset. */}
        <div className="grid grid-cols-[auto_11rem_auto_auto_auto_auto] items-center gap-x-3 gap-y-1">
          {/* Judul kolom */}
          <span aria-hidden />
          <span className="text-[10px] uppercase tracking-wide text-white/50">Font</span>
          <span className="text-center text-[10px] uppercase tracking-wide text-white/50">Font Size</span>
          <span aria-hidden />
          <span className="text-center text-[10px] uppercase tracking-wide text-white/50">Color</span>
          <span className="text-center text-[10px] uppercase tracking-wide text-white/50">Bg-Color</span>

          {/* Header */}
          <span className="pr-1 text-xs text-white/80">Header</span>
          <PilihFont
            id="select_huruf_header_top"
            value={headerFont}
            onChange={(v) => setGayaBagian('tabel_header', { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
            title="Jenis huruf header tabel"
            ariaLabel="Jenis huruf header tabel"
          />
          <SpinBox
            id="input_ukuran_header_top"
            value={headerSize}
            min={MIN_FONT_PX}
            max={MAX_FONT_PX}
            title="Ukuran huruf header tabel"
            ariaLabel="Ukuran huruf header tabel (px)"
            disabled={!apiTabel}
            onChange={(n) => setGayaBagian('tabel_header', { size: n })}
          />
          {/* Tombol reset selalu tampil; nonaktif bila bukan nilai manual.
              Margin kiri negatif merapatkan ke stepper (kolom terpisah). */}
          <span className="-ml-2 inline-flex">
            <RibbonCmd
              id="btn_reset_ukuran_header_top"
              icon={RotateCcw}
              label="Kembalikan ukuran huruf header ke bawaan"
              iconOnly
              disabled={!headerSizeManual}
              onClick={() => setGayaBagian('tabel_header', { size: undefined })}
            />
          </span>
          <WarnaInput
            id="input_warna_header_top"
            value={headerColor}
            title="Warna huruf header tabel (mode aktif)"
            ariaLabel="Warna huruf header tabel"
            onChange={(v) => setWarnaBagian(mode, 'tabel_header', { fg: v })}
          />
          <div className="flex items-center gap-1">
            <WarnaInput
              id="input_warna_bg_header_top"
              value={headerBg}
              title="Warna latar header tabel (mode aktif)"
              ariaLabel="Warna latar header tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_header', { bg: v })}
            />
            <RibbonCmd
              id="btn_reset_warna_header_top"
              icon={RotateCcw}
              label="Kembalikan warna header ke bawaan"
              iconOnly
              disabled={!headerWarnaDiatur}
              onClick={() => setWarnaBagian(mode, 'tabel_header', { fg: undefined, bg: undefined })}
            />
          </div>

          {/* Cell */}
          <span className="pr-1 text-xs text-white/80">Cell</span>
          <PilihFont
            id="select_huruf_top"
            value={fontFamily}
            onChange={setFontFamily}
            title="Jenis huruf sel tabel (berlaku semua tabel)"
            ariaLabel="Jenis huruf sel tabel"
          />
          <SpinBox
            id="input_huruf_top"
            value={effectiveFont}
            min={MIN_FONT_PX}
            max={MAX_FONT_PX}
            title="Ukuran huruf sel tabel (berlaku semua tabel)"
            ariaLabel="Ukuran huruf sel tabel (px)"
            disabled={!apiTabel}
            onChange={setFontPx}
          />
          {/* Tombol reset selalu tampil; nonaktif bila bukan nilai manual.
              Margin kiri negatif merapatkan ke stepper (kolom terpisah). */}
          <span className="-ml-2 inline-flex">
            <RibbonCmd
              id="btn_reset_ukuran_cell_top"
              icon={RotateCcw}
              label="Kembalikan ukuran huruf sel ke bawaan"
              iconOnly
              disabled={fontPx == null}
              onClick={() => setFontPx(null)}
            />
          </span>
          <WarnaInput
            id="input_warna_cell_top"
            value={cellColor}
            title="Warna huruf sel tabel (mode aktif)"
            ariaLabel="Warna huruf sel tabel"
            onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { fg: v })}
          />
          <div className="flex items-center gap-1">
            <WarnaInput
              id="input_warna_bg_cell_top"
              value={cellBg}
              title="Warna latar sel tabel (mode aktif)"
              ariaLabel="Warna latar sel tabel"
              onChange={(v) => setWarnaBagian(mode, 'tabel_sel', { bg: v })}
            />
            <RibbonCmd
              id="btn_reset_warna_cell_top"
              icon={RotateCcw}
              label="Kembalikan warna sel ke bawaan"
              iconOnly
              disabled={!cellWarnaDiatur}
              onClick={() => setWarnaBagian(mode, 'tabel_sel', { fg: undefined, bg: undefined })}
            />
          </div>
        </div>
      </RibbonGroup>
    </>
  );
}
