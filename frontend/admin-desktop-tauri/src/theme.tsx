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
  type WarnaUIName,
} from '@/prefs';
import { findPreset } from '@/themes';
import { FONT_FAMILY_DEFAULT, fontParts } from '@/fonts';
import { terapkanGayaBagian } from './partStyles';
import { gabungGaya, gabungWarna, type PartGaya, type PartId, type PartMode, type PartOverrides, type PartWarna } from './parts';

interface ThemeState extends Prefs {
  /** true bila dark efektif (mode gelap, atau sistem + OS gelap). */
  dark: boolean;
  setTheme: (t: ThemeName) => void;
  setCustomHex: (hex: string) => void;
  setMode: (m: ModeName) => void;
  setCollapsed: (c: boolean) => void;
  setDensity: (d: DensityName) => void;
  setFontUI: (v: string) => void;
  setWarnaUI: (w: WarnaUIName) => void;
  /** Tipografi & kotak satu bagian (berlaku kedua mode; `undefined` = hapus). */
  setGayaBagian: (id: PartId, patch: Partial<PartGaya>) => void;
  /** Warna satu bagian untuk mode tertentu (`undefined` = hapus). */
  setWarnaBagian: (mode: PartMode, id: PartId, patch: Partial<PartWarna>) => void;
  /** Hapus semua pengaturan (gaya + warna kedua mode) satu bagian. */
  resetBagian: (id: PartId) => void;
  resetSemuaBagian: () => void;
}

const Ctx = createContext<ThemeState | null>(null);

function applyPrefs(p: Prefs, osDark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  // Tingkat "kaya warna" UI (dibaca aturan CSS [data-warna=…]).
  root.dataset.warna = p.warnaUI;
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
  // Font antarmuka (UI/UX): ganti --font-sans/--font-display + bobot dasar body.
  // `_bawaan` = ikut font bawaan aplikasi (Aptos) dari index.css.
  if (p.fontUI === FONT_FAMILY_DEFAULT) {
    root.style.removeProperty('--font-sans');
    root.style.removeProperty('--font-display');
    root.style.removeProperty('--font-ui-weight');
  } else {
    const { family, weight } = fontParts(p.fontUI);
    root.style.setProperty('--font-sans', family);
    root.style.setProperty('--font-display', family);
    root.style.setProperty('--font-ui-weight', weight);
  }
  // Gaya atomik per bagian UI (di-generate ke <style id="simpes_part_styles">).
  terapkanGayaBagian(p.parts);
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

  /** Ubah `parts` berbasis state terbaru (aman untuk perubahan beruntun). */
  const updateParts = useCallback((fn: (p: PartOverrides) => PartOverrides) => {
    setPrefs((prev) => {
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
      setCustomHex: (hex) => {
        const norm = normalizeHex(hex);
        if (norm) update({ customHex: norm, theme: 'kustom' });
      },
      setMode: (mode) => update({ mode }),
      setCollapsed: (collapsed) => update({ collapsed }),
      setDensity: (density) => update({ density }),
      setFontUI: (fontUI) => update({ fontUI }),
      setWarnaUI: (warnaUI) => update({ warnaUI }),
      setGayaBagian: (id, patch) => updateParts((p) => {
        const map = { ...p.gaya };
        const g = gabungGaya(map[id], patch);
        if (g) map[id] = g;
        else delete map[id];
        return { ...p, gaya: map };
      }),
      setWarnaBagian: (mode, id, patch) => updateParts((p) => {
        const map = { ...p[mode] };
        const w = gabungWarna(map[id], patch);
        if (w) map[id] = w;
        else delete map[id];
        return { ...p, [mode]: map };
      }),
      resetBagian: (id) => updateParts((p) => {
        const gaya = { ...p.gaya };
        delete gaya[id];
        const terang = { ...p.terang };
        delete terang[id];
        const gelap = { ...p.gelap };
        delete gelap[id];
        return { gaya, terang, gelap };
      }),
      resetSemuaBagian: () => updateParts(() => ({ gaya: {}, terang: {}, gelap: {} })),
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
