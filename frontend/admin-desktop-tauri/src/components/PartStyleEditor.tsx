import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTheme } from '@/theme';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS, type FontOption } from '@/fonts';
import { PARTS, PART_GROUPS, RENTANG, type PartId, type PartMode } from '@/parts';
import { normalizeHex } from '@/prefs';
import { bangunCssPratinjau, variabelBagian, variabelWajah } from '@/partStyles';
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
import { ChevronDown, Moon, RotateCcw, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const FONT_GROUPS: { id: string; label: string; items: FontOption[] }[] = [
  { id: 'sistem', label: 'Sistem & bawaan', items: FONT_OPTIONS.filter((f) => f.group === 'sistem') },
  { id: 'aptos', label: 'Aptos (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'aptos') },
  { id: 'google', label: 'Google Fonts (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'google') },
];

/** Contoh isi pratinjau per bagian (meniru markup asli agar gaya terbaca). */
function ContohBagian({ id }: { id: PartId }) {
  switch (id) {
    case 'ribbon':
    case 'tab_ribbon':
      return (
        <div className="flex gap-1 rounded bg-[var(--sidebar-deep)] p-2">
          <span className="rounded-t-md bg-white/20 px-3 py-1 text-xs font-semibold text-white">Beranda</span>
          <span className="rounded-t-md px-3 py-1 text-xs text-white/70">Master</span>
          <span className="rounded-t-md px-3 py-1 text-xs text-white/70">PSB</span>
        </div>
      );
    case 'grup_ribbon':
    case 'menu_ribbon':
      return (
        <div className="flex items-end gap-2 rounded bg-[var(--sidebar-deep)] p-2">
          <span className="flex h-[48px] w-[64px] items-center justify-center rounded bg-white/20 text-[11px] font-semibold text-white">Santri</span>
          <span className="flex h-[48px] w-[64px] items-center justify-center rounded text-[11px] text-white/80">Kelas</span>
          <span className="pb-1 text-[10px] uppercase tracking-wide text-white/50">Grup</span>
        </div>
      );
    case 'judul_halaman':
      return <h2 className="text-lg font-semibold">Data Santri</h2>;
    case 'subjudul':
      return <h3 className="text-sm font-semibold">Ringkasan Keuangan</h3>;
    case 'teks_isi':
      return (
        <p className="max-w-md text-center text-sm">
          Total santri aktif tahun ajaran ini bertambah 24 orang dari periode sebelumnya.
        </p>
      );
    case 'kartu':
      return (
        <section className="w-full max-w-sm rounded-xl border bg-card p-3">
          <div className="text-sm font-medium">Ringkasan</div>
          <p className="text-sm text-muted-foreground">12 kelas · 345 santri aktif</p>
        </section>
      );
    case 'badge':
      return (
        <div className="flex gap-1.5">
          <Badge>Aktif</Badge>
          <Badge variant="secondary">Sekunder</Badge>
          <Badge variant="outline">Nonaktif</Badge>
        </div>
      );
    case 'tabel_header':
      return (
        <div className="simpes-dsg w-full max-w-sm overflow-hidden rounded border">
          <div className="dsg-row dsg-row-header flex">
            {['Nama', 'Kelas', 'Status'].map((t) => (
              <div
                key={t}
                className="dsg-cell dsg-cell-header flex flex-1 items-center justify-center"
                style={{ borderRight: '1px solid var(--dsg-border-color)' }}
              >
                <div
                  className="dsg-cell-header-container py-1"
                  style={{ color: 'var(--dsg-header-text-color, var(--muted-foreground))' }}
                >
                  {t}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'tabel_sel':
      return (
        <div className="simpes-dsg w-full max-w-sm overflow-hidden rounded border">
          {[
            ['Ahmad Fauzi', 'VII-A', 'Aktif'],
            ['Siti Aminah', 'VIII-B', 'Aktif'],
          ].map((baris) => (
            <div key={baris[0]} className="dsg-row flex">
              {baris.map((t) => (
                <div
                  key={t}
                  className="dsg-cell simpes-dsg-fill flex-1 py-1"
                  style={{
                    background: 'var(--dsg-cell-background-color)',
                    color: 'var(--part-tabel_sel-fg, var(--foreground))',
                    borderTop: '1px solid var(--dsg-border-color)',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case 'pager':
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded border px-1.5 py-0.5">‹</span>
          <span>Hal 1 / 4 · 345 data</span>
          <span className="rounded border px-1.5 py-0.5">›</span>
        </div>
      );
    case 'toolbar_tabel':
      return (
        <div className="flex w-full max-w-md flex-wrap items-center gap-2 rounded border bg-card p-2">
          <span className="rounded border px-2 py-1 text-xs">Cari…</span>
          <span className="text-xs text-muted-foreground">2 baris dipilih</span>
          <span className="ml-auto rounded border bg-primary px-2 py-1 text-xs text-primary-foreground">＋ Tambah</span>
        </div>
      );
    case 'tombol':
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm">Simpan</Button>
          <Button size="sm" variant="secondary">Batal</Button>
          <Button size="sm" variant="outline">Filter</Button>
          <Button size="sm" variant="destructive">Hapus</Button>
        </div>
      );
    case 'label_form':
      return (
        <div className="flex flex-col gap-1">
          <Label>Nama lengkap</Label>
          <span className="text-xs text-muted-foreground">Label di atas kotak isian.</span>
        </div>
      );
    case 'input_form':
      return (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Input placeholder="Nama santri" />
          <div
            data-slot="select-trigger"
            className="flex h-[30px] items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm"
          >
            VII-A <span className="text-muted-foreground">▾</span>
          </div>
        </div>
      );
    case 'dropdown':
      return (
        <div className="w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="rounded px-2 py-1.5 text-sm">Ubah</div>
          <div className="rounded bg-accent px-2 py-1.5 text-sm text-accent-foreground">Lihat detail</div>
          <div className="rounded px-2 py-1.5 text-sm text-destructive">Hapus</div>
        </div>
      );
    case 'dialog':
      return (
        <div className="w-full max-w-xs rounded-lg border bg-background p-4 shadow-lg">
          <div className="font-semibold">Tambah Santri</div>
          <p className="text-sm text-muted-foreground">Lengkapi data lalu simpan.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline">Batal</Button>
            <Button size="sm">Simpan</Button>
          </div>
        </div>
      );
  }
}

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
    <div className="flex items-center gap-1.5">
      <Label htmlFor={`${id}_picker`} className="w-14 shrink-0">{label}</Label>
      <input
        id={`${id}_picker`}
        type="color"
        value={nilai ?? '#808080'}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="h-[30px] w-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
      />
      <Input
        id={`${id}_hex`}
        value={draft}
        placeholder="bawaan"
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
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="w-20 shrink-0">{label}</Label>
      <Input
        key={`${id}:${nilai ?? ''}`}
        id={id}
        type="number"
        min={min}
        max={max}
        defaultValue={nilai ?? ''}
        placeholder="bawaan"
        className="h-8 w-full min-w-0"
        onBlur={(e) => {
          const v = e.target.value.trim();
          onChange(v === '' ? undefined : Number(v));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="w-4 shrink-0 text-xs text-muted-foreground">px</span>
    </div>
  );
}

/** Editor gaya atomik per bagian UI (terpisah mode terang/gelap) + pratinjau. */
export default function PartStyleEditor() {
  const { parts, theme, customHex, setPart, resetPart, resetParts } = useTheme();
  const [mode, setMode] = useState<PartMode>('terang');
  const [aktif, setAktif] = useState<PartId>('ribbon');
  const [cari, setCari] = useState('');
  const [tertutup, setTertutup] = useState<Record<string, boolean>>({});
  const alihGrup = (nama: string) => setTertutup((prev) => ({ ...prev, [nama]: !prev[nama] }));
  const meta = PARTS.find((p) => p.id === aktif) ?? PARTS[0];
  const s = parts[mode][aktif] ?? {};
  const angka = (k: keyof typeof RENTANG) =>
    (v: number | undefined) => setPart(mode, aktif, { [k]: v });

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
        if (parts[mode][p.id]) s.diatur += 1;
      }
      return {
        nama,
        subs,
        berlapis: subs.length > 1,
        diatur: subs.reduce((n, s) => n + s.diatur, 0),
      };
    }).filter((g) => g.subs.length > 0);
  }, [cari, mode, parts]);

  const mencari = cari.trim() !== '';
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const jumlahDiatur = Object.keys(parts[mode]).length;
  const gelap = mode === 'gelap';
  /** Wajah tema untuk kanvas pratinjau (mengikuti tab mode yang diedit). */
  const gayaWajah = {
    ...variabelWajah(theme, gelap, customHex),
  } as unknown as CSSProperties;

  /** Tombol satu bagian (dipakai di dalam sub-kelompok). */
  const tombolBagian = (p: (typeof PARTS)[number]) => {
    const diatur = !!parts[mode][p.id];
    return (
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
        {diatur && (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Ada pengaturan" />
        )}
      </button>
    );
  };

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
          {grupTampil.map((g) => {
            const kunciGrup = `grup:${g.nama}`;
            const bukaGrup = mencari || !tertutup[kunciGrup];
            return (
              <div key={g.nama}>
                <button
                  id={`btn_grup_${slug(g.nama)}`}
                  type="button"
                  aria-expanded={bukaGrup}
                  title={tertutup[kunciGrup] ? `Buka grup ${g.nama}` : `Tutup grup ${g.nama}`}
                  onClick={() => alihGrup(kunciGrup)}
                  className="flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-muted"
                >
                  <ChevronDown
                    size={12}
                    className={cn(
                      'shrink-0 text-muted-foreground transition-transform',
                      !bukaGrup && '-rotate-90',
                    )}
                  />
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.nama}
                  </span>
                  {g.diatur > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                      {g.diatur}
                    </Badge>
                  )}
                </button>
                {bukaGrup && (
                  <div className="flex flex-col gap-1 pl-2">
                    {g.subs.map((sb) => {
                      if (!g.berlapis) {
                        return (
                          <div key={sb.nama} className="flex flex-col gap-0.5">
                            {sb.items.map(tombolBagian)}
                          </div>
                        );
                      }
                      const kunciSub = `sub:${g.nama}|${sb.nama}`;
                      const bukaSub = mencari || !tertutup[kunciSub];
                      return (
                        <div key={sb.nama}>
                          <button
                            id={`btn_sub_${slug(g.nama)}_${slug(sb.nama)}`}
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
                            <div className="flex flex-col gap-0.5 pl-3">
                              {sb.items.map(tombolBagian)}
                            </div>
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
                <Badge variant="secondary">{mode === 'gelap' ? 'Mode Gelap' : 'Mode Terang'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Atur mode</span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  spacing={0}
                  value={mode}
                  onValueChange={(v) => { if (v) setMode(v as PartMode); }}
                >
                  <ToggleGroupItem id="btn_bagian_terang" value="terang" title="Atur mode terang">
                    <Sun size={14} /> Terang
                  </ToggleGroupItem>
                  <ToggleGroupItem id="btn_bagian_gelap" value="gelap" title="Atur mode gelap">
                    <Moon size={14} /> Gelap
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  id="btn_reset_semua_bagian"
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={jumlahDiatur === 0}
                  onClick={resetParts}
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
              <style>{bangunCssPratinjau(aktif, s)}</style>
              <div
                data-pratinjau-part
                className="flex w-full justify-center"
                style={variabelBagian(aktif, s) as unknown as CSSProperties}
              >
                <ContohBagian id={aktif} />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pratinjau mengikuti tab mode yang sedang diedit dan tema aktif — kanvas
              ikut mode Terang/Gelap, bukan mode global aplikasi.
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
                disabled={!parts[mode][meta.id]}
                onClick={() => resetPart(mode, meta.id)}
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
                    value={s.font ?? FONT_FAMILY_DEFAULT}
                    onValueChange={(v) => setPart(mode, aktif, { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
                  >
                    <SelectTrigger id="select_font_bagian" title="Font bagian" className="w-full min-w-0">
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
              </FieldSet>

              <FieldSet className="gap-2 rounded-lg border p-3">
                <FieldLegend variant="label" className="mb-0">Warna</FieldLegend>
                <WarnaField id="warna_bg_bagian" label="Latar" nilai={s.bg} onChange={(v) => setPart(mode, aktif, { bg: v })} />
                <WarnaField id="warna_fg_bagian" label="Teks" nilai={s.fg} onChange={(v) => setPart(mode, aktif, { fg: v })} />
                <WarnaField id="warna_border_bagian" label="Border" nilai={s.border} onChange={(v) => setPart(mode, aktif, { border: v })} />
              </FieldSet>

              <FieldSet className="gap-2 rounded-lg border p-3 md:col-span-2 xl:col-span-1">
                <FieldLegend variant="label" className="mb-0">Kotak</FieldLegend>
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
              </FieldSet>
            </div>
            <FieldDescription className="mt-3">
              Bagian bertingkat mengikuti yang paling spesifik: mis. gaya Tab ribbon
              tidak tertimpa gaya Bilah ribbon. Bagian <b>kontainer</b> (mis. Ribbon,
              Kartu, Teks isi) tidak menimpa ukuran/jenis huruf tombol, input, label,
              dan badge di dalamnya — atur kontrol lewat bagian Kontrol/Overlay agar
              proporsinya tetap. Padding Y dan radius pada bagian tabel mengikuti
              geometri grid (tidak berpengaruh).
            </FieldDescription>
          </div>
        </div>
      </div>
    </section>
  );
}
