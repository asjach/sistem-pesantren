import { DENSITY_PX } from '@/prefs';
import { useTheme } from '@/theme';
import {
  DEFAULT_FONT_PX,
  FONT_OPTIONS,
  MAX_FONT_PX,
  MAX_ROW_H,
  MIN_FONT_PX,
  MIN_ROW_H,
  useGridPrefs,
} from '@/components/GridPrefs';
import type { RibbonTableApi } from '@/components/RibbonTable';
import { Copy, MoveHorizontal, RotateCcw } from '@/icons';
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

export function RibbonTabel({ apiTabel }: { apiTabel: RibbonTableApi | null }) {
  const { density } = useTheme();
  const { rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily } = useGridPrefs();
  const effectiveH = rowH ?? DENSITY_PX[density];
  const effectiveFont = fontPx ?? DEFAULT_FONT_PX;

  return (
    <>
      <RibbonGroup label="Papan Klip">
        <RibbonCmd
          id="ribbon_btn_salin"
          icon={Copy}
          label="Salin TSV"
          disabled={!apiTabel}
          onClick={() => apiTabel?.salin()}
        />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Kolom">
        <RibbonCmd
          id="ribbon_btn_autofit"
          icon={MoveHorizontal}
          label="Sesuaikan Lebar"
          disabled={!apiTabel}
          onClick={() => apiTabel?.autofit()}
        />
        <RibbonCmd
          id="ribbon_btn_reset"
          icon={RotateCcw}
          label="Reset Tampilan"
          disabled={!apiTabel}
          onClick={() => apiTabel?.reset()}
        />
      </RibbonGroup>
      <RibbonPemisah />
      <RibbonGroup label="Ukuran">
        <div className="grid grid-cols-[auto_auto] items-center gap-x-2 gap-y-1.5">
          <span className="text-right text-[11px] text-white/70">Tinggi baris</span>
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
      <RibbonGroup label="Jenis Huruf">
        <Select value={fontFamily} onValueChange={setFontFamily}>
          <SelectTrigger
            id="select_huruf_top"
            title="Jenis huruf isi tabel (berlaku semua tabel)"
            aria-label="Jenis huruf isi tabel"
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
      </RibbonGroup>
    </>
  );
}
