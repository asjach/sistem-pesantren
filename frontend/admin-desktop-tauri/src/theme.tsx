import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFS,
  RADIUS_DEFAULT,
  RADIUS_MAX,
  RADIUS_MIN,
  bacaPrefsSinkron,
  loadPrefs,
  onAccentFor,
  savePrefs,
  type DensityName,
  type ModeName,
  type NavigasiName,
  type Prefs,
  type ThemeName,
  type WarnaUIName,
} from '@/prefs';
import { findPreset } from '@/themes';
import type { IconSetId } from '@/iconSets';
import { terapkanGayaBagian } from './partStyles';
import { gabungGaya, gabungWarna, type PartGaya, type PartId, type PartMode, type PartOverrides, type PartWarna } from './parts';

interface ThemeState extends Prefs {
  /** true bila dark efektif (mode gelap, atau sistem + OS gelap). */
  dark: boolean;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ModeName) => void;
  setCollapsed: (c: boolean) => void;
  /** Set lebar navigasi kiri (px; sudah dijepit pemanggil). */
  setSidebarLebar: (px: number) => void;
  /** Mode navigasi utama. */
  setNavigasi: (n: NavigasiName) => void;
  setDensity: (d: DensityName) => void;
  /** Sudut membulat global (px; dijepit 0–16 pemanggil). */
  setRadius: (px: number) => void;
  setWarnaUI: (w: WarnaUIName) => void;
  /** Set ikon antarmuka (9 koleksi Iconify). */
  setIconSet: (v: IconSetId) => void;
  /** Tipografi & kotak satu bagian (berlaku kedua mode; `undefined` = hapus). */
  setGayaBagian: (id: PartId, patch: Partial<PartGaya>) => void;
  /** Warna satu bagian untuk mode tertentu (`undefined` = hapus). */
  setWarnaBagian: (mode: PartMode, id: PartId, patch: Partial<PartWarna>) => void;
}

const Ctx = createContext<ThemeState | null>(null);

/** Preferensi tampilan = setelan perangkat pengguna; tidak ada standar lembaga. */
type DevicePrefs = Prefs;

/** Pasang warna satu preset pada <html> untuk mode tertentu. Dipakai jalur
 *  efek (perubahan prefs) DAN jalur boot sinkron — lihat `pasangTemaAwal`. */
export function pasangWarnaTema(themeName: string, dark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = themeName;
  const t = findPreset(themeName);
  const face = dark ? t.gelap : t.terang;
  root.style.setProperty('--accent', face.accent);
  root.style.setProperty('--on-accent', onAccentFor(face.accent));
  root.style.setProperty('--background', face.bg);
  root.style.setProperty('--foreground', face.fg);

  const punyaSidebarKhusus = t.sidebarFg !== undefined || t.sidebarGelap !== undefined;
  if (!dark && !punyaSidebarKhusus) {
    root.style.setProperty('--sidebar', `color-mix(in srgb, ${face.bg} 95%, ${face.fg})`);
    root.style.setProperty('--sidebar-deep', `color-mix(in srgb, ${face.bg} 90%, ${face.fg})`);
    root.style.setProperty('--sidebar-foreground', `color-mix(in srgb, ${face.fg} 75%, ${face.bg})`);
  } else {
    const sbGelap = dark && t.sidebarGelap ? t.sidebarGelap : undefined;
    root.style.setProperty('--sidebar', sbGelap?.sidebar ?? t.sidebar);
    root.style.setProperty('--sidebar-deep', sbGelap?.sidebarDeep ?? t.sidebarDeep);
    root.style.setProperty('--sidebar-foreground', sbGelap?.fg ?? t.sidebarFg ?? '#ffffff');
  }
}

/** Simpan warna hasil tema ke penyimpanan sebagai cache boot. Dibaca skrip
 *  inline `index.html` agar cat pertama sudah sewarna tema (anti kilatan). */
function simpanCacheTema(theme: string, dark: boolean, warna: string, bg: string) {
  try {
    localStorage.setItem('simpes_tema_cache', JSON.stringify({ theme, dark, warna, bg }));
  } catch {

  }
}

function applyPrefs(p: Prefs, osDark: boolean) {
  const dark = p.mode === 'gelap' || (p.mode === 'sistem' && osDark);
  document.documentElement.classList.toggle('dark', dark);

  document.documentElement.dataset.warna = p.warnaUI;

  document.documentElement.style.setProperty('--radius-semua', `${p.radius}px`);
  pasangWarnaTema(p.theme, dark);
  simpanCacheTema(p.theme, dark, p.warnaUI, findPreset(p.theme)[dark ? 'gelap' : 'terang'].bg);

  terapkanGayaBagian(p.parts);
}

export function ThemeProvider({ children }: { children: ReactNode }) {

  const [device, setDevice] = useState<DevicePrefs>(() => bacaPrefsSinkron() ?? DEFAULT_PREFS);
  const [osDark, setOsDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    loadPrefs().then(setDevice).catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const prefs = device;

  useEffect(() => {
    applyPrefs(prefs, osDark);
  }, [prefs, osDark]);

  /** Simpan setelan ke perangkat pengguna. */
  const update = useCallback((patch: Partial<Prefs>) => {
    setDevice((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next).catch(() => {});
      return next;
    });
  }, []);

  /** Ubah `parts` berbasis state terbaru (aman untuk perubahan beruntun). */
  const updateParts = useCallback((fn: (p: PartOverrides) => PartOverrides) => {
    setDevice((prev) => {
      const next = { ...prev, parts: fn(prev.parts) };
      savePrefs(next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeState>(() => {
    const dark = prefs.mode === 'gelap' || (prefs.mode === 'sistem' && osDark);
    return {
      ...prefs,
      dark,
      setTheme: (theme) => update({ theme }),
      setMode: (mode) => update({ mode }),
      setCollapsed: (collapsed) => update({ collapsed }),
      setSidebarLebar: (sidebarLebar) => update({ sidebarLebar }),
      setNavigasi: (navigasi) => update({ navigasi }),
      setDensity: (density) => update({ density }),
      setRadius: (radius) => update({
        radius: Number.isFinite(radius)
          ? Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(radius)))
          : RADIUS_DEFAULT,
      }),
      setWarnaUI: (warnaUI) => update({ warnaUI }),
      setIconSet: (iconSet) => update({ iconSet }),
      setGayaBagian: (id, patch) => {
        updateParts((p) => {
          const map = { ...p.gaya };
          const g = gabungGaya(map[id], patch);
          if (g) map[id] = g;
          else delete map[id];
          return { ...p, gaya: map };
        });
      },
      setWarnaBagian: (mode, id, patch) => {
        updateParts((p) => {
          const map = { ...p[mode] };
          const w = gabungWarna(map[id], patch);
          if (w) map[id] = w;
          else delete map[id];
          return { ...p, [mode]: map };
        });
      },
    };
  }, [prefs, osDark, update, updateParts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme di luar ThemeProvider');
  return ctx;
}

export { THEME_PRESETS } from '@/themes';
export type { DensityName, ModeName, ThemeName, WarnaUIName };
