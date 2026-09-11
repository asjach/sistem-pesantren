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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-6">
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

      <section className="w-full max-w-none space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Server backend</h2>
        <p className="text-sm text-muted-foreground">Bawaan: {DEFAULT_API_BASE_URL}</p>
        {err && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
        )}
        <form id="form_server" onSubmit={(e) => { e.preventDefault(); onUji(); }} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="input_base_url">Alamat API backend (tanpa garis miring akhir)</Label>
            <Input
              id="input_base_url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000/api"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button id="btn_uji_server">Simpan & uji koneksi</Button>
            <Button id="btn_reset_server" type="button" variant="outline" onClick={onReset}>
              Kembalikan bawaan
            </Button>
          </div>
        </form>
      </section>

      <section className="w-full max-w-none space-y-4 rounded-xl border bg-card p-5">
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
                    <span className="block flex-1 space-y-1.5 p-3">
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
        <div>
          <div className="mb-2 text-sm font-medium">Mode</div>
          <div className="inline-flex rounded-lg border p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                id={`btn_mode_${m.id}`}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                  mode === m.id ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <m.icon size={15} />
                {m.nama}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Kerapatan baris tabel</div>
          <div className="inline-flex rounded-lg border p-1">
            {DENSITIES.map((d) => (
              <button
                key={d.id}
                id={`btn_density_${d.id}`}
                type="button"
                onClick={() => setDensity(d.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm',
                  density === d.id ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {d.nama}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Berlaku untuk semua tabel. Tinggi tiap baris juga bisa diseret langsung di grid.
          </p>
        </div>
      </section>
    </div>
  );
}
