import { useEffect, useState } from 'react';
import {
  DEFAULT_API_BASE_URL,
  errorMessage,
  getBaseUrl,
  isTauri,
  resetBaseUrl,
  setBaseUrl,
  api,
} from '../api/client';
import { useTheme, type DensityName, type ModeName, type ThemeName } from '@/theme';
import { THEME_PRESETS } from '@/themes';
import { normalizeHex, onAccentFor } from '@/prefs';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import PageHeader from '@/components/PageHeader';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Base URL backend bisa diganti runtime (lokal dulu, server belakangan)
// tanpa rebuild binary. Disimpan di plugin-store (desktop) / localStorage (web).
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

export default function PengaturanPage() {
  const [url, setUrl] = useState('');
  const [aktif, setAktif] = useState('');
  const [err, setErr] = useState('');
  const { theme, mode, customHex, dark, density, setTheme, setMode, setCustomHex, setDensity } = useTheme();
  const [customInput, setCustomInput] = useState(customHex);

  useEffect(() => {
    getBaseUrl().then((b) => { setAktif(b); setUrl(b); }).catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    setCustomInput(customHex);
  }, [customHex]);

  async function onUji() {
    setErr('');
    try {
      await setBaseUrl(url);
      const me = await api<{ name: string }>('/auth/me');
      setAktif(await getBaseUrl());
      toast.success(`Terhubung sebagai ${me.name}.`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onReset() {
    await resetBaseUrl();
    const b = await getBaseUrl();
    setAktif(b); setUrl(b);
    toast.success(`Kembali ke bawaan (${DEFAULT_API_BASE_URL}).`);
  }

  function onPickTheme(t: string) {
    setTheme(t as ThemeName);
  }

  function onCustomColor(v: string) {
    setCustomInput(v);
    if (normalizeHex(v)) setCustomHex(v);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titleId="title_pengaturan"
        title="Pengaturan"
        className="mb-0"
        description={(
          <>
            Aktif: <b className="text-foreground">{aktif}</b> · Mode:{' '}
            <Badge variant="secondary">{isTauri() ? 'desktop' : 'web'}</Badge>
          </>
        )}
      />

      <section className="flex w-full max-w-none flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Server backend</h2>
        <p className="text-sm text-muted-foreground">Bawaan: {DEFAULT_API_BASE_URL}</p>
        {err && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
        )}
        <form id="form_server" onSubmit={(e) => { e.preventDefault(); onUji(); }} className="flex flex-col gap-3">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="input_base_url">Alamat API backend (tanpa garis miring akhir)</FieldLabel>
              <Input
                id="input_base_url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/api"
                required
              />
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button id="btn_uji_server">Simpan & uji koneksi</Button>
            <Button id="btn_reset_server" type="button" variant="outline" onClick={onReset}>
              Kembalikan bawaan
            </Button>
          </div>
        </form>
      </section>

      <section className="flex w-full max-w-none flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Tampilan</h2>
        <div>
          <div className="mb-2 text-sm font-medium">Tema warna ({THEME_PRESETS.length})</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_PRESETS.map((t) => {
              const face = dark ? t.gelap : t.terang;
              const teksAksen = onAccentFor(face.accent);
              const aktif = theme === t.id;
              return (
                <button
                  key={t.id}
                  id={`select_tema_${t.id}`}
                  type="button"
                  onClick={() => onPickTheme(t.id)}
                  title={t.nama}
                  className={cn(
                    'overflow-hidden rounded-lg border text-left transition',
                    aktif ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/50',
                  )}
                >
                  {/* Pratinjau mini ala VSCode: strip sidebar + latar tema + contoh UI. */}
                  <span className="flex" style={{ background: face.bg, color: face.fg }}>
                    <span className="w-4 shrink-0" style={{ background: t.sidebar }} />
                    <span className="flex flex-1 flex-col gap-1.5 p-3">
                      <span className="flex items-center justify-between text-[11px] opacity-80">
                        <span>{t.nama}</span>
                        {aktif && <Check size={13} />}
                      </span>
                      <span className="block h-1.5 w-3/4 rounded-full opacity-30" style={{ background: face.fg }} />
                      <span className="block h-1.5 w-1/2 rounded-full opacity-20" style={{ background: face.fg }} />
                      <span className="flex items-center gap-1.5 pt-1">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: face.accent, color: teksAksen }}
                        >
                          Tombol
                        </span>
                        <span
                          className="inline-block rounded px-2 py-0.5 text-[10px]"
                          style={{ background: face.bg, color: face.fg, border: `1px solid ${face.accent}` }}
                        >
                          Badge
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Label htmlFor="input_warna_kustom">Warna kustom</Label>
            <input
              id="input_warna_kustom"
              type="color"
              value={normalizeHex(customInput) ?? customHex}
              onChange={(e) => onCustomColor(e.target.value)}
              className="h-6 w-14 cursor-pointer rounded-md border bg-card p-1"
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
          <p className="mt-1 text-xs text-muted-foreground">
            Kontras teks di atas aksen dijaga otomatis (≥4.5:1).
          </p>
        </div>
        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="mb-0">Mode</FieldLegend>
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
        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="mb-0">Kerapatan baris tabel</FieldLegend>
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
      </section>
    </div>
  );
}
