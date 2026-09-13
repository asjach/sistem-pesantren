import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTheme } from '@/theme';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS, type FontOption } from '@/fonts';
import {
  PARTS,
  PART_BY_ID,
  PART_GROUPS,
  RENTANG,
  type PartGaya,
  type PartId,
  type PartMode,
  type PartWarna,
} from '@/parts';
import { normalizeHex } from '@/prefs';
import { bangunCssPratinjau, variabelBagian, variabelWajah } from '@/partStyles';
import { contohBagian } from '@/components/PartContohBagian';
import { Badge } from '@/components/ui/badge';
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
import { ChevronDown, Minus, Moon, Plus, RotateCcw, Search, Sun } from '@/icons';
import { cn } from '@/lib/utils';

/** Objek kosong stabil (menghindari efek pengukuran berulang tanpa henti). */
const TANPA_GAYA: PartGaya = {};
const TANPA_WARNA: PartWarna = {};

const FONT_GROUPS: { id: string; label: string; items: FontOption[] }[] = [
  { id: 'sistem', label: 'Sistem & bawaan', items: FONT_OPTIONS.filter((f) => f.group === 'sistem') },
  { id: 'aptos', label: 'Aptos (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'aptos') },
  { id: 'google', label: 'Google Fonts (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'google') },
];

/** Nilai bawaan terukur dari pratinjau (ditampilkan saat field kosong). */
interface Bawaan {
  font?: string;
  size?: number;
  bg?: string;
  fg?: string;
  border?: string;
  borderW?: number;
  radius?: number;
  padX?: number;
  padY?: number;
}

function px(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
}

function hexDari(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Warna computed → hex; `undefined` bila transparan/tak dikenali. */
function warnaSolid(v: string): string | undefined {
  const s = v.trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'none') return undefined;
  const rgb = s.match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)$/);
  if (rgb) {
    if (rgb[4] != null && Number(rgb[4]) === 0) return undefined;
    return hexDari(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }
  const srgb = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (srgb) {
    if (srgb[4] != null && Number(srgb[4]) === 0) return undefined;
    return hexDari(Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255);
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return undefined;
}

/** Nama keluarga pertama dari daftar font computed (untuk label "Bawaan"). */
function keluargaUtama(font: string): string {
  return font.split(',')[0].replace(/["']/g, '').trim();
}

/** Kontrol warna opsional: picker + hex + tombol kembali ke bawaan. */
function WarnaField({
  id,
  label,
  nilai,
  bawaan,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: string;
  bawaan?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(nilai ?? '');
  useEffect(() => setDraft(nilai ?? ''), [nilai]);
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={`${id}_picker`} className="w-14 shrink-0">{label}</Label>
      <input
        id={`${id}_picker`}
        type="color"
        value={nilai ?? bawaan ?? '#808080'}
        onChange={(e) => onChange(e.target.value)}
        title={bawaan ? `Nilai bawaan: ${bawaan}` : 'Nilai bawaan: transparan'}
        className="h-[30px] w-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
      />
      <Input
        id={`${id}_hex`}
        value={draft}
        placeholder={bawaan ?? 'bawaan'}
        maxLength={7}
        className="h-8 w-full min-w-0 font-mono"
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

/** Kontrol angka opsional (px) bergaya stepper: tombol −/+, ketik manual,
 *  dikomit saat blur/Enter, langkah dimulai dari nilai yang tampil (bawaan). */
function AngkaField({
  id,
  label,
  nilai,
  bawaan,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: number;
  bawaan?: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const basis = nilai ?? bawaan ?? min;
  const commit = (raw: string) => {
    setDraft(null);
    const t = raw.trim();
    if (t === '') return onChange(undefined);
    const n = Number(t);
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, Math.round(n))));
  };
  const langkah = (d: number) => {
    setDraft(null);
    onChange(Math.min(max, Math.max(min, Math.round(basis + d))));
  };
  const tampil = draft ?? (nilai != null ? String(nilai) : '');
  const tombol =
    'grid w-7 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="w-20 shrink-0">{label}</Label>
      <div className="flex h-[30px] min-w-0 flex-1 items-stretch overflow-hidden rounded-md border bg-transparent focus-within:ring-2 focus-within:ring-ring/40">
        <button
          type="button"
          id={`${id}_kurang`}
          aria-label={`${label} kurang`}
          title={`${label} −1`}
          disabled={basis <= min}
          onClick={() => langkah(-1)}
          className={tombol}
        >
          <Minus size={12} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={tampil}
          placeholder={bawaan != null ? String(bawaan) : 'bawaan'}
          title={bawaan != null ? `Nilai bawaan: ${bawaan} px` : 'Nilai bawaan tidak terukur'}
          aria-label={label}
          className="h-full w-full min-w-0 border-x bg-transparent px-2 text-center text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft ?? tampil)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          id={`${id}_tambah`}
          aria-label={`${label} tambah`}
          title={`${label} +1`}
          disabled={basis >= max}
          onClick={() => langkah(1)}
          className={tombol}
        >
          <Plus size={12} />
        </button>
      </div>
      <span className="w-4 shrink-0 text-xs text-muted-foreground">px</span>
    </div>
  );
}

/** Editor gaya atomik per bagian UI + pratinjau.
 *  Tipografi & kotak berlaku kedua mode; warna dipisah terang/gelap. */
export default function PartStyleEditor() {
  const { parts, theme, customHex, setGayaBagian, setWarnaBagian, resetBagian, resetSemuaBagian } = useTheme();
  const [mode, setMode] = useState<PartMode>('terang');
  const [aktif, setAktif] = useState<PartId>('ribbon');
  const [cari, setCari] = useState('');
  const [tertutup, setTertutup] = useState<Record<string, boolean>>({});
  const [bawaan, setBawaan] = useState<Bawaan>({});
  const refContoh = useRef<HTMLElement | null>(null);
  const meta = PARTS.find((p) => p.id === aktif) ?? PARTS[0];
  const g = parts.gaya[aktif] ?? TANPA_GAYA;
  const w = parts[mode][aktif] ?? TANPA_WARNA;
  const alihGrup = (nama: string) => setTertutup((prev) => ({ ...prev, [nama]: !prev[nama] }));
  const diatur = (id: PartId) => !!(parts.gaya[id] || parts.terang[id] || parts.gelap[id]);

  // Ukur nilai nyata elemen pratinjau → ditampilkan sebagai nilai "bawaan".
  useLayoutEffect(() => {
    const el = refContoh.current;
    if (!el) return;
    const m = PART_BY_ID.get(aktif);
    const t = (m?.ukurSel ? el.querySelector<HTMLElement>(m.ukurSel) : el.querySelector<HTMLElement>('[class*="text-"]')) ?? el;
    const s = m?.ukurSel ? t : el;
    const cs = getComputedStyle(s);
    const ct = getComputedStyle(t);
    setBawaan({
      font: ct.fontFamily,
      size: px(ct.fontSize),
      bg: warnaSolid(cs.backgroundColor) ?? warnaSolid(ct.backgroundColor),
      fg: warnaSolid(ct.color),
      border: warnaSolid(cs.borderTopColor),
      borderW: px(cs.borderTopWidth),
      radius: px(cs.borderTopLeftRadius),
      padX: px(cs.paddingLeft),
      padY: px(cs.paddingTop),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, mode, theme, customHex, g, w]);

  const grupTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const cocok = q
      ? PARTS.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.hint.toLowerCase().includes(q) ||
            p.grup.toLowerCase().includes(q) ||
            (p.sub ?? '').toLowerCase().includes(q),
        )
      : PARTS;
    return PART_GROUPS.map((nama) => {
      const items = cocok.filter((p) => p.grup === nama);
      const subs: { nama: string; items: typeof items; diatur: number }[] = [];
      for (const p of items) {
        const namaSub = p.sub ?? 'Umum';
        let s = subs.find((x) => x.nama === namaSub);
        if (!s) {
          s = { nama: namaSub, items: [], diatur: 0 };
          subs.push(s);
        }
        s.items.push(p);
        if (diatur(p.id)) s.diatur += 1;
      }
      return {
        nama,
        subs,
        berlapis: subs.length > 1,
        diatur: subs.reduce((n, s) => n + s.diatur, 0),
      };
    }).filter((g) => g.subs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari, mode, parts]);

  const mencari = cari.trim() !== '';
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const jumlahDiatur = useMemo(() => {
    const ids = new Set<string>([
      ...Object.keys(parts.gaya),
      ...Object.keys(parts.terang),
      ...Object.keys(parts.gelap),
    ]);
    return ids.size;
  }, [parts]);
  const gelap = mode === 'gelap';
  /** Wajah tema untuk kanvas pratinjau (mengikuti tab mode yang diedit). */
  const gayaWajah = {
    ...variabelWajah(theme, gelap, customHex),
    ...variabelBagian(aktif, g, w),
  } as unknown as CSSProperties;

  const fontGroups = useMemo(
    () =>
      FONT_GROUPS.map((grp) => ({
        ...grp,
        items: grp.items.map((f) =>
          f.value === FONT_FAMILY_DEFAULT && bawaan.font
            ? { ...f, label: `Bawaan — ${keluargaUtama(bawaan.font)}` }
            : f,
        ),
      })),
    [bawaan.font],
  );

  const contoh = useMemo(() => {
    const el = contohBagian(aktif) as ReactElement<Record<string, unknown>>;
    return cloneElement(el, { 'data-pratinjau-part': '', ref: refContoh });
  }, [aktif]);

  /** Tombol satu bagian (dipakai di dalam sub-kelompok). */
  const tombolBagian = (p: (typeof PARTS)[number]) => (
    <button
      key={p.id}
      id={`btn_bagian_${p.id}`}
      type="button"
      title={p.hint}
      onClick={() => setAktif(p.id)}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
        p.id === aktif ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span className="flex-1 truncate">{p.label}</span>
      {diatur(p.id) && (
        <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Ada pengaturan" />
      )}
    </button>
  );

  return (
    <section className="flex w-full max-w-none flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2 rounded-xl border bg-card p-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="input_cari_bagian"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari bagian…"
              aria-label="Cari bagian"
              className="h-8 pl-7"
            />
          </div>
          {grupTampil.map((gr) => {
            const kunciGrup = `grup:${gr.nama}`;
            const bukaGrup = mencari || !tertutup[kunciGrup];
            return (
              <div key={gr.nama}>
                <button
                  id={`btn_grup_${slug(gr.nama)}`}
                  type="button"
                  aria-expanded={bukaGrup}
                  title={tertutup[kunciGrup] ? `Buka grup ${gr.nama}` : `Tutup grup ${gr.nama}`}
                  onClick={() => alihGrup(kunciGrup)}
                  className="flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-muted"
                >
                  <ChevronDown
                    size={12}
                    className={cn('shrink-0 text-muted-foreground transition-transform', !bukaGrup && '-rotate-90')}
                  />
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {gr.nama}
                  </span>
                  {gr.diatur > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                      {gr.diatur}
                    </Badge>
                  )}
                </button>
                {bukaGrup && (
                  <div className="flex flex-col gap-1 pl-2">
                    {gr.subs.map((sb) => {
                      if (!gr.berlapis) {
                        return (
                          <div key={sb.nama} className="flex flex-col gap-0.5">
                            {sb.items.map(tombolBagian)}
                          </div>
                        );
                      }
                      const kunciSub = `sub:${gr.nama}|${sb.nama}`;
                      const bukaSub = mencari || !tertutup[kunciSub];
                      return (
                        <div key={sb.nama}>
                          <button
                            id={`btn_sub_${slug(gr.nama)}_${slug(sb.nama)}`}
                            type="button"
                            aria-expanded={bukaSub}
                            title={tertutup[kunciSub] ? `Buka sub ${sb.nama}` : `Tutup sub ${sb.nama}`}
                            onClick={() => alihGrup(kunciSub)}
                            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted"
                          >
                            <ChevronDown
                              size={11}
                              className={cn(
                                'shrink-0 text-muted-foreground/80 transition-transform',
                                !bukaSub && '-rotate-90',
                              )}
                            />
                            <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                              {sb.nama}
                            </span>
                            {sb.diatur > 0 && (
                              <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                                {sb.diatur}
                              </Badge>
                            )}
                          </button>
                          {bukaSub && (
                            <div className="flex flex-col gap-0.5 pl-3">{sb.items.map(tombolBagian)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {grupTampil.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">Tidak ada bagian yang cocok.</p>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Pratinjau</span>
                <Badge variant="secondary">{gelap ? 'Mode Gelap' : 'Mode Terang'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Atur warna mode</span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={mode}
                  onValueChange={(v) => { if (v) setMode(v as PartMode); }}
                >
                  <ToggleGroupItem id="btn_bagian_terang" value="terang" title="Atur warna mode terang">
                    <Sun size={14} /> Terang
                  </ToggleGroupItem>
                  <ToggleGroupItem id="btn_bagian_gelap" value="gelap" title="Atur warna mode gelap">
                    <Moon size={14} /> Gelap
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  id="btn_reset_semua_bagian"
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={jumlahDiatur === 0}
                  onClick={resetSemuaBagian}
                >
                  <RotateCcw size={14} /> Reset semua
                </Button>
              </div>
            </div>
            <div
              id="pratinjau_bagian"
              className={cn(
                'grid min-h-[170px] place-items-center overflow-hidden rounded-lg border p-4',
                gelap && 'dark',
              )}
              style={{ ...gayaWajah, background: 'var(--background)', color: 'var(--foreground)' }}
            >
              <style>{bangunCssPratinjau(aktif, g, w)}</style>
              {contoh}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Kanvas mengikuti tab mode warna (Terang/Gelap) dan tema aktif. Tipografi
              & kotak berlaku kedua mode; warna dipisah per mode.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
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
                disabled={!diatur(meta.id)}
                onClick={() => resetBagian(meta.id)}
              >
                <RotateCcw size={14} /> Reset bagian
              </Button>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FieldSet className="gap-2 rounded-lg border p-3">
                <FieldLegend variant="label" className="mb-0">Tipografi</FieldLegend>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="select_font_bagian" className="w-20 shrink-0">Font</Label>
                  <Select
                    value={g.font ?? FONT_FAMILY_DEFAULT}
                    onValueChange={(v) => setGayaBagian(aktif, { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
                  >
                    <SelectTrigger id="select_font_bagian" title="Font bagian" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {fontGroups.map((grp) => (
                        <SelectGroup key={grp.id}>
                          <SelectLabel>{grp.label}</SelectLabel>
                          {grp.items.map((f) => (
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
                  nilai={g.size}
                  bawaan={bawaan.size}
                  min={RENTANG.size[0]}
                  max={RENTANG.size[1]}
                  onChange={(v) => setGayaBagian(aktif, { size: v })}
                />
                <FieldDescription>Berlaku untuk mode terang & gelap.</FieldDescription>
              </FieldSet>

              <FieldSet className="gap-2 rounded-lg border p-3">
                <FieldLegend variant="label" className="mb-0">
                  Warna <span className="font-normal text-muted-foreground">(per mode)</span>
                </FieldLegend>
                <WarnaField
                  id="warna_bg_bagian"
                  label="Latar"
                  nilai={w.bg}
                  bawaan={bawaan.bg}
                  onChange={(v) => setWarnaBagian(mode, aktif, { bg: v })}
                />
                <WarnaField
                  id="warna_fg_bagian"
                  label="Teks"
                  nilai={w.fg}
                  bawaan={bawaan.fg}
                  onChange={(v) => setWarnaBagian(mode, aktif, { fg: v })}
                />
                <WarnaField
                  id="warna_border_bagian"
                  label="Border"
                  nilai={w.border}
                  bawaan={bawaan.border}
                  onChange={(v) => setWarnaBagian(mode, aktif, { border: v })}
                />
                <FieldDescription>
                  Mengikuti tab mode: {gelap ? 'Gelap' : 'Terang'}.
                </FieldDescription>
              </FieldSet>

              <FieldSet className="gap-2 rounded-lg border p-3 md:col-span-2 xl:col-span-1">
                <FieldLegend variant="label" className="mb-0">Kotak</FieldLegend>
                <AngkaField
                  id="input_borderw_bagian"
                  label="Tebal border"
                  nilai={g.borderW}
                  bawaan={bawaan.borderW}
                  min={RENTANG.borderW[0]}
                  max={RENTANG.borderW[1]}
                  onChange={(v) => setGayaBagian(aktif, { borderW: v })}
                />
                <AngkaField
                  id="input_radius_bagian"
                  label="Radius"
                  nilai={g.radius}
                  bawaan={bawaan.radius}
                  min={RENTANG.radius[0]}
                  max={RENTANG.radius[1]}
                  onChange={(v) => setGayaBagian(aktif, { radius: v })}
                />
                <AngkaField
                  id="input_padx_bagian"
                  label="Padding X"
                  nilai={g.padX}
                  bawaan={bawaan.padX}
                  min={RENTANG.padX[0]}
                  max={RENTANG.padX[1]}
                  onChange={(v) => setGayaBagian(aktif, { padX: v })}
                />
                <AngkaField
                  id="input_pady_bagian"
                  label="Padding Y"
                  nilai={g.padY}
                  bawaan={bawaan.padY}
                  min={RENTANG.padY[0]}
                  max={RENTANG.padY[1]}
                  onChange={(v) => setGayaBagian(aktif, { padY: v })}
                />
                <FieldDescription>Berlaku untuk mode terang & gelap.</FieldDescription>
              </FieldSet>
            </div>
            <FieldDescription className="mt-3">
              Nilai abu-abu pada field kosong = nilai nyata saat ini (bawaan),
              terukur dari pratinjau. Bagian bertingkat mengikuti yang paling
              spesifik; bagian <b>kontainer</b> (mis. Ribbon, Kartu, Teks isi) tidak
              menimpa kontrol di dalamnya agar proporsi tetap. Padding Y dan radius
              pada bagian tabel mengikuti geometri grid (tidak berpengaruh).
            </FieldDescription>
          </div>
        </div>
      </div>
    </section>
  );
}
