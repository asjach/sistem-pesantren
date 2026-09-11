import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFS,
  loadPrefs,
  normalizeHex,
  onAccentFor,
  savePrefs,
  type DensityName,
  type ModeName,
  type Prefs,
  type ThemeName,
} from '@/prefs';
import { findPreset } from '@/themes';

interface ThemeState extends Prefs {
  /** true bila dark efektif (mode gelap, atau sistem + OS gelap). */
  dark: boolean;
  setTheme: (t: ThemeName) => void;
  setCustomHex: (hex: string) => void;
  setMode: (m: ModeName) => void;
  setCollapsed: (c: boolean) => void;
  setDensity: (d: DensityName) => void;
}

const Ctx = createContext<ThemeState | null>(null);

function applyPrefs(p: Prefs, osDark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  const dark = p.mode === 'gelap' || (p.mode === 'sistem' && osDark);
  root.classList.toggle('dark', dark);
  if (p.theme === 'kustom') {
    // Kustom: aksen dari picker; kanvas netral dari fallback CSS.
    root.style.setProperty('--accent', p.customHex);
    root.style.setProperty('--on-accent', onAccentFor(p.customHex));
    for (const k of ['--background', '--foreground', '--sidebar', '--sidebar-deep']) {
      root.style.removeProperty(k);
    }
  } else {
    // Preset: seluruh wajah diambil dari data + teks aksen dihitung otomatis.
    const t = findPreset(p.theme);
    const face = dark ? t.gelap : t.terang;
    root.style.setProperty('--accent', face.accent);
    root.style.setProperty('--on-accent', onAccentFor(face.accent));
    root.style.setProperty('--background', face.bg);
    root.style.setProperty('--foreground', face.fg);
    root.style.setProperty('--sidebar', t.sidebar);
    root.style.setProperty('--sidebar-deep', t.sidebarDeep);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [osDark, setOsDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    loadPrefs().then(setPrefs).catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyPrefs(prefs, osDark);
  }, [prefs, osDark]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
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
      setCustomHex: (hex) => {
        const norm = normalizeHex(hex);
        if (norm) update({ customHex: norm, theme: 'kustom' });
      },
      setMode: (mode) => update({ mode }),
      setCollapsed: (collapsed) => update({ collapsed }),
      setDensity: (density) => update({ density }),
    };
  }, [prefs, osDark, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme di luar ThemeProvider');
  return ctx;
}

export { THEME_PRESETS } from '@/themes';
export type { DensityName, ModeName, ThemeName };
