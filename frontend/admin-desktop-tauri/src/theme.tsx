import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFS,
  loadPrefs,
  onAccentFor,
  savePrefs,
  type DensityName,
  type ModeName,
  type Prefs,
  type ThemeName,
  type WarnaUIName,
} from '@/prefs';
import { findPreset } from '@/themes';
import type { IconSetId } from '@/iconSets';
import { terapkanGayaBagian } from './partStyles';
import { gabungGaya, gabungWarna, type PartGaya, type PartId, type PartMode, type PartOverrides, type PartWarna } from './parts';
import type { TampilanData } from '@/api/tampilan';
import { useStandarTampilan, type PribadiMap } from '@/standarTampilan';

interface ThemeState extends Prefs {
  /** true bila dark efektif (mode gelap, atau sistem + OS gelap). */
  dark: boolean;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ModeName) => void;
  setCollapsed: (c: boolean) => void;
  setDensity: (d: DensityName) => void;
  setWarnaUI: (w: WarnaUIName) => void;
  /** Set ikon antarmuka (9 koleksi Iconify). */
  setIconSet: (v: IconSetId) => void;
  /** Tipografi & kotak satu bagian (berlaku kedua mode; `undefined` = hapus). */
  setGayaBagian: (id: PartId, patch: Partial<PartGaya>) => void;
  /** Warna satu bagian untuk mode tertentu (`undefined` = hapus). */
  setWarnaBagian: (mode: PartMode, id: PartId, patch: Partial<PartWarna>) => void;
  /** Kembalikan satu bagian ke standar/bawaan (hapus centang pribadi). */
  resetBagian: (id: PartId) => void;
  /** Kembalikan beberapa bagian sekaligus ke standar (mis. satu grup). */
  resetBagianBanyak: (ids: PartId[]) => void;
  resetSemuaBagian: () => void;
}

const Ctx = createContext<ThemeState | null>(null);

/** Setelan pribadi yang tersimpan di perangkat. */
type DevicePrefs = Prefs;

/** Nilai dari standar dipakai bila user belum menandai setelan itu sebagai pribadi. */
function pilihStd(key: string, dev: string, stdVal: string | null | undefined, pribadi: PribadiMap): string {
  return pribadi[key] || stdVal == null || stdVal === '' ? dev : stdVal;
}

function gabungParts(dev: PartOverrides, std: TampilanData['parts'] | undefined, pribadi: PribadiMap): PartOverrides {
  const out: PartOverrides = { gaya: {}, terang: {}, gelap: {} };
  const perMode = (m: 'gaya' | 'terang' | 'gelap') => {
    const stdMap = (std?.[m] ?? {}) as Record<string, object>;
    const devMap = (dev[m] ?? {}) as Record<string, object>;
    const target = out[m] as unknown as Record<string, object>;
    for (const [id, val] of Object.entries(stdMap)) {
      if (val && !pribadi[`parts.${m}.${id}`]) target[id] = val;
    }
    for (const [id, val] of Object.entries(devMap)) {
      if (val && pribadi[`parts.${m}.${id}`]) target[id] = val;
    }
  };
  perMode('gaya');
  perMode('terang');
  perMode('gelap');

  return out;
}

/** Preferensi efektif = pribadi (jika ada) ⊕ standar lembaga ⊕ bawaan aplikasi. */
function gabungPrefs(dev: DevicePrefs, std: TampilanData | null, pribadi: PribadiMap): Prefs {
  const t = std?.tema ?? {};
  return {
    theme: pilihStd('tema.theme', dev.theme, t.theme, pribadi) as ThemeName,
    mode: pilihStd('tema.mode', dev.mode, t.mode, pribadi) as ModeName,
    density: pilihStd('tema.density', dev.density, t.density, pribadi) as DensityName,
    warnaUI: pilihStd('tema.warnaUI', dev.warnaUI, t.warnaUI, pribadi) as WarnaUIName,
    iconSet: pilihStd('tema.iconSet', dev.iconSet, t.iconSet, pribadi) as IconSetId,
    // Tata letak sidebar selalu milik perangkat, bukan standar.
    collapsed: dev.collapsed,
    parts: gabungParts(dev.parts, std?.parts, pribadi),
  };
}

function applyPrefs(p: Prefs, osDark: boolean) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  // Tingkat "kaya warna" UI (dibaca aturan CSS [data-warna=…]).
  root.dataset.warna = p.warnaUI;
  const dark = p.mode === 'gelap' || (p.mode === 'sistem' && osDark);
  root.classList.toggle('dark', dark);
  // Preset: seluruh wajah diambil dari data + teks aksen dihitung otomatis.
  const t = findPreset(p.theme);
  const face = dark ? t.gelap : t.terang;
  root.style.setProperty('--accent', face.accent);
  root.style.setProperty('--on-accent', onAccentFor(face.accent));
  root.style.setProperty('--background', face.bg);
  root.style.setProperty('--foreground', face.fg);
  root.style.setProperty('--sidebar', t.sidebar);
  root.style.setProperty('--sidebar-deep', t.sidebarDeep);
  // Gaya atomik per bagian UI (di-generate ke <style id="simpes_part_styles">).
  terapkanGayaBagian(p.parts);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { tampilan: standar, pribadi, tandai, hapus, bertindak, simpanKeStandar } = useStandarTampilan();
  const [device, setDevice] = useState<DevicePrefs>(DEFAULT_PREFS);
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

  // Saat bertindak sebagai lembaga, tampilan murni mengikuti standar lembaga
  // (override pribadi diabaikan) agar yang terlihat = yang sedang diatur.
  const prefs = useMemo(
    () => gabungPrefs(device, standar, bertindak ? {} : pribadi),
    [device, standar, pribadi, bertindak],
  );

  useEffect(() => {
    applyPrefs(prefs, osDark);
  }, [prefs, osDark]);

  /** Simpan setelan pribadi + tandai agar tidak ditimpa standar. Saat bertindak
   *  sebagai lembaga, perubahan langsung disimpan ke standar lembaga itu. */
  const update = useCallback((patch: Partial<Prefs>, kunci: string[]) => {
    if (bertindak && kunci.length > 0) {
      hapus(...kunci);
      const tema: TampilanData['tema'] = {};
      if ('theme' in patch) tema.theme = patch.theme;
      if ('mode' in patch) tema.mode = patch.mode;
      if ('density' in patch) tema.density = patch.density;
      if ('warnaUI' in patch) tema.warnaUI = patch.warnaUI;
      if ('iconSet' in patch) tema.iconSet = patch.iconSet;
      if (Object.keys(tema).length > 0) simpanKeStandar({ tema });
      return;
    }
    setDevice((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next).catch(() => {});
      return next;
    });
    if (kunci.length > 0) tandai(...kunci);
  }, [bertindak, hapus, simpanKeStandar, tandai]);

  /** Ubah `parts` berbasis state terbaru (aman untuk perubahan beruntun). */
  const updateParts = useCallback((fn: (p: PartOverrides) => PartOverrides, kunci: string[]) => {
    setDevice((prev) => {
      const next = { ...prev, parts: fn(prev.parts) };
      savePrefs(next).catch(() => {});
      return next;
    });
    if (kunci.length > 0) tandai(...kunci);
  }, [tandai]);

  const value = useMemo<ThemeState>(() => {
    const dark = prefs.mode === 'gelap' || (prefs.mode === 'sistem' && osDark);
    return {
      ...prefs,
      dark,
      setTheme: (theme) => update({ theme }, ['tema.theme']),
      setMode: (mode) => update({ mode }, ['tema.mode']),
      setCollapsed: (collapsed) => update({ collapsed }, []),
      setDensity: (density) => update({ density }, ['tema.density']),
      setWarnaUI: (warnaUI) => update({ warnaUI }, ['tema.warnaUI']),
      setIconSet: (iconSet) => update({ iconSet }, ['tema.iconSet']),
      setGayaBagian: (id, patch) => {
        if (bertindak) {
          hapus(`parts.gaya.${id}`);
          const g = gabungGaya(standar?.parts?.gaya?.[id] as PartGaya | undefined, patch);
          simpanKeStandar({
            parts: { gaya: { [id]: g as unknown as Record<string, unknown> } },
          });
          return;
        }
        updateParts((p) => {
          const map = { ...p.gaya };
          const g = gabungGaya(map[id], patch);
          if (g) map[id] = g;
          else delete map[id];
          return { ...p, gaya: map };
        }, [`parts.gaya.${id}`]);
      },
      setWarnaBagian: (mode, id, patch) => {
        if (bertindak) {
          hapus(`parts.${mode}.${id}`);
          const w = gabungWarna(standar?.parts?.[mode]?.[id] as PartWarna | undefined, patch);
          simpanKeStandar({
            parts: { [mode]: { [id]: w as unknown as Record<string, unknown> } },
          });
          return;
        }
        updateParts((p) => {
          const map = { ...p[mode] };
          const w = gabungWarna(map[id], patch);
          if (w) map[id] = w;
          else delete map[id];
          return { ...p, [mode]: map };
        }, [`parts.${mode}.${id}`]);
      },
      resetBagian: (id) => {
        hapus(`parts.gaya.${id}`, `parts.terang.${id}`, `parts.gelap.${id}`);
        if (bertindak) {
          simpanKeStandar({ parts: { gaya: { [id]: null }, terang: { [id]: null }, gelap: { [id]: null } } });
          return;
        }
        updateParts((p) => {
          const gaya = { ...p.gaya };
          delete gaya[id];
          const terang = { ...p.terang };
          delete terang[id];
          const gelap = { ...p.gelap };
          delete gelap[id];
          return { gaya, terang, gelap };
        }, []);
      },
      resetBagianBanyak: (ids) => {
        hapus(...ids.flatMap((id) => [`parts.gaya.${id}`, `parts.terang.${id}`, `parts.gelap.${id}`]));
        if (bertindak) {
          const nullMap = () => Object.fromEntries(ids.map((id) => [id, null]));
          simpanKeStandar({ parts: { gaya: nullMap(), terang: nullMap(), gelap: nullMap() } });
          return;
        }
        updateParts((p) => {
          const gaya = { ...p.gaya };
          const terang = { ...p.terang };
          const gelap = { ...p.gelap };
          for (const id of ids) {
            delete gaya[id];
            delete terang[id];
            delete gelap[id];
          }
          return { gaya, terang, gelap };
        }, []);
      },
      resetSemuaBagian: () => {
        hapus(...Object.keys(pribadi).filter((k) => k.startsWith('parts.')));
        if (bertindak) {
          const kumpul = new Set([
            ...Object.keys(standar?.parts?.gaya ?? {}),
            ...Object.keys(standar?.parts?.terang ?? {}),
            ...Object.keys(standar?.parts?.gelap ?? {}),
          ]);
          const nullMap = () => Object.fromEntries([...kumpul].map((id) => [id, null]));
          simpanKeStandar({ parts: { gaya: nullMap(), terang: nullMap(), gelap: nullMap() } });
          return;
        }
        updateParts(() => ({ gaya: {}, terang: {}, gelap: {} }), []);
      },
    };
  }, [prefs, osDark, update, updateParts, hapus, pribadi, bertindak, simpanKeStandar, standar]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme di luar ThemeProvider');
  return ctx;
}

export { THEME_PRESETS } from '@/themes';
export type { DensityName, ModeName, ThemeName, WarnaUIName };
