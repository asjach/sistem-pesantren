import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTauri } from '../api/client';
import { useTheme, type DensityName, type ModeName, type WarnaUIName } from '@/theme';
import { normalizeHex, DEFAULT_PREFS } from '@/prefs';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS, fontParts, type FontOption } from '@/fonts';
import { FieldDescription, FieldSet } from '@/components/ui/field';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Monitor, Moon, Paintbrush, Sun } from '@/icons';

const MODES: { id: ModeName; nama: string; icon: typeof Sun }[] = [
  { id: 'terang', nama: 'Terang', icon: Sun },
  { id: 'gelap', nama: 'Gelap', icon: Moon },
  { id: 'sistem', nama: 'Sistem', icon: Monitor },
];

const DENSITIES: { id: DensityName; nama: string }[] = [
  { id: 'ramping', nama: 'Ramping' },
  { id: 'sedang', nama: 'Sedang' },
  { id: 'nyaman', nama: 'Nyaman' },
];

const WARNA_UI_OPSI: { id: WarnaUIName; nama: string }[] = [
  { id: 'netral', nama: 'Netral' },
  { id: 'aksen', nama: 'Aksen' },
  { id: 'kaya', nama: 'Kaya' },
];

/** Opsi font antarmuka: varian Bold dikecualikan (seluruh UI jadi tebal). */
const FONT_UI: FontOption[] = FONT_OPTIONS.filter((f) => !f.value.endsWith('|700'));
const FONT_UI_GROUPS: { id: string; label: string; items: FontOption[] }[] = [
  { id: 'sistem', label: 'Sistem & bawaan', items: FONT_UI.filter((f) => f.group === 'sistem') },
  { id: 'aptos', label: 'Aptos (bundel offline)', items: FONT_UI.filter((f) => f.group === 'aptos') },
  { id: 'google', label: 'Google Fonts (bundel offline)', items: FONT_UI.filter((f) => f.group === 'google') },
];

/** Pengaturan → Tampilan: tema, mode, kerapatan baris. */
export default function PengaturanTampilanPage() {
  const { theme, mode, customHex, density, fontUI, warnaUI, setMode, setCustomHex, setDensity, setFontUI, setWarnaUI } = useTheme();
  const [customInput, setCustomInput] = useState(customHex);
  const navigate = useNavigate();
  const fontUIParts = fontUI === FONT_FAMILY_DEFAULT ? null : fontParts(fontUI);

  useEffect(() => {
    setCustomInput(customHex);
  }, [customHex]);

  function onCustomColor(v: string) {
    setCustomInput(v);
    if (normalizeHex(v)) setCustomHex(v);
  }

  return (
    <div className="flex flex-col gap-6">
      <p id="info_pengaturan" className="text-sm text-muted-foreground">
        Tema aktif: <b className="text-foreground">{theme}</b> · Bawaan:{' '}
        <b className="text-foreground">{DEFAULT_PREFS.theme}</b> · Mode:{' '}
        <Badge variant="secondary">{isTauri() ? 'desktop' : 'web'}</Badge>
      </p>

      <section className="flex w-full max-w-none flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Tampilan</h2>
        <Accordion
          type="multiple"
          defaultValue={['tema', 'font', 'warna', 'mode', 'kerapatan', 'bagian']}
        >
          <AccordionItem value="tema">
            <AccordionTrigger>Tema warna</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <p className="text-sm text-muted-foreground">
                  Pilih tema dari ribbon: tab <b>Pengaturan → grup Tema</b> (Select tema +
                  tombol mode Terang/Gelap/Sistem).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="input_warna_kustom">Warna kustom</Label>
                  <input
                    id="input_warna_kustom"
                    type="color"
                    value={normalizeHex(customInput) ?? customHex}
                    onChange={(e) => onCustomColor(e.target.value)}
                    className="h-6 w-12 cursor-pointer rounded-md border bg-card p-1"
                  />
                  <Input
                    id="input_hex_kustom"
                    value={customInput}
                    onChange={(e) => onCustomColor(e.target.value)}
                    placeholder="#2c5c38"
                    maxLength={7}
                    className="w-28 font-mono"
                  />
                  {theme === 'kustom' && <Badge>Kustom aktif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Kontras teks di atas aksen dijaga otomatis (≥4.5:1).
                </p>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="font">
            <AccordionTrigger>Font antarmuka</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={fontUI} onValueChange={setFontUI}>
                    <SelectTrigger id="select_font_ui" title="Font antarmuka" aria-label="Font antarmuka" className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {FONT_UI_GROUPS.map((g) => (
                        <SelectGroup key={g.id}>
                          <SelectLabel>{g.label}</SelectLabel>
                          {g.items.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <span
                    id="pratinjau_font_ui"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    style={fontUIParts
                      ? { fontFamily: fontUIParts.family, fontWeight: Number(fontUIParts.weight) || 400 }
                      : undefined}
                  >
                    Pratinjau: Data Santri 12.345 — SIMPES Admin
                  </span>
                </div>
                <FieldDescription>
                  Berlaku untuk seluruh antarmuka (menu, judul, tombol). Font isi tabel diatur
                  terpisah dari toolbar tabel.
                </FieldDescription>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="warna">
            <AccordionTrigger>Kaya warna UI</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={warnaUI}
                  onValueChange={(v) => { if (v) setWarnaUI(v as WarnaUIName); }}
                >
                  {WARNA_UI_OPSI.map((w) => (
                    <ToggleGroupItem key={w.id} id={`btn_warna_${w.id}`} value={w.id}>
                      {w.nama}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>
                  <b>Netral</b>: hemat warna. <b>Aksen</b>: judul & ikon memakai warna aksen tema.{' '}
                  <b>Kaya</b>: + tint header/baris tabel & warna semantik (sukses/info). Berlaku
                  untuk semua tema; ikon hapus/peringatan & header bersidebar tidak ikut berubah.
                </FieldDescription>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mode">
            <AccordionTrigger>Mode</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={mode}
                  onValueChange={(v) => { if (v) setMode(v as ModeName); }}
                >
                  {MODES.map((m) => (
                    <ToggleGroupItem key={m.id} id={`btn_mode_${m.id}`} value={m.id}>
                      <m.icon />
                      {m.nama}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="kerapatan">
            <AccordionTrigger>Kerapatan baris tabel</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={density}
                  onValueChange={(v) => { if (v) setDensity(v as DensityName); }}
                >
                  {DENSITIES.map((d) => (
                    <ToggleGroupItem key={d.id} id={`btn_density_${d.id}`} value={d.id}>
                      {d.nama}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>
                  Berlaku untuk semua tabel. Tinggi tiap baris juga bisa diseret langsung di grid.
                </FieldDescription>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bagian">
            <AccordionTrigger>Per bagian (atomic)</AccordionTrigger>
            <AccordionContent>
              <FieldSet className="gap-3">
                <Button
                  id="btn_buka_pengaturan_bagian"
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => navigate('/pengaturan/bagian')}
                >
                  <Paintbrush size={14} /> Buka pengaturan per bagian
                </Button>
                <FieldDescription>
                  Font, warna, border, radius, dan padding untuk bagian UI — dipisah
                  mode terang/gelap. Halaman ini juga bisa dibuka dari ribbon:{' '}
                  <b>Pengaturan → grup Pengaturan → Bagian UI</b>.
                </FieldDescription>
              </FieldSet>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}
