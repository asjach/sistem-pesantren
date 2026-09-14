import { DENSITY_PX } from '@/prefs';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_PX,
  FONT_FAMILY_DEFAULT,
  FONT_OPTIONS,
  MAX_FONT_PX,
  MAX_ROW_H,
  MIN_FONT_PX,
  MIN_ROW_H,
  useGridPrefs,
} from '@/components/GridPrefs';
import type { RibbonTableApi } from '@/components/RibbonTable';
import { Copy, MoveHorizontal, MoveVertical, Pencil, PlusCircle, RotateCcw } from '@/icons';
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

export function RibbonTabel({ apiTabel }: { apiTabel: RibbonTableApi | null }) {
  const { density, dark, parts, setGayaBagian, setWarnaBagian } = useTheme();
  const { rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily } = useGridPrefs();
  const effectiveH = rowH ?? DENSITY_PX[density];
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;

  // Pengaturan header tabel — tersimpan sebagai bagian UI `tabel_header`
  // sehingga tersinkron dua arah dengan halaman Pengaturan > Bagian UI.
  const mode = dark ? 'gelap' : 'terang';
  const gayaHeader = parts.gaya.tabel_header;
  const warnaHeader = parts[mode]?.tabel_header;
  const headerFont = gayaHeader?.font ?? FONT_FAMILY_DEFAULT;
  const headerSize = gayaHeader?.size ?? effectiveFont;
  const headerColor = warnaHeader?.fg ?? '#9ca3af';

  return (
    <>
      <RibbonGroup label="Mode">
        <RibbonCmd
          id="ribbon_btn_edit"
          icon={Pencil}
          label="Edit Sel"
          aktif={!!apiTabel?.editing}
          disabled={!apiTabel?.canEdit}
          onClick={() => apiTabel?.setEditMode(!apiTabel.editMode)}
        />
        <RibbonCmd
          id="ribbon_btn_input"
          icon={PlusCircle}
          label="Input Baris"
          aktif={!!apiTabel?.showInput}
          disabled={!apiTabel?.inputEnabled}
          onClick={() => apiTabel?.setInputMode(!apiTabel.inputMode)}
        />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Tabel">
        <RibbonCmd
          id="ribbon_btn_salin"
          icon={Copy}
          label="Salin TSV"
          iconOnly
          disabled={!apiTabel}
          onClick={() => apiTabel?.salin()}
        />
        <RibbonCmd
          id="ribbon_btn_autofit"
          icon={MoveHorizontal}
          label="Sesuaikan Lebar"
          iconOnly
          disabled={!apiTabel}
          onClick={() => apiTabel?.autofit()}
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
      <RibbonGroup label="Ukuran">
        <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5">
          <span
            className="flex justify-end text-white/70"
            title="Tinggi baris (berlaku semua tabel)"
            aria-label="Tinggi baris (px)"
          >
            <MoveVertical size={14} />
          </span>
          <SpinBox
            id="input_tinggi_top"
            value={effectiveH}
            min={MIN_ROW_H}
            max={MAX_ROW_H}
            title="Tinggi baris (berlaku semua tabel)"
            ariaLabel="Tinggi baris (px)"
            onChange={setRowH}
          />
          <span className="text-right text-[11px] text-white/70">Ukuran huruf</span>
          <SpinBox
            id="input_huruf_top"
            value={effectiveFont}
            min={MIN_FONT_PX}
            max={MAX_FONT_PX}
            title="Ukuran huruf (berlaku semua tabel)"
            ariaLabel="Ukuran huruf (px)"
            onChange={setFontPx}
          />
        </div>
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Huruf Isi">
        <PilihFont
          id="select_huruf_top"
          value={fontFamily}
          onChange={setFontFamily}
          title="Jenis huruf isi tabel (berlaku semua tabel)"
          ariaLabel="Jenis huruf isi tabel"
        />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Header Tabel">
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
          onChange={(n) => setGayaBagian('tabel_header', { size: n })}
        />
        <input
          id="input_warna_header_top"
          type="color"
          value={headerColor}
          title="Warna huruf header tabel (mode aktif)"
          aria-label="Warna huruf header tabel"
          onChange={(e) => setWarnaBagian(mode, 'tabel_header', { fg: e.target.value })}
          className="h-6 w-8 shrink-0 cursor-pointer rounded-md border border-white/20 bg-white/5 p-0.5"
        />
        {warnaHeader?.fg ? (
          <RibbonCmd
            id="btn_reset_warna_header_top"
            icon={RotateCcw}
            label="Kembalikan warna header ke bawaan"
            iconOnly
            onClick={() => setWarnaBagian(mode, 'tabel_header', { fg: undefined })}
          />
        ) : null}
      </RibbonGroup>
    </>
  );
}
