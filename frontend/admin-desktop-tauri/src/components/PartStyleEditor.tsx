import { useEffect, useState } from 'react';
import { useTheme } from '@/theme';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS, type FontOption } from '@/fonts';
import { PARTS, PART_GROUPS, RENTANG, type PartId, type PartMode } from '@/parts';
import { normalizeHex } from '@/prefs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
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
import { Moon, RotateCcw, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const FONT_GROUPS: { id: string; label: string; items: FontOption[] }[] = [
  { id: 'sistem', label: 'Sistem & bawaan', items: FONT_OPTIONS.filter((f) => f.group === 'sistem') },
  { id: 'aptos', label: 'Aptos (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'aptos') },
  { id: 'google', label: 'Google Fonts (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'google') },
];

/** Kontrol warna opsional: picker + hex + tombol kembali ke bawaan. */
function WarnaField({
  id,
  label,
  nilai,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(nilai ?? '');
  useEffect(() => setDraft(nilai ?? ''), [nilai]);
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={`${id}_picker`} className="w-20 shrink-0">{label}</Label>
      <input
        id={`${id}_picker`}
        type="color"
        value={nilai ?? '#808080'}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="h-[30px] w-10 cursor-pointer rounded-md border bg-card p-1"
      />
      <Input
        id={`${id}_hex`}
        value={draft}
        placeholder="bawaan"
        maxLength={7}
        className="w-24 font-mono"
        onChange={(e) => {
          setDraft(e.target.value);
          const n = normalizeHex(e.target.value);
          if (n) onChange(n);
        }}
      />
      <Button
        id={`${id}_reset`}
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Kembalikan ke bawaan"
        disabled={nilai == null}
        onClick={() => onChange(undefined)}
      >
        <RotateCcw size={14} />
      </Button>
    </div>
  );
}

/** Kontrol angka opsional (px); dikomit saat blur/Enter. */
function AngkaField({
  id,
  label,
  nilai,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="w-20 shrink-0">{label}</Label>
      <Input
        key={`${id}:${nilai ?? ''}`}
        id={id}
        type="number"
        min={min}
        max={max}
        defaultValue={nilai ?? ''}
        placeholder="bawaan"
        className="w-24"
        onBlur={(e) => {
          const v = e.target.value.trim();
          onChange(v === '' ? undefined : Number(v));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="text-xs text-muted-foreground">px</span>
    </div>
  );
}

/** Editor gaya atomik per bagian UI (terpisah mode terang/gelap). */
export default function PartStyleEditor() {
  const { parts, setPart, resetPart, resetParts } = useTheme();
  const [mode, setMode] = useState<PartMode>('terang');
  const [aktif, setAktif] = useState<PartId>('ribbon');
  const meta = PARTS.find((p) => p.id === aktif) ?? PARTS[0];
  const s = parts[mode][aktif] ?? {};
  const angka = (k: keyof typeof RENTANG) =>
    (v: number | undefined) => setPart(mode, aktif, { [k]: v });

  return (
    <section className="flex w-full max-w-none flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Per bagian (atomic)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={mode}
            onValueChange={(v) => { if (v) setMode(v as PartMode); }}
          >
            <ToggleGroupItem id="btn_bagian_terang" value="terang">
              <Sun size={14} /> Terang
            </ToggleGroupItem>
            <ToggleGroupItem id="btn_bagian_gelap" value="gelap">
              <Moon size={14} /> Gelap
            </ToggleGroupItem>
          </ToggleGroup>
          <Button id="btn_reset_semua_bagian" type="button" variant="outline" size="sm" onClick={resetParts}>
            <RotateCcw size={14} /> Reset semua
          </Button>
        </div>
      </div>
      <FieldDescription>
        Atur font, warna, border, radius, dan padding untuk tiap bagian UI. Field
        kosong = ikut tema/komponen (bawaan). Pengaturan dipisah untuk mode terang
        dan gelap, dan langsung terlihat di antarmuka.
      </FieldDescription>
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto rounded-md border p-2">
          {PART_GROUPS.map((g) => (
            <div key={g}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g}
              </div>
              <div className="flex flex-col gap-0.5">
                {PARTS.filter((p) => p.grup === g).map((p) => {
                  const diatur = !!parts[mode][p.id];
                  return (
                    <button
                      key={p.id}
                      id={`btn_bagian_${p.id}`}
                      type="button"
                      title={p.hint}
                      onClick={() => setAktif(p.id)}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors',
                        p.id === aktif ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
                      )}
                    >
                      <span className="flex-1 truncate">{p.label}</span>
                      {diatur && <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Ada pengaturan" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{meta.label}</div>
              <div className="text-xs text-muted-foreground">{meta.hint}</div>
            </div>
            <Button
              id={`btn_reset_bagian_${meta.id}`}
              type="button"
              variant="outline"
              size="sm"
              disabled={!parts[mode][meta.id]}
              onClick={() => resetPart(mode, meta.id)}
            >
              <RotateCcw size={14} /> Reset bagian
            </Button>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="select_font_bagian" className="w-20 shrink-0">Font</Label>
              <Select
                value={s.font ?? FONT_FAMILY_DEFAULT}
                onValueChange={(v) => setPart(mode, aktif, { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
              >
                <SelectTrigger id="select_font_bagian" title="Font bagian" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {FONT_GROUPS.map((g) => (
                    <SelectGroup key={g.id}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.items.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AngkaField
              id="input_size_bagian"
              label="Ukuran font"
              nilai={s.size}
              min={RENTANG.size[0]}
              max={RENTANG.size[1]}
              onChange={angka('size')}
            />
          </div>
          <div className="grid gap-2">
            <WarnaField id="warna_bg_bagian" label="Latar" nilai={s.bg} onChange={(v) => setPart(mode, aktif, { bg: v })} />
            <WarnaField id="warna_fg_bagian" label="Teks" nilai={s.fg} onChange={(v) => setPart(mode, aktif, { fg: v })} />
            <WarnaField id="warna_border_bagian" label="Border" nilai={s.border} onChange={(v) => setPart(mode, aktif, { border: v })} />
          </div>
          <div className="grid gap-2">
            <AngkaField
              id="input_borderw_bagian"
              label="Tebal border"
              nilai={s.borderW}
              min={RENTANG.borderW[0]}
              max={RENTANG.borderW[1]}
              onChange={angka('borderW')}
            />
            <AngkaField
              id="input_radius_bagian"
              label="Radius"
              nilai={s.radius}
              min={RENTANG.radius[0]}
              max={RENTANG.radius[1]}
              onChange={angka('radius')}
            />
            <AngkaField
              id="input_padx_bagian"
              label="Padding X"
              nilai={s.padX}
              min={RENTANG.padX[0]}
              max={RENTANG.padX[1]}
              onChange={angka('padX')}
            />
            <AngkaField
              id="input_pady_bagian"
              label="Padding Y"
              nilai={s.padY}
              min={RENTANG.padY[0]}
              max={RENTANG.padY[1]}
              onChange={angka('padY')}
            />
          </div>
        </div>
      </div>
      <FieldSet className="gap-0">
        <FieldLegend variant="label" className="mb-0">Catatan</FieldLegend>
        <FieldDescription>
          Bagian bertingkat mengikuti yang paling spesifik: mis. gaya Tab ribbon
          tidak tertimpa gaya Bilah ribbon. Padding Y dan radius pada bagian tabel
          mengikuti geometri grid (tidak berpengaruh).
        </FieldDescription>
      </FieldSet>
    </section>
  );
}
